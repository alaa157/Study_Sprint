import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CommitmentList } from "./CommitmentList";
import type { CommitmentInput } from "../lib/roomView";

const base: CommitmentInput = {
  id: 1,
  email: "maya@example.com",
  online: true,
  promiseText: null,
  promised: false,
  completed: false,
  completionKnown: true,
};

const me: CommitmentInput = { ...base, id: 2, email: "alex@example.com" };

describe("CommitmentList", () => {
  it("makes the current user's missing promise the most obvious item", () => {
    const html = renderToStaticMarkup(<CommitmentList people={[me]} currentUserId={2} />);
    expect(html).toContain("You");
    expect(html).toContain("Add your promise");
    expect(html).toContain("commitment--attention");
  });

  it("labels peers by completion and never shows a peer promise", () => {
    const done = { ...base, completed: true };
    const html = renderToStaticMarkup(<CommitmentList people={[done]} currentUserId={2} />);
    expect(html).toContain("maya@example.com");
    expect(html).toContain("Complete");
    expect(html).toContain("commitment--complete");
  });

  it("says when peer completion is unknown instead of guessing", () => {
    const unknown = { ...base, completionKnown: false };
    const html = renderToStaticMarkup(<CommitmentList people={[unknown]} currentUserId={2} />);
    expect(html).toContain("Completion status unavailable");
  });

  it("renders an explicit waiting state for an empty room", () => {
    const html = renderToStaticMarkup(<CommitmentList people={[]} currentUserId={2} />);
    expect(html).toContain("Waiting for the group to join");
  });
});