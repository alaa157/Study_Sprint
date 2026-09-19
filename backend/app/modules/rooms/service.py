from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.modules.identity.models import User
from app.modules.matching import service as matching
from .models import RoomSession


def remaining_s(session: RoomSession, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    starts = session.starts_at
    if starts.tzinfo is None:
        # Postgres timestamptz comes back aware; tolerate naive datetimes.
        starts = starts.replace(tzinfo=timezone.utc)
    return max(0, int(session.duration_s - (now - starts).total_seconds()))


def start_session(db: Session, user: User, group_id: int, duration_s: int = 1500) -> RoomSession:
    group = matching.get_group(db, group_id)
    if group is None:
        raise HTTPException(404, "GroupNotFound")
    if user.group_id != group.id:
        raise HTTPException(403, "NotGroupMember")
    if len(matching.group_members(db, group.id)) < matching.QUORUM_MIN:
        raise HTTPException(409, "QuorumNotMet")
    session = RoomSession(
        group_id=group.id,
        starts_at=datetime.now(timezone.utc),
        duration_s=duration_s,
        status="live",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def finalize_session(db: Session, session_id: int) -> RoomSession | None:
    session = db.query(RoomSession).filter_by(id=session_id).first()
    if session is None:
        return None
    session.status = "finalized"
    db.commit()
    db.refresh(session)
    return session
