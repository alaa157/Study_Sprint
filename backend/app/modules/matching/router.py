from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.modules.identity.models import User
from app.shared.auth import get_current_user
from app.shared.db import get_db
from .schemas import GroupSchema
from .service import join_group, propose_group

router = APIRouter(tags=["groups"])


@router.post("/find", response_model=GroupSchema)
def find_group(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return propose_group(db, user)


@router.post("/{group_id}/join", response_model=GroupSchema)
def join_group_endpoint(group_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return join_group(db, user, group_id)
