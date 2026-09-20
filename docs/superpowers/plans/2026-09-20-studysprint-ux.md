# StudySprint UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the existing React SPA into a polished, session-first StudySprint experience with the friendly-library visual system and commitment-circle room hierarchy.

**Architecture:** Keep the existing route/API/WebSocket contracts and improve the frontend through focused presentation components, shared design tokens, and explicit UI state handling. The current `api` and `RoomSocketClient` remain the only integration boundaries; no backend or datastore changes are planned.

**Tech Stack:** React 18, TypeScript, React Router 6, Vite, Vitest, existing FastAPI HTTP API, existing WebSocket room protocol.

**Spec:** `docs/superpowers/specs/2026-09-20-studysprint-ux-design.md`

## Global Constraints

- **Core concept:** Focus command center
- **Visual tone:** Friendly library
- **Navigation:** Session-first
- **Room hierarchy:** Commitment circle
- **Primary action:** Make or complete a study promise
- Preserve the existing FastAPI, Postgres, JWT, HTTP, and WebSocket contracts.
- Do not add a dashboard route, backend subsystem, datastore, third-party component system, or new authentication provider.
- Use text labels in addition to color/icons for presence and status.
- Use the server timer as the source of truth; preserve >2s drift correction, 15s heartbeats, 3 reconnect attempts, and close code `4401`.
- Keep the demo path working: register/login → find group → start/join room → promise → complete → scoreboard.

## Review Focus

- **Missing group/session data:** the UI must show an explicit empty or unavailable state instead of rendering a blank card or throwing.
- **WebSocket reconnect/finalization:** reconnecting, failed reconnect, finalized, and expired-token states must be visible and actionable.
- **Duplicate or invalid check-in:** `409 AlreadyPromised` and date validation must remain visible as user-facing feedback.
- **Narrow viewport:** the promise action and commitment list must remain usable without horizontal scrolling on mobile.
- **Keyboard and non-color status:** all primary actions must be reachable by keyboard, and focused/away/complete states must have text or icon equivalents.

---

### Task 1: Creating the friendly-library design foundation

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/app.css`
- Create: `frontend/src/components/AppShell.tsx`
- Create: `frontend/src/components/StatusMessage.tsx`
- Create: `frontend/src/components/LoadingState.tsx`
- Create: `frontend/src/components/EmptyState.tsx`
- Create: `frontend/src/components/ProtectedLayout.tsx`
- Create: `frontend/src/lib/copy.ts`
- Create: `frontend/src/lib/nav.ts`
- Create: `frontend/src/styles/designSystem.test.ts`
- Create: `frontend/src/test/stubs.ts`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/components/StatusMessage.test.tsx`

**Interfaces:**
- Consumes: React children and plain status props.
- Produces: `AppShell({ children, title? })`, `StatusMessage({ tone, children })`, `LoadingState({ label })`, and `EmptyState({ title, description, action? })` presentation components used by later route tasks.

- [ ] **Step 1: Write the failing component tests**

```tsx
import { describe, expect, it } from "vitest";
import { statusToneClass } from "./StatusMessage";

describe("StatusMessage", () => {
  it("maps a reconnecting tone to a stable class", () => {
    expect(statusToneClass("reconnecting")).toBe("status status--reconnecting");
  });
});
```

Extend `StatusMessage.test.tsx` to assert **every** tone in the
`"info" | "ready" | "waiting" | "attention" | "complete" | "reconnecting" | "error"` union
(D10) plus a `renderToStaticMarkup` check for the `role="status"` element.
The exact test file is in F3 of `2026-09-20-studysprint-ux-fixes.md` (§ F3.1) — use it verbatim.

Keep this task’s test framework dependency-free: test the exported
`statusToneClass("reconnecting")` helper and validate the rendered semantic
markup through the production build rather than adding a component library.

- [ ] **Step 2: Run the focused test and confirm the missing component fails**

Run: `cd frontend && npm test -- src/components/StatusMessage.test.tsx`

Expected: FAIL because the new shared component and style exports do not exist.

- [ ] **Step 3: Add tokens and shared layout primitives**

Define CSS custom properties for the agreed palette and spacing:

```css
:root {
  --ss-sage-50: #edf4f0;
  --ss-sage-100: #dce9e0;
  --ss-cream: #f7faf7;
  --ss-ink: #203128;
  --ss-muted: #597064;
  --ss-amber: #d99b42;
  --ss-amber-ink: #2e210e;
  --ss-border: #b8cabe;
  --ss-radius-card: 18px;
  --ss-radius-control: 10px;
  --ss-space-1: 0.25rem;
  --ss-space-2: 0.5rem;
  --ss-space-3: 0.75rem;
  --ss-space-4: 1rem;
  --ss-space-6: 1.5rem;
  --ss-space-8: 2rem;
}
```

`AppShell({ title, roomSessionId, children })` must provide a semantic `header`,
navigation links for `Find a group`, `Scoreboard`, and the current room when
applicable, and a `main` landmark. The title comes from `navTitle(pathname)` and
`roomSessionId` from `roomSessionIdFromPath(pathname)`, both in
`frontend/src/lib/nav.ts` (F1). Render router-connected components in tests only
inside `MemoryRouter` with the `React.useLayoutEffect = React.useEffect` shim
(D3, test recipe §4(b) of the fixes plan). `app.css` must define visible
`:focus-visible` styles, responsive card/grid utilities, button/input states, a
class for **every** status tone (D10, verified by `designSystem.test.ts`), and
mobile stacking at a single readable breakpoint. The exact component sources are
in F3 of `2026-09-20-studysprint-ux-fixes.md` — use them verbatim.

- [ ] **Step 4: Import the styles and wrap routes with the shell**

Import `tokens.css` and `app.css` from `main.tsx`. Wire the shell as a
**layout route**: add `frontend/src/components/ProtectedLayout.tsx` and nest the
protected routes under `<Route element={<ProtectedLayout />}>` in `App.tsx`,
leaving `/login` outside it (H4 — a shell wrapped around `<Routes>` cannot read
route params; the exact structure is in F3 of the fixes plan).
Do not change route paths or API calls in this task.

- [ ] **Step 5: Run tests and the production build**

Run: `cd frontend && npm test && npm run build`

Expected: PASS; the existing socket tests and TypeScript build remain green.

- [ ] **Step 6: Commit the foundation**

```bash
git add frontend/src/styles frontend/src/components frontend/src/main.tsx frontend/src/App.tsx frontend/src/components/StatusMessage.test.tsx
git commit -m "feat: add StudySprint friendly-library UI foundation"
```

### Task 2: Refining authentication and group discovery

**Files:**
- Modify: `frontend/src/routes/Login.tsx`
- Modify: `frontend/src/routes/FindGroup.tsx`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/components/GroupCard.tsx`
- Create: `frontend/src/components/ReadinessBadge.tsx`
- Test: `frontend/src/routes/FindGroup.test.tsx`

**Interfaces:**
- Consumes: `api.register`, `api.login`, `api.findGroup`, `api.joinGroup`, `api.createSession`, `ApiError`, `errorMessage`, and the shared presentation components from Task 1.
- Produces: `GroupCard({ group, onStart, busy })` and `ReadinessBadge({ tone, label })` (the join-by-ID form stays in `FindGroup`; there is no `onJoin` prop); preserves navigation to `/room/:sid` with `groupId` route state and `rememberGroup` in `sessionStorage` (`ss_group`, D6).

- [ ] **Step 1: Write tests for group loading, matched, queued, and full states**

Pin these behaviors with route-level tests or pure view-model tests:

```ts
import { describe, expect, it } from "vitest";
import { groupReadiness } from "../lib/groupView";

