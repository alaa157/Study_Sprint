from pydantic import BaseModel, ConfigDict
from typing import Literal


class GroupSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    member_count: int
    max_members: int = 4
    status: Literal["queued", "matched"]
