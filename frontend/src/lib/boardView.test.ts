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
