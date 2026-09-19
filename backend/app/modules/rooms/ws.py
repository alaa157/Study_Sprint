import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.websockets import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.modules.identity.models import User
from app.modules.identity.service import authenticate
from app.shared.db import get_db
from .models import RoomSession
from .service import finalize_session, remaining_s

router = APIRouter()

TICK_INTERVAL_S = 5

_connections: dict[int, set[WebSocket]] = {}
_presence: dict[int, dict[int, dict]] = {}


def _touch(sid: int, user: User) -> None:
    _presence.setdefault(sid, {})[user.id] = {
        "id": user.id,
        "email": user.email,
        "last_seen": datetime.now(timezone.utc).isoformat(),
    }


def _participants(sid: int, db: Session, group_id: int) -> list[dict]:
    online = _presence.get(sid, {})
    members = db.query(User).filter_by(group_id=group_id).all()
    return [
        {"id": m.id, "email": m.email, "online": m.id in online} for m in members
    ]


def _snapshot(sid: int, db: Session, session: RoomSession) -> dict:
    return {
        "type": "state_snapshot",
        "remaining_s": remaining_s(session),
        "participants": _participants(sid, db, session.group_id),
    }


async def _broadcast(sid: int, message: dict) -> None:
    dead = []
    for ws in _connections.get(sid, set()):
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _connections[sid].discard(ws)


async def _tick_loop(sid: int, websocket: WebSocket, session: RoomSession) -> None:
    try:
        while True:
            await asyncio.sleep(TICK_INTERVAL_S)
            await websocket.send_json({"type": "tick", "remaining_s": remaining_s(session)})
    except (asyncio.CancelledError, WebSocketDisconnect, RuntimeError):
        pass


@router.websocket("/ws/rooms/{sid}")
async def room_ws(websocket: WebSocket, sid: int, db: Session = Depends(get_db)):
    token = websocket.query_params.get("token", "")
    try:
        user = authenticate(token, db)
    except HTTPException:
        await websocket.close(code=4401)
        return

    session = db.query(RoomSession).filter_by(id=sid).first()
    if session is None:
        await websocket.close(code=4404)
        return

    await websocket.accept()
    _connections.setdefault(sid, set()).add(websocket)
    _touch(sid, user)
    await websocket.send_json(_snapshot(sid, db, session))
    ticker = asyncio.create_task(_tick_loop(sid, websocket, session))
    try:
        while True:
            msg = await websocket.receive_json()
            kind = msg.get("type")
            if kind == "heartbeat":
                _touch(sid, user)
                await _broadcast(
                    sid,
                    {"type": "presence", "participants": _participants(sid, db, session.group_id)},
                )
            elif kind == "complete":
                session = finalize_session(db, sid) or session
                await _broadcast(sid, {"type": "finalized", "session_id": sid})
    except WebSocketDisconnect:
        pass
    finally:
        ticker.cancel()
        _connections.get(sid, set()).discard(websocket)
        _presence.get(sid, {}).pop(user.id, None)
