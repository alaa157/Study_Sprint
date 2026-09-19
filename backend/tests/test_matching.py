def test_matching_forms_group_and_full_race(client, user_a, user_b, user_c, user_d, extra_user_header):
    g = client.post("/groups/find", headers=user_a).json()
    assert g["status"] == "queued"  # founder alone: below quorum of 3
    # fill group to capacity 4, fifth join -> 409
    for h, expected in ((user_b, "queued"), (user_c, "matched"), (user_d, "matched")):
        r = client.post("/groups/find", headers=h)
        assert r.status_code == 200
        assert r.json()["id"] == g["id"]
        assert r.json()["status"] == expected
    r = client.post(f"/groups/{g['id']}/join", headers=extra_user_header)
    assert r.status_code == 409
    assert r.json()["detail"] == "GroupFull"


def test_concurrent_join_single_winner():
    """Five threads race for the last seat: exactly one wins, no overfill."""
    import threading
    import uuid
    from app.modules.identity.models import User
    from app.modules.identity.schemas import UserRegister
    from app.modules.identity.service import register
    from app.modules.matching.models import Group, GroupMember
    from app.modules.matching.service import group_members, join_group, propose_group
    from app.shared.errors import DomainError
    from tests.conftest import new_test_session

    tag = uuid.uuid4().hex[:8]
    founder = {"email": f"race0-{tag}@x.com", "password": "secret123", "timezone": "UTC", "subjects": ["math"], "goals": ["exam"]}
    fillers = [f"fill{i}-{tag}@x.com" for i in range(1, 3)]
    racers = [f"race{i}-{tag}@x.com" for i in range(1, 6)]

    setup = new_test_session()
    try:
        register(setup, UserRegister(**founder))
        group = propose_group(setup, setup.query(User).filter_by(email=founder["email"]).first())
        for email in fillers:
            register(setup, UserRegister(email=email, password="secret123", timezone="UTC", subjects=[], goals=[]))
            join_group(setup, setup.query(User).filter_by(email=email).first(), group["id"])
        for email in racers:
            register(setup, UserRegister(email=email, password="secret123", timezone="UTC", subjects=[], goals=[]))
        gid = group["id"]
        assert len(group_members(setup, gid)) == 3
    finally:
        setup.close()

    barrier = threading.Barrier(len(racers) + 1)
    outcomes = []

    def attempt(email):
        session = new_test_session()
        try:
            user = session.query(User).filter_by(email=email).first()
            barrier.wait(timeout=10)
            join_group(session, user, gid)
            outcomes.append("ok")
        except DomainError as e:
            outcomes.append(e.detail)
        finally:
            session.close()

    threads = [threading.Thread(target=attempt, args=(e,)) for e in racers]
    for t in threads:
        t.start()
    barrier.wait(timeout=10)
    for t in threads:
        t.join(timeout=20)

    try:
        assert outcomes.count("ok") == 1, outcomes
        assert outcomes.count("GroupFull") == 4, outcomes
        check = new_test_session()
        try:
            assert len(group_members(check, gid)) == 4
            assert check.query(Group).filter_by(id=gid).first().member_count == 4
        finally:
            check.close()
    finally:
        from app.modules.rooms.models import RoomSession

        cleanup = new_test_session()
        try:
            # Membership rows reference both sides: delete them before parents.
            member_ids = [
                u.id
                for u in cleanup.query(User).filter(
                    (User.email.like(f"%{tag}@x.com"))
                    | (User.email.like("race%@x.com"))
                    | (User.email.like("fill%@x.com"))
                ).all()
            ]
            if member_ids:
                cleanup.query(GroupMember).filter(
                    GroupMember.user_id.in_(member_ids)
                ).delete(synchronize_session=False)
            cleanup.query(RoomSession).delete()
            cleanup.query(Group).delete()
            cleanup.query(User).filter(User.email.like(f"%{tag}@x.com")).delete(synchronize_session=False)
            # Belt and braces: drop rows from any earlier aborted run.
            cleanup.query(User).filter(User.email.like("race%@x.com")).delete(synchronize_session=False)
            cleanup.query(User).filter(User.email.like("fill%@x.com")).delete(synchronize_session=False)
            cleanup.commit()
        finally:
            cleanup.close()