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