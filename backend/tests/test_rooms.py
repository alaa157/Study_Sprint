import pytest
from starlette.websockets import WebSocketDisconnect


def _start_session(client, headers, duration_s=1500):
    g = client.post("/groups/find", headers=headers).json()
    r = client.post(f"/groups/{g['id']}/sessions", json={"duration_s": duration_s}, headers=headers)
    assert r.status_code == 201, r.text
    session = r.json()
    assert session["duration_s"] == duration_s
    assert session["status"] == "live"
    assert "starts_at" in session
    return session


def test_session_lifecycle_and_ws_flow(client, user_a):
    session = _start_session(client, user_a)
    token = user_a["Authorization"].split(" ", 1)[1]
    with client.websocket_connect(f"/ws/rooms/{session['id']}?token={token}") as ws:
        snapshot = ws.receive_json()
        assert snapshot["type"] == "state_snapshot"
        assert snapshot["remaining_s"] <= 1500
        assert any(p["email"] == "a@x.com" for p in snapshot["participants"])

        ws.send_json({"type": "heartbeat"})
        presence = ws.receive_json()
        assert presence["type"] == "presence"
        assert any(p["email"] == "a@x.com" for p in presence["participants"])

        ws.send_json({"type": "complete"})
        finalized = ws.receive_json()
        assert finalized == {"type": "finalized", "session_id": session["id"]}


def test_ws_rejects_bad_token_4401(client, user_a):
    session = _start_session(client, user_a)
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/ws/rooms/{session['id']}?token=BAD"):
            pass
    assert exc.value.code == 4401


def test_ws_rejects_missing_session_4404(client, user_a):
    token = user_a["Authorization"].split(" ", 1)[1]
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/ws/rooms/999999?token=" + token):
            pass
    assert exc.value.code == 4404
