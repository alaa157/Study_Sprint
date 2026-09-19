import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from fastapi.websockets import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from app.modules.identity.models import User
from app.modules.identity.service import authenticate
from app.modules.matching import service as matching
from app.shared.db import get_db
from app.shared.errors import DomainError
from .models import RoomSession
from .service import (
    finalize_session,
    mark_present,
    present_user_ids,
    prune_presence,
    remaining_s,
)

router = APIRouter()

TICK_INTERVAL_S = 5

_connections: dict[int, set[WebSocket]] = {}
_room_clock: dict[int, dict] = {}
_tickers: dict[int, asyncio.Task] = {}


def _participants(session_id: int, db: Session, group_id: int) -> list[dict]:
    online = present_user_ids(db, session_id)
    return [
        {"id": m.id, "email": m.email, "online": m.id in online}
        for m in matching.group_members(db, group_id)
    ]


def _snapshot(session_id: int, db: Session, session: RoomSession) -> dict:
    return {
        "type": "state_snapshot",
        "remaining_s": remaining_s(session),
        "participants": _participants(session_id, db, session.group_id),
    }


async def _broadcast(session_id: int, message: dict) -> None:
    dead = []
    for ws in _connections.get(session_id, set()):
        try:
            await ws.send_json(message)
        except Exception:
            # Send can fail for half-closed sockets; prune, don't crash the room.
            dead.append(ws)
    for ws in dead:
        _connections[session_id].discard(ws)


def _remaining_from_clock(session_id: int) -> int:
    clock = _room_clock[session_id]
    starts = clock["starts_at"]
    if starts.tzinfo is None:
        starts = starts.replace(tzinfo=timezone.utc)
    elapsed = (datetime.now(timezone.utc) - starts).total_seconds()
    return max(0, int(clock["duration_s"] - elapsed))


async def _ensure_ticker(session_id: int) -> None:
    ticker = _tickers.get(session_id)
    if ticker is None or ticker.done():
        _tickers[session_id] = asyncio.create_task(_ticking(session_id))


async def _ticking(session_id: int) -> None:
    try:
        while _connections.get(session_id):
            await asyncio.sleep(TICK_INTERVAL_S)
            await _broadcast(
                session_id,
                {"type": "tick", "remaining_s": _remaining_from_clock(session_id)},
            )
    except asyncio.CancelledError:
        pass


async def _stop_ticker_if_empty(session_id: int) -> None:
    if not _connections.get(session_id):
        ticker = _tickers.pop(session_id, None)
        if ticker is not None:
            ticker.cancel()
            try:
                await ticker
            except asyncio.CancelledError:
                pass
        _room_clock.pop(session_id, None)


@router.websocket("/ws/rooms/{sid}")
async def room_ws(websocket: WebSocket, sid: int, db: Session = Depends(get_db)):
    # Browsers can't set WS headers, so the token travels in ?token= by design.
    token = websocket.query_params.get("token", "")
    try:
        user = authenticate(token, db)
    except DomainError:
        await websocket.close(code=4401)
        return

    session = db.query(RoomSession).filter_by(id=sid).first()
    if session is None:
        await websocket.close(code=4404)
        return

    await websocket.accept()
    _connections.setdefault(sid, set()).add(websocket)
    # Overwrite (not setdefault): ids restart across rolled-back tests.
    _room_clock[sid] = {"starts_at": session.starts_at, "duration_s": session.duration_s}
    joined = False

    async def on_join(_msg: dict) -> None:
        nonlocal joined
        joined = True
        mark_present(db, sid, user.id)
        await websocket.send_json(_snapshot(sid, db, session))
        await _ensure_ticker(sid)

    async def on_heartbeat(_msg: dict) -> None:
        mark_present(db, sid, user.id)
        prune_presence(db, sid)
        await _broadcast(
            sid,
            {"type": "presence", "participants": _participants(sid, db, session.group_id)},
        )

    async def on_complete(_msg: dict) -> None:
        nonlocal session
        session = finalize_session(db, sid) or session
        await _broadcast(sid, {"type": "finalized", "session_id": sid})

    handlers = {"join": on_join, "heartbeat": on_heartbeat, "complete": on_complete}

    try:
        while True:
            msg = await websocket.receive_json()
            handler = handlers.get(msg.get("type", ""))
            # Messages before join (and unknown types) are ignored by design:
            # snapshot is only defined after the client identifies itself.
            if handler is not None and (joined or msg.get("type") == "join"):
                await handler(msg)
    except WebSocketDisconnect:
        pass
    finally:
        _connections.get(sid, set()).discard(websocket)
        await _stop_ticker_if_empty(sid)
