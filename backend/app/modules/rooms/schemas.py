from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import Literal


class SessionCreate(BaseModel):
    duration_s: int = Field(default=1500, ge=60, le=7200)


class SessionSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    group_id: int
    starts_at: datetime
    duration_s: int
    status: Literal["live", "finalized"]
