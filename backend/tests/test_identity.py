def test_register_login_me(client):
    r = client.post("/auth/register", json={"email": "a@x.com", "password": "secret123", "timezone": "UTC", "subjects": ["math"], "goals": ["exam"]})
    assert r.status_code == 201, r.text
    r = client.post("/auth/login", json={"email": "a@x.com", "password": "secret123"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "a@x.com"


def test_duplicate_register_409(client):
    client.post("/auth/register", json={"email": "b@x.com", "password": "secret123", "timezone": "UTC", "subjects": [], "goals": []})
    r = client.post("/auth/register", json={"email": "b@x.com", "password": "secret123", "timezone": "UTC", "subjects": [], "goals": []})
    assert r.status_code == 409


def test_me_rejects_bad_token_401(client):
    r = client.get("/auth/me", headers={"Authorization": "Bearer BAD"})
    assert r.status_code == 401


def test_login_rejects_bad_password_401(client):
    client.post("/auth/register", json={"email": "c@x.com", "password": "secret123", "timezone": "UTC", "subjects": [], "goals": []})
    r = client.post("/auth/login", json={"email": "c@x.com", "password": "wrong"})
    assert r.status_code == 401
    assert r.json()["detail"] == "BadCredentials"
