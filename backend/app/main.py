from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.shared.db import engine
from app.shared.errors import DomainError

app = FastAPI(title="StudySprint")


@app.exception_handler(DomainError)
def domain_error_handler(request, exc: DomainError):
    return JSONResponse({"detail": exc.detail}, exc.status_code)


@app.exception_handler(SQLAlchemyError)
def db_error_handler(request, exc: SQLAlchemyError):
    # 5xx responses never leak SQL or driver internals.
    return JSONResponse({"detail": "InternalError"}, 500)

@app.get("/health")
def health():
    try:
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
        db = "up"
    except Exception:
        db = "down"
    return {"status": "ok", "db": db}

# --- modules ---
from app.modules.identity.router import router as identity_router
app.include_router(identity_router, prefix="/auth")

from app.modules.matching.router import router as matching_router
app.include_router(matching_router, prefix="/groups")

from app.modules.rooms.router import router as rooms_router
app.include_router(rooms_router, prefix="/groups")

from app.modules.rooms.ws import router as rooms_ws_router
app.include_router(rooms_ws_router)

from app.modules.checkins.router import board_router as scoreboard_router
from app.modules.checkins.router import router as checkins_router
app.include_router(checkins_router, prefix="/checkins")
app.include_router(scoreboard_router, prefix="/groups")