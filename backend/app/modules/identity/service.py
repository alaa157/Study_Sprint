import bcrypt
import jwt
import os
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from sqlalchemy.orm import Session
from .models import User
from .schemas import UserLogin, UserRegister

SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")

ACCESS_MINUTES = 60
REFRESH_DAYS = 7


def _hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_pw(password: str, hash_: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hash_.encode("utf-8"))


def _token(user_id: int, expires: timedelta, typ: str) -> str:
    exp = datetime.now(timezone.utc) + expires
    return jwt.encode({"sub": str(user_id), "exp": exp, "typ": typ}, SECRET, algorithm="HS256")


def _tokens_and_view(user: User) -> dict:
    return {
        "access_token": _token(user.id, timedelta(minutes=ACCESS_MINUTES), "access"),
        "refresh_token": _token(user.id, timedelta(days=REFRESH_DAYS), "refresh"),
        "user": {
            "id": user.id,
            "email": user.email,
            "timezone": user.timezone,
            "subjects": user.subjects,
            "goals": user.goals,
        },
    }


def register(db: Session, payload: UserRegister) -> dict:
    if db.query(User).filter_by(email=payload.email).first():
        raise HTTPException(409, "EmailTaken")
    user = User(
        email=payload.email,
        password_hash=_hash_pw(payload.password),
        timezone=payload.timezone,
        subjects=payload.subjects,
        goals=payload.goals,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _tokens_and_view(user)


def login(db: Session, payload: UserLogin) -> dict:
    user = db.query(User).filter_by(email=payload.email).first()
    if not user or not _verify_pw(payload.password, user.password_hash):
        raise HTTPException(401, "BadCredentials")
    return _tokens_and_view(user)


def authenticate(token: str, db: Session) -> User:
    try:
        payload = jwt.decode(token, SECRET, algorithms=["HS256"])
        user = db.query(User).filter_by(id=int(payload["sub"])).first()
    except Exception:
        raise HTTPException(401, "BadToken")
    if not user:
        raise HTTPException(401, "BadToken")
    return user


def refresh_tokens(db: Session, token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET, algorithms=["HS256"])
        user = db.query(User).filter_by(id=int(payload["sub"])).first()
        is_refresh = payload.get("typ") == "refresh"
    except Exception:
        raise HTTPException(401, "BadToken")
    if not user or not is_refresh:
        raise HTTPException(401, "BadToken")
    return _tokens_and_view(user)
