from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.modules.identity.models import User
from app.shared.auth import get_current_user
from app.shared.db import get_db
from .schemas import SessionCreate, SessionSchema
from .service import start_session

router = APIRouter(tags=["sessions"])


@router.post("/{group_id}/sessions", response_model=SessionSchema, status_code=status.HTTP_201_CREATED)
def create_session(
    group_id: int,
    payload: SessionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return start_session(db, user, group_id, payload.duration_s)
