# StudySprint UX Fix Plan (remediation for `2026-09-20-studysprint-ux.md`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan workstream-by-workstream. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `docs/superpowers/plans/2026-09-20-studysprint-ux.md` executable by removing the 13 verified defects in it, using **zero new dependencies** and **zero backend/API/WebSocket contract changes**.

**Architecture:** All new decision logic moves into pure, dependency-free helper modules under `frontend/src/lib/` (unit-testable in the existing `environment: "node"` Vitest setup). React components become thin renderers of those helpers. Components that touch the network/WebSocket keep the existing `api` and `RoomSocketClient` boundaries.

**Tech Stack:** React 18, TypeScript 5 (strict), React Router 6, Vite 5, Vitest 2, `react-dom/server` (already a dependency) for markup assertions.

**Source spec:** `docs/superpowers/specs/2026-09-20-studysprint-ux-design.md`
**Plan being remediated:** `docs/superpowers/plans/2026-09-20-studysprint-ux.md`
**Workstreams:** F0 (amend the plan doc) → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8 (validation).

---

## 1. Defect register (what this plan fixes)

Severity: **BLOCKER** = the UX plan's step cannot be completed as written, the build breaks, or the spec is violated. **HIGH** = wrong or unverifiable behaviour.

| ID | Sev | Defect (verified in this repo) | Fixed in |
| --- | --- | --- | --- |
| B1 | BLOCKER | The room snapshot is `{id, email, online}` only (`backend/app/modules/rooms/ws.py:29-42`) and no endpoint exposes another member's promise text (`checkins/router.py`). UX Task 3's `RoomParticipant.promise/completed` is unfillable for peers, and its fixture fabricates peer data. | F1, F5 |
| B2 | BLOCKER | No `@testing-library/react`, no `jsdom`/`happy-dom`; `frontend/vite.config.ts` sets `test.environment: "node"`; Node 24 has no `localStorage`/`window`. UX Tasks 2–4 Step 1 demand DOM/interaction tests. | F1, F2–F6 |
| B3 | BLOCKER | A required `onReconnecting` on `RoomEvents` breaks `frontend/src/hooks/useRoomSocket.test.ts:45-57` (`tsc --noEmit` covers `src/`), and that file is absent from UX Task 3's Files list. | F5 |
| B4 | BLOCKER | `errorMessage` returns FastAPI `detail` raw; a 422 sends `detail: [{msg,…}]` → `{error}` renders an object array → React **throws** (`Objects are not valid as a React child`, reproduced live). Reachable via `Number(joinId)`, `Number(id)`, >280-char promise text. Machine codes (`GroupFull`) also reach the user as copy. | F2 |
| B5 | BLOCKER | Spec §5.1 requires "Session expired or unavailable"; the server closes **4404** for an unknown session (`rooms/ws.py:106-109`) and `Room.tsx:17` does unguarded `Number(sid)`. UX `RoomStatus` has no such state. | F1, F5 |
| B6 | BLOCKER | UX Task 5's demo test is a tautology (`expect([A]).toEqual(expect.arrayContaining([A]))`) and imports a copy module no task creates. | F1, F7 |
| H1 | HIGH | Quorum is server-only (`matching/service.py:9-10`: `GROUP_SIZE = 4`, `QUORUM_MIN = 3`); UX Task 2 bakes it in implicitly as `max_members - 1`. | F1, F4 |
| H2 | HIGH | Missing copy for reachable errors: `409 QuorumNotMet` (`rooms/service.py:27-28`), `404 PromiseNotFound` (`checkins/service.py:44-45`), `403 NotGroupMember`, `404 GroupNotFound`. | F1, F2, F4, F5, F6 |
| H3 | HIGH | "I'm done" is server-idempotent (`complete_today` swallows `IntegrityError`), but the UX plan never renders a completed/blocked state, so the user is re-prompted forever. | F5 |
| H4 | HIGH | `AppShell` wrapped around `<Routes>` cannot resolve "the current room" (`useParams` outside a route is `{}`); UX Task 1's `AppShell({children, title?})` contract is unimplementable as worded. | F1, F3 |
| H5 | HIGH | Files-list drift: UX Task 4's "row component" has no file; `timerAriaLabel` is tested in `CommitmentList.test.tsx`; finalized/reconnecting labels have no home module. | F1, F3, F6 |
| H6 | HIGH | Tone classes are asserted for one tone only; `app.css` tone rules are unspecified → unstyled statuses. | F3 |
| H7 | HIGH | `POST /groups/{id}/sessions` is not idempotent (`live_session_for_group` exists but is unused) → a double-click creates two live sessions. | F4 |

## 2. Verified baseline (do not re-verify; re-run only to detect drift)

Measured in this workspace on 2026-09-20 at commit `34bd4bb`:

| Command | Observed result |
| --- | --- |
| `cd frontend && npm test` | `src/hooks/useRoomSocket.test.ts` — **8 passed**, 0 failed |
| `cd frontend && npx tsc --noEmit` | exit 0, no output |
| `cd frontend && npm run build` | `42 modules transformed`, `dist/assets/index-CHrHZTbb.js 173.54 kB` |
| `node -v` | `v24.21.0`; `typeof localStorage === "undefined"`, `typeof window === "undefined"` |
| `docker --version` / `docker compose version` | `29.8.0` / `v5.5.1` → `make test` is runnable here |
| `git check-ignore frontend/dist/index.html` | ignored (`.gitignore:9`) → builds never dirty commits |

If `npm test` is not exactly 8/8 passing before you start, **stop and report drift** instead of continuing.

---

## 3. Locked decisions (D1–D10 — do not re-litigate)

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | **No new npm dependencies.** Markup/ARIA assertions use `renderToStaticMarkup` from `react-dom/server`. | Verified working in this node-env Vitest setup; keeps the UX plan's "no third-party component system" constraint true. |
| D2 | **All branching logic lives in pure helpers** under `frontend/src/lib/`, importing neither React, `api`, nor the DOM. Components are thin renderers. | The only way to satisfy the existing node-env test setup deterministically. |
| D3 | **Never render a react-router-connected component in a test** without `MemoryRouter` + the `React.useLayoutEffect = React.useEffect` shim in §4(b). Prefer asserting `navTitle`, `roomSessionIdFromPath`, and `guardRedirect`. | React SSR warns on `useLayoutEffect`; the shim removes the warning (verified: `<nav><a href="/board">Scoreboard</a></nav>` with clean stderr). |
| D4 | Tests that render components needing storage call `installStorageStub()` and `restore()` in `afterEach`. | `localStorage`/`sessionStorage` are `undefined` in node. |
| D5 | `errorMessage()` returns **human copy**, never a raw `detail` code or array; `ApiError.detail` stays a normalized `string`. | Fixes B4 at one choke point. |
| D6 | The room's `groupId` comes from route state **or** the `ss_group` sessionStorage key written by `FindGroup` when a session starts. | No `GET /sessions/{sid}` exists, so refresh/deep-link must be frontend-recoverable. |
| D7 | Peers in the room expose **presence + today's completion** only (`done_today` from the scoreboard). Peer promise text is never claimed; a failed scoreboard call renders "Completion status unavailable". | B1: honest representation of available data, no fabricated state. |
| D8 | Quorum is mirrored in `frontend/src/lib/groupView.ts` (`GROUP_SIZE = 4`, `QUORUM_MIN = 3`) with a comment pointing at `backend/app/modules/matching/service.py`. **Counts beat `status`** when they disagree. | H1: `status` is derived server-side from the same count. |
| D9 | Copy strings live in `frontend/src/lib/copy.ts`, imported by both components and the demo-flow test. | Makes UX Task 5 fail for real on copy drift (B6). |
| D10 | The tone union is `"info" \| "ready" \| "waiting" \| "attention" \| "complete" \| "reconnecting" \| "error"`, and **every** tone class must exist in `frontend/src/styles/app.css` (test-enforced). | H6. |

---

## 4. The test recipe (copy-paste; every form here is verified)

```bash
# pure helper tests
cd frontend && npm test -- src/lib/messages.test.ts
# component markup tests (node env, no jsdom)
cd frontend && npm test -- src/components/CommitmentList.test.tsx
```

**(a) Markup + ARIA assertion — no DOM library**

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { CommitmentList } from "./CommitmentList";

const html = renderToStaticMarkup(
  <CommitmentList people={[{ id: 1, email: "maya@example.com", online: true }]} />,
);
expect(html).toContain('role="status"');
expect(html).toContain('aria-live="polite"');
```

**(b) Router-connected markup (only if unavoidable)**

```tsx
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";

// react-router v6 uses useLayoutEffect; SSR warns about it. This shim removes the
// warning (verified). Use it only in tests that render router-connected components.
React.useLayoutEffect = React.useEffect;

const html = renderToStaticMarkup(
  <MemoryRouter initialEntries={["/find"]}>
    <AppShell title="Find a group" roomSessionId={null}>
      <p>page</p>
    </AppShell>
  </MemoryRouter>,
);
expect(html).toContain("Find a group");
```

**(c) `fetch` integration test for the API layer (no msw, no jsdom)**

```ts
installStorageStub();
globalThis.fetch = async () =>
  new Response(JSON.stringify({ detail: [{ msg: "Input should be a valid integer" }] }), {
    status: 422,
  });
```

**(d) Forbidden in tests:** `@testing-library/*`, `jsdom`, `happy-dom`, real `document`/`window` usage, real timers for reconnect tests (inject the `DelayFn`).

**(e) String-assertion pitfalls (verified against `react-dom/server` in this repo)** — use these rules or your tests will fail for the wrong reason:

| Pitfall | Observed output | Rule |
| --- | --- | --- |
| A literal apostrophe in text | `Make today&#x27;s promise` | Never assert copied strings containing `'` unless you escape them: `const asRendered = (t: string) => t.replace(/'/g, "&#x27;");` |
| `maxLength={280}` | `maxLength="280"` (camelCase preserved) | Assert with a case-insensitive regex: `/maxlength="280"/i` |
| Boolean attributes | `disabled=""`, `readonly=""` | Assert presence only (`toContain("disabled")`), never `disabled="true"` |
| Ordering assertions | `<h2>Today&#x27;s group commitments</h2>` | Compare `indexOf` on apostrophe-free substrings (`"group commitments"`), and assert `>= 0` on each index you use |


---

## 5. Reading order before you start (do not skip)

1. `frontend/src/lib/api.ts` (all route code depends on `req`, `ApiError`, `errorMessage`).
2. `frontend/src/lib/socket.ts` + `frontend/src/lib/roomSocket.ts` + `frontend/src/hooks/useRoomSocket.ts` + `frontend/src/hooks/useRoomSocket.test.ts`.
3. `frontend/src/routes/{Login,FindGroup,Room,Board}.tsx` and `frontend/src/components/TimerDisplay.tsx`.
4. `frontend/src/App.tsx`, `frontend/src/main.tsx`, `frontend/vite.config.ts`, `frontend/tsconfig.json`.
5. `backend/app/modules/rooms/ws.py`, `backend/app/modules/matching/service.py`, `backend/app/modules/checkins/{router,service,schemas}.py`, `backend/app/shared/errors.py` (**read-only — never edit these**).

---

## 6. F0 — Amend the UX plan document (docs only, no code)

**Goal:** Patch `docs/superpowers/plans/2026-09-20-studysprint-ux.md` so a worker executing it lands on the corrected steps.
**Files:** Modify `docs/superpowers/plans/2026-09-20-studysprint-ux.md`
**Rule:** apply every row below. Do not rewrite other steps.

| UX plan step | Replace with |
| --- | --- |
| Task 1 Files | add `frontend/src/lib/{copy,nav}.ts`, `frontend/src/components/ProtectedLayout.tsx`, `frontend/src/styles/designSystem.test.ts`, `frontend/src/test/stubs.ts` |
| Task 1 Step 1 | Keep `statusToneClass("reconnecting")`, and add assertions for **every** tone in `StatusMessage.test.tsx` plus a `renderToStaticMarkup` check for `role="status"` (§ F3). |
| Task 1 Step 3 | Use the exact `AppShell({ title, roomSessionId, children })` signature and `ProtectedLayout` from F3 (D3/H4). |
| Task 1 Step 4 | Replace "Update `App.tsx` so protected routes render inside `AppShell`" with the **layout route** structure in F3 (a shell wrapped around `<Routes>` cannot read route params). |
| Task 2 Step 1 | Import `groupReadiness` from `src/lib/groupView.ts` (not from `FindGroup.tsx`); replace the "rendering `role="alert"`" and "navigating to `/room/:id`" assertions with the pure `messages`/`groupView` tests in F2/F4. |
| Task 2 Step 3 | Use `PRIMARY_ACTIONS` from `src/lib/copy.ts`, add the join-ID input guard (F4), and remember the group in sessionStorage (`rememberGroup`) when a session starts. |
| Task 2 Step 4 | Add the submit loading state and use `PRODUCT_PROMISE`; keep the removal of the unauthenticated scoreboard link. |
| Task 2 Files | `frontend/src/lib/api.ts` is modified **only** as specified in F2 (error normalization) — do not invent other changes. |
| Task 3 Step 1 | Import `commitmentState`, `mergeCommitments`, `statusLabel`, `timerAriaLabel` from `src/lib/roomView.ts`; expected objects now include `action` (F1); `timerAriaLabel` is tested in `src/lib/roomView.test.ts`, not `CommitmentList.test.tsx`. |
| Task 3 Step 3 | **Delete** `RoomParticipant extends Participant` with `promise`/`completed`. Use `CommitmentInput` + `mergeCommitments` (peers expose completion + presence only, D7). |
| Task 3 Step 4 | Add the `unavailable` state, `resolveGroupId`, the completed-state gating (H3), and `StatusMessage` copy from `messages.ts`. |
| Task 3 Step 5 | Add `onReconnecting`/`onUnavailable` to `RoomEvents` and **add `frontend/src/hooks/useRoomSocket.test.ts` to the Files and commit lists** (B3). |
| Task 2 Interfaces | `GroupCard({ group, onStart, busy })` and `ReadinessBadge({ tone, label })` — the join-by-ID form stays in `FindGroup`; there is no `onJoin` prop. |
| Task 3 Files | add `frontend/src/lib/roomView.ts` + `frontend/src/lib/roomView.test.ts`; `useRoomSocket.test.ts` moves to Modify. |
| Task 4 Step 1 | Add the `scoreboardMessage(rows) === null` case and place helpers in `src/lib/boardView.ts`. |
| Task 4 Step 3 | "row component" = `frontend/src/components/ScoreboardRow.tsx` (create it); errors use `messages.ts` copy. |
| Task 4 Step 4 | Add `frontend/src/styles/designSystem.test.ts` (focus-visible + mobile media query + every tone class present). |
| Task 5 Step 1–2 | Replace the tautological test with the real assertions in F7 (imports `PRIMARY_ACTIONS`/`PRODUCT_PROMISE` from `src/lib/copy.ts` **and** asserts rendered markup). |
| Task 5 Step 3 | Add the reload-safe `groupId`, `unavailable`, and `reconnecting` demo notes from F7. |

**Verify:** `git diff --stat docs/superpowers/plans/2026-09-20-studysprint-ux.md` shows only the rows above.

```bash
git add docs/superpowers/plans/2026-09-20-studysprint-ux.md
git commit -m "docs: amend UX plan with verified fixes from review"
```

---

## 7. F1 — Shared pure helpers + test infrastructure

**Goal:** Land every new decision helper, fully tested, before any component changes.
**Depends on:** —
**Blocks:** F2, F3, F4, F5, F6, F7

**Files:**
- Create: `frontend/src/lib/messages.ts`
- Create: `frontend/src/lib/copy.ts`
- Create: `frontend/src/lib/nav.ts`
- Create: `frontend/src/lib/groupView.ts`
- Create: `frontend/src/lib/roomView.ts`
- Create: `frontend/src/lib/boardView.ts`
- Create: `frontend/src/lib/groupContext.ts`
- Create: `frontend/src/test/stubs.ts`
- Test: `frontend/src/lib/messages.test.ts`, `copy.test.ts`, `nav.test.ts`, `groupView.test.ts`, `roomView.test.ts`, `boardView.test.ts`, `groupContext.test.ts`

**Interfaces (exact signatures — later workstreams depend on these):**

```ts
// messages.ts
normalizeDetail(detail: unknown, fallback: string): string
friendlyMessage(detail: string, status: number): string
NETWORK_ERROR | VALIDATION_ERROR | FALLBACK_ERROR : string
DOMAIN_COPY: Record<string, string>
// copy.ts
PRODUCT_PROMISE | SHARED_INTENT : string
HEADINGS: { app; login; register; findGroup; room; board; commitments; presence }
NAV: { findGroup; scoreboard }
PRIMARY_ACTIONS: { findGroup; joinById; startSprint; promise; complete }
// nav.ts
roomSessionIdFromPath(pathname: string): number | null
navTitle(pathname: string): string
guardRedirect(token: string | null): string | null
// groupView.ts
GROUP_SIZE = 4; QUORUM_MIN = 3
groupReadiness(group: Group): Readiness      // Readiness = { tone: "ready" | "waiting"; label: string }
seatsLeft(group: Group): number
// roomView.ts
RoomStatus = "connecting" | "live" | "reconnecting" | "finalized" | "unavailable" | "error"
statusLabel(status: RoomStatus): string
statusDetail(status: RoomStatus, attempt: number, maxAttempts: number): string | null
commitmentState(person: CommitmentInput, currentUserId: number): CommitmentView
mergeCommitments(people, rows, currentUser, localPromise): CommitmentInput[]
timerAriaLabel(remaining: number | null): string
// boardView.ts
completionLabel(doneToday: boolean): string
scoreboardMessage(rows: readonly unknown[]): string | null
streakSummary(streak: number | null): string
// groupContext.ts
rememberGroup(groupId: number): void
rememberedGroup(): number | null
resolveGroupId(stateGroupId?: number): number | null
// test/stubs.ts
installStorageStub(): { restore(): void }
```

### Step F1.1 — Write the failing pure-helper tests (28 `it` blocks)

- [ ] **F1.1a** Create `frontend/src/lib/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FALLBACK_ERROR, VALIDATION_ERROR, friendlyMessage, normalizeDetail } from "./messages";

describe("normalizeDetail", () => {
  it("keeps a string detail", () => {
    expect(normalizeDetail("GroupFull", "Bad Request")).toBe("GroupFull");
  });

  it("extracts the first message from a FastAPI 422 array", () => {
    expect(
      normalizeDetail(
        [{ type: "int_parsing", loc: ["path", "gid"], msg: "Input should be a valid integer" }],
        "Bad Request",
      ),
    ).toBe("Input should be a valid integer");
  });

  it("falls back for missing, empty, and non-string details", () => {
    expect(normalizeDetail(undefined, "Bad Request")).toBe("Bad Request");
    expect(normalizeDetail([], "Bad Request")).toBe("Bad Request");
    expect(normalizeDetail("   ", "Bad Request")).toBe("Bad Request");
  });
});

describe("friendlyMessage", () => {
  it("maps domain codes to actionable copy", () => {
    expect(friendlyMessage("GroupFull", 409)).toBe("That group just filled up. Try finding another group.");
    expect(friendlyMessage("AlreadyPromised", 409)).toBe("You already made a promise today.");
    expect(friendlyMessage("QuorumNotMet", 409)).toBe("A focus sprint needs 3 learners. Invite one more and try again.");
  });

  it("hides pydantic text behind a validation message", () => {
    expect(friendlyMessage("Input should be a valid integer", 422)).toBe(VALIDATION_ERROR);
  });

  it("never returns an empty string or a prototype member", () => {
    expect(friendlyMessage("", 500)).toBe(FALLBACK_ERROR);
    expect(friendlyMessage("Weird", 500)).toBe("Weird");
    expect(friendlyMessage("toString", 400)).toBe("toString");
  });
});
```

- [ ] **F1.1b** Create `frontend/src/lib/groupView.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GROUP_SIZE, QUORUM_MIN, groupReadiness, seatsLeft } from "./groupView";

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
    expect(groupReadiness({ id: 1, member_count: 1, max_members: 4, status: "queued" })).toEqual({
      tone: "waiting",
      label: "Waiting for 2 more learners",
    });
  });

  it("trusts counts over a stale server status", () => {
    expect(groupReadiness({ id: 1, member_count: 4, max_members: 4, status: "queued" })).toEqual({
      tone: "ready",
      label: "Ready to start",
    });
  });

  it("mirrors the backend quorum constants", () => {
    expect(QUORUM_MIN).toBe(3); // backend/app/modules/matching/service.py
    expect(GROUP_SIZE).toBe(4);
    expect([
      seatsLeft({ member_count: 2, max_members: 4 }),
      seatsLeft({ member_count: 4, max_members: 4 }),
    ]).toEqual([2, 0]);
  });
});
```

- [ ] **F1.1c** Create `frontend/src/lib/nav.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { HEADINGS } from "./copy";
import { guardRedirect, navTitle, roomSessionIdFromPath } from "./nav";

describe("roomSessionIdFromPath", () => {
  it("reads a valid session id and rejects everything else", () => {
    expect(roomSessionIdFromPath("/room/42")).toBe(42);
    expect(roomSessionIdFromPath("/room/42/")).toBe(42);
    expect(roomSessionIdFromPath("/room/abc")).toBeNull();
    expect(roomSessionIdFromPath("/room/0")).toBeNull();
    expect(roomSessionIdFromPath("/room/42/extra")).toBeNull();
  });
});

describe("navTitle", () => {
  it("labels each route from the shared copy module", () => {
    expect(navTitle("/find")).toBe(HEADINGS.findGroup);
    expect(navTitle("/board")).toBe(HEADINGS.board);
    expect(navTitle("/room/42")).toBe(HEADINGS.room);
    expect(navTitle("/login")).toBe(HEADINGS.app);
  });
});

describe("guardRedirect", () => {
  it("sends unauthenticated visitors to login", () => {
    expect(guardRedirect(null)).toBe("/login");
    expect(guardRedirect("")).toBe("/login");
    expect(guardRedirect("token")).toBeNull();
  });
});
```

- [ ] **F1.1d** Create `frontend/src/lib/roomView.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  commitmentState,
  mergeCommitments,
  statusDetail,
  statusLabel,
  timerAriaLabel,
  type CommitmentInput,
  type PresencePerson,
} from "./roomView";

function person(overrides: Partial<CommitmentInput> = {}): CommitmentInput {
  return {
    id: 2,
    email: "alex@example.com",
    online: true,
    promiseText: null,
    promised: false,
    completed: false,
    completionKnown: true,
    ...overrides,
  };
}

describe("statusLabel", () => {
  it("has explicit copy for every room state", () => {
    expect(statusLabel("unavailable")).toBe("This session is no longer available");
    expect(statusLabel("reconnecting")).toBe("Reconnecting...");
    expect(statusLabel("finalized")).toBe("Session finished");
    expect(statusLabel("connecting")).toBe("Connecting to the room...");
    expect(statusLabel("live")).toBe("Live session");
    expect(statusLabel("error")).toBe("Connection lost");
  });

  it("spells out the reconnect attempt", () => {
    expect(statusDetail("reconnecting", 2, 3)).toBe("Reconnecting attempt 2 of 3");
    expect(statusDetail("live", 1, 3)).toBeNull();
  });
});

describe("commitmentState", () => {
  it("makes the current user's missing promise the next action", () => {
    expect(commitmentState(person(), 2)).toEqual({
      label: "Add your promise",
      tone: "attention",
      action: "promise",
    });
  });

  it("offers completion once the current user has promised", () => {
    expect(commitmentState(person({ promised: true, promiseText: "Chapter 3 notes" }), 2)).toEqual({
      label: "Mark today's promise done",
      tone: "active",
      action: "complete",
    });
  });

  it("blocks further action for a completed promise", () => {
    expect(commitmentState(person({ id: 1, completed: true }), 2)).toEqual({
      label: "Complete",
      tone: "complete",
      action: null,
    });
  });

  it("never claims to know a peer's promise", () => {
    expect(commitmentState(person({ id: 1 }), 2)).toEqual({
      label: "Not complete yet",
      tone: "waiting",
      action: null,
    });
    expect(commitmentState(person({ id: 1, completionKnown: false }), 2)).toEqual({
      label: "Completion status unavailable",
      tone: "waiting",
      action: null,
    });
  });
});

describe("mergeCommitments", () => {
  const people: PresencePerson[] = [
    { id: 2, email: "alex@example.com", online: true },
    { id: 1, email: "maya@example.com", online: false },
  ];

  it("marks peer completion as unknown when the scoreboard is unavailable", () => {
    const merged = mergeCommitments(people, null, { id: 2 }, { promised: false, text: null });
    expect(merged.map((p) => p.completionKnown)).toEqual([false, false]);
    expect(merged.map((p) => p.completed)).toEqual([false, false]);
  });

  it("takes peer completion from the scoreboard and the local promise from this session", () => {
    const merged = mergeCommitments(
      people,
      [{ email: "maya@example.com", done_today: true }],
      { id: 2 },
      { promised: true, text: "Chapter 3 notes" },
    );
    expect(merged.map((p) => [p.email, p.completed, p.promised, p.promiseText])).toEqual([
      ["alex@example.com", false, true, "Chapter 3 notes"],
      ["maya@example.com", true, false, null],
    ]);
  });
});

describe("timerAriaLabel", () => {
  it("reads the remaining time for screen readers", () => {
    expect(timerAriaLabel(1472)).toBe("24 minutes 32 seconds remaining");
    expect(timerAriaLabel(61)).toBe("1 minute 1 second remaining");
    expect(timerAriaLabel(0)).toBe("Time is up");
    expect(timerAriaLabel(null)).toBe("Timer connecting");
  });
});
```

- [ ] **F1.1e** Create `frontend/src/lib/boardView.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EMPTY_BOARD_MESSAGE, completionLabel, scoreboardMessage, streakSummary } from "./boardView";

describe("completionLabel", () => {
  it("renders completion as text, never colour alone", () => {
    expect(completionLabel(true)).toBe("Complete today");
    expect(completionLabel(false)).toBe("Not complete");
  });
});

describe("scoreboardMessage", () => {
  it("renders a useful empty state when the group has no rows", () => {
    expect(scoreboardMessage([])).toBe("No check-ins yet. Be the first to make today's promise.");
    expect(scoreboardMessage([])).toBe(EMPTY_BOARD_MESSAGE);
  });

  it("stays silent when there are rows", () => {
    expect(scoreboardMessage([{ email: "a@b.c" }])).toBeNull();
  });
});

describe("streakSummary", () => {
  it("covers loading, zero, and pluralised streaks", () => {
    expect(streakSummary(null)).toBe("Loading your streak...");
    expect(streakSummary(0)).toBe("No streak yet. Today is a good day to start.");
    expect(streakSummary(1)).toBe("Your streak: 1 day");
    expect(streakSummary(5)).toBe("Your streak: 5 days");
  });
});
```

- [ ] **F1.1f** Create `frontend/src/lib/groupContext.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rememberedGroup, rememberGroup, resolveGroupId } from "./groupContext";
import { installStorageStub, type StorageStub } from "../test/stubs";

let stub: StorageStub;

beforeEach(() => {
  stub = installStorageStub();
});

afterEach(() => {
  stub.restore();
});

describe("groupContext", () => {
  it("returns null when nothing was remembered", () => {
    expect(rememberedGroup()).toBeNull();
    expect(resolveGroupId(undefined)).toBeNull();
  });

  it("remembers the group across a reload and prefers route state", () => {
    rememberGroup(7);
    expect(rememberedGroup()).toBe(7);
    expect(resolveGroupId(undefined)).toBe(7);
    expect(resolveGroupId(9)).toBe(9);
  });

  it("ignores a corrupt stored value", () => {
    sessionStorage.setItem("ss_group", "not-a-number");
    expect(rememberedGroup()).toBeNull();
    expect(resolveGroupId(undefined)).toBeNull();
  });
});
```

- [ ] **F1.2** Run the tests and confirm they fail for the right reason (missing modules):

```bash
cd frontend && npm test -- src/lib
```

**Expected:** FAIL with `Failed to resolve import "./messages"` (and one message per missing module). Every failure must be a missing module — **not** a syntax error in a test file. If you see a syntax error, fix the test file before continuing.

### Step F1.3 — Implement the helpers

- [ ] **F1.3a** Create `frontend/src/lib/messages.ts` (verbatim):

```ts
// User-facing API error copy. Pure and dependency-free so it is testable in node.
//
// FastAPI sends {"detail": "<DomainError code>"} for handled errors and
// {"detail": [{...pydantic...}]} for validation errors. `detail` is therefore
// `unknown` on the wire; normalizeDetail() collapses both to one line of text.

export const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";
export const VALIDATION_ERROR = "Please check that form and try again.";
export const FALLBACK_ERROR = "Request failed.";

export const DOMAIN_COPY: Record<string, string> = {
  EmailTaken: "That email is already registered. Try logging in instead.",
  BadCredentials: "Email or password is incorrect.",
  BadToken: "Your session expired. Please log in again.",
  Unauthorized: "Your session expired. Please log in again.",
  GroupNotFound: "That group does not exist. Try finding a new group.",
  GroupFull: "That group just filled up. Try finding another group.",
  QuorumNotMet: "A focus sprint needs 3 learners. Invite one more and try again.",
  NotGroupMember: "You are not a member of that group yet.",
  AlreadyPromised: "You already made a promise today.",
  PromiseNotFound: "Make your promise first, then mark it complete.",
  FutureDate: "You cannot check in for a future date.",
  InternalError: "Something went wrong on our side. Please try again.",
};

/** Collapse any FastAPI `detail` shape into a single non-empty string. */
export function normalizeDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim() !== "") return detail;
  if (Array.isArray(detail)) {
    const first = detail.find(
      (item): item is { msg: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { msg?: unknown }).msg === "string",
    );
    if (first) return first.msg;
  }
  return fallback;
}

/** Map a normalized detail + HTTP status to copy a student can act on. */
export function friendlyMessage(detail: string, status: number): string {
  if (status === 422) return VALIDATION_ERROR;
  if (Object.prototype.hasOwnProperty.call(DOMAIN_COPY, detail)) return DOMAIN_COPY[detail];
  if (detail.trim() === "") return FALLBACK_ERROR;
  return detail;
}
```

- [ ] **F1.3b** Create `frontend/src/lib/copy.ts` (verbatim) — the single source of user-visible product copy:

```ts
// Shared product copy. Components and the demo-flow test import these constants so
// the portfolio narrative cannot drift silently.

export const PRODUCT_PROMISE = "Find your people. Keep your promise.";
export const SHARED_INTENT = "We're in this together.";

export const HEADINGS = {
  app: "StudySprint",
  login: "Log in",
  register: "Create your account",
  findGroup: "Find a group",
  room: "Focus room",
  board: "Scoreboard",
  commitments: "Today's group commitments",
  presence: "Focus status",
} as const;

export const NAV = {
  findGroup: HEADINGS.findGroup,
  scoreboard: HEADINGS.board,
} as const;

export const PRIMARY_ACTIONS = {
  findGroup: "Find my study group",
  joinById: "Join with an ID",
  startSprint: "Start a focus sprint",
  promise: "Make today's promise",
  complete: "I'm done",
} as const;
```

- [ ] **F1.3c** Create `frontend/src/lib/nav.ts` (verbatim):

```ts
import { HEADINGS } from "./copy";

