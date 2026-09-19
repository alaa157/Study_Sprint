import os

import pytest
import sqlalchemy
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://studysprint:studysprint@localhost:5432/studysprint_test",
)


def _ensure_test_db(url: str) -> None:
    """CREATE DATABASE for the test DB if missing, so `make test` works anywhere."""
    from urllib.parse import urlparse

    parts = urlparse(url)
    dbname = parts.path.lstrip("/")
    maint_url = url.replace(f"/{dbname}", "/postgres", 1)
    maint = sqlalchemy.create_engine(maint_url, isolation_level="AUTOCOMMIT")
    try:
        with maint.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname=:d"),
                {"d": dbname},
            ).first()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{dbname}"'))
    except (OperationalError, ProgrammingError):
        pass  # already exists (race) or no maint access; the connect below will tell
    finally:
        maint.dispose()


_ensure_test_db(TEST_DATABASE_URL)

_test_engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
_TestSessionLocal = sessionmaker(bind=_test_engine, autoflush=False, autocommit=False)

# Import app + models so Base metadata covers every table before create_all.
import app.shared.db as app_db  # noqa: E402
from app.main import app  # noqa: E402
from app.shared.db import Base  # noqa: E402

Base.metadata.create_all(_test_engine)


def new_test_session():
    """Independent committed session for concurrency tests.

    Outside the per-test rollback transaction by design: callers must clean
    up every row they commit.
    """
    return _TestSessionLocal()


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