describe("groupReadiness", () => {
  it("reports ready when quorum is met", () => {
    expect(groupReadiness({ id: 1, member_count: 3, max_members: 4, status: "matched" })).toEqual({
      tone: "ready",
      label: "Ready to start",
    });
  });

  it("reports queued when matching has not reached quorum", () => {
    expect(groupReadiness({ id: 1, member_count: 2, max_members: 4, status: "queued" })).toEqual({
      tone: "waiting",
      label: "Waiting for 1 more learner",
    });
  });

  it("trusts counts over a stale server status", () => {
    expect(groupReadiness({ id: 1, member_count: 4, max_members: 4, status: "queued" })).toEqual({
      tone: "ready",
      label: "Ready to start",
    });
  });
});
```

`groupReadiness` lives in `frontend/src/lib/groupView.ts` — **not** in
`FindGroup.tsx` — with `GROUP_SIZE = 4` / `QUORUM_MIN = 3` mirroring
`backend/app/modules/matching/service.py` (H1, D8). Skip the "rendering a
`role="alert"`" and "navigating to `/room/:id`" assertions: error copy is covered
by the pure `messages`/`groupView` tests in F2/F4 and `parseGroupId` guards the
join-by-ID input (F4). The exact test file is in F4 of the fixes plan.

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run: `cd frontend && npm test -- src/routes/FindGroup.test.tsx`

Expected: FAIL because `groupReadiness`, the new card, and the polished states do
not exist.

- [ ] **Step 3: Implement the group discovery presentation**

Add a named `groupReadiness` helper with the exact return shape tested above.
Replace raw paragraphs and unlabelled controls with:

- A page heading and short explanation of matching by subject, goals, and
  timezone.
- A primary `Find my study group` button.
- A secondary join-by-ID form with a labelled numeric input.
- Loading text while requests are pending.
- `GroupCard` showing member count, status, readiness, and a primary
  `Start a focus sprint` action when the group is ready.
- A queued state explaining what is missing.
- A `409 GroupFull` state that suggests finding another group (`friendlyMessage`
  copy from `src/lib/messages.ts`).

Import `PRIMARY_ACTIONS` from `src/lib/copy.ts` for all button labels, guard the
join-ID input with `parseGroupId` (a typo shows the validation message instead of
a 422), and call `rememberGroup(group.id)` from `src/lib/groupContext.ts` when a
session starts so the room can recover its `groupId` after refresh (D6).

Keep `api.createSession(group.id)` unchanged and preserve the existing room
navigation state. Disable buttons during their own request and restore them
after success or failure.

- [ ] **Step 4: Refine the auth route**

Add the product promise from `PRODUCT_PROMISE` (`src/lib/copy.ts`: "Find your
people. Keep your promise."), explicit labels associated with email/password
inputs, a submit loading state, and actionable error text from the hardened
`errorMessage` (F2). Keep login/register mode switching and token storage
behavior unchanged. Remove the unauthenticated scoreboard link because protected
navigation belongs in `AppShell`.

- [ ] **Step 5: Run focused tests and build**

Run: `cd frontend && npm test -- src/routes/FindGroup.test.tsx && npm run build`

Expected: PASS with no route or type regressions.

- [ ] **Step 6: Commit group discovery and auth**

```bash
git add frontend/src/routes/Login.tsx frontend/src/routes/FindGroup.tsx frontend/src/lib/api.ts frontend/src/components/GroupCard.tsx frontend/src/components/ReadinessBadge.tsx frontend/src/routes/FindGroup.test.tsx
git commit -m "feat: polish auth and group discovery flow"
```

### Task 3: Building the commitment-circle room

**Files:**
- Modify: `frontend/src/routes/Room.tsx`
- Modify: `frontend/src/hooks/useRoomSocket.ts`
- Modify: `frontend/src/lib/roomSocket.ts`
- Modify: `frontend/src/components/TimerDisplay.tsx`
- Create: `frontend/src/components/RoomHeader.tsx`
- Create: `frontend/src/components/CommitmentList.tsx`
- Create: `frontend/src/components/PresenceList.tsx`
- Create: `frontend/src/components/PromiseControls.tsx`
- Test: `frontend/src/routes/Room.test.tsx`
- Test: `frontend/src/components/CommitmentList.test.tsx`
- Create: `frontend/src/lib/roomView.ts`
- Test: `frontend/src/lib/roomView.test.ts`
- Modify: `frontend/src/hooks/useRoomSocket.test.ts` (keep the file compiling
  when `RoomEvents` gains callbacks — B3)

**Interfaces:**
- Consumes: `useRoomSocket(sessionId)`, `Participant`, `api.promise`, `api.complete`, `api.scoreboard`, and the existing room message protocol.
- Produces: room UI states `connecting | live | reconnecting | finalized | unavailable | error`, accessible commitment/presence components, and unchanged socket wire messages (`join`, `heartbeat`, `complete`).

- [ ] **Step 1: Write tests for the commitment hierarchy and room states**

Use pure props for commitment rendering so tests do not depend on live time:

```tsx
import type { CommitmentInput } from "../lib/roomView";

