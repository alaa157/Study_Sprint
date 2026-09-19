from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.modules.identity.models import User
from app.shared.auth import get_current_user
from app.shared.clock import SystemClock
from app.shared.db import get_db
from .schemas import (
    CompleteCreate,
    CompleteResponse,
    PromiseCreate,
    PromiseSchema,
    ScoreboardEntry,
    StreakResponse,
)
from .service import (
    complete_today,
    get_streak,
    promise_today,
    scoreboard,
)

router = APIRouter(tags=["checkins"])
_clock = SystemClock()


@router.post("/promise", response_model=PromiseSchema, status_code=status.HTTP_201_CREATED)
def make_promise(
    payload: PromiseCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return promise_today(db, user, payload.text, payload.date, _clock)


@router.post("/complete", response_model=CompleteResponse)
def complete_promise(
    payload: CompleteCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    promise = complete_today(db, user, payload.date, _clock)
    return {"date": promise.date, "completed": True, "streak": get_streak(db, user, _clock)}


@router.get("/streak", response_model=StreakResponse)
def read_streak(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"streak": get_streak(db, user, _clock)}


board_router = APIRouter(tags=["scoreboard"])


@board_router.get("/{group_id}/scoreboard", response_model=list[ScoreboardEntry])
def read_scoreboard(
    group_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return scoreboard(db, user, group_id, _clock)