/** `/room/42` -> 42. Anything else (missing, non-numeric, zero, extra segments) -> null. */
export function roomSessionIdFromPath(pathname: string): number | null {
  const match = /^\/room\/(\d+)\/?$/.exec(pathname);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function navTitle(pathname: string): string {
  if (pathname.startsWith("/find")) return HEADINGS.findGroup;
  if (pathname.startsWith("/board")) return HEADINGS.board;
  if (roomSessionIdFromPath(pathname) !== null) return HEADINGS.room;
  return HEADINGS.app;
}

/** Mirrors the existing `Guard` behaviour in App.tsx, as a pure decision. */
export function guardRedirect(token: string | null): string | null {
  return token === null || token === "" ? "/login" : null;
}
```

- [ ] **F1.3d** Create `frontend/src/lib/groupView.ts` (verbatim):

```ts
import type { Group } from "./api";

// Mirrors backend/app/modules/matching/service.py — keep both sides in step.
export const GROUP_SIZE = 4;
export const QUORUM_MIN = 3;

export interface Readiness {
  tone: "ready" | "waiting";
  label: string;
}

function learner(count: number): string {
  return count === 1 ? "learner" : "learners";
}

/**
 * Counts are authoritative: the server derives `status` from the same count, so a
 * stale response must never talk the UI out of a startable group.
 */
export function groupReadiness(group: Group): Readiness {
  if (group.member_count >= QUORUM_MIN) return { tone: "ready", label: "Ready to start" };
  const needed = QUORUM_MIN - group.member_count;
  return { tone: "waiting", label: `Waiting for ${needed} more ${learner(needed)}` };
}

export function seatsLeft(group: Group): number {
  return Math.max(0, group.max_members - group.member_count);
}
```

- [ ] **F1.3e** Create `frontend/src/lib/roomView.ts` (verbatim):

```ts
// Pure room presentation model. No React, no socket, no storage: every rule below
// is unit-tested in the node environment.

export type RoomStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "finalized"
  | "unavailable"
  | "error";

export const STATUS_LABEL: Record<RoomStatus, string> = {
  connecting: "Connecting to the room...",
  live: "Live session",
  reconnecting: "Reconnecting...",
  finalized: "Session finished",
  unavailable: "This session is no longer available",
  error: "Connection lost",
};

export function statusLabel(status: RoomStatus): string {
  return STATUS_LABEL[status];
}

export function statusDetail(
  status: RoomStatus,
  attempt: number,
  maxAttempts: number,
): string | null {
  if (status !== "reconnecting") return null;
  return `Reconnecting attempt ${attempt} of ${maxAttempts}`;
}

export type CommitmentTone = "attention" | "active" | "complete" | "waiting";

export interface PresencePerson {
  id: number;
  email: string;
  online: boolean;
}

export interface ScoreRow {
  email: string;
  done_today: boolean;
}

/**
 * `commitmentKnown` is the important field: the room snapshot never carries peer
 * promise text (backend/app/modules/rooms/ws.py), so peers only ever expose
 * presence plus today's completion from the scoreboard.
 */
export interface CommitmentInput extends PresencePerson {
  promiseText: string | null;
  promised: boolean;
  completed: boolean;
  completionKnown: boolean;
}

export interface CommitmentView {
  label: string;
  tone: CommitmentTone;
  action: "promise" | "complete" | null;
}

export function commitmentState(
  person: CommitmentInput,
  currentUserId: number,
): CommitmentView {
  if (person.completed) return { label: "Complete", tone: "complete", action: null };
  const isCurrentUser = person.id === currentUserId;
  if (isCurrentUser && !person.promised) {
    return { label: "Add your promise", tone: "attention", action: "promise" };
  }
  if (isCurrentUser) {
    return { label: "Mark today's promise done", tone: "active", action: "complete" };
  }
  if (!person.completionKnown) {
    return { label: "Completion status unavailable", tone: "waiting", action: null };
  }
  return { label: "Not complete yet", tone: "waiting", action: null };
}

export function mergeCommitments(
  people: PresencePerson[],
  rows: ScoreRow[] | null,
  currentUser: { id: number } | null,
  localPromise: { promised: boolean; text: string | null },
): CommitmentInput[] {
  return people.map((person) => {
    const isCurrentUser = currentUser !== null && person.id === currentUser.id;
    const row = rows?.find((r) => r.email === person.email) ?? null;
    return {
      ...person,
      promiseText: isCurrentUser ? localPromise.text : null,
      promised: isCurrentUser ? localPromise.promised : false,
      completed: row?.done_today ?? false,
      completionKnown: rows !== null,
    };
  });
}

export function timerAriaLabel(remaining: number | null): string {
  if (remaining === null) return "Timer connecting";
  if (remaining <= 0) return "Time is up";
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes} minute${minutes === 1 ? "" : "s"} ${seconds} second${seconds === 1 ? "" : "s"} remaining`;
}
```

- [ ] **F1.3f** Create `frontend/src/lib/boardView.ts` (verbatim):

```ts
export const EMPTY_BOARD_MESSAGE =
  "No check-ins yet. Be the first to make today's promise.";

/** Completion is always rendered as text, never as colour alone. */
export function completionLabel(doneToday: boolean): string {
  return doneToday ? "Complete today" : "Not complete";
}

/** Returns the empty-state copy when there are no rows, otherwise null. */
export function scoreboardMessage(rows: readonly unknown[]): string | null {
  return rows.length === 0 ? EMPTY_BOARD_MESSAGE : null;
}

export function streakSummary(streak: number | null): string {
  if (streak === null) return "Loading your streak...";
  if (streak === 0) return "No streak yet. Today is a good day to start.";
  return `Your streak: ${streak} day${streak === 1 ? "" : "s"}`;
}
```

- [ ] **F1.3g** Create `frontend/src/lib/groupContext.ts` (verbatim):

```ts
// The room route only receives `groupId` through router state, which is lost on
// reload or a shared link, and the API has no GET /sessions/{sid}. Persisting the
// id for the tab keeps the scoreboard and commitment list working after a refresh.

const GROUP_KEY = "ss_group";

export function rememberGroup(groupId: number): void {
  try {
    sessionStorage.setItem(GROUP_KEY, String(groupId));
  } catch {
    /* storage unavailable: the room still works, only reload recovery is lost */
  }
}

export function rememberedGroup(): number | null {
  try {
    const raw = sessionStorage.getItem(GROUP_KEY);
    if (raw === null) return null;
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** Route state wins; sessionStorage is the reload/deep-link fallback. */
export function resolveGroupId(stateGroupId?: number): number | null {
  if (typeof stateGroupId === "number" && Number.isInteger(stateGroupId) && stateGroupId > 0) {
    return stateGroupId;
  }
  return rememberedGroup();
}
```

- [ ] **F1.3h** Create `frontend/src/test/stubs.ts` (verbatim):

```ts
// Node-env Vitest has no DOM: `localStorage` and `sessionStorage` are undefined.
// Tests that exercise the api/groupContext layers install these in-memory stubs.

export interface StorageStub {
  restore(): void;
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length(): number {
      return data.size;
    },
    clear: (): void => void data.clear(),
    getItem: (key: string): string | null => (data.has(key) ? String(data.get(key)) : null),
    key: (index: number): string | null => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string): void => void data.delete(key),
    setItem: (key: string, value: string): void => void data.set(key, String(value)),
  };
}

export function installStorageStub(): StorageStub {
  const g = globalThis as { localStorage?: Storage; sessionStorage?: Storage };
  const before = { localStorage: g.localStorage, sessionStorage: g.sessionStorage };
  g.localStorage = memoryStorage();
  g.sessionStorage = memoryStorage();
  return {
    restore(): void {
      g.localStorage = before.localStorage;
      g.sessionStorage = before.sessionStorage;
    },
  };
}
```

- [ ] **F1.4** Run the new tests; all 28 `it` blocks must pass:

```bash
cd frontend && npm test -- src/lib
```

**Expected:** PASS. `Test Files` should list `messages`, `groupView`, `nav`, `roomView`, `boardView`, `groupContext` (6 files) plus the pre-existing `useRoomSocket.test.ts` when you run the full suite. 0 failures. If any expected string differs by one character, fix the **test or the helper to match this plan** — do not "fix" it by loosening `toBe` into `toContain`.

- [ ] **F1.5** Confirm no type or build regressions, then commit:

```bash
cd frontend && npm test && npx tsc --noEmit && npm run build
cd /workspaces/Study_Sprint
git add frontend/src/lib frontend/src/test
git commit -m "feat: add pure UX presentation helpers with node-env tests"
```

**Expected:** full suite green (8 original + 28 new `it` blocks), `tsc --noEmit` exit 0, build succeeds.

---

## 8. F2 — Error-path hardening (`lib/api.ts`) — fixes B4, H2

**Goal:** No route can crash or show a machine code; every failure has copy.
**Depends on:** F1
**Blocks:** F4, F5, F6

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts` (create)

- [ ] **F2.1** Create `frontend/src/lib/api.test.ts` (verbatim):

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError, api, errorMessage } from "./api";
import { NETWORK_ERROR } from "./messages";
import { installStorageStub, type StorageStub } from "../test/stubs";

let stub: StorageStub;
const realFetch = globalThis.fetch;

function respond(status: number, body: unknown): void {
  globalThis.fetch = async () => new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  stub = installStorageStub();
});

afterEach(() => {
  stub.restore();
  globalThis.fetch = realFetch;
});

describe("errorMessage", () => {
  it("turns a 422 validation payload into one line of human copy", async () => {
    respond(422, {
      detail: [{ type: "int_parsing", loc: ["path", "gid"], msg: "Input should be a valid integer" }],
    });
    const error: unknown = await api.scoreboard(Number("x")).catch((e: unknown) => e);
    expect(typeof errorMessage(error)).toBe("string");
    expect(errorMessage(error)).toBe("Please check that form and try again.");
  });

  it("maps domain codes to actionable copy", async () => {
    respond(409, { detail: "GroupFull" });
    const error: unknown = await api.joinGroup(99).catch((e: unknown) => e);
    expect(errorMessage(error)).toBe("That group just filled up. Try finding another group.");
  });

  it("keeps the normalized code and status on ApiError", async () => {
    respond(409, { detail: "AlreadyPromised" });
    const error = (await api.promise("text", "2026-09-20").catch((e: unknown) => e)) as ApiError;
    expect(error.detail).toBe("AlreadyPromised");
    expect(error.status).toBe(409);
    expect(error).toBeInstanceOf(ApiError);
  });

  it("explains an unreachable server", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toBe(NETWORK_ERROR);
  });
});
```

- [ ] **F2.2** Run it and confirm the failure profile:

```bash
cd frontend && npm test -- src/lib/api.test.ts
```

**Expected:** FAIL on the 422 test and the network test (422 currently returns the raw pydantic string; non-`ApiError` currently returns `"Request failed"`). The `GroupFull` test may already pass — that is fine.

- [ ] **F2.3** Patch `frontend/src/lib/api.ts` — **three** edits, nothing else:

  1. Add the import after the existing `import` lines (this file has none today, so add it at the top below the header comment):

```ts
import { FALLBACK_ERROR, NETWORK_ERROR, friendlyMessage, normalizeDetail } from "./messages";
```

  2. Replace the `if (!res.ok) { … }` block inside `req()` with:

```ts
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* non-JSON error body */
    }
    const detail = normalizeDetail(
      (body as { detail?: unknown } | null)?.detail,
      res.statusText || FALLBACK_ERROR,
    );
    throw new ApiError(res.status, detail);
  }
```

  3. Replace the existing `errorMessage` function with:

```ts
export function errorMessage(e: unknown): string {
  return e instanceof ApiError ? friendlyMessage(e.detail, e.status) : NETWORK_ERROR;
}
```

**Do not change:** `ApiError`'s shape (`status`/`detail` stay public and `string`), the single 401 silent-refresh retry, `storeAuth`, `getToken`, `logout`, or any request body/route.

- [ ] **F2.4** Verify:

```bash
cd frontend && npm test && npx tsc --noEmit && npm run build
```

**Expected:** 4/4 new `api.test.ts` assertions pass, the F1 helpers still pass, the 8 socket tests still pass, build green.

- [ ] **F2.5** Commit:

```bash
cd /workspaces/Study_Sprint
git add frontend/src/lib/api.ts frontend/src/lib/api.test.ts
git commit -m "fix: normalize API error details into actionable copy"
```

---

## 9. F3 — Shell, design tokens, and status primitives — fixes H4, H6

**Goal:** A real authenticated shell with a layout route, the friendly-library tokens, and status copy that is styled for every tone.
**Depends on:** F1
**Blocks:** F4, F5, F6

**Files:**
- Create: `frontend/src/styles/tokens.css`, `frontend/src/styles/app.css`
- Create: `frontend/src/components/StatusMessage.tsx`, `LoadingState.tsx`, `EmptyState.tsx`, `AppShell.tsx`, `ProtectedLayout.tsx`
- Modify: `frontend/src/main.tsx`, `frontend/src/App.tsx`
- Test: `frontend/src/components/StatusMessage.test.tsx`, `frontend/src/styles/designSystem.test.ts`

- [ ] **F3.1** Create the two tests (verbatim).

`frontend/src/components/StatusMessage.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusMessage, statusToneClass, type StatusTone } from "./StatusMessage";

const TONES: StatusTone[] = [
  "info",
  "ready",
  "waiting",
  "attention",
  "complete",
  "reconnecting",
  "error",
];

describe("statusToneClass", () => {
  it("maps a reconnecting tone to a stable class", () => {
    expect(statusToneClass("reconnecting")).toBe("status status--reconnecting");
  });

  it("names a class for every tone", () => {
    expect(TONES.map(statusToneClass)).toEqual(TONES.map((tone) => `status status--${tone}`));
  });
});

describe("StatusMessage", () => {
  it("announces non-critical feedback politely", () => {
    const html = renderToStaticMarkup(<StatusMessage tone="ready">Ready to start</StatusMessage>);
    expect(html).toContain('role="status"');
    expect(html).toContain("status--ready");
  });

  it("announces errors assertively", () => {
    const html = renderToStaticMarkup(
      <StatusMessage tone="error" assertive>
        Could not load the scoreboard
      </StatusMessage>,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
  });
});
```

`frontend/src/styles/designSystem.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { statusToneClass, type StatusTone } from "../components/StatusMessage";

const css = readFileSync(fileURLToPath(new URL("./app.css", import.meta.url)), "utf8");

const TONES: StatusTone[] = [
  "info",
  "ready",
  "waiting",
  "attention",
  "complete",
  "reconnecting",
  "error",
];

describe("design system", () => {
  it("defines the friendly-library tokens", () => {
    for (const token of ["--ss-sage-50", "--ss-cream", "--ss-ink", "--ss-amber", "--ss-border"]) {
      expect(css).toContain(token);
    }
  });

  it("styles every status tone", () => {
    for (const tone of TONES) {
      expect(css).toContain(`.status--${tone}`);
    }
    expect(statusToneClass("attention")).toBe("status status--attention");
  });

  it("has visible focus states and a single mobile stacking breakpoint", () => {
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (max-width:");
  });
});
```

- [ ] **F3.2** Run and confirm failure:

```bash
cd frontend && npm test -- src/components/StatusMessage.test.tsx src/styles/designSystem.test.ts
```

**Expected:** FAIL — `Failed to resolve import "./StatusMessage"` and a missing-file error for `app.css`.

- [ ] **F3.3** Create the stylesheets.

`frontend/src/styles/tokens.css` (verbatim):

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

`frontend/src/styles/app.css` (verbatim; the tones and the single breakpoint are test-enforced, keep the selector names):

```css
* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--ss-sage-50);
  color: var(--ss-ink);
  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  line-height: 1.5;
}

a { color: var(--ss-ink); }

a:focus-visible,
button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 3px solid var(--ss-amber);
  outline-offset: 2px;
}

.app-header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ss-space-3);
  align-items: baseline;
  padding: var(--ss-space-4) var(--ss-space-6);
  background: var(--ss-cream);
  border-bottom: 1px solid var(--ss-border);
}
.app-brand { margin: 0; color: var(--ss-muted); font-weight: 600; }
.app-title { margin: 0; font-size: 1.4rem; }
.app-nav { display: flex; gap: var(--ss-space-4); margin-left: auto; }
.app-nav a { text-decoration: none; padding: var(--ss-space-1) 0; color: var(--ss-muted); }
.app-nav a:hover { color: var(--ss-ink); text-decoration: underline; }

.app-main {
  max-width: 68rem;
  margin: 0 auto;
  padding: var(--ss-space-6);
  display: grid;
  gap: var(--ss-space-4);
}

.card {
  background: var(--ss-cream);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-card);
  padding: var(--ss-space-6);
  display: grid;
  gap: var(--ss-space-3);
}

button {
  font: inherit;
  border-radius: var(--ss-radius-control);
  border: 1px solid var(--ss-border);
  background: var(--ss-cream);
  color: var(--ss-ink);
  padding: var(--ss-space-2) var(--ss-space-4);
  cursor: pointer;
}
button:disabled { opacity: 0.55; cursor: not-allowed; }
button[type="submit"] {
  background: var(--ss-amber);
  color: var(--ss-amber-ink);
  border-color: var(--ss-amber);
  font-weight: 600;
}

input {
  font: inherit;
  border-radius: var(--ss-radius-control);
  border: 1px solid var(--ss-border);
  padding: var(--ss-space-2) var(--ss-space-3);
  background: #fff;
  color: var(--ss-ink);
}
label { display: grid; gap: var(--ss-space-1); color: var(--ss-muted); font-size: 0.9rem; }

.status {
  margin: 0;
  padding: var(--ss-space-3);
  border-radius: var(--ss-radius-control);
  border: 1px solid var(--ss-border);
  background: var(--ss-sage-100);
}
.status--info { border-color: var(--ss-border); background: var(--ss-sage-100); }
.status--ready { border-color: #4f7a5c; background: #e3f0e6; }
.status--waiting { border-color: var(--ss-border); background: var(--ss-cream); color: var(--ss-muted); }
.status--attention { border-color: var(--ss-amber); background: #fbf0dc; }
.status--complete { border-color: #4f7a5c; background: #e3f0e6; }
.status--reconnecting { border-color: var(--ss-amber); background: #fbf0dc; }
.status--error { border-color: #a4453c; background: #f8e6e3; }

.loading { margin: 0; color: var(--ss-muted); }
.empty-state {
  border: 1px dashed var(--ss-border);
  border-radius: var(--ss-radius-card);
  padding: var(--ss-space-6);
  background: var(--ss-cream);
}

.room-layout {
  display: grid;
  gap: var(--ss-space-4);
  grid-template-columns: 1.6fr 1fr;
  align-items: start;
}
.room-main { display: grid; gap: var(--ss-space-4); }
.room-aside { display: grid; gap: var(--ss-space-4); }

.commitments { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--ss-space-2); }
.commitment {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ss-space-2);
  align-items: baseline;
  justify-content: space-between;
  padding: var(--ss-space-3);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-control);
  background: var(--ss-cream);
}
.commitment--attention { border-color: var(--ss-amber); }
.commitment--complete { border-color: #4f7a5c; }
.commitment-owner { font-weight: 600; }
.commitment-status { color: var(--ss-muted); }

.presence { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--ss-space-3); }
.timer { font-size: 3rem; font-variant-numeric: tabular-nums; margin: 0; }

.scoreboard { width: 100%; border-collapse: collapse; }
.scoreboard th,
.scoreboard td { text-align: left; padding: var(--ss-space-2) var(--ss-space-3); border-bottom: 1px solid var(--ss-border); }

@media (max-width: 46rem) {
  .app-main { padding: var(--ss-space-4); }
  .app-nav { margin-left: 0; }
  .room-layout { grid-template-columns: 1fr; }
  .promise-controls { grid-template-columns: 1fr; }
  .promise-controls button { width: 100%; }
  .timer { font-size: 2.4rem; }
}
```

- [ ] **F3.4** Create the shared primitives.

`frontend/src/components/StatusMessage.tsx` (verbatim):

```tsx
import type { ReactNode } from "react";

export type StatusTone =
  | "info"
  | "ready"
  | "waiting"
  | "attention"
  | "complete"
  | "reconnecting"
  | "error";

export function statusToneClass(tone: StatusTone): string {
  return `status status--${tone}`;
}

/**
 * `assertive` renders role="alert" for failures; everything else is a polite
 * role="status" so screen readers are not interrupted for progress updates.
 */
export function StatusMessage({
  tone = "info",
  assertive = false,
  children,
}: {
  tone?: StatusTone;
  assertive?: boolean;
  children: ReactNode;
}) {
  return (
    <p className={statusToneClass(tone)} role={assertive ? "alert" : "status"} aria-live={assertive ? "assertive" : "polite"}>
      {children}
    </p>
  );
}
```

`frontend/src/components/LoadingState.tsx` (verbatim):

```tsx
export function LoadingState({ label }: { label: string }) {
  return (
    <p className="loading" role="status" aria-live="polite">
      {label}
    </p>
  );
}
```

`frontend/src/components/EmptyState.tsx` (verbatim):

```tsx
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}
```

`frontend/src/components/AppShell.tsx` (verbatim):

```tsx
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { HEADINGS, NAV } from "../lib/copy";

export interface AppShellProps {
  title: string;
  roomSessionId: number | null;
  children: ReactNode;
}

/** Session-first chrome: identity, current page title, and the three nav targets. */
export function AppShell({ title, roomSessionId, children }: AppShellProps) {
  return (
    <>
      <header className="app-header">
        <p className="app-brand">{HEADINGS.app}</p>
        <h1 className="app-title">{title}</h1>
        <nav className="app-nav" aria-label={HEADINGS.app}>
          <Link to="/find">{NAV.findGroup}</Link>
          {roomSessionId !== null && <Link to={`/room/${roomSessionId}`}>{HEADINGS.room}</Link>}
          <Link to="/board">{NAV.scoreboard}</Link>
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </>
  );
}
```

- [ ] **F3.5** Wire the shell as a **layout route** (this is the H4 fix).

`frontend/src/components/ProtectedLayout.tsx` (verbatim):

```tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getToken } from "../lib/api";
import { guardRedirect, navTitle, roomSessionIdFromPath } from "../lib/nav";
import { AppShell } from "./AppShell";

/**
 * Layout route for every authenticated page. Rendering the shell here (instead of
 * wrapping <Routes>) is what lets it read the current pathname and session id.
 */
export function ProtectedLayout() {
  const { pathname } = useLocation();
  const redirect = guardRedirect(getToken());
  if (redirect !== null) return <Navigate to={redirect} replace />;
  return (
    <AppShell title={navTitle(pathname)} roomSessionId={roomSessionIdFromPath(pathname)}>
      <Outlet />
    </AppShell>
  );
}
```

Replace `frontend/src/App.tsx` with (verbatim) — note the local `Guard` component is **deleted**:

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { Board } from "./routes/Board";
import { FindGroup } from "./routes/FindGroup";
import { Login } from "./routes/Login";
import { Room } from "./routes/Room";
import { ProtectedLayout } from "./components/ProtectedLayout";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedLayout />}>
        <Route path="/find" element={<FindGroup />} />
        <Route path="/room/:sid" element={<Room />} />
        <Route path="/board" element={<Board />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
```

Patch `frontend/src/main.tsx` to import the styles above the `App` import:

```tsx
import "./styles/tokens.css";
import "./styles/app.css";
```

- [ ] **F3.6** Create `frontend/src/components/AppShell.test.tsx` (verbatim; uses the D3 recipe):

```tsx
import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { HEADINGS } from "../lib/copy";

// react-router v6 uses useLayoutEffect; the server renderer warns about it.
React.useLayoutEffect = React.useEffect;

function render(pathname: string, roomSessionId: number | null): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <AppShell title={HEADINGS.findGroup} roomSessionId={roomSessionId}>
        <p>page body</p>
      </AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  it("renders landmarks, navigation, and the page body", () => {
    const html = render("/find", null);
    expect(html).toContain("<header");
    expect(html).toContain("<main");
    expect(html).toContain('href="/find"');
    expect(html).toContain('href="/board"');
    expect(html).toContain(HEADINGS.findGroup);
    expect(html).toContain("page body");
  });

  it("only offers the current-room link inside a room", () => {
    expect(render("/room/7", 7)).toContain('href="/room/7"');
    expect(render("/find", null)).not.toContain('href="/room/');
  });
});
```

- [ ] **F3.7** Verify and commit:

```bash
cd frontend && npm test && npx tsc --noEmit && npm run build
cd /workspaces/Study_Sprint
git add frontend/src/styles frontend/src/components frontend/src/main.tsx frontend/src/App.tsx
git commit -m "feat: add friendly-library shell, tokens, and status primitives"
```

**Expected:** every new test passes (StatusMessage 4, designSystem 3, AppShell 2), the F1/F2 tests still pass, the 8 socket tests still pass, `tsc --noEmit` exit 0, build green. **If `tsc` errors on the AppShell test** (`Property 'useLayoutEffect' is read-only`), delete only the shim line — the render still works and only prints a React warning.

---

## 10. F4 — Auth + group discovery — fixes H1, H2, H7

**Goal:** Labelled, guarded, and honest discovery states; no double sprint sessions.
**Depends on:** F1, F2, F3
**Blocks:** F5, F7

**Files:**
- Modify: `frontend/src/routes/Login.tsx`, `frontend/src/routes/FindGroup.tsx`, `frontend/src/lib/groupView.ts`, `frontend/src/styles/app.css`
- Create: `frontend/src/components/GroupCard.tsx`, `frontend/src/components/ReadinessBadge.tsx`
- Test: `frontend/src/routes/FindGroup.test.tsx` (create)

> Supersedes the UX plan's `GroupCard({ group, onStart, onJoin })` prop list: the join-by-ID form stays in `FindGroup`, so there is no `onJoin` prop.

- [ ] **F4.1** Append the join-ID guard to `frontend/src/lib/groupView.ts` (verbatim):

```ts
/** Accepts only a positive decimal integer: protects the API from 422s on bad input. */
export function parseGroupId(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const id = Number(trimmed);
  return Number.isInteger(id) && id > 0 ? id : null;
}
```

- [ ] **F4.2** Change the primary-button selector in `frontend/src/styles/app.css` so primary actions work outside a `<form>`:

```css
button[type="submit"],
.button-primary {
```

(keep the existing body of that rule unchanged)

- [ ] **F4.3** Create `frontend/src/routes/FindGroup.test.tsx` (verbatim):

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GroupCard } from "../components/GroupCard";
import type { Group } from "../lib/api";
import { PRIMARY_ACTIONS } from "../lib/copy";
import { parseGroupId } from "../lib/groupView";

const ready: Group = { id: 3, member_count: 3, max_members: 4, status: "matched" };
const queued: Group = { id: 4, member_count: 2, max_members: 4, status: "queued" };

describe("parseGroupId", () => {
  it("accepts only positive integers", () => {
    expect(parseGroupId("12")).toBe(12);
    expect(parseGroupId(" 12 ")).toBe(12);
    expect(parseGroupId("0007")).toBe(7);
    expect(parseGroupId("")).toBeNull();
    expect(parseGroupId("abc")).toBeNull();
    expect(parseGroupId("0")).toBeNull();
    expect(parseGroupId("-3")).toBeNull();
    expect(parseGroupId("1e3")).toBeNull();
  });
});

describe("GroupCard", () => {
  it("offers the focus sprint when quorum is met", () => {
    const html = renderToStaticMarkup(<GroupCard group={ready} onStart={() => {}} busy={false} />);
    expect(html).toContain("3 of 4 learners");
    expect(html).toContain("Ready to start");
    expect(html).toContain(PRIMARY_ACTIONS.startSprint);
  });

  it("explains what is missing when the group is queued", () => {
    const html = renderToStaticMarkup(<GroupCard group={queued} onStart={() => {}} busy={false} />);
    expect(html).toContain("Waiting for 1 more learner");
    expect(html).not.toContain(PRIMARY_ACTIONS.startSprint);
  });

  it("disables the start action while the request is in flight", () => {
    const html = renderToStaticMarkup(<GroupCard group={ready} onStart={() => {}} busy={true} />);
    expect(html).toContain("disabled");
  });
});
```

- [ ] **F4.4** Run and confirm failure:

```bash
cd frontend && npm test -- src/routes/FindGroup.test.tsx
```

**Expected:** FAIL — `Failed to resolve import "../components/GroupCard"` and `parseGroupId is not a function`.

- [ ] **F4.5** Create the two discovery components.

`frontend/src/components/ReadinessBadge.tsx` (verbatim):

```tsx
import { statusToneClass } from "./StatusMessage";

/** Text label + tone, so readiness is never signalled by colour alone. */
export function ReadinessBadge({
  tone,
  label,
}: {
  tone: "ready" | "waiting";
  label: string;
}) {
  return <p className={statusToneClass(tone)}>{label}</p>;
}
```

`frontend/src/components/GroupCard.tsx` (verbatim):

```tsx
import type { Group } from "../lib/api";
import { PRIMARY_ACTIONS } from "../lib/copy";
import { groupReadiness, seatsLeft } from "../lib/groupView";
import { ReadinessBadge } from "./ReadinessBadge";

export interface GroupCardProps {
  group: Group;
  onStart: () => void;
  busy: boolean;
}

export function GroupCard({ group, onStart, busy }: GroupCardProps) {
  const readiness = groupReadiness(group);
  const seats = seatsLeft(group);
  return (
    <section className="card" aria-labelledby="matched-group">
      <h2 id="matched-group">Your group</h2>
      <p>
        Group #{group.id} — {group.member_count} of {group.max_members} learners
        {seats === 0 ? " (full)" : ` (${seats} seat${seats === 1 ? "" : "s"} left)`}
      </p>
      <ReadinessBadge tone={readiness.tone} label={readiness.label} />
      {readiness.tone === "ready" ? (
        <button className="button-primary" type="button" onClick={onStart} disabled={busy}>
          {PRIMARY_ACTIONS.startSprint}
        </button>
      ) : (
        <p>Matching keeps running while you wait — check back in a moment.</p>
      )}
    </section>
  );
}
```

- [ ] **F4.6** Replace `frontend/src/routes/Login.tsx` with (verbatim) — the unauthenticated `<Link to="/board">` is removed and `/login` keeps its own landmark:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingState } from "../components/LoadingState";
import { StatusMessage } from "../components/StatusMessage";
import { api, errorMessage } from "../lib/api";
import { HEADINGS, PRODUCT_PROMISE } from "../lib/copy";

export function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      if (mode === "login") {
        await api.login(email, password);
      } else {
        await api.register({
          email,
          password,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      }
      navigate("/find");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="app-main">
      <h1>{HEADINGS.app}</h1>
      <p>{PRODUCT_PROMISE}</p>
      <h2>{mode === "login" ? HEADINGS.login : HEADINGS.register}</h2>
      <form className="card" onSubmit={submit}>
        <label htmlFor="email">
          Email
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label htmlFor="password">
          Password
          <input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={pending}>
          {mode === "login" ? HEADINGS.login : HEADINGS.register}
        </button>
        {pending && <LoadingState label="Talking to StudySprint..." />}
      </form>
      {error !== "" && (
        <StatusMessage tone="error" assertive>
          {error}
        </StatusMessage>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "Need an account? Register" : "Have an account? Log in"}
      </button>
    </main>
  );
}
```

- [ ] **F4.7** Replace `frontend/src/routes/FindGroup.tsx` with (verbatim). Note the three deliberate behaviours: guarded join input, `rememberGroup` on start, and `pending` left set after a **successful** start so a second click cannot create a second live session:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { GroupCard } from "../components/GroupCard";
import { LoadingState } from "../components/LoadingState";
import { StatusMessage } from "../components/StatusMessage";
import { api, errorMessage, type Group } from "../lib/api";
import { HEADINGS, PRIMARY_ACTIONS } from "../lib/copy";
import { rememberGroup } from "../lib/groupContext";
import { parseGroupId } from "../lib/groupView";
import { VALIDATION_ERROR } from "../lib/messages";

export function FindGroup() {
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [joinId, setJoinId] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"find" | "join" | "start" | null>(null);

  async function find() {
    setError("");
    setPending("find");
    try {
      setGroup(await api.findGroup());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  }

  async function join() {
    const id = parseGroupId(joinId);
    if (id === null) {
      setError(VALIDATION_ERROR);
      return;
    }
    setError("");
    setPending("join");
    try {
      setGroup(await api.joinGroup(id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  }

  async function start() {
    if (group === null) return;
    setError("");
    setPending("start");
    try {
      const session = await api.createSession(group.id);
      rememberGroup(group.id);
      navigate(`/room/${session.id}`, { state: { groupId: group.id } });
    } catch (e) {
      setError(errorMessage(e));
      setPending(null); // success intentionally leaves the action disabled
    }
  }

  return (
    <>
      <section className="card">
        <h2>{HEADINGS.findGroup}</h2>
        <p>We match you by subject, goals, and timezone so your study window is shared.</p>
        <button className="button-primary" type="button" onClick={find} disabled={pending !== null}>
          {PRIMARY_ACTIONS.findGroup}
        </button>
        {pending === "find" && <LoadingState label="Looking for learners who match you..." />}
      </section>
      <section className="card">
        <h2>Already have a group ID?</h2>
        <label htmlFor="group-id">
          Group ID
          <input
            id="group-id"
            inputMode="numeric"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
          />
        </label>
        <button type="button" onClick={join} disabled={pending !== null}>
          {PRIMARY_ACTIONS.joinById}
        </button>
        {pending === "join" && <LoadingState label="Joining the group..." />}
      </section>
      {error !== "" && (
        <StatusMessage tone="error" assertive>
          {error}
        </StatusMessage>
      )}
      {group !== null ? (
        <GroupCard group={group} onStart={start} busy={pending === "start"} />
      ) : (
        <EmptyState
          title="No group yet"
          description="Find a group to see who you are studying with, or join one with an ID."
        />
      )}
    </>
  );
}
```

- [ ] **F4.8** Verify and commit:

```bash
cd frontend && npm test && npx tsc --noEmit && npm run build
cd /workspaces/Study_Sprint
git add frontend/src/routes/Login.tsx frontend/src/routes/FindGroup.tsx frontend/src/routes/FindGroup.test.tsx frontend/src/components/GroupCard.tsx frontend/src/components/ReadinessBadge.tsx frontend/src/lib/groupView.ts frontend/src/styles/app.css
git commit -m "feat: polish auth and group discovery with guarded inputs"
```

**Expected:** `FindGroup.test.tsx` green (4 `it` blocks: 1 for `parseGroupId`, 3 for `GroupCard`), everything from F1–F3 still green, build green.

---

## 11. F5 — Commitment-circle room — fixes B1, B3, B5, H2, H3, H5

**Goal:** The room shows commitments before the timer, peers' data is never fabricated, and every socket outcome has a visible, actionable state.
**Depends on:** F1, F2, F3, F4
**Blocks:** F7

**Files:**
- Modify: `frontend/src/lib/socket.ts`, `frontend/src/lib/roomSocket.ts`, `frontend/src/hooks/useRoomSocket.ts`, `frontend/src/hooks/useRoomSocket.test.ts`, `frontend/src/lib/roomView.ts`, `frontend/src/lib/roomView.test.ts`, `frontend/src/components/TimerDisplay.tsx`, `frontend/src/routes/Room.tsx`
- Create: `frontend/src/components/RoomHeader.tsx`, `CommitmentList.tsx`, `PresenceList.tsx`, `PromiseControls.tsx`
- Test: `frontend/src/routes/Room.test.tsx`, `frontend/src/components/CommitmentList.test.tsx` (create)

### Step F5.1 — Extend the pure room model (B1, H3)

- [ ] Append to `frontend/src/lib/roomView.ts` (verbatim):

```ts
/** After a successful completion the local user is complete even if the scoreboard is unreachable. */
export function markCompleted(people: CommitmentInput[], userId: number): CommitmentInput[] {
  return people.map((person) =>
    person.id === userId ? { ...person, completed: true, completionKnown: true } : person,
  );
}
```

- [ ] Append to the `commitmentState` describe block in `frontend/src/lib/roomView.test.ts`:

```ts
  it("keeps completion terminal after a local complete call", () => {
    const merged = mergeCommitments(
      [{ id: 2, email: "alex@example.com", online: true }],
      null,
      { id: 2 },
      { promised: true, text: "Chapter 3 notes" },
    );
    expect(markCompleted(merged, 2)[0]).toMatchObject({ completed: true, completionKnown: true });
    expect(markCompleted(merged, 99)[0].completed).toBe(false);
  });
```

(add `markCompleted` to that file's import list)

- [ ] Run: `cd frontend && npm test -- src/lib/roomView.test.ts` → **Expected:** PASS.

### Step F5.2 — Make the socket states explicit (B3, B5)

- [ ] Append to `frontend/src/lib/socket.ts`:

```ts
/** Close code the server sends when the session id does not exist. */
export const SESSION_UNAVAILABLE_CLOSE_CODE = 4404;
```

- [ ] In `frontend/src/lib/roomSocket.ts`: add the import of `SESSION_UNAVAILABLE_CLOSE_CODE`, extend `RoomEvents` with **both** required callbacks, and replace `handleClose` exactly:

```ts
export interface RoomEvents {
  onSnapshot(remaining: number, participants: Participant[]): void;
  onTick(serverRemaining: number): void;
  onPresence(participants: Participant[]): void;
  onFinalized(): void;
  onReconnecting(attempt: number): void;
  onUnavailable(): void;
  onAuthFailure(): void;
  onGaveUp(): void;
}
```

```ts
  private async handleClose(code: number): Promise<void> {
    if (this.closed) return;
    if (code === AUTH_CLOSE_CODE) {
      this.events.onAuthFailure();
      return;
    }
    if (code === SESSION_UNAVAILABLE_CLOSE_CODE) {
      this.events.onUnavailable();
      return;
    }
    if (this.retries < MAX_RETRIES) {
      const wait = backoffDelay(this.retries);
      this.retries += 1;
      // Notify before waiting so the UI can show "Reconnecting…" during the backoff.
      this.events.onReconnecting(this.retries);
      await this.delay(wait);
      if (!this.closed) this.connect();
    } else {
      this.events.onGaveUp();
    }
  }
```

- [ ] Update `frontend/src/hooks/useRoomSocket.test.ts` — this file **must** be in the commit (B3):

  1. Add the two callbacks to the `events()` factory:

```ts
    onReconnecting: (attempt: number) => void calls.push(`reconnecting:${attempt}`),
    onUnavailable: () => void calls.push("unavailable"),
```

  2. Change the give-up expectation inside "reconnects 3x on abnormal close, then gives up":

```ts
    expect(ev.calls).toEqual(["reconnecting:1", "reconnecting:2", "reconnecting:3", "gaveup"]);
```

  3. Add this new case next to the 4401 case:

```ts
  it("stops immediately on 4404 because the session no longer exists", async () => {
    const ev = events();
    const client = new RoomSocketClient("ws://x", ev, factory);
    client.connect();
    MockWebSocket.instances[0].open();
    MockWebSocket.instances[0].drop(4404);
    await flush();
    expect(ev.calls).toEqual(["unavailable"]);
    expect(MockWebSocket.instances).toHaveLength(1);
    client.close();
  });
```

- [ ] Run: `cd frontend && npm test -- src/hooks/useRoomSocket.test.ts` → **Expected:** PASS (12 tests: the original 8 renamed/extended plus the new one).

### Step F5.3 — Rework the hook

- [ ] Update `frontend/src/hooks/useRoomSocket.ts` with these exact changes:

  1. Replace the local status union with a re-export of the shared one:

```ts
export type { Participant } from "../lib/roomSocket";
export type { RoomStatus } from "../lib/roomView";
```

  2. Import `statusLabel`-free additions plus the shared type:

```ts
import { RoomSocketClient, type Participant } from "../lib/roomSocket";
import type { RoomStatus } from "../lib/roomView";
```

  3. Add `reconnectAttempt` state and rename `finalizedRef` → `sessionOverRef` everywhere (4 occurrences) with this state block:

```ts
  const [remaining, setRemaining] = useState<number | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const remainingRef = useRef<number | null>(null);
  const sessionOverRef = useRef(false);
  const clientRef = useRef<RoomSocketClient | null>(null);
```

  4. Replace the callback object passed to `new RoomSocketClient(...)` with:

```ts
      onSnapshot: (serverRemaining, people) => {
        setStatus("live");
        setReconnectAttempt(0);
        setBoth(serverRemaining);
        setParticipants(people);
      },
      onTick: (serverRemaining) => {
        // Drift >2s: snap to server, never accumulate locally.
        if (remainingRef.current !== null && needsSnap(remainingRef.current, serverRemaining)) {
          setBoth(serverRemaining);
        }
      },
      onPresence: (people) => setParticipants(people),
      onFinalized: () => {
        sessionOverRef.current = true;
        setStatus("finalized");
      },
      onReconnecting: (attempt) => {
        setReconnectAttempt(attempt);
        setStatus("reconnecting");
      },
      onUnavailable: () => {
        // The session id is gone: stop the local countdown and offer a way out.
        sessionOverRef.current = true;
        setStatus("unavailable");
      },
      onAuthFailure: () => logout(), // expired/bad token: back to login, no retry
      onGaveUp: () => setStatus("error"),
```

  5. Update the countdown guard and the returned object:

```ts
      if (!sessionOverRef.current && remainingRef.current !== null && remainingRef.current > 0) {
```

```ts
  return { remaining, participants, status, reconnectAttempt, finalizeRoom };
```

**Do not change:** the 15s heartbeat interval, the 3-retry policy, `HEARTBEAT_INTERVAL_MS`, or the message names `join`/`heartbeat`/`complete`.

- [ ] Run: `cd frontend && npm test && npx tsc --noEmit` → **Expected:** PASS with zero type errors. A `Property 'onReconnecting' is missing` error means you did not complete edit 1 of F5.2 in the test file.

### Step F5.4 — Room surface tests

- [ ] Create `frontend/src/components/CommitmentList.test.tsx` (verbatim):

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CommitmentList } from "./CommitmentList";
import type { CommitmentInput } from "../lib/roomView";

const base: CommitmentInput = {
  id: 1,
  email: "maya@example.com",
  online: true,
  promiseText: null,
  promised: false,
  completed: false,
  completionKnown: true,
};

const me: CommitmentInput = { ...base, id: 2, email: "alex@example.com" };

describe("CommitmentList", () => {
  it("makes the current user's missing promise the most obvious item", () => {
    const html = renderToStaticMarkup(<CommitmentList people={[me]} currentUserId={2} />);
    expect(html).toContain("You");
    expect(html).toContain("Add your promise");
    expect(html).toContain("commitment--attention");
  });

  it("labels peers by completion and never shows a peer promise", () => {
    const done = { ...base, completed: true };
    const html = renderToStaticMarkup(<CommitmentList people={[done]} currentUserId={2} />);
    expect(html).toContain("maya@example.com");
    expect(html).toContain("Complete");
    expect(html).toContain("commitment--complete");
  });

  it("says when peer completion is unknown instead of guessing", () => {
    const unknown = { ...base, completionKnown: false };
    const html = renderToStaticMarkup(<CommitmentList people={[unknown]} currentUserId={2} />);
    expect(html).toContain("Completion status unavailable");
  });

  it("renders an explicit waiting state for an empty room", () => {
    const html = renderToStaticMarkup(<CommitmentList people={[]} currentUserId={2} />);
    expect(html).toContain("Waiting for the group to join");
  });
});
```

- [ ] Create `frontend/src/routes/Room.test.tsx` (verbatim) — room **surface** markup, no router and no network:

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CommitmentList } from "../components/CommitmentList";
import { PresenceList } from "../components/PresenceList";
import { RoomHeader } from "../components/RoomHeader";
import { HEADINGS } from "../lib/copy";

describe("room surface", () => {
  it("keeps identity and timer together, with commitments leading the main column", () => {
    const html = renderToStaticMarkup(
      <>
        <RoomHeader sessionId={12} status="live" attempt={0} maxAttempts={3} remaining={1472} />
        <CommitmentList people={[]} currentUserId={2} />
        <PresenceList people={[{ id: 2, email: "alex@example.com", online: true }]} status="live" />
      </>,
    );
    // react-dom escapes apostrophes in text nodes, so assert on an unescaped substring.
    const heading = html.indexOf(HEADINGS.room);
    const timer = html.indexOf("24 minutes 32 seconds remaining");
    const commitments = html.indexOf("group commitments");
    const presence = html.indexOf(HEADINGS.presence);
    expect(heading).toBeGreaterThanOrEqual(0);
    expect(timer).toBeGreaterThan(heading); // spec 5.4: the timer stays near the header
    expect(commitments).toBeGreaterThan(timer); // spec 5.2: commitments lead the supporting context
    expect(presence).toBeGreaterThan(commitments);
  });

  it("announces the connection state but not the timer", () => {
    const html = renderToStaticMarkup(
      <RoomHeader sessionId={12} status="reconnecting" attempt={2} maxAttempts={3} remaining={1472} />,
    );
    expect(html).toContain("Reconnecting...");
    expect(html).toContain("Reconnecting attempt 2 of 3");
    expect(html).toContain('aria-label="24 minutes 32 seconds remaining"');
    expect(html.match(/aria-live="polite"/g) ?? []).toHaveLength(1);
  });

  it("has an explicit unavailable state", () => {
    const html = renderToStaticMarkup(
      <RoomHeader sessionId={12} status="unavailable" attempt={0} maxAttempts={3} remaining={null} />,
    );
    expect(html).toContain("This session is no longer available");
  });

  it("labels presence as focused or away in text", () => {
    const html = renderToStaticMarkup(
      <PresenceList
        people={[
          { id: 2, email: "alex@example.com", online: true },
          { id: 1, email: "maya@example.com", online: false },
        ]}
        status="live"
      />,
    );
    expect(html).toContain("focused");
    expect(html).toContain("away");
  });

  it("warns that presence may be stale while reconnecting", () => {
    const html = renderToStaticMarkup(<PresenceList people={[]} status="reconnecting" />);
    expect(html).toContain("Presence updates paused");
  });
});
```

- [ ] Run: `cd frontend && npm test -- src/components/CommitmentList.test.tsx src/routes/Room.test.tsx`
  **Expected:** FAIL — `Failed to resolve import "./CommitmentList"`, `"../components/PresenceList"`, `"../components/RoomHeader"`.

### Step F5.5 — Room components

- [ ] Create `frontend/src/components/CommitmentList.tsx` (verbatim) — peers are labelled by completion, never by promise text:

```tsx
import { HEADINGS } from "../lib/copy";
import { commitmentState, type CommitmentInput } from "../lib/roomView";

export interface CommitmentListProps {
  people: CommitmentInput[];
  currentUserId: number | null;
}

export function CommitmentList({ people, currentUserId }: CommitmentListProps) {
  return (
    <section className="card" aria-labelledby="commitments-heading">
      <h2 id="commitments-heading">{HEADINGS.commitments}</h2>
      {people.length === 0 ? (
        <p>Waiting for the group to join...</p>
      ) : (
        <ul className="commitments">
          {people.map((person) => {
            const view = commitmentState(person, currentUserId ?? -1);
            return (
              <li key={person.id} className={`commitment commitment--${view.tone}`}>
                <span className="commitment-owner">
                  {person.id === currentUserId ? "You" : person.email}
                </span>
                {person.promiseText !== null && <span>{person.promiseText}</span>}
                <span className="commitment-status">{view.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] Create `frontend/src/components/PresenceList.tsx` (verbatim):

```tsx
import { HEADINGS } from "../lib/copy";
import type { PresencePerson, RoomStatus } from "../lib/roomView";

export interface PresenceListProps {
  people: PresencePerson[];
  status: RoomStatus;
}

export function PresenceList({ people, status }: PresenceListProps) {
  const stale = status === "connecting" || status === "reconnecting" || status === "error";
  return (
    <section className="card" aria-labelledby="presence-heading">
      <h2 id="presence-heading">{HEADINGS.presence}</h2>
      {stale && (
        <p>Presence updates paused — the list below may be out of date until we reconnect.</p>
      )}
      <ul className="presence">
        {people.map((person) => (
          <li key={person.id}>
            {person.email} — {person.online ? "focused" : "away"}
          </li>
        ))}
      </ul>
      {people.length === 0 && <p>No one has joined the room yet.</p>}
    </section>
  );
}
```

- [ ] Create `frontend/src/components/RoomHeader.tsx` (verbatim). The timer is **not** a live region: only the connection line is announced:

```tsx
import { HEADINGS, SHARED_INTENT } from "../lib/copy";
import { statusDetail, statusLabel, type RoomStatus } from "../lib/roomView";
import { TimerDisplay } from "./TimerDisplay";

export interface RoomHeaderProps {
  sessionId: number;
  status: RoomStatus;
  attempt: number;
  maxAttempts: number;
  remaining: number | null;
}

export function RoomHeader({ sessionId, status, attempt, maxAttempts, remaining }: RoomHeaderProps) {
  const detail = statusDetail(status, attempt, maxAttempts);
  return (
    <header className="card room-header">
      <h2>
        {HEADINGS.room} #{sessionId}
      </h2>
      <p>{SHARED_INTENT}</p>
      <p role="status" aria-live="polite">
        {statusLabel(status)}
      </p>
      {detail !== null && <p>{detail}</p>}
      <TimerDisplay remaining={remaining} />
    </header>
  );
}
```

- [ ] Create `frontend/src/components/PromiseControls.tsx` (verbatim). `nextAction` comes from `commitmentState`, which is how a completed promise stops being re-prompted (H3):

```tsx
import { PRIMARY_ACTIONS } from "../lib/copy";
import { StatusMessage, type StatusTone } from "./StatusMessage";

export interface PromiseControlsProps {
  text: string;
  onTextChange: (value: string) => void;
  onPromise: () => void;
  onComplete: () => void;
  pending: "promise" | "complete" | null;
  feedback: string;
  feedbackTone: StatusTone;
  nextAction: "promise" | "complete" | null;
}

export function PromiseControls({
  text,
  onTextChange,
  onPromise,
  onComplete,
  pending,
  feedback,
  feedbackTone,
  nextAction,
}: PromiseControlsProps) {
  return (
    <section className="card promise-controls" aria-labelledby="promise-heading">
      <h2 id="promise-heading">Today&apos;s promise</h2>
      <label htmlFor="promise-text">
        What will you finish?
        <input
          id="promise-text"
          maxLength={280}
          value={text}
          placeholder="Finish chapter 3 notes"
          onChange={(event) => onTextChange(event.target.value)}
        />
      </label>
      <button
        className="button-primary"
        type="button"
        onClick={onPromise}
        disabled={pending !== null || nextAction !== "promise"}
      >
        {PRIMARY_ACTIONS.promise}
      </button>
      <button
        type="button"
        onClick={onComplete}
        disabled={pending !== null || nextAction !== "complete"}
      >
        {PRIMARY_ACTIONS.complete}
      </button>
      {feedback !== "" && (
        <StatusMessage tone={feedbackTone} assertive={feedbackTone === "error"}>
          {feedback}
        </StatusMessage>
      )}
    </section>
  );
}
```

- [ ] Replace `frontend/src/components/TimerDisplay.tsx` with (verbatim):

```tsx
import { timerAriaLabel } from "../lib/roomView";

export function TimerDisplay({ remaining }: { remaining: number | null }) {
  if (remaining === null) return <p className="timer">Waiting for the timer...</p>;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return (
    <p className="timer" role="timer" aria-label={timerAriaLabel(remaining)}>
      {minutes}:{String(seconds).padStart(2, "0")}
    </p>
  );
}
```

**Why no `aria-live` on the timer:** the timer re-renders every second; the polite live region belongs to the connection status only (spec §6.2: "avoid announcing every timer tick").

### Step F5.6 — Rebuild `Room.tsx` (B1, B5, D6, H2, H3)

- [ ] Replace `frontend/src/routes/Room.tsx` with the following. `todayLocal` must stay exported — an existing test imports it.

Part 1 of 2 (imports, `todayLocal`, route validation, state, data loading):

```tsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { CommitmentList } from "../components/CommitmentList";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { PresenceList } from "../components/PresenceList";
import { PromiseControls } from "../components/PromiseControls";
import { RoomHeader } from "../components/RoomHeader";
import { StatusMessage, type StatusTone } from "../components/StatusMessage";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { ApiError, api, errorMessage, type ScoreboardEntry } from "../lib/api";
import { resolveGroupId } from "../lib/groupContext";
import { roomSessionIdFromPath } from "../lib/nav";
import { commitmentState, markCompleted, mergeCommitments } from "../lib/roomView";
import { MAX_RETRIES } from "../lib/socket";

/** Calendar date in the browser's local timezone (UTC slicing would be off by a day). */
export function todayLocal(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function Room() {
  const { sid } = useParams<{ sid: string }>();
  const sessionId = roomSessionIdFromPath(`/room/${sid ?? ""}`);
  if (sessionId === null) {
    return (
      <EmptyState
        title="Session unavailable"
        description="That room link is not valid. Choose a group to start a new focus sprint."
        action={<Link to="/find">Find a group</Link>}
      />
    );
  }
  return <RoomSession sessionId={sessionId} />;
}

function RoomSession({ sessionId }: { sessionId: number }) {
  const location = useLocation() as { state?: { groupId?: number } };
  const groupId = resolveGroupId(location.state?.groupId);
  const { remaining, participants, status, reconnectAttempt, finalizeRoom } =
    useRoomSocket(sessionId);
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string } | null>(null);
  const [rows, setRows] = useState<ScoreboardEntry[] | null>(null);
  const [localPromise, setLocalPromise] = useState<{ promised: boolean; text: string | null }>({
    promised: false,
    text: null,
  });
  const [completedLocally, setCompletedLocally] = useState(false);
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<StatusTone>("info");
  const [pending, setPending] = useState<"promise" | "complete" | null>(null);

  useEffect(() => {
    api
      .me()
      .then((me) => setCurrentUser({ id: me.id, email: me.email }))
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    if (groupId === null) {
      // No group id (deep link with empty storage): peer completion stays unknown, never guessed.
      setRows(null);
      return;
    }
    api.scoreboard(groupId).then(setRows).catch(() => setRows(null));
  }, [groupId]);

  const people = useMemo(() => {
    const merged = mergeCommitments(participants, rows, currentUser, localPromise);
    return completedLocally && currentUser !== null
      ? markCompleted(merged, currentUser.id)
      : merged;
  }, [participants, rows, currentUser, localPromise, completedLocally]);

  const me = currentUser === null ? null : (people.find((p) => p.id === currentUser.id) ?? null);
  const nextAction =
    me === null || currentUser === null ? null : commitmentState(me, currentUser.id).action;
```

Part 2 of 2 (handlers and markup — continue the same file):

```tsx
  async function promise() {
    setFeedback("");
    setPending("promise");
    try {
      await api.promise(text, todayLocal());
      setLocalPromise({ promised: true, text });
      setFeedback("Promise saved for today.");
      setFeedbackTone("ready");
    } catch (e) {
      if (e instanceof ApiError && e.detail === "AlreadyPromised") {
        // A duplicate promise is state, not failure: stop asking for one.
        setLocalPromise({ promised: true, text: null });
        setFeedback(errorMessage(e));
        setFeedbackTone("attention");
      } else {
        setFeedback(errorMessage(e));
        setFeedbackTone("error");
      }
    } finally {
      setPending(null);
    }
  }

  async function complete() {
    setFeedback("");
    setPending("complete");
    try {
      const res = await api.complete(todayLocal());
      setCompletedLocally(true);
      setFeedback(`Done! Your streak is ${res.streak} day${res.streak === 1 ? "" : "s"}.`);
      setFeedbackTone("complete");
    } catch (e) {
      setFeedback(errorMessage(e));
      setFeedbackTone("error");
    } finally {
      setPending(null);
    }
  }

  if (status === "unavailable") {
    return (
      <EmptyState
        title="Session unavailable"
        description="This session is no longer available. Start a new focus sprint with your group."
        action={<Link to="/find">Find a group</Link>}
      />
    );
  }

  return (
    <>
      <RoomHeader
        sessionId={sessionId}
        status={status}
        attempt={reconnectAttempt}
        maxAttempts={MAX_RETRIES}
        remaining={remaining}
      />
      <div className="room-layout">
        <div className="room-main">
          <CommitmentList people={people} currentUserId={currentUser?.id ?? null} />
          <PresenceList people={participants} status={status} />
        </div>
        <div className="room-aside">
          <PromiseControls
            text={text}
            onTextChange={setText}
            onPromise={promise}
            onComplete={complete}
            pending={pending}
            feedback={feedback}
            feedbackTone={feedbackTone}
            nextAction={nextAction}
          />
          <section className="card" aria-labelledby="session-heading">
            <h2 id="session-heading">Session</h2>
            <button type="button" onClick={finalizeRoom} disabled={status !== "live"}>
              Finalize room session
            </button>
            <p>
              <Link to={groupId !== null ? `/board?group=${groupId}` : "/board"}>Scoreboard</Link>
            </p>
          </section>
        </div>
      </div>
      {currentUser === null && <LoadingState label="Loading your check-in status..." />}
      {rows === null && groupId !== null && (
        <StatusMessage tone="waiting">
          Group completion is temporarily unavailable. Your own promise still works.
        </StatusMessage>
      )}
    </>
  );
}
```

- [ ] **F5.7** Verify and commit:

```bash
cd frontend && npm test && npx tsc --noEmit && npm run build
cd /workspaces/Study_Sprint
git add frontend/src/routes/Room.tsx frontend/src/routes/Room.test.tsx frontend/src/hooks/useRoomSocket.ts frontend/src/hooks/useRoomSocket.test.ts frontend/src/lib/socket.ts frontend/src/lib/roomSocket.ts frontend/src/lib/roomView.ts frontend/src/lib/roomView.test.ts frontend/src/components/TimerDisplay.tsx frontend/src/components/RoomHeader.tsx frontend/src/components/CommitmentList.tsx frontend/src/components/CommitmentList.test.tsx frontend/src/components/PresenceList.tsx frontend/src/components/PromiseControls.tsx
git commit -m "feat: build the commitment-first live room with explicit socket states"
```

**Expected:** full frontend suite green (`CommitmentList` 4, `Room` 5, `useRoomSocket` 9, plus F1–F4), `tsc --noEmit` exit 0, build green.

---

## 12. F6 — Scoreboard, responsive, and accessibility polish — fixes H2, H5, H6

**Goal:** The scoreboard has explicit loading/empty/invalid/error states and completion is text, not colour; the responsive rules from F3 are verified rather than duplicated.
**Depends on:** F1, F2, F3
**Blocks:** F7

**Files:**
- Modify: `frontend/src/routes/Board.tsx`, `frontend/src/styles/app.css`
- Create: `frontend/src/components/ScoreboardRow.tsx`, `frontend/src/components/ScoreboardTable.tsx`
- Test: `frontend/src/routes/Board.test.tsx` (create)

- [ ] **F6.1** Create `frontend/src/routes/Board.test.tsx` (verbatim):

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ScoreboardTable } from "../components/ScoreboardTable";
import { completionLabel, scoreboardMessage, streakSummary } from "../lib/boardView";

const row = { email: "maya@example.com", streak: 4, done_today: true };

describe("scoreboard states", () => {
  it("renders a useful empty state when the group has no rows", () => {
    expect(scoreboardMessage([])).toBe("No check-ins yet. Be the first to make today's promise.");
    const html = renderToStaticMarkup(<ScoreboardTable rows={[]} />);
    expect(html).toContain("No check-ins yet");
    expect(html).not.toContain("<table");
  });

  it("renders a semantic table with completion text instead of colour alone", () => {
    const html = renderToStaticMarkup(<ScoreboardTable rows={[row]} />);
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("maya@example.com");
    expect(html).toContain(">4<");
    expect(html).toContain(completionLabel(true));
  });

  it("covers the streak summary states", () => {
    expect(streakSummary(null)).toBe("Loading your streak...");
    expect(streakSummary(0)).toBe("No streak yet. Today is a good day to start.");
    expect(streakSummary(3)).toBe("Your streak: 3 days");
  });

  it("labels incomplete members explicitly", () => {
    expect(completionLabel(false)).toBe("Not complete");
  });
});
```

- [ ] **F6.2** Run it: `cd frontend && npm test -- src/routes/Board.test.tsx`
  **Expected:** FAIL — `Failed to resolve import "../components/ScoreboardTable"`.

- [ ] **F6.3** Create the two components (verbatim).

`frontend/src/components/ScoreboardRow.tsx`:

```tsx
import type { ScoreboardEntry } from "../lib/api";
import { completionLabel } from "../lib/boardView";

export function ScoreboardRow({ entry }: { entry: ScoreboardEntry }) {
  return (
    <tr>
      <td>{entry.email}</td>
      <td>{entry.streak}</td>
      <td>{completionLabel(entry.done_today)}</td>
    </tr>
  );
}
```

`frontend/src/components/ScoreboardTable.tsx`:

```tsx
import type { ScoreboardEntry } from "../lib/api";
import { scoreboardMessage } from "../lib/boardView";
import { ScoreboardRow } from "./ScoreboardRow";

export function ScoreboardTable({ rows }: { rows: ScoreboardEntry[] }) {
  const emptyMessage = scoreboardMessage(rows);
  if (emptyMessage !== null) return <p className="loading">{emptyMessage}</p>;
  return (
    <table className="scoreboard">
      <caption>Group check-ins for today</caption>
      <thead>
        <tr>
          <th scope="col">Member</th>
          <th scope="col">Streak</th>
          <th scope="col">Today</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((entry) => (
          <ScoreboardRow key={entry.email} entry={entry} />
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **F6.4** Replace `frontend/src/routes/Board.tsx` with (verbatim). The ID form appears **only** when the URL has no `?group=`, and the input is guarded by `parseGroupId` so a typo cannot produce a 422:

```tsx
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LoadingState } from "../components/LoadingState";
import { ScoreboardTable } from "../components/ScoreboardTable";
import { StatusMessage } from "../components/StatusMessage";
import { api, errorMessage, type ScoreboardEntry } from "../lib/api";
import { streakSummary } from "../lib/boardView";
import { HEADINGS } from "../lib/copy";
import { parseGroupId } from "../lib/groupView";
import { VALIDATION_ERROR } from "../lib/messages";

