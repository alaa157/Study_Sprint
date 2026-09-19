# StudySprint Demo Checklist

Employer-friendly local demo. Everything runs on your machine via docker-compose;
no cloud, no accounts, no external services.

## Setup

```bash
make seed   # 12 users / 3 groups / 1 live session / check-ins (idempotent)
make dev    # db :5432, api :8000, web :5173
```

- API health: http://localhost:8000/health → `{"status":"ok","db":"up"}`
- API docs: http://localhost:8000/docs
- App: http://localhost:5173

Seeded logins (password for all: `secret123`):

| Email                  | Timezone            | Group subject |
| ---------------------- | ------------------- | ------------- |
| demo-math-0@x.com      | UTC                 | math (#1)     |
| demo-physics-0@x.com   | America/New_York    | physics (#2)  |
| demo-biology-0@x.com   | Pacific/Kiritimati  | biology (#3)  |

## Click path (2 minutes)

1. **Register** a new user, or log in as `demo-math-0@x.com`.
2. **Find group** → status `matched`, 4/4 members → **Start session**.
3. **Room**: timer counts down, participants listed. Open the room in a
   second browser window: both see the same `tick`, presence updates.
4. **Promise** `finish chapter 3`, then **Complete check-in** → streak shown.
5. **Finalize room session** → all windows see `finalized`.
6. **Scoreboard** (auto-loaded from the room): streaks + `done_today`.

## What to look for

- Second promise for the same date → `409 AlreadyPromised`, streak unchanged.
- Fifth join on a full group → `409 GroupFull`.
- Bad/expired token on the WS → socket closes `4401`, client returns to login.
- Streaks follow each user's **local** date (try a `Pacific/Kiritimati` user).

## Full verification

```bash
make test          # backend pytest suite (separate test DB, rolled back)
cd frontend && npm test && npm run build
```
