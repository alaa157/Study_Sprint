from sqlalchemy import String, ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from app.shared.db import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    subjects: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    goals: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)