# StudySprint UX Design Specification

## 1. Design brief

StudySprint is a portfolio-ready MVP for students who want small, shared focus
sessions and lightweight accountability. The primary audience for this design
pass is a portfolio reviewer, and the success criterion is that the product
value is understandable within two minutes.

The experience should tell a linear story:

> **Match → focus together → keep a promise → see progress**

This specification defines the frontend product experience. The existing
FastAPI, Postgres, JWT, HTTP, and WebSocket contracts remain the technical
constraints; this work does not introduce a new backend subsystem.

## 2. Agreed product direction

- **Core concept:** Focus command center
- **Visual tone:** Friendly library
- **Navigation:** Session-first
- **Room hierarchy:** Commitment circle
- **Primary action:** Make or complete a study promise
- **Supporting proof:** Live timer, participant presence, streaks, and
  scoreboard

The live room is the strongest product proof, but shared commitments—not the
timer—are its emotional center.

## 3. Information architecture

The app preserves the current route model and strengthens its presentation:

1. **Login/Register**
   - Minimal entry point.
   - Product promise: “Find your people. Keep your promise.”
   - Clear validation and authentication error states.

2. **Find a group**
   - Primary action: **Find my study group**.
   - Secondary action: join by group ID.
   - Show subject, goals, timezone/matching rationale, member count, and
     readiness.
   - Distinguish matched, queued, and group-full states.

3. **Group preview**
   - Show the proposed group before starting a session.
   - Make **Start a focus sprint** the obvious next action when quorum is met.
   - Explain what is needed when the group is not ready.

4. **Live room**
   - Show shared commitments, participant presence, and timer state.
   - Primary actions: make a promise, complete the promise, and finalize the
     session where permitted.
   - Link to the scoreboard without competing with the active session.

5. **Scoreboard**
   - Show group members, current streaks, and today’s completion status.
   - Keep the view lightweight and scannable.
   - Provide a clear route back to finding or returning to a room.

No separate dashboard route is required for this design. Existing routes may
be reorganized visually, but the session-first flow should remain recognizable
and easy to demo.

## 4. Visual system

### 4.1 Tokens and tone

- **Backgrounds:** soft sage surfaces with warm white/cream cards
- **Primary text:** dark ink
- **Secondary text:** muted green-gray
- **Accent:** amber for primary actions and attention states
- **Cards and controls:** moderately rounded corners and consistent spacing
- **Typography:** friendly, readable sans-serif
- **Timer:** large numeric display using tabular digits

The design should feel like a welcoming library or study room: calm and
approachable, but structured enough to communicate progress and live status.

### 4.2 Status communication

Color must not be the only status signal. Pair visual states with text or an
icon:

- `focused`
- `away`
- `connecting`
- `reconnecting`
- `complete`
- `queued`
- `group full`

Use the existing project’s component patterns where possible rather than
introducing a broad design-system dependency.

## 5. Live-room design

The room uses a commitment-first hierarchy:

1. **Room identity and shared intent**
   - Subject/group name.
   - Message such as “We’re in this together.”

2. **Today’s group commitments**
   - One compact item per participant.
   - Show completed, active, and missing promises with text labels.
   - Make the current user’s missing promise the most obvious next action.

3. **Focus status**
   - Show who is focused, away, or reconnecting.
   - Presence updates remain useful context, not a distracting feed.

4. **Timer**
   - Keep the synchronized remaining time visible near the room header.
   - The server remains the source of truth.
   - Preserve existing drift correction and reconnect behavior.

5. **Progress link**
   - Offer the scoreboard as supporting proof, not the primary room action.

### 5.1 Room states

The UI must explicitly represent:

- Connecting to the room
- Live session
- Reconnecting after a socket drop
- Session finalized
- Session expired or unavailable
- Promise not yet submitted
- Promise submitted
- Promise completed
- Duplicate promise rejected

Errors should be actionable and visible. Do not silently replace a failed
request with a success-shaped state.

## 6. Responsive and accessibility behavior

### 6.1 Responsive layout

- **Desktop:** use a two-column composition: commitment/status content as the
  main area and timer/supporting group context as the secondary area.
- **Mobile:** stack the room into one column.
- Keep the promise action full-width or otherwise visually dominant on narrow
  screens.
- Preserve the same content order across breakpoints so the user does not
  need to relearn the flow.

### 6.2 Accessibility

- Use semantic headings and landmarks for each route.
- Make all actions keyboard accessible.
- Provide visible focus states.
- Use text labels in addition to presence colors and icons.
- Use `role="status"` for non-critical request feedback already modeled by the
  application.
- Use polite live announcements for meaningful presence, connection, and
  session-state changes; avoid announcing every timer tick.
- Keep timer digits readable and stable with tabular numerals.
- Ensure contrast remains sufficient for sage, cream, ink, and amber tokens.

## 7. Component and route responsibilities

The frontend should evolve around focused components:

- **App/navigation shell:** route protection and session-first navigation
- **Auth form:** login/register mode, validation, and error feedback
- **Group discovery:** find, join, group preview, readiness, and start action
- **Room header:** group identity, connection state, and timer summary
- **Commitment list:** participant promises and current-user next action
- **Presence list:** accessible participant status
- **Promise controls:** submit and complete flows with explicit feedback
- **Scoreboard:** streak and completion table
- **Shared UI primitives:** card, button, status, loading, empty, and error
  presentation using the friendly-library tokens

These are presentation boundaries. They consume the existing `api` and room
socket interfaces rather than reaching into backend details.

## 8. Validation and testing

Frontend validation should cover:

- Existing API and WebSocket contracts remain unchanged.
- The end-to-end demo path remains:
  register/login → find group → start/join room → promise → complete →
  scoreboard.
- Loading, empty, error, reconnecting, and finalized states render correctly.
- Room presence and server timer updates remain visible and accessible.
- Timer drift correction and expired-token behavior remain intact.
- Promise duplicate and completion feedback remain explicit.
- Keyboard navigation and visible focus are present for the main path.
- Responsive layout is usable at mobile and desktop widths.
- Existing Vitest tests and the production build continue to pass.

## 9. Scope boundaries

### In scope

- Reorganize the existing React SPA around the session-first narrative.
- Apply the friendly-library visual system.
- Implement the commitment-circle room hierarchy.
- Improve loading, empty, error, connection, and completion states.
- Add focused responsive and accessibility behavior.
- Keep the existing backend and WebSocket protocols.

### Out of scope

- New backend modules or datastore changes
- New authentication models or providers
- Redis, multi-instance synchronization, or cloud deployment
- Payments, SSO, mobile-native apps, or admin tooling
- A separate dashboard product surface
- A broad third-party component or design-system dependency

