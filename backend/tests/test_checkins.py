from datetime import date, timedelta

from app.shared.clock import SystemClock

_clock = SystemClock()


def _local_today() -> str:
    return _clock.today("UTC").isoformat()


def _promise_and_complete(client, headers, text: str, day: str):
    r = client.post("/checkins/promise", json={"text": text, "date": day}, headers=headers)
    assert r.status_code == 201, r.text
    r = client.post("/checkins/complete", json={"date": day}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_double_promise_409_and_streak(client, user_a):
    today = _local_today()
    r = client.post("/checkins/promise", json={"text": "ch2", "date": today}, headers=user_a)
    assert r.status_code == 201, r.text
    r = client.post("/checkins/promise", json={"text": "again", "date": today}, headers=user_a)
    assert r.status_code == 409
    assert r.json()["detail"] == "AlreadyPromised"
    r = client.post("/checkins/complete", json={"date": today}, headers=user_a)
    assert r.status_code == 200
    assert r.json()["streak"] == 1
    assert client.get("/checkins/streak", headers=user_a).json()["streak"] == 1


def test_streak_counts_consecutive_days(client, user_a):
    today = _clock.today("UTC")
    for offset in (2, 1, 0):
        day = (today - timedelta(days=offset)).isoformat()
        _promise_and_complete(client, user_a, f"d-{offset}", day)
    assert client.get("/checkins/streak", headers=user_a).json()["streak"] == 3


def test_streak_breaks_on_gap(client, user_a):
    today = _clock.today("UTC")
    for offset in (3, 1, 0):  # skip 2 days ago
        day = (today - timedelta(days=offset)).isoformat()
        _promise_and_complete(client, user_a, f"g-{offset}", day)
    assert client.get("/checkins/streak", headers=user_a).json()["streak"] == 2


def test_complete_without_promise_404(client, user_a):
    r = client.post("/checkins/complete", json={"date": _local_today()}, headers=user_a)
    assert r.status_code == 404


def test_complete_future_date_400(client, user_a):
    future = (_clock.today("UTC") + timedelta(days=2)).isoformat()
    r = client.post("/checkins/promise", json={"text": "later", "date": future}, headers=user_a)
    assert r.status_code == 201, r.text
    r = client.post("/checkins/complete", json={"date": future}, headers=user_a)
    assert r.status_code == 400
    assert r.json()["detail"] == "FutureDate"


def test_promise_text_validated_422(client, user_a):
    today = _local_today()
    r = client.post("/checkins/promise", json={"text": "", "date": today}, headers=user_a)
    assert r.status_code == 422
    r = client.post("/checkins/promise", json={"text": "x" * 281, "date": today}, headers=user_a)
    assert r.status_code == 422


def test_local_date_boundary_with_fake_clock():
    """UTC instant where UTC and UTC+14 disagree on the date.

    2026-09-18 10:00 UTC == 2026-09-19 00:00 in Pacific/Kiritimati.
    The island user's streak must count their local date, not UTC.
    """
    from datetime import datetime, timezone
    from app.modules.identity.models import User
    from app.modules.identity.schemas import UserRegister
    from app.modules.identity.service import register
    from app.modules.checkins.models import Promise
    from app.modules.checkins.service import complete_today, get_streak, promise_today
    from app.shared.clock import FakeClock
    from tests.conftest import new_test_session

    clock = FakeClock(datetime(2026, 9, 18, 10, 0, tzinfo=timezone.utc))
    assert clock.today("UTC").isoformat() == "2026-09-18"
    assert clock.today("Pacific/Kiritimati").isoformat() == "2026-09-19"
    session = new_test_session()
    try:
        register(session, UserRegister(
            email="island@x.com", password="secret123",
            timezone="Pacific/Kiritimati", subjects=[], goals=[],
        ))
        user = session.query(User).filter_by(email="island@x.com").first()
        promise_today(session, user, "fish", date(2026, 9, 19))
        complete_today(session, user, date(2026, 9, 19), clock)
        assert get_streak(session, user, clock) == 1
        # The UTC calendar date has no completion: proof tz mattered.
        assert not session.query(Promise).filter_by(user_id=user.id, date=date(2026, 9, 18)).first()
    finally:
        user = session.query(User).filter_by(email="island@x.com").first()
        if user is not None:
            session.query(Promise).filter_by(user_id=user.id).delete()
            session.query(User).filter_by(email="island@x.com").delete()
            session.commit()
        session.close()


def test_scoreboard(client, user_a, user_b):
    g = client.post("/groups/find", headers=user_a).json()
    client.post("/groups/find", headers=user_b)
    client.post("/groups/find", headers=user_b)  # idempotent re-find
    today = _local_today()
    client.post("/checkins/promise", json={"text": "s", "date": today}, headers=user_a)
    client.post("/checkins/complete", json={"date": today}, headers=user_a)
    r = client.get(f"/groups/{g['id']}/scoreboard", headers=user_a)
    assert r.status_code == 200
    board = {row["email"]: row for row in r.json()}
    assert board["a@x.com"] == {"email": "a@x.com", "streak": 1, "done_today": True}
    assert board["b@x.com"]["streak"] == 0
    assert board["b@x.com"]["done_today"] is False


def test_scoreboard_requires_membership_403(client, user_a, extra_user_header):
    g = client.post("/groups/find", headers=user_a).json()
    r = client.get(f"/groups/{g['id']}/scoreboard", headers=extra_user_header)
    assert r.status_code == 403
    assert r.json()["detail"] == "NotGroupMember"


def test_refresh_flow(client):
    r = client.post("/auth/register", json={"email": "ref@x.com", "password": "secret123", "timezone": "UTC", "subjects": [], "goals": []})
    assert r.status_code == 201
    refresh = r.json()["refresh_token"]
    r = client.post("/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    # Access tokens are not refreshable; garbage is rejected.
    r = client.post("/auth/refresh", json={"refresh_token": token})
    assert r.status_code == 401
    r = client.post("/auth/refresh", json={"refresh_token": "BAD"})
    assert r.status_code == 401
