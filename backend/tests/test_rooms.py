import pytest
from starlette.websockets import WebSocketDisconnect


def _quorum_group(client, headers):
    """Fill the caller's group to 3 members and return it."""
    g = client.post("/groups/find", headers=headers).json()
    for email in ("q2@x.com", "q3@x.com"):
        client.post("/auth/register", json={"email": email, "password": "secret123", "timezone": "UTC", "subjects": [], "goals": []})
        r = client.post("/auth/login", json={"email": email, "password": "secret123"})
        h = {"Authorization": f"Bearer {r.json()['access_token']}"}
        client.post("/groups/find", headers=h)
    return client.post("/groups/find", headers=headers).json()


def _start_session(client, headers, duration_s=1500):
    g = _quorum_group(client, headers)
    r = client.post(f"/groups/{g['id']}/sessions", json={"duration_s": duration_s}, headers=headers)
    assert r.status_code == 201, r.text
    session = r.json()
    assert session["duration_s"] == duration_s
    assert session["status"] == "live"
    assert "starts_at" in session
    return session


def _join(ws):
    ws.send_json({"type": "join"})
    return ws.receive_json()


def test_session_lifecycle_and_ws_flow(client, user_a):
    session = _start_session(client, user_a)
    token = user_a["Authorization"].split(" ", 1)[1]
    with client.websocket_connect(f"/ws/rooms/{session['id']}?token={token}") as ws:
        snapshot = _join(ws)
        assert snapshot["type"] == "state_snapshot"
        assert snapshot["remaining_s"] <= 1500
        assert any(p["email"] == "a@x.com" and p["online"] for p in snapshot["participants"])

        ws.send_json({"type": "heartbeat"})
        presence = ws.receive_json()
        assert presence["type"] == "presence"
        assert any(p["email"] == "a@x.com" for p in presence["participants"])

        ws.send_json({"type": "complete"})
        finalized = ws.receive_json()
        assert finalized == {"type": "finalized", "session_id": session["id"]}


def test_ws_ignores_messages_before_join(client, user_a):
    session = _start_session(client, user_a)
    token = user_a["Authorization"].split(" ", 1)[1]
    with client.websocket_connect(f"/ws/rooms/{session['id']}?token={token}") as ws:
        ws.send_json({"type": "heartbeat"})  # no snapshot yet; must not crash
        snapshot = _join(ws)
        assert snapshot["type"] == "state_snapshot"


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


def test_session_requires_quorum_409(client, user_a):
    g = client.post("/groups/find", headers=user_a).json()
    assert g["status"] == "queued"  # 1 member < quorum of 3
    r = client.post(f"/groups/{g['id']}/sessions", json={"duration_s": 1500}, headers=user_a)
    assert r.status_code == 409
    assert r.json()["detail"] == "QuorumNotMet"


def test_session_requires_membership_403(client, user_a, extra_user_header):
    g = _quorum_group(client, user_a)
    r = client.post(f"/groups/{g['id']}/sessions", json={"duration_s": 1500}, headers=extra_user_header)
    assert r.status_code == 403
    assert r.json()["detail"] == "NotGroupMember"