export function Board() {
  const [params] = useSearchParams();
  const preset = params.get("group") ?? "";
  const [groupId, setGroupId] = useState(preset);
  const [rows, setRows] = useState<ScoreboardEntry[] | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (raw: string) => {
    const id = parseGroupId(raw);
    if (id === null) {
      setError(VALIDATION_ERROR);
      return;
    }
    setError("");
    setLoading(true);
    try {
      setRows(await api.scoreboard(id));
    } catch (e) {
      setRows(null);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api
      .streak()
      .then((s) => setStreak(s.streak))
      .catch(() => setStreak(null));
  }, []);

  useEffect(() => {
    if (preset !== "") void load(preset);
  }, [load, preset]);

  return (
    <>
      <section className="card">
        <h2>{HEADINGS.board}</h2>
        <p>{streakSummary(streak)}</p>
      </section>
      {preset === "" && (
        <section className="card">
          <label htmlFor="board-group">
            Group ID
            <input
              id="board-group"
              inputMode="numeric"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            />
          </label>
          <button type="button" onClick={() => void load(groupId)} disabled={loading}>
            Load scoreboard
          </button>
        </section>
      )}
      {loading && <LoadingState label="Loading check-ins..." />}
      {error !== "" && (
        <StatusMessage tone="error" assertive>
          {error}
        </StatusMessage>
      )}
      {rows !== null && <ScoreboardTable rows={rows} />}
      <p>
        <Link to="/find">Find a group</Link>
      </p>
    </>
  );
}
```

- [ ] **F6.5** Responsive/a11y check (these rules already exist in F3's `app.css`; verify, do not duplicate):
  - `.scoreboard { width: 100% }` with no fixed widths → no horizontal scrolling.
  - `@media (max-width: 46rem)` stacks `.room-layout` and makes `.promise-controls button` full width.
  - `:focus-visible` is defined for `a`, `button`, `input`, `select`, `textarea`.
  - If you add any rule, `frontend/src/styles/designSystem.test.ts` must still pass.

- [ ] **F6.6** Verify and commit:

```bash
cd frontend && npm test && npx tsc --noEmit && npm run build
cd /workspaces/Study_Sprint
git add frontend/src/routes/Board.tsx frontend/src/routes/Board.test.tsx frontend/src/components/ScoreboardRow.tsx frontend/src/components/ScoreboardTable.tsx frontend/src/styles/app.css
git commit -m "feat: polish scoreboard states and responsive accessibility"
```

**Expected:** `Board.test.tsx` 4 cases pass; full suite green; build green.

---

## 13. F7 — Demo regression test and documentation — fixes B6, H2

**Goal:** The portfolio narrative is machine-checked and the demo doc matches the shipped UI.
**Depends on:** F4, F5, F6

**Files:**
- Create: `frontend/src/demo-flow.test.tsx`
- Modify: `docs/DEMO.md`, `README.md`

- [ ] **F7.1** Create `frontend/src/demo-flow.test.tsx` (verbatim). This replaces the UX plan's tautological test — every assertion can fail:

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GroupCard } from "./components/GroupCard";
import { PromiseControls } from "./components/PromiseControls";
import { HEADINGS, PRIMARY_ACTIONS, PRODUCT_PROMISE } from "./lib/copy";

/** react-dom escapes apostrophes in text nodes: "I'm done" renders as "I&#x27;m done". */
const asRendered = (text: string): string => text.replace(/'/g, "&#x27;");

const readyGroup = { id: 3, member_count: 3, max_members: 4, status: "matched" } as const;

function promiseControls(nextAction: "promise" | "complete" | null, feedback = ""): string {
  return renderToStaticMarkup(
    <PromiseControls
      text=""
      onTextChange={() => {}}
      onPromise={() => {}}
      onComplete={() => {}}
      pending={null}
      feedback={feedback}
      feedbackTone="info"
      nextAction={nextAction}
    />,
  );
}

describe("portfolio demo narrative", () => {
  it("pins the agreed product copy", () => {
    expect(PRODUCT_PROMISE).toBe("Find your people. Keep your promise.");
    expect(PRIMARY_ACTIONS.findGroup).toBe("Find my study group");
    expect(PRIMARY_ACTIONS.startSprint).toBe("Start a focus sprint");
    expect(PRIMARY_ACTIONS.promise).toBe("Make today's promise");
    expect(PRIMARY_ACTIONS.complete).toBe("I'm done");
    expect(HEADINGS.board).toBe("Scoreboard");
  });

  it("renders the actions the demo clicks through", () => {
    const card = renderToStaticMarkup(<GroupCard group={readyGroup} onStart={() => {}} busy={false} />);
    expect(card).toContain(PRIMARY_ACTIONS.startSprint);

    const controls = promiseControls("promise");
    expect(controls).toContain(asRendered(PRIMARY_ACTIONS.promise));
    expect(controls).toMatch(/maxlength="280"/i);
  });

  it("stops offering a promise once one is recorded", () => {
    const controls = promiseControls("complete");
    expect(controls).toContain(asRendered(PRIMARY_ACTIONS.complete));
    expect(controls).toContain(asRendered(PRIMARY_ACTIONS.promise)); // still labelled, but disabled
    expect((controls.match(/disabled/g) ?? []).length).toBe(1);
  });

  it("surfaces duplicate-promise feedback instead of a success shape", () => {
    const controls = promiseControls("complete", "You already made a promise today.");
    expect(controls).toContain("You already made a promise today.");
    expect(controls).toContain("status--info");
  });
});
```

