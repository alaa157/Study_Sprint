# StudySprint — Codebase Design Spec (2026-09-19)

## 1. Intent (agreed brief)

- **Outcome:** Portfolio MVP of StudySprint — students matched into small study groups by subject/timezone/goals; groups run shared focus sessions with live timer; daily check-ins ("did you do what you promised?") drive streaks + group scoreboard.
- **Success:** Working local demo an employer can run (`make dev`, `make seed`) and click through end-to-end: register → find group → live timer room → promise/complete → streak + board.
- **Constraints:** Python backend (FastAPI). Postgres from day one. True live sync for timer + presence. Local server only — no cloud deploy.
- **Assumptions:** Single developer, small scale (tens of groups). Simple JWT auth, no SSO/payments. React SPA frontend. Postgres 16 via docker-compose locally.

## 2. Architecture (Approach A: deep modular monolith)

Single deploy, three processes locally: `api` (FastAPI), `web` (Vite React), `db` (Postgres 16). No Redis, no split services, no cloud.

Four deep **modules**, each with one **interface** at one **seam**. Shared kernel only: `db session`, `clock`, `auth dep`.

```
backend/app/modules/{identity,matching,rooms,checkins}/{router.py,service.py,models.py,schemas.py}
backend/app/shared/{db.py,auth.py,clock.py,errors.py}
frontend/src/{routes,components,hooks/useRoomSocket.ts}
docker-compose.yml — db, api, web
```

- `identity` — register/login/me, JWT (access 60min, refresh 7d). Interface: `authenticate(token) -> User`.
- `matching` — `propose_group(user) -> Group | Queued`, `join_group()`. Hides scoring (subject + tz overlap + goal tags). Leverage: one call serves API + tests + seed.
- `rooms` — `start_session(group_id)`, WS `join/heartbeat/complete`. Owns timer truth + presence. Deepest module for locality.
- `checkins` — `promise_today()`, `complete_today()`, `streak(user)`, `scoreboard(group)`. One write path drives streaks + board.

Deletion test: deleting `matching` pushes group-formation complexity into callers; deleting `rooms` spreads timer sync everywhere; deleting `checkins` spreads streak math. All earn their keep.

## 3. Data flow + interfaces

- **Matching:** `POST /groups/find` → `matching.propose_group(profile)`. Scores queued users; quorum min 3 else `Queued`. Weights hidden behind interface.
- **Room (live sync):** `POST /groups/{id}/sessions` creates row (server truth: `starts_at, duration_s`). `WS /ws/rooms/{session_id}?token=` → `join → state_snapshot`, `heartbeat 15s → presence`, `complete → finalized`. Server broadcasts `tick + presence`. Client timer display-only, re-syncs on drift >2s. Reconnect logic in `useRoomSocket` only.
- **Check-ins:** `POST /checkins/promise {text}` + `POST /checkins/complete` → `complete_today(user, date, clock) -> Streak`. Date math uses injected `clock` internal seam.

Postgres tables: `users, groups, group_members, sessions, session_participants, promises, completions`. Modules own their tables; cross-module reads go via interfaces, not direct SQL joins.

## 4. Auth + error handling

All HTTP routers depend on `get_current_user`; WS authenticates via `?token=` at connect, rejects with `4401`. Domain errors (`GroupFull, SessionEnded, AlreadyPromised`) map to 4xx in one handler per module; 5xx never leak SQL. Frontend: toast + retry on WS drop, re-auth on 401.

## 5. Testing

Interface is the test surface. Each module tested through its service interface against real Postgres (test DB, transactional rollback) + `FakeClock` internal seam for streak/timer determinism. `matching` scorer has pure unit tests. Frontend: Vitest for streak display + WS hook reconnect. No mocks of Postgres adapters in service tests.

## 6. Local run (no cloud)

- `docker-compose.yml`: `db (postgres:16, volume pgdata)`, `api (uvicorn --reload, .env)`, `web (vite dev, VITE_API_URL)`.
- `make dev` (compose up), `make test` (pytest + vitest), `make seed` (12 demo users, 3 timezones, 3 groups, 1 live session).
- `.env.example` checked in; `.env` local only, never committed.

## 7. Out of scope (YAGNI)

Multi-instance scaling, Redis pub/sub, SSO, payments, mobile app, admin panel, cloud CI/CD. Second adapter (e.g. in-memory) only if a real second use appears — one adapter means a hypothetical seam.
