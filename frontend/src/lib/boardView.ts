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
