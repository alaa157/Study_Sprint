from typing import Literal
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.modules.identity.models import User
from app.shared.errors import GroupFull, GroupNotFound
from .models import Group, GroupMember

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


def member_group_id(db: Session, user_id: int) -> int | None:
    row = db.query(GroupMember.group_id).filter_by(user_id=user_id).first()
    return row[0] if row else None


def group_members(db: Session, group_id: int) -> list[User]:
    return (
        db.query(User)
        .join(GroupMember, GroupMember.user_id == User.id)
        .filter(GroupMember.group_id == group_id)
        .all()
    )


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
    """Atomically increment the counter iff a seat is free, then record membership.

    Single UPDATE ... WHERE statement, so concurrent joiners serialize on the
    row: exactly one wins the last seat, the rest see rowcount 0. Backed by
    CHECK (member_count <= max_members) plus UNIQUE(user_id) as defense in depth.
    """
    updated = db.execute(
        update(Group)
        .where(Group.id == group.id, Group.member_count < Group.max_members)
        .values(member_count=Group.member_count + 1)
    ).rowcount
    if not updated:
        return False
    db.add(GroupMember(group_id=group.id, user_id=user.id))
    return True


def propose_group(db: Session, user: User) -> dict:
    db.refresh(user)
    mine = member_group_id(db, user.id)
    if mine is not None:
        group = get_group(db, mine)
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
        rows = (
            db.query(User, GroupMember.group_id)
            .join(GroupMember, GroupMember.user_id == User.id)
            .filter(GroupMember.group_id.in_([g.id for g in open_groups]))
            .all()
        )
        by_group: dict[int, list[User]] = {g.id: [] for g in open_groups}
        for member, gid in rows:
            if member.id != user.id:
                by_group[gid].append(member)
        best = max(
            open_groups,
            key=lambda g: (
                sum(compatibility_score(user, m) for m in by_group[g.id])
                / len(by_group[g.id])
                if by_group[g.id]
                else 0.0
            ),
        )
        try:
            if _take_seat(db, user, best):
                db.commit()
                db.refresh(best)
                return _group_view(best, status_for(best.member_count))
            db.rollback()  # lost the race on this group; re-pick from fresh state
        except IntegrityError:
            # Concurrent join recorded first (or duplicate membership):
            # re-read authoritative state and report it.
            db.rollback()
            mine = member_group_id(db, user.id)
            if mine is not None:
                group = get_group(db, mine)
                if group is not None:
                    return _group_view(group, status_for(group.member_count))

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
    db.add(GroupMember(group_id=group.id, user_id=user.id))
    db.commit()
    db.refresh(group)
    return _group_view(group, status_for(group.member_count))


def join_group(db: Session, user: User, group_id: int) -> dict:
    db.refresh(user)
    group = get_group(db, group_id)
    if group is None:
        raise GroupNotFound()
    mine = member_group_id(db, user.id)
    if mine == group.id:
        return _group_view(group, status_for(group.member_count))
    if mine is not None:
        current = get_group(db, mine)
        return _group_view(current, status_for(current.member_count))
    try:
        seated = _take_seat(db, user, group)
    except IntegrityError:
        db.rollback()
        mine = member_group_id(db, user.id)
        if mine is not None:
            current = get_group(db, mine)
            return _group_view(current, status_for(current.member_count))
        raise GroupFull()
    if not seated:
        db.rollback()
        raise GroupFull()
    db.commit()
    db.refresh(group)
    return _group_view(group, status_for(group.member_count))
