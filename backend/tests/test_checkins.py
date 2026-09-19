from datetime import date, timedelta
from zoneinfo import ZoneInfo


def _local_today(timezone: str) -> date:
    from datetime import datetime
    return datetime.now(ZoneInfo(timezone)).date()


def test_double_promise_409_and_streak(client, user_a):
    today = _local_today("UTC").isoformat()
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
    today = _local_today("UTC")
    for offset in (2, 1, 0):
        day = (today - timedelta(days=offset)).isoformat()
        assert client.post("/checkins/promise", json={"text": f"d-{offset}", "date": day}, headers=user_a).status_code == 201
        assert client.post("/checkins/complete", json={"date": day}, headers=user_a).status_code == 200
    assert client.get("/checkins/streak", headers=user_a).json()["streak"] == 3


def test_streak_breaks_on_gap(client, user_a):
    today = _local_today("UTC")
    for offset in (3, 1, 0):  # skip 2 days ago
        day = (today - timedelta(days=offset)).isoformat()
        assert client.post("/checkins/promise", json={"text": f"g-{offset}", "date": day}, headers=user_a).status_code == 201
        assert client.post("/checkins/complete", json={"date": day}, headers=user_a).status_code == 200
    assert client.get("/checkins/streak", headers=user_a).json()["streak"] == 2


def test_complete_without_promise_404(client, user_a):
    r = client.post("/checkins/complete", json={"date": _local_today("UTC").isoformat()}, headers=user_a)
    assert r.status_code == 404


def test_local_date_boundary_with_fake_clock():
    """UTC+14 user at 23:55 local on 09-19: streak counts local date, not UTC."""
    from datetime import datetime, timezone
    from app.modules.identity.models import User
    from app.modules.identity.schemas import UserRegister
    from app.modules.identity.service import register
    from app.modules.checkins.service import complete_today, get_streak, promise_today
    from app.shared.clock import FakeClock
    from tests.conftest import new_test_session

    # 2026-09-19 23:55 in Kiritimati (UTC+14) == 2026-09-19 09:55 UTC.
    clock = FakeClock(datetime(2026, 9, 19, 9, 55, tzinfo=timezone.utc))
    session = new_test_session()
    try:
        register(session, UserRegister(
            email="island@x.com", password="secret123",
            timezone="Pacific/Kiritimati", subjects=[], goals=[],
        ))
        user = session.query(User).filter_by(email="island@x.com").first()
        assert clock.today("Pacific/Kiritimati").isoformat() == "2026-09-19"
        promise_today(session, user, "fish", date(2026, 9, 19))
        complete_today(session, user, date(2026, 9, 19), clock)
        assert get_streak(session, user, clock) == 1
    finally:
        from app.modules.checkins.models import Promise
        session.query(Promise).filter_by(user_id=user.id).delete()
        session.query(User).filter_by(email="island@x.com").delete()
        session.commit()
        session.close()


def test_scoreboard(client, user_a, user_b):
    g = client.post("/groups/find", headers=user_a).json()
    client.post("/groups/find", headers=user_b)
    client.post("/groups/find", headers=user_b)  # idempotent re-find
    today = _local_today("UTC").isoformat()
    client.post("/checkins/promise", json={"text": "s", "date": today}, headers=user_a)
    client.post("/checkins/complete", json={"date": today}, headers=user_a)
    r = client.get(f"/groups/{g['id']}/scoreboard", headers=user_a)
    assert r.status_code == 200
    board = {row["email"]: row for row in r.json()}
    assert board["a@x.com"] == {"email": "a@x.com", "streak": 1, "done_today": True}
    assert board["b@x.com"]["streak"] == 0
    assert board["b@x.com"]["done_today"] is False
