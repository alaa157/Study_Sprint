import { describe, expect, it } from "vitest";
import {
  commitmentState,
  markCompleted,
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
