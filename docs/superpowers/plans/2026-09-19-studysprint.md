# StudySprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the StudySprint portfolio MVP — FastAPI modular monolith + React SPA + Postgres, running fully local via docker-compose.

**Architecture:** One FastAPI app with four deep modules (identity, matching, rooms, checkins) behind small service interfaces; React SPA talks HTTP + one WebSocket per session; Postgres 16 is the only datastore.

**Tech Stack:** Python 3.12, FastAPI 0.115, SQLAlchemy 2.0, Alembic, Pydantic v2, PyJWT, passlib[bcrypt], psycopg[binary], pytest + httpx, React 18 + Vite + TypeScript, react-router-dom, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-19-studysprint-design.md`

## Global Constraints

- Postgres from day one — no SQLite fallback; tests use a separate Postgres test DB with transactional rollback.
- Local server only — docker-compose with `db`, `api`, `web`; no cloud config, `.env` local only and never committed.
- JWT access lifetime 60min, refresh lifetime 7 days.
- Room quorum minimum 3 members; WS heartbeat every 15s; client re-syncs on timer drift >2s.
- Modules talk via service interfaces, never direct cross-module SQL.

## Review Focus

- Expired JWT presented to WS connect → expect `4401` close, client redirects to login.
- Second `promise_today` for same user+date → expect `409 AlreadyPromised`, streak unchanged.
- User in UTC+14 promises at 23:55 local crossing UTC date boundary → expect streak counted by user's local date, not UTC.
- Two users concurrently `join_group` on a group with 1 seat left → expect exactly one succeeds, other gets `409 GroupFull`.
- Client clock drifts >2s from server tick → expect client snaps to server `remaining_s`, no local accumulation.

---

## File Structure

```
backend/
  pyproject.toml
  alembic.ini / alembic/
  app/
    main.py                 — app factory, router mounting, error handlers
    shared/db.py            — engine, SessionLocal, get_db
    shared/auth.py          — password hash, JWT encode/decode, get_current_user
    shared/clock.py         — Clock protocol, SystemClock, FakeClock
    shared/errors.py        — domain errors + handlers
    modules/identity/{models,schemas,service,router}.py
    modules/matching/{models,schemas,service,router}.py
    modules/rooms/{models,schemas,service,router,ws}.py
    modules/checkins/{models,schemas,service,router}.py
  tests/{test_identity,test_matching,test_rooms,test_checkins}.py
  seed.py
frontend/
  package.json, vite.config.ts
  src/{main.tsx,App.tsx,routes/,components/,hooks/useRoomSocket.ts,lib/api.ts}
docker-compose.yml, Makefile, .env.example
```

### Task 1: Local scaffold (compose + Postgres + health)

**Files:**
- Create: `docker-compose.yml`, `Makefile`, `.env.example`, `.gitignore` (append), `backend/pyproject.toml`, `backend/app/main.py`, `backend/app/shared/db.py`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `GET /health -> {"status":"ok","db":"up"|"down"}`; `get_db()` session dependency used by all later tasks.

- [ ] **Step 1: Write docker-compose + Makefile + pyproject**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: studysprint
      POSTGRES_PASSWORD: studysprint
      POSTGRES_DB: studysprint
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
  api:
    build: ./backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    environment:
      DATABASE_URL: postgresql+psycopg://studysprint:studysprint@db:5432/studysprint
      JWT_SECRET: dev-secret-change-me
    ports: ["8000:8000"]
    depends_on: [db]
  web:
    build: ./frontend
    ports: ["5173:5173"]
volumes:
  pgdata:
```

```makefile
# Makefile
dev:
	docker compose up --build
test:
	docker compose run --rm api pytest -q
seed:
	docker compose run --rm api python seed.py
```

```toml
# backend/pyproject.toml
[project]
name = "studysprint"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi==0.115.*",
  "uvicorn[standard]",
  "sqlalchemy==2.0.*",
  "alembic",
  "pydantic>=2.0",
  "pydantic-settings",
  "pyjwt",
  "passlib[bcrypt]",
  "psycopg[binary]",
  "httpx",
  "pytest",
]
```

- [ ] **Step 2: Write failing health test**

```python
# backend/tests/test_health.py
from fastapi.testclient import TestClient
from app.main import app

def test_health_ok():
    r = TestClient(app).get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_health.py -v`
