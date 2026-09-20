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
