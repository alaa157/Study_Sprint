from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.modules.identity.models import User
from .models import Group

GROUP_SIZE = 4


def score(a: User, b: User) -> int:
    s = len(set(a.subjects or []) & set(b.subjects or [])) * 3
    s += len(set(a.goals or []) & set(b.goals or [])) * 2
    if a.timezone == b.timezone:
        s += 2
    return s


def _view(group: Group, status: str) -> dict:
    return {
        "id": group.id,
        "member_count": group.member_count,
        "max_members": group.max_members,
        "status": status,
    }


def _place(db: Session, user: User, group: Group) -> dict:
    group.member_count = db.query(User).filter_by(group_id=group.id).count() + 1
    user.group_id = group.id
    db.commit()
    db.refresh(group)
    return _view(group, "matched")


def propose_group(db: Session, user: User) -> dict:
    db.refresh(user)
    if user.group_id is not None:
        group = db.query(Group).filter_by(id=user.group_id).first()
        if group is not None:
            return _view(group, "matched")

    open_groups = (
        db.query(Group)
        .filter(Group.member_count < Group.max_members)
        .with_for_update()
        .all()
    )
    best: Group | None = None
    best_avg = -1.0
    for group in open_groups:
        members = [m for m in db.query(User).filter_by(group_id=group.id).all() if m.id != user.id]
        avg = sum(score(user, m) for m in members) / len(members) if members else 0.0
        if avg > best_avg:
            best, best_avg = group, avg

    if best is not None:
        return _place(db, user, best)

    group = Group(
        created_by=user.id,
        subject=",".join(user.subjects or []),
        goal=",".join(user.goals or []),
        timezone=user.timezone,
        member_count=0,
        max_members=GROUP_SIZE,
    )
    db.add(group)
    db.flush()  # assign id before placing the founder
    user.group_id = group.id
    group.member_count = 1
    db.commit()
    db.refresh(group)
    return _view(group, "queued")


def join_group(db: Session, user: User, group_id: int) -> dict:
    db.refresh(user)
    group = db.query(Group).filter_by(id=group_id).with_for_update().first()
    if group is None:
        raise HTTPException(404, "GroupNotFound")
    if user.group_id == group.id:
        return _view(group, "matched")
    count = db.query(User).filter_by(group_id=group.id).count()
    if count >= group.max_members:
        raise HTTPException(409, "GroupFull")
    return _place(db, user, group)
