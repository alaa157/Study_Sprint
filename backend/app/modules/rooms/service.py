from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.modules.identity.models import User
from app.modules.matching import service as matching
from app.shared.errors import GroupNotFound, NotGroupMember, QuorumNotMet
from .models import RoomSession
from .presence import SessionParticipant

PRESENCE_TTL = timedelta(seconds=45)


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
        raise GroupNotFound()
    if matching.member_group_id(db, user.id) != group.id:
        raise NotGroupMember()
    if len(matching.group_members(db, group.id)) < matching.QUORUM_MIN:
        raise QuorumNotMet()
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


def live_session_for_group(db: Session, group_id: int) -> RoomSession | None:
    return db.query(RoomSession).filter_by(group_id=group_id, status="live").first()


def finalize_session(db: Session, session_id: int) -> RoomSession | None:
    session = db.query(RoomSession).filter_by(id=session_id).first()
    if session is None:
        return None
    session.status = "finalized"
    db.commit()
    db.refresh(session)
    return session


def mark_present(db: Session, session_id: int, user_id: int) -> None:
    row = (
        db.query(SessionParticipant)
        .filter_by(session_id=session_id, user_id=user_id)
        .first()
    )
    if row is None:
        db.add(SessionParticipant(session_id=session_id, user_id=user_id))
    else:
        row.last_seen = datetime.now(timezone.utc)
    db.commit()


def present_user_ids(db: Session, session_id: int) -> set[int]:
    cutoff = datetime.now(timezone.utc) - PRESENCE_TTL
    rows = (
        db.query(SessionParticipant.user_id)
        .filter(
            SessionParticipant.session_id == session_id,
            SessionParticipant.last_seen >= cutoff,
        )
        .all()
    )
    return {r[0] for r in rows}


def prune_presence(db: Session, session_id: int) -> None:
    cutoff = datetime.now(timezone.utc) - PRESENCE_TTL
    db.query(SessionParticipant).filter(
        SessionParticipant.session_id == session_id,
        SessionParticipant.last_seen < cutoff,
    ).delete()
    db.commit()