Expected: FAIL with "app.main not found" / import error.

- [ ] **Step 4: Write minimal implementation**

```python
# backend/app/main.py
from fastapi import FastAPI
from sqlalchemy import text
from app.shared.db import engine

app = FastAPI(title="StudySprint")

@app.get("/health")
def health():
    try:
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
        db = "up"
    except Exception:
        db = "down"
    return {"status": "ok", "db": db}
```

```python
# backend/app/shared/db.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://studysprint:studysprint@localhost:5432/studysprint",
)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && DATABASE_URL=postgresql+psycopg://studysprint:studysprint@localhost:5432/studysprint python -m pytest tests/test_health.py -v`
Expected: PASS (requires local Postgres from `docker compose up db`).

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml Makefile backend/pyproject.toml backend/app/main.py backend/app/shared/db.py backend/tests/test_health.py .env.example
git commit -m "feat: local scaffold with compose, postgres, health check"
```

### Task 2: Identity module (register/login/me)

**Files:**
- Create: `backend/app/shared/auth.py`, `backend/app/shared/errors.py`, `backend/app/modules/identity/models.py`, `backend/app/modules/identity/schemas.py`, `backend/app/modules/identity/service.py`, `backend/app/modules/identity/router.py`
- Modify: `backend/app/main.py` (mount router), `backend/app/shared/db.py` (import Base subclasses)
- Test: `backend/tests/test_identity.py`

**Interfaces:**
- Consumes: `get_db()` from Task 1.
- Produces: `POST /auth/register`, `POST /auth/login -> {access_token, refresh_token}`, `GET /auth/me`, `get_current_user` dependency; `authenticate(token) -> User` used by rooms WS (Task 4).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_identity.py
from fastapi.testclient import TestClient
from app.main import app

def test_register_login_me():
    c = TestClient(app)
    r = c.post("/auth/register", json={"email": "a@x.com", "password": "secret123", "timezone": "UTC", "subjects": ["math"], "goals": ["exam"]})
    assert r.status_code == 201, r.text
    r = c.post("/auth/login", json={"email": "a@x.com", "password": "secret123"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    r = c.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "a@x.com"

def test_duplicate_register_409():
    c = TestClient(app)
    c.post("/auth/register", json={"email": "b@x.com", "password": "secret123", "timezone": "UTC", "subjects": [], "goals": []})
    r = c.post("/auth/register", json={"email": "b@x.com", "password": "secret123", "timezone": "UTC", "subjects": [], "goals": []})
    assert r.status_code == 409
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_identity.py -v`
Expected: FAIL with 404 (no such route).

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/modules/identity/models.py
from sqlalchemy import String, ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from app.shared.db import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")
    subjects: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    goals: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
```

```python
# backend/app/modules/identity/service.py
from datetime import datetime, timedelta, timezone
import jwt, os
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from .models import User

SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def register(db: Session, email: str, password: str, timezone_: str, subjects: list[str], goals: list[str]) -> User:
    from fastapi import HTTPException
    if db.query(User).filter_by(email=email).first():
        raise HTTPException(409, "EmailTaken")
    u = User(email=email, password_hash=pwd.hash(password), timezone=timezone_, subjects=subjects, goals=goals)
    db.add(u); db.commit(); db.refresh(u)
    return u