const participants: CommitmentInput[] = [
  { id: 1, email: "maya@example.com", online: true, promiseText: null, promised: false, completed: true, completionKnown: true },
  { id: 2, email: "alex@example.com", online: true, promiseText: null, promised: false, completed: false, completionKnown: true },
];

it("marks the current user's missing promise as the next action", () => {
  expect(commitmentState(participants[1], 2)).toEqual({
    label: "Add your promise",
    tone: "attention",
    action: "promise",
  });
  expect(commitmentState(participants[0], 2)).toEqual({
    label: "Complete",
    tone: "complete",
    action: null,
  });
});
```

Import `commitmentState`, `mergeCommitments`, `statusLabel`, and
`timerAriaLabel` from `frontend/src/lib/roomView.ts` (F1). `timerAriaLabel` is
tested in `roomView.test.ts` — not in `CommitmentList.test.tsx` (H5). The
component markup must use those values and the build must preserve the semantic
`role="status"` and `aria-live="polite"` attributes (exactly one polite live
region per room).

- [ ] **Step 2: Run the focused room tests and confirm they fail**

Run: `cd frontend && npm test -- src/routes/Room.test.tsx src/components/CommitmentList.test.tsx`

Expected: FAIL because the commitment components and explicit room statuses do
not exist.

- [ ] **Step 3: Define presentation types and components**

Do **not** add `promise`/`completed` to the participant view model — the room
WebSocket snapshot is `{id, email, online}` only and no endpoint exposes another
member's promise text (B1). Instead use `CommitmentInput` +
`mergeCommitments(people, scoreboardRows, currentUser, localPromise)` from
`src/lib/roomView.ts`: peers expose presence + today's completion only, sourced
from the existing scoreboard call (`done_today`), and a failed scoreboard fetch
renders "Completion status unavailable" instead of guessing (D7).
Render:

- `RoomHeader` with subject/group identity, shared-intent copy, connection
  status, and compact timer.
- `CommitmentList` with complete/active/missing text labels.
- `PresenceList` with `focused`, `away`, and reconnecting text states.
- `PromiseControls` with labelled promise input, `Make today's promise`, and
  `I'm done` actions.

- [ ] **Step 4: Refactor `Room.tsx` into the commitment-circle layout**

Replace the raw page structure with semantic sections in this order:

1. Room identity/shared intent
2. Group commitments
3. Focus/presence status
4. Timer
5. Scoreboard link

Use `todayLocal()` unchanged for check-in dates. Show request loading states,
`AlreadyPromised`, future-date, network, and completion feedback through
`StatusMessage` with copy from `src/lib/messages.ts` (H2). Add an explicit
`unavailable` state for the server's `4404` unknown-session close (B5), derive
`groupId` via `resolveGroupId` (route state **or** the `ss_group` sessionStorage
key, D6), and gate "I'm done" behind the completed state so a completed user is
never re-prompted (H3). Disable promise/complete buttons while their request is
pending.

- [ ] **Step 5: Make socket connection states explicit**

