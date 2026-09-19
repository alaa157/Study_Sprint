def test_matching_forms_group_and_full_race(client, user_a, user_b, user_c, user_d, extra_user_header):
    g = client.post("/groups/find", headers=user_a).json()
    assert g["status"] in ("matched", "queued")
    # fill group to capacity 4, fifth join -> 409
    for h in (user_b, user_c, user_d):
        client.post("/groups/find", headers=h)
    r = client.post(f"/groups/{g['id']}/join", headers=extra_user_header())
    assert r.status_code in (200, 409)