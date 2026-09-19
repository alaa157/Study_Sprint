from pydantic import BaseModel, Field
from typing import Literal

class GroupFindRequest(BaseModel):
    subjects: list[str] = Field(default=[], description="User's subjects")
    goals: list[str] = Field(default=[], description="User's goals")
    timezone: str = Field(default="UTC", description="User's timezone")

class GroupSchema(BaseModel):
    id: int
    member_count: int
    max_members: int = 4
    status: Literal["queued", "matched"] | None = None

    class Config:
        from_attributes = True

class JoinGroupRequest(BaseModel):
    pass