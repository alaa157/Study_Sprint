from typing import Literal
from fastapi import HTTPException
from sqlalchemy import update
from sqlalchemy.orm import Session
from app.modules.identity.models import User
from .models import Group

GROUP_SIZE = 4
QUORUM_MIN = 3

GroupStatus = Literal["queued", "matched"]


def compatibility_score(a: User, b: User) -> int:
    total = len(set(a.subjects or []) & set(b.subjects or [])) * 3
    total += len(set(a.goals or []) & set(b.goals or [])) * 2
    if a.timezone == b.timezone:
        total += 2
    return total


def get_group(db: Session, group_id: int) -> Group | None:
    return db.query(Group).filter_by(id=group_id).first()


def group_members(db: Session, group_id: int) -> list[User]:
    return db.query(User).filter_by(group_id=group_id).all()


def status_for(member_count: int) -> GroupStatus:
    return "matched" if member_count >= QUORUM_MIN else "queued"


def _group_view(group: Group, status: GroupStatus) -> dict:
    return {
        "id": group.id,
        "member_count": group.member_count,
        "max_members": group.max_members,
        "status": status,
    }


def _take_seat(db: Session, user: User, group: Group) -> bool:
    """Atomically increment the counter iff a seat is free.

    Single UPDATE ... WHERE statement, so concurrent joiners serialize on the
    row: exactly one wins the last seat, the rest see rowcount 0. Backed by
    CHECK (member_count <= max_members) as defense in depth.
    """
    updated = db.execute(
        update(Group)
        .where(Group.id == group.id, Group.member_count < Group.max_members)
        .values(member_count=Group.member_count + 1)
    ).rowcount
    if not updated:
        return False
    user.group_id = group.id
    return True


def propose_group(db: Session, user: User) -> dict:
    db.refresh(user)
    if user.group_id is not None:
        group = get_group(db, user.group_id)
        if group is not None:
            return _group_view(group, status_for(group.member_count))

    attempts = 0
    while True:
        attempts += 1
        open_groups = (
            db.query(Group).filter(Group.member_count < Group.max_members).all()
        )
        if not open_groups or attempts > len(open_groups) + 1:
            break
        member_lists = db.query(User).filter(
            User.group_id.in_([g.id for g in open_groups])
        ).all()
        by_group: dict[int, list[User]] = {g.id: [] for g in open_groups}
        for member in member_lists:
            if member.id != user.id:
                by_group[member.group_id].append(member)
        best = max(
            open_groups,
            key=lambda g: (
                sum(compatibility_score(user, m) for m in by_group[g.id])
                / len(by_group[g.id])
                if by_group[g.id]
                else 0.0
            ),
        )
        if _take_seat(db, user, best):
            db.commit()
            db.refresh(best)
            return _group_view(best, status_for(best.member_count))
        db.rollback()  # lost the race on this group; re-pick from fresh state

    group = Group(
        created_by=user.id,
        subject=",".join(user.subjects or []),
        goal=",".join(user.goals or []),
        timezone=user.timezone,
        member_count=1,
        max_members=GROUP_SIZE,
    )
    db.add(group)
    db.flush()
    user.group_id = group.id
    db.commit()
    db.refresh(group)
    return _group_view(group, status_for(group.member_count))


def join_group(db: Session, user: User, group_id: int) -> dict:
    db.refresh(user)
    group = get_group(db, group_id)
    if group is None:
        raise HTTPException(404, "GroupNotFound")
    if user.group_id == group.id:
        return _group_view(group, status_for(group.member_count))
    if not _take_seat(db, user, group):
        db.rollback()
        raise HTTPException(409, "GroupFull")
    db.commit()
    db.refresh(group)
    return _group_view(group, status_for(group.member_count))
