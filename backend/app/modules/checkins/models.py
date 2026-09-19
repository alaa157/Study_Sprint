from datetime import date
from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.shared.db import Base


class Promise(Base):
    __tablename__ = "promises"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_promise_user_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    text: Mapped[str] = mapped_column(String(280))


class Completion(Base):
    """One row per kept promise; streaks read this table, not a flag."""

    __tablename__ = "completions"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_completion_user_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
