from datetime import date, timedelta
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.modules.identity.models import User
from app.modules.matching import service as matching
from app.shared.clock import Clock, SystemClock
from .models import Promise


def promise_today(db: Session, user: User, text: str, day: date) -> Promise:
    if db.query(Promise).filter_by(user_id=user.id, date=day).first():
        raise HTTPException(409, "AlreadyPromised")
    promise = Promise(user_id=user.id, date=day, text=text, completed=False)
    db.add(promise)
    try:
        db.commit()
    except IntegrityError:
        # Lost a concurrent double-promise race; same outcome as pre-check.
        db.rollback()
        raise HTTPException(409, "AlreadyPromised")
    db.refresh(promise)
    return promise


def complete_today(
    db: Session, user: User, day: date, clock: Clock | None = None
) -> Promise:
    promise = db.query(Promise).filter_by(user_id=user.id, date=day).first()
    if promise is None:
        raise HTTPException(404, "PromiseNotFound")
    promise.completed = True
    db.commit()
    db.refresh(promise)
    return promise


def _completed_dates(db: Session, user_id: int) -> set[date]:
    rows = db.query(Promise.date).filter_by(user_id=user_id, completed=True).all()
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
        db.query(Promise)
        .filter_by(user_id=user.id, date=day, completed=True)
        .first()
        is not None
    )


def scoreboard(db: Session, group_id: int, clock: Clock | None = None) -> list[dict]:
    clock = clock or SystemClock()
    group = matching.get_group(db, group_id)
    if group is None:
        raise HTTPException(404, "GroupNotFound")
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
