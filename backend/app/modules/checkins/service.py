from datetime import date, timedelta
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.modules.identity.models import User
from app.modules.matching import service as matching
from app.shared.clock import Clock, SystemClock
from app.shared.errors import (
    AlreadyPromised,
    FutureDate,
    GroupNotFound,
    NotGroupMember,
    PromiseNotFound,
)
from .models import Completion, Promise


def promise_today(
    db: Session, user: User, text: str, day: date, clock: Clock | None = None
) -> Promise:
    clock = clock or SystemClock()
    if day > clock.today(user.timezone):
        raise FutureDate()
    if db.query(Promise).filter_by(user_id=user.id, date=day).first():
        raise AlreadyPromised()
    promise = Promise(user_id=user.id, date=day, text=text)
    db.add(promise)
    try:
        db.commit()
    except IntegrityError:
        # Lost a concurrent double-promise race; same outcome as pre-check.
        db.rollback()
        raise AlreadyPromised()
    db.refresh(promise)
    return promise


def complete_today(
    db: Session, user: User, day: date, clock: Clock | None = None
) -> Promise:
    clock = clock or SystemClock()
    if day > clock.today(user.timezone):
        raise FutureDate()
    promise = db.query(Promise).filter_by(user_id=user.id, date=day).first()
    if promise is None:
        raise PromiseNotFound()
    db.add(Completion(user_id=user.id, date=day))
    try:
        db.commit()
    except IntegrityError:
        # Already completed: completing is idempotent, keep the first record.
        db.rollback()
    db.refresh(promise)
    return promise


def _completed_dates(db: Session, user_id: int) -> set[date]:
    rows = db.query(Completion.date).filter_by(user_id=user_id).all()
    return {r[0] for r in rows}


def get_streak(db: Session, user: User, clock: Clock | None = None) -> int:
    clock = clock or SystemClock()
    done = _completed_dates(db, user.id)
    day = clock.today(user.timezone)
    streak = 0
    while day in done:
        streak += 1
        day -= timedelta(days=1)
    return streak


def done_on(db: Session, user: User, day: date) -> bool:
    return (
        db.query(Completion)
        .filter_by(user_id=user.id, date=day)
        .first()
        is not None
    )


def scoreboard(db: Session, reader: User, group_id: int, clock: Clock | None = None) -> list[dict]:
    clock = clock or SystemClock()
    group = matching.get_group(db, group_id)
    if group is None:
        raise GroupNotFound()
    if matching.member_group_id(db, reader.id) != group.id:
        raise NotGroupMember()
    board = []
    for member in matching.group_members(db, group.id):
        today = clock.today(member.timezone)
        board.append(
            {
                "email": member.email,
                "streak": get_streak(db, member, clock),
                "done_today": done_on(db, member, today),
            }
        )
    return board
