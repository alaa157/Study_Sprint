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
