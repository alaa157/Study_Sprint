from sqlalchemy import CheckConstraint, Column, ForeignKey, Integer, String, ARRAY, UniqueConstraint
from app.shared.db import Base


class Group(Base):
    __tablename__ = "groups"
    __table_args__ = (
        CheckConstraint("member_count <= max_members", name="ck_group_capacity"),
    )

    id = Column(Integer, primary_key=True, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject = Column(String, nullable=False)  # aggregated/composite key for matching
    goal = Column(String, nullable=False)
    timezone = Column(String, nullable=False)
    member_count = Column(Integer, default=0, nullable=False)
    max_members = Column(Integer, default=4, nullable=False)


class GroupMember(Base):
    """One row per membership; a user sits in at most one group."""

    __tablename__ = "group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_member"),
        UniqueConstraint("user_id", name="uq_member_single_group"),
    )

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