def _token(user_id: int, minutes: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    return jwt.encode({"sub": str(user_id), "exp": exp}, SECRET, algorithm="HS256")

def login(db: Session, email: str, password: str) -> dict:
    from fastapi import HTTPException
    u = db.query(User).filter_by(email=email).first()
    if not u or not pwd.verify(password, u.password_hash):
        raise HTTPException(401, "BadCredentials")
    return {"access_token": _token(u.id, 60), "refresh_token": _token(u.id, 7 * 24 * 60)}

def authenticate(token: str, db: Session) -> User:
    from fastapi import HTTPException
    try:
        payload = jwt.decode(token, SECRET, algorithms=["HS256"])
        u = db.get(User, int(payload["sub"]))
    except Exception:
        raise HTTPException(401, "BadToken")
    if not u:
        raise HTTPException(401, "BadToken")
    return u
```

Router + schemas follow the same shape (register 201, login, me via `get_current_user` = `Depends` on bearer token → `authenticate`). Mount with `app.include_router(router, prefix="/auth")` in `main.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_identity.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/modules/identity backend/app/shared/auth.py backend/app/shared/errors.py backend/app/main.py backend/tests/test_identity.py
git commit -m "feat: identity module with JWT register/login/me"
```

### Task 3: Matching module (propose_group/join_group)

**Files:**
- Create: `backend/app/modules/matching/models.py`, `schemas.py`, `service.py`, `router.py`
- Modify: `backend/app/main.py` (mount `/groups`)
- Test: `backend/tests/test_matching.py`

**Interfaces:**
- Consumes: `get_current_user` from Task 2; `User` model.
- Produces: `POST /groups/find -> Group | {status:"queued"}`; `POST /groups/{id}/join`; `matching.propose_group(db, user)` used by seed (Task 7). Race rule: last seat wins, loser gets 409 GroupFull (Review Focus #4 pins this).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_matching.py
def test_matching_forms_group_and_full_race(client, user_a, user_b, user_c, user_d):
    g = client.post("/groups/find", headers=user_a).json()
    assert g["status"] in ("matched", "queued")
    # fill group to capacity 4, fifth join -> 409
    for h in (user_b, user_c, user_d):
        client.post("/groups/find", headers=h)
    r = client.post(f"/groups/{g['id']}/join", headers=extra_user_header())
    assert r.status_code in (200, 409)
```

(Conftest `client`, `user_*` fixtures use transactional rollback; `extra_user_header` registers a 5th user.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_matching.py -v`
Expected: FAIL with 404.

- [ ] **Step 3: Write minimal implementation**

```python
# backend/app/modules/matching/service.py
GROUP_SIZE = 4

def score(a: User, b: User) -> int:
    s = len(set(a.subjects) & set(b.subjects)) * 3
    s += len(set(a.goals) & set(b.goals)) * 2
    if a.timezone == b.timezone:
        s += 2
    return s

def propose_group(db: Session, user: User) -> dict:
    # find open group with best average score, else create
    ...
def join_group(db: Session, user: User, group_id: int) -> dict:
    # SELECT ... FOR UPDATE on group row; if full -> 409 GroupFull
    ...
```

Full body: query groups with `member_count < 4`, pick max avg `score`, `SELECT ... FOR UPDATE` inside transaction for the race guarantee.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_matching.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/modules/matching backend/tests/test_matching.py
git commit -m "feat: matching module with scored propose_group and race-safe join"
```

### Task 4: Rooms module (session HTTP + WebSocket live sync)

**Files:**
- Create: `backend/app/modules/rooms/models.py`, `schemas.py`, `service.py`, `router.py`, `ws.py`
- Modify: `backend/app/main.py` (mount HTTP + WS)
- Test: `backend/tests/test_rooms.py`

**Interfaces:**
- Consumes: `authenticate(token)` from Task 2; `get_db`.
- Produces: `POST /groups/{id}/sessions {duration_s} -> Session{starts_at}`; `WS /ws/rooms/{sid}?token=` with `join/state_snapshot/heartbeat/presence/tick/complete/finalized`; `useRoomSocket` (Task 6) consumes this protocol. Drift rule >2s and expired-token `4401` (Review Focus #1, #5) pinned here.

- [ ] **Step 1: Write the failing test**

```python
def test_session_lifecycle_and_ws_reject_bad_token(client, group_headers):
    r = client.post(f"/groups/{gid}/sessions", json={"duration_s": 1500}, headers=group_headers)
    assert r.status_code == 201
    sid = r.json()["id"]
    with pytest.raises(Exception):  # bad token -> 4401 close
        ws_connect(f"/ws/rooms/{sid}?token=BAD")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_rooms.py -v`
Expected: FAIL with 404.

- [ ] **Step 3: Write minimal implementation**

```python
# service.py
def start_session(db, group_id, duration_s=1500) -> Session:
    s = Session(group_id=group_id, starts_at=datetime.now(timezone.utc), duration_s=duration_s, status="live")
    db.add(s); db.commit(); db.refresh(s); return s

# ws.py — on connect: authenticate(?token=) else close 4401
# on join: send {"type":"state_snapshot","remaining_s":...,"participants":[...]}
# on heartbeat: update presence, broadcast {"type":"presence",...}
# server tick loop broadcasts {"type":"tick","remaining_s":...} every 5s
# on complete: mark finalized, broadcast {"type":"finalized"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_rooms.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/modules/rooms backend/tests/test_rooms.py
git commit -m "feat: rooms module with live WS timer and presence"
```

### Task 5: Check-ins module (promise/complete/streak/scoreboard)

**Files:**
- Create: `backend/app/modules/checkins/models.py`, `schemas.py`, `service.py`, `router.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_checkins.py`

**Interfaces:**
- Consumes: `Clock` (`shared/clock.py`: `SystemClock` prod, `FakeClock` tests) — `complete_today(user, date, clock)`.
- Produces: `POST /checkins/promise`, `POST /checkins/complete`, `GET /checkins/streak`, `GET /groups/{id}/scoreboard`. Double-promise 409 and local-date streak boundary (Review Focus #2, #3) pinned here.

- [ ] **Step 1: Write the failing test**

```python
def test_double_promise_409_and_streak_with_fake_clock(client, headers):
    assert client.post("/checkins/promise", json={"text": "ch2", "date": "2026-09-19"}, headers=headers).status_code == 201
    r = client.post("/checkins/promise", json={"text": "again", "date": "2026-09-19"}, headers=headers)
    assert r.status_code == 409
    client.post("/checkins/complete", json={"date": "2026-09-19"}, headers=headers)
    assert client.get("/checkins/streak", headers=headers).json()["streak"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_checkins.py -v`
Expected: FAIL with 404.

- [ ] **Step 3: Write minimal implementation**

```python
# service.py
def promise_today(db, user, text, date) -> Promise:
    if db.query(Promise).filter_by(user_id=user.id, date=date).first():
        raise HTTPException(409, "AlreadyPromised")
    ...
def complete_today(db, user, date, clock) -> Streak:
    # mark completion; streak = consecutive local-date completions via user's timezone
    ...
def scoreboard(db, group_id) -> list[{"email","streak","done_today"}]:
    ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_checkins.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/modules/checkins backend/app/shared/clock.py backend/tests/test_checkins.py
git commit -m "feat: checkins with streaks and scoreboard"
```

### Task 6: Frontend (auth → matching → room → check-ins)

**Files:**
- Create: `frontend/package.json`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `src/lib/api.ts`, `src/hooks/useRoomSocket.ts`, routes `Login, FindGroup, Room, Board`, `src/components/*`
- Test: `frontend/src/hooks/useRoomSocket.test.ts` (Vitest: reconnect + drift snap)

**Interfaces:**
- Consumes: all HTTP/WS contracts from Tasks 2–5 (exact paths above).
- Produces: clickable demo path used by Task 7 seed verification.

- [ ] **Step 1: Write failing hook test**

```ts
// useRoomSocket.test.ts
import { describe, it, expect } from "vitest";
// WS mock server sends tick with remaining_s 10s behind local -> expect snap
describe("useRoomSocket", () => {
  it("snaps to server tick on drift >2s", () => { expect(snapNeeded(100, 97)).toBe(true); });
});
```

- [ ] **Step 2: Run to verify fail** — `cd frontend && npm test` → FAIL (hook missing).
- [ ] **Step 3: Implement `api.ts` (fetch wrapper with JWT), `useRoomSocket.ts` (connect with ?token=, heartbeat 15s, drift snap >2s, auto-reconnect 3x, 4401 → logout), four routes.**
- [ ] **Step 4: Run to verify pass** — `npm test` PASS + `npm run build` succeeds.
- [ ] **Step 5: Commit** — `git commit -m "feat: frontend SPA with live room socket"`

### Task 7: Seed + demo verification

**Files:**
- Create: `backend/seed.py` (12 users / 3 timezones / 3 groups / 1 live session)
- Test: manual demo checklist in `docs/DEMO.md`

- [ ] **Step 1: Write seed using Task 3 + 4 service interfaces** (no raw SQL).
- [ ] **Step 2: Run `make seed`, then `make dev`; click register → find group → join room → promise/complete → board.**
- [ ] **Step 3: Run full suite `make test` (pytest -q, all green).**
- [ ] **Step 4: Commit** — `git commit -m "chore: seed data and demo checklist"`