Update `RoomStatus` and the hook callbacks so an abnormal close first exposes
`reconnecting`, then `error` after the existing three retries. Add
`onReconnecting`/`onUnavailable` to `RoomEvents` and update
`frontend/src/hooks/useRoomSocket.test.ts` in the same step — a required callback
missing from that file breaks `tsc --noEmit` (B3). The 4404 unknown-session close
maps to the `unavailable` state, never to reconnect attempts (B5). Keep `4401`
calling `logout()` without reconnecting. Keep finalized sessions from
continuing the local countdown. Add an accessible live status for connection
changes, but do not announce every timer tick.

- [ ] **Step 6: Run the full frontend test/build checks**

Run: `cd frontend && npm test && npm run build`

Expected: PASS; existing drift, heartbeat, reconnect, close-code, and local-date
tests remain green alongside the new room tests.

- [ ] **Step 7: Commit the room experience**

```bash
git add frontend/src/routes/Room.tsx frontend/src/hooks/useRoomSocket.ts frontend/src/hooks/useRoomSocket.test.ts frontend/src/lib/roomSocket.ts frontend/src/lib/roomView.ts frontend/src/lib/roomView.test.ts frontend/src/components/TimerDisplay.tsx frontend/src/components/RoomHeader.tsx frontend/src/components/CommitmentList.tsx frontend/src/components/PresenceList.tsx frontend/src/components/PromiseControls.tsx frontend/src/routes/Room.test.tsx frontend/src/components/CommitmentList.test.tsx
git commit -m "feat: build commitment-first live room"
```

### Task 4: Polishing scoreboard, responsive behavior, and accessibility

**Files:**
- Modify: `frontend/src/routes/Board.tsx`
- Modify: `frontend/src/components/TimerDisplay.tsx` (remove; the timer lives in `RoomHeader` — H5)
- Modify: `frontend/src/styles/app.css`
- Create: `frontend/src/components/ScoreboardRow.tsx` (this is the "row component" referenced below — H5)
- Create: `frontend/src/components/ScoreboardTable.tsx`
- Create: `frontend/src/lib/boardView.ts`
- Create: `frontend/src/routes/Board.test.tsx`

**Interfaces:**
- Consumes: `api.streak`, `api.scoreboard`, `ScoreboardEntry`, shared shell/status/empty components.
- Produces: an accessible scoreboard with explicit loading, empty, invalid-group, and error states; responsive styles shared by all routes (verified, not duplicated, by `frontend/src/styles/designSystem.test.ts`).

- [ ] **Step 1: Write scoreboard state tests**

Cover, with helpers in `frontend/src/lib/boardView.ts` (F1):

```ts
it("renders a useful empty state when the group has no rows", () => {
  expect(scoreboardMessage([])).toBe("No check-ins yet. Be the first to make today's promise.");
});

it("renders completion text instead of color-only status", () => {
  expect(completionLabel(true)).toBe("Complete today");
});
```

- [ ] **Step 2: Run the focused scoreboard tests and confirm they fail**

Run: `cd frontend && npm test -- src/routes/Board.test.tsx`

Expected: FAIL because the view-model helper, row component, and explicit
empty/loading states do not exist.

- [ ] **Step 3: Implement the scoreboard states**

Add a labelled group ID form only when no group is present in the URL, with the
input guarded by `parseGroupId` so a typo shows the validation message instead of
a 422 (F4). Render the current streak in a friendly-library summary card, then a
semantic table (`ScoreboardTable` + `ScoreboardRow`) with `Complete today` /
`Not complete` text. Add loading feedback, empty check-in copy, invalid
group/network error feedback via `messages.ts` copy (H2), and a link back to
`/find`. Keep `api.scoreboard(id)` and `api.streak()` unchanged.

- [ ] **Step 4: Finish responsive and keyboard behavior**

Add media-query rules that stack room columns and make promise controls full
width on narrow viewports. Verify every `button`, `input`, and navigation link
has a visible focus state and no fixed-width container causes horizontal
overflow. Add `aria-live="polite"` only to connection/request status regions.
Add `frontend/src/styles/designSystem.test.ts` asserting `:focus-visible`, the
mobile media query, and a `.status--…` class for **every** tone (H6, D10).

- [ ] **Step 5: Run tests and build**

