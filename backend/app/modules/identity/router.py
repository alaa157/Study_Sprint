from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.shared.auth import get_current_user
from app.shared.db import get_db
from .models import User
from .schemas import AuthResponse, RefreshRequest, UserLogin, UserRegister, UserSchema
from .service import login, refresh_tokens, register

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_endpoint(payload: UserRegister, db: Session = Depends(get_db)):
    return register(db, payload)


@router.post("/login", response_model=AuthResponse)
def login_endpoint(payload: UserLogin, db: Session = Depends(get_db)):
    return login(db, payload)


@router.post("/refresh", response_model=AuthResponse)
def refresh_endpoint(payload: RefreshRequest, db: Session = Depends(get_db)):
    return refresh_tokens(db, payload.refresh_token)


@router.get("/me", response_model=UserSchema)
def me_endpoint(user: User = Depends(get_current_user)):
    return user
