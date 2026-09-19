from sqlalchemy import ForeignKey, String, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.shared.db import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    subjects: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    goals: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    group_id: Mapped[int | None] = mapped_column(ForeignKey("groups.id"), default=None)

    group: Mapped["Group | None"] = relationship(back_populates="members", foreign_keys=[group_id])