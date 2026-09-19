from datetime import date
from pydantic import BaseModel, ConfigDict, Field


class PromiseCreate(BaseModel):
    text: str = Field(min_length=1, max_length=280)
    date: date


class CompleteCreate(BaseModel):
    date: date


class PromiseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    date: date
    text: str


class CompleteResponse(BaseModel):
    date: date
    completed: bool
    streak: int


class StreakResponse(BaseModel):
    streak: int


class ScoreboardEntry(BaseModel):
    email: str
    streak: int
    done_today: bool