- [ ] **F7.2** Run it: `cd frontend && npm test -- src/demo-flow.test.tsx` → **Expected:** PASS. Then prove it can fail: temporarily change `PRIMARY_ACTIONS.complete` in `lib/copy.ts` to `"Done"`, re-run (must FAIL), and revert.

- [ ] **F7.3** Update `docs/DEMO.md`:
  - Rewrite the "Click path (2 minutes)" steps to the shipped labels: **Find my study group** → **Start a focus sprint** → **Make today's promise** → **I'm done** → **Scoreboard**.
  - Add a "Visible states to demo" list: `reconnecting` (devtools → offline for ~5s: the header shows "Reconnecting… (attempt N of 3)", then "Connection lost" after 3 tries), `finalized` (Finalize room session), `unavailable` (open `/room/999999` in a new tab), duplicate promise (`409` → "You already made a promise today."), `409 GroupFull` (join a full group by ID), `404 PromiseNotFound` ("I'm done" before promising).
  - Note that the room `groupId` is remembered in `sessionStorage` (`ss_group`) so a refresh keeps the scoreboard link, and that the timer is server-synchronized (>2s drift snaps to the server tick).
  - Keep every existing local setup command, the seeded credentials table, and the group-membership notes accurate.
- [ ] **F7.4** Update `README.md` with the product narrative: small matched groups, a shared focus room, visible commitments, and streak/scoreboard proof. Do not claim anything the API or UI does not do. Add the frontend check command:

