# StudySprint Demo Checklist

Employer-friendly local demo. Everything runs on your machine via docker-compose;
no cloud, no accounts, no external services.

Verified against this repo: `make test` 23 passed, seed run twice with identical
output, newcomer register → find → session path returns `matched` + `201`.

## Setup (order matters: db first, then seed)

```bash
make dev    # db :5432, api :8000, web :5173 (first boot builds images)
make seed   # 12 users / 3 groups / 1 live session / check-ins (idempotent)
```

- API health: http://localhost:8000/health → `{"status":"ok","db":"up"}`
- API docs: http://localhost:8000/docs
- App: http://localhost:5173

Seeded logins (password for all: `secret123`):

| Email                 | Timezone           | Cohort  |
| --------------------- | ------------------ | ------- |
| demo-math-0@x.com     | UTC                | math    |
| demo-math-1@x.com     | America/New_York   | math    |
| demo-math-2@x.com     | Pacific/Kiritimati | math    |
| demo-math-3@x.com     | UTC                | math    |
| demo-physics-0@x.com  | America/New_York   | physics |
| demo-physics-1@x.com  | Pacific/Kiritimati | physics |
| demo-physics-2@x.com  | UTC                | physics |
| demo-physics-3@x.com  | America/New_York   | physics |
| demo-biology-0@x.com  | Pacific/Kiritimati | biology |
| demo-biology-1@x.com  | UTC                | biology |
| demo-biology-2@x.com  | America/New_York   | biology |
| demo-biology-3@x.com  | Pacific/Kiritimati | biology (ungrouped) |

Groups #1 (math) and #2 (physics) are full at 4/4; group #3 (biology) sits at
3/4 with one seat open, so a newcomer registering with matching interests joins
a real group (`matched`) instead of stranding in a solo queue.

## Click path (2 minutes)

1. **Log in** as `demo-math-0@x.com` (`secret123`), or register a new user.
2. **Find my study group** → the readiness badge shows "Ready to start"
   (quorum is 3, group #1 has 4).
3. **Start a focus sprint** → the room opens: timer in the header,
   "Today's group commitments" above "Focus status".
4. **Make today's promise** (`finish chapter 3`) → polite feedback
   "Promise saved for today." A second identical promise → `409` surfaces
   "You already made a promise today."
5. **I'm done** → "Done! Your streak is N days." The promise button stops
   asking; completing again is terminal, not a re-prompt.
6. **Scoreboard** (follow the link from the room): streak summary plus each
   member's "Complete today" / "Not complete" status text.
7. **Finalize room session** → all windows see "Session finished".

## Visible states to demo

- `reconnecting`: devtools → offline for ~5s — the header shows
  "Reconnecting… (attempt N of 3)"; after 3 tries it shows "Connection lost".
- `finalized`: Finalize room session → "Session finished".
- `unavailable`: open `/room/999999` in a new tab → "This session is no
  longer available. Start a new focus sprint with your group."
- Duplicate promise: `409` → "You already made a promise today."
- `409 GroupFull`: join a full group by ID → "That group just filled up.
  Try finding another group."
- `404 PromiseNotFound`: "I'm done" before promising → "Make your promise
  first, then mark it complete."
- Room `groupId` is remembered in `sessionStorage` (`ss_group`), so a
  refresh keeps the scoreboard link working.
- The timer is server-synchronized: a >2s drift snaps to the server tick.

## What to look for

- Second promise for the same date → `409 AlreadyPromised`, streak unchanged.
- Fifth join on a full group (Join by ID) → `409 GroupFull`.
- Bad/expired token on the WS → socket closes `4401`, client returns to login.
- Streaks follow each user's **registered** timezone date, not UTC; completing
  a future date → `400 FutureDate`.
- Refresh tokens rotate via `POST /auth/refresh` and never work as access tokens.

## Full verification

```bash
make test          # backend pytest suite in compose (isolated test DB, rolled back)
cd frontend && npm test && npm run build
```
