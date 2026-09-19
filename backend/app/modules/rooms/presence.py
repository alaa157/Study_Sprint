from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.shared.db import Base


class SessionParticipant(Base):
    """Presence ledger: one row per user per session, refreshed on join/heartbeat.

    `online` is derived (last_seen within TTL), so rows survive api restarts —
    unlike the previous in-memory presence dict.
    """

    __tablename__ = "session_participants"
    __table_args__ = (
        UniqueConstraint("session_id", "user_id", name="uq_session_participant"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("sessions.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
