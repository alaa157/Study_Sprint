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
