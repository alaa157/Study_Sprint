import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://studysprint:studysprint@localhost:5432/studysprint_test",
)

_test_engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
_TestSessionLocal = sessionmaker(bind=_test_engine, autoflush=False, autocommit=False)

# Import app + models so Base metadata covers every table before create_all.
import app.shared.db as app_db  # noqa: E402
from app.main import app  # noqa: E402
from app.shared.db import Base  # noqa: E402

Base.metadata.create_all(_test_engine)


@pytest.fixture(scope="function")
def client():
    conn = _test_engine.connect()
    tx = conn.begin()
    session = _TestSessionLocal(bind=conn)

    def _override_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[app_db.get_db] = _override_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        session.close()
        tx.rollback()
        conn.close()


def _register(client, email, **kwargs):
    payload = {
        "email": email,
        "password": "secret123",
        "timezone": "UTC",
        "subjects": [],
        "goals": [],
    }
    payload.update(kwargs)
    r = client.post("/auth/register", json=payload)
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture
def user_a(client):
    return _register(client, "a@x.com", subjects=["math"], goals=["exam"])


@pytest.fixture
def user_b(client):
    return _register(client, "b@x.com", subjects=["physics"], goals=["lab"])


@pytest.fixture
def user_c(client):
    return _register(client, "c@x.com", subjects=["chemistry"], goals=["exam"])


@pytest.fixture
def user_d(client):
    return _register(client, "d@x.com", subjects=["biology"], goals=["field"])


@pytest.fixture
def extra_user_header(client):
    return _register(client, "e@x.com")
