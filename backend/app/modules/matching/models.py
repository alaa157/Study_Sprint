from sqlalchemy import CheckConstraint, Column, Integer, String, ARRAY, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
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

    members = relationship("User", back_populates="group", foreign_keys="User.group_id")