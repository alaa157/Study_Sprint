import { describe, it, expect } from "vitest";
import { needsSnap, backoffDelay, MAX_RETRIES } from "../lib/socket";

// WS mock server sends tick with remaining_s 10s behind local -> expect snap
describe("useRoomSocket", () => {
  it("snaps to server tick on drift >2s", () => {
    expect(needsSnap(100, 97)).toBe(true);
    expect(needsSnap(100, 99)).toBe(false);
    expect(needsSnap(100, 100)).toBe(false);
  });

  it("retries with exponential backoff, then gives up", () => {
    expect(backoffDelay(0)).toBe(1000);
    expect(backoffDelay(1)).toBe(2000);
    expect(backoffDelay(2)).toBe(4000);
    expect(MAX_RETRIES).toBe(3);
  });
});