```bash
cd frontend && npm test && npm run build
```

- [ ] **F7.5** Commit:

```bash
cd /workspaces/Study_Sprint
git add docs/DEMO.md README.md frontend/src/demo-flow.test.tsx
git commit -m "docs: document the verified StudySprint demo flow"
```

---

## 14. F8 — Final validation and definition of done

- [ ] **F8.1** Run the complete automated set (each command must exit 0):

```bash
cd /workspaces/Study_Sprint/frontend && npm test && npx tsc --noEmit && npm run build
cd /workspaces/Study_Sprint && git diff --check
cd /workspaces/Study_Sprint && make test
```

**Expected:** frontend suite green (all files below, 0 failures), `tsc --noEmit` silent, `vite build` succeeds, `git diff --check` silent, `make test` reports the backend pytest suite passing (it runs Postgres in Docker; Docker 29 + Compose v5.5.1 are available in this workspace).

Expected test files after F0–F7:

| Test file | Origin |
| --- | --- |
| `src/hooks/useRoomSocket.test.ts` | pre-existing, extended (9) |
| `src/lib/messages.test.ts` | F1 (6) |
| `src/lib/groupView.test.ts` | F1 (4) |
| `src/lib/nav.test.ts` | F1 (3) |
| `src/lib/roomView.test.ts` | F1 + F5 (10) |
| `src/lib/boardView.test.ts` | F1 (3) |
| `src/lib/groupContext.test.ts` | F1 (3) |
| `src/lib/api.test.ts` | F2 (4) |
| `src/components/StatusMessage.test.tsx` | F3 (4) |
| `src/components/AppShell.test.tsx` | F3 (2) |
| `src/styles/designSystem.test.ts` | F3 (3) |
| `src/routes/FindGroup.test.tsx` | F4 (4) |
| `src/components/CommitmentList.test.tsx` | F5 (4) |
| `src/routes/Room.test.tsx` | F5 (5) |
| `src/routes/Board.test.tsx` | F6 (4) |
| `src/demo-flow.test.tsx` | F7 (4) |

- [ ] **F8.2** Manual demo verification (this is the only part that needs a browser):

```bash
cd /workspaces/Study_Sprint && make dev && make seed
```

In a Codespace, forward both ports from your laptop first:

```bash
gh codespace ports forward 5173:5173 8000:8000 -c silver-goldfish-x69prj95p9r3vq4p
```

Then at `http://localhost:5173`:

1. Register or log in as `demo-math-0@x.com` / `secret123`.
2. Find my study group → readiness badge shows "Ready to start" → Start a focus sprint.
3. In the room: "Today's group commitments" appears above "Focus status"; the timer sits in the header.
4. Make today's promise → feedback is a polite status; the promise button becomes disabled and "I'm done" becomes enabled.
5. I'm done → "Done! Your streak is …" and the commitment row reads "Complete".
6. Open the same room in a second browser profile: both windows show the same tick and presence, one shows "focused", the other may show "away".
7. Finalize room session → the status line reads "Session finished" and the timer stops.
8. Scoreboard → streak summary + the semantic table with "Complete today" / "Not complete".
9. Narrow the window to ~400px: no horizontal scrolling, promise buttons are full width.
10. Tab through the page: every control shows the amber focus ring.
11. Open `/room/999999`: "Session unavailable" with a link back to `/find`.
12. Go offline for ~5s in the open room: "Reconnecting… Reconnecting attempt 1 of 3"; after three attempts "Connection lost".

- [ ] **F8.3** Definition of done — traceability (each row must be verifiable by the named test):

| Defect | Verified by |
| --- | --- |
| B1 | `roomView.test.ts` → "takes peer completion from the scoreboard…" and "marks peer completion as unknown…"; `CommitmentList.test.tsx` → "never shows a peer promise" / "says when peer completion is unknown instead of guessing" |
| B2 | `npm test` runs every file above in `environment: "node"` with no jsdom/testing-library in `package.json` |
| B3 | `useRoomSocket.test.ts` → "reconnects 3x on abnormal close, then gives up" (now expects `reconnecting:1..3`) and `tsc --noEmit` clean |
| B4 | `api.test.ts` → "turns a 422 validation payload into one line of human copy"; `messages.test.ts` → "extracts the first message from a FastAPI 422 array" |
| B5 | `useRoomSocket.test.ts` → "stops immediately on 4404…"; `Room.test.tsx` → "has an explicit unavailable state"; `nav.test.ts` → "reads a valid session id and rejects everything else" |
| B6 | `demo-flow.test.tsx` → all 4 cases (proved to fail by F7.2) |
| H1 | `groupView.test.ts` → "mirrors the backend quorum constants" + "trusts counts over a stale server status" |
| H2 | `messages.test.ts` → "maps domain codes to actionable copy" (covers `QuorumNotMet`, `PromiseNotFound`, `NotGroupMember`, `GroupNotFound`) |
| H3 | `roomView.test.ts` → "keeps completion terminal after a local complete call"; `demo-flow.test.tsx` → "stops offering a promise once one is recorded" |
| H4 | `nav.test.ts` → all cases; `AppShell.test.tsx` → "renders landmarks, navigation, and the page body" |
| H5 | the Files lists in F1, F3, F5, F6 (every helper and test has one canonical home) |
| H6 | `designSystem.test.ts` → "styles every status tone" + "has visible focus states…" |
| H7 | `FindGroup.tsx` leaves `pending` set after a successful start (code-level, verified by manual step 2 twice in a row plus `FindGroup.test.tsx` for the guarded input) |
| B5/H4 route guard | `nav.test.ts` → "sends unauthenticated visitors to login" |

---

## 15. Forbidden actions and anti-patterns (worker guardrails)

**Never edit (read-only backend):** `backend/**` (especially `app/modules/rooms/ws.py`, `app/modules/matching/service.py`, `app/modules/checkins/*`, `app/shared/errors.py`), `docker-compose.yml`, `backend/alembic/**`, `Makefile`.

**Never add:** npm dependencies (no `@testing-library/*`, `jsdom`, `happy-dom`, `msw`), a CSS framework, a component library, a state-management library, or a `frontend/src/components/ui/` design system.

**Never change:** route paths (`/login`, `/find`, `/room/:sid`, `/board`), API paths or payload shapes, WebSocket message names (`join`, `heartbeat`, `complete`), close-code handling for `4401`, the 15s heartbeat, the 3-retry policy, the >2s drift rule, or `todayLocal`'s local-calendar behaviour.

**Never weaken a test to make it pass:** no `toContain`/`toBeTruthy`/`toBeDefined` substitutions for an exact `toBe`, no `.skip`, no deleting a failing assertion, no `any` casts to silence `tsc`. If an expected string genuinely cannot match, fix the plan-consistent string in the helper or copy module **and** update every test that asserts it.

**Copy discipline:** user-visible strings come from `src/lib/copy.ts` or `src/lib/messages.ts`. If you change one, update `demo-flow.test.tsx`, the affected component tests, and `docs/DEMO.md` in the same commit.

**Commit discipline:** one workstream per commit, exact `git add` path lists as written, never `git add -A`, never commit `frontend/dist` (it is gitignored), and never amend or force-push a commit a previous workstream created.

**Known traps already paid for in this plan:**
1. Apostrophes in rendered text become `&#x27;` — use the `asRendered` helper (§4(e)).
2. `maxLength` renders camelCase server-side — match it with `/maxlength="280"/i`.
3. A required `RoomEvents` callback breaks `tsc` in `useRoomSocket.test.ts` — update that file in the same step.
4. Rendering a router-connected component without the `useLayoutEffect` shim prints React warnings (harmless but noisy) — use the shim from §4(b).
5. `react-dom/server` renders `role="timer"` fine, but do **not** add `aria-live` to the timer: `Room.test.tsx` asserts exactly one polite live region.

---

## 16. Evidence appendix (what was verified while writing this plan)

Everything below was executed in this workspace at commit `34bd4bb`; a worker can re-run any line to confirm.

| # | Claim | Command / result |
| --- | --- | --- |
| 1 | Baseline is green | `npm test` → 8 passed; `npx tsc --noEmit` → exit 0; `npm run build` → 42 modules |
| 2 | No DOM test stack exists | `package.json` has no testing-library/jsdom/happy-dom; `vite.config.ts` → `environment: "node"` |
| 3 | Node has no browser globals | `node -e "typeof localStorage"` → `undefined`; `typeof window` → `undefined` |
| 4 | `react-dom/server` works with zero deps | `renderToStaticMarkup(<p role="status" aria-live="polite">)` → `<p role="status" aria-live="polite">…</p>` |
| 5 | FastAPI 422 shape | TestClient against the repo's own `UserRegister`: `422 {'detail': [{'type': 'value_error', 'loc': ['body','email'], 'msg': '…'}]}`; `/groups/NaN/scoreboard` → `{'detail': [{'type': 'int_parsing', …}]}` |
| 6 | That payload crashes React | `renderToStaticMarkup(<p>{[{msg:'x'}]}</p>)` → throws `Objects are not valid as a React child` |
| 7 | `MemoryRouter` + layout route renders in node | `<div><nav><a href="/find">Find a group</a>…</div>`; with `React.useLayoutEffect = React.useEffect` the stderr warning disappears |
| 8 | All F1 helper logic and its exact expected values | 29 assertions (messages, groupView, roomView, boardView, nav, groupContext) → **29 passed, 0 failed** |
| 9 | `parseGroupId` cases | 9 cases (`"12"`, `" 12 "`, `"0007"`, `""`, `"abc"`, `"0"`, `"-3"`, `"1e3"`, `"12.5"`) → **PASS** |
| 10 | `statusDetail` / `guardRedirect` | 3 checks → **PASS** |
| 11 | `markCompleted` + completed-state flow | 5 checks → **PASS** |
| 12 | Room markup ordering + live-region count | indexes heading/timer/commitments/presence = `37 / 185 / 275 / 372`; exactly one `aria-live="polite"` → **PASS** |
| 13 | Apostrophe + `maxLength` rendering | `I'm done` → `I&#x27;m done`; `maxLength={280}` → `maxLength="280"` |
| 14 | Demo-flow assertions (corrected form) | 5 checks → **PASS** |
| 15 | `make test` is runnable here | `docker --version` → 29.8.0; `docker compose version` → v5.5.1 |
| 16 | Backend facts the plan depends on | `ws.py`: snapshot is `{id,email,online}`, 4401/4404 closes; `matching/service.py`: `GROUP_SIZE=4`, `QUORUM_MIN=3`; `errors.py`: `GroupFull`/`QuorumNotMet`/`AlreadyPromised` → 409, `PromiseNotFound` → 404, `NotGroupMember` → 403, `FutureDate` → 400; `checkins/service.py`: `complete_today` swallows `IntegrityError` (idempotent); `rooms/service.py`: `start_session` raises `QuorumNotMet`; `live_session_for_group` exists but is unused |

**Known limitations (accepted, do not "fix" without a spec change):**
1. Peer promise *text* is unavailable in-room by design (D7) — peers show presence + completion only. Reversing this requires a backend change, which is out of scope.
2. The current user's own promise text is only known after they submit it in this session (or when a 409 confirms it exists); after a reload the room shows the action state, not the text.
3. H7's double-submit protection is code-level (`pending` stays set on success) because testing it needs a DOM; it is covered by the manual step.
4. `404 PromiseNotFound` when clicking "I'm done" before promising surfaces as copy, not as a state change, because `complete` returns the same shape for a no-op completion.