Run: `cd frontend && npm test && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit scoreboard and accessibility polish**

```bash
git add frontend/src/routes/Board.tsx frontend/src/routes/Board.test.tsx frontend/src/components/ScoreboardRow.tsx frontend/src/components/ScoreboardTable.tsx frontend/src/styles/app.css
git commit -m "feat: polish scoreboard and accessible responsive states"
```

### Task 5: Verifying the portfolio demo and documenting the UX

**Files:**
- Modify: `docs/DEMO.md`
- Modify: `README.md`
- Create: `frontend/src/demo-flow.test.tsx`

**Interfaces:**
- Consumes: `PRIMARY_ACTIONS`, `PRODUCT_PROMISE`, and `HEADINGS` from `src/lib/copy.ts` (D9), plus the rendered `GroupCard` and `PromiseControls` markup.
- Produces: a documented two-minute reviewer path and regression coverage for the visible product narrative.

- [ ] **Step 1: Write the demo-flow regression test**

Use the real test in F7.1 of `2026-09-20-studysprint-ux-fixes.md` verbatim. It
imports `PRIMARY_ACTIONS`/`PRODUCT_PROMISE`/`HEADINGS` from `src/lib/copy.ts`
**and** asserts rendered markup (`renderToStaticMarkup` of `GroupCard` and
`PromiseControls`) — every assertion can fail (B6). Never assert a
`expect([A]).toEqual(expect.arrayContaining([A]))` tautology, and remember the
`asRendered` apostrophe-escape rule for markup assertions (§4(e) of the fixes
plan).

- [ ] **Step 2: Run the regression test and confirm it fails if labels are absent**

Run: `cd frontend && npm test -- src/demo-flow.test.tsx`

Expected: PASS with the shipped copy, and demonstrably FAIL after any copy drift
(temporarily change `PRIMARY_ACTIONS.complete` to `"Done"` in `lib/copy.ts`, see
the test fail, then revert — F7.2).

- [ ] **Step 3: Update demo documentation**

Update `docs/DEMO.md` with the polished click path:

1. Log in or register.
2. Find my study group → readiness badge shows "Ready to start" → Start a focus sprint.
3. In the commitment circle, make a promise ("Make today's promise").
4. Complete the promise ("I'm done") and finalize the room.
5. Open the scoreboard and verify the streak/completion proof.

Also demo the reload-safe `groupId` (room refresh keeps the scoreboard link via
`sessionStorage` `ss_group`), the `unavailable` state (`/room/999999`), and the
`reconnecting` → `Connection lost` sequence (go offline ~5s; header shows
"Reconnecting attempt N of 3", then "Connection lost" after 3 tries).

Document visible reconnecting/finalized/unavailable/error states and note that
the room timer is server-synchronized (>2s drift snaps to the server tick).
Keep all existing local setup commands and seeded credentials accurate.

- [ ] **Step 4: Update the README product description**

Describe the product using the approved narrative: small groups, shared focus
room, visible commitments, and streak/scoreboard proof. Do not claim features
not present in the current API or UI.

- [ ] **Step 5: Run the complete validation set**

Run:

```bash
cd frontend && npm test && npm run build
cd .. && make test
```

Expected: frontend tests/build and the backend suite pass without API or
WebSocket contract changes.

- [ ] **Step 6: Commit the verified demo documentation**

```bash
git add docs/DEMO.md README.md frontend/src/demo-flow.test.tsx
git commit -m "docs: document the StudySprint portfolio demo flow"
```

## Final review checklist

- [ ] The implementation matches `docs/superpowers/specs/2026-09-20-studysprint-ux-design.md`.
- [ ] `git diff --check` passes.
- [ ] `cd frontend && npm test && npm run build` passes.
- [ ] `make test` passes.
- [ ] Login/register, group discovery, room promise/completion, and scoreboard
  are all usable without horizontal scrolling at mobile width.
- [ ] The room presents shared commitments before timer/supporting context.
- [ ] No backend, datastore, or WebSocket protocol changes were introduced.
