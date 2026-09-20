# Study_Sprint
StudySprint matches students into small study groups based on subject, timezone, and goals. Each group gets shared focus sessions with a live timer, daily check-ins ("did you do what you promised?"), streaks, and a lightweight group scoreboard. Think "Duolingo streaks + Discord study rooms," built as a real product.

## Product narrative

- **Small matched groups:** "Find my study group" matches you by subject,
  goals, and timezone; the readiness badge tells you honestly whether the
  group can start ("Ready to start") or is still waiting for learners.
- **A shared focus room:** the header holds the live, server-synchronized
  timer; "Today's group commitments" leads, "Focus status" follows. Peers
  show presence plus today's completion — never fabricated promise text.
- **Visible commitments:** "Make today's promise" → "I'm done". A completed
  promise stays completed; a duplicate is acknowledged, not re-asked. Every
  socket outcome (reconnecting, finished, unavailable, lost) has an explicit
  visible state.
- **Streak/scoreboard proof:** per-member streaks and "Complete today" /
  "Not complete" text (never colour alone), plus your own streak summary.

## Checks

```bash
cd frontend && npm test && npm run build
```

See `docs/DEMO.md` for the local demo walkthrough.
