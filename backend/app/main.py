from fastapi import FastAPI
from sqlalchemy import text
from app.shared.db import engine

app = FastAPI(title="StudySprint")

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