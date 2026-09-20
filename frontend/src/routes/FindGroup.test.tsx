import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GroupCard } from "../components/GroupCard";
import type { Group } from "../lib/api";
import { PRIMARY_ACTIONS } from "../lib/copy";
import { parseGroupId } from "../lib/groupView";

const ready: Group = { id: 3, member_count: 3, max_members: 4, status: "matched" };
const queued: Group = { id: 4, member_count: 2, max_members: 4, status: "queued" };

describe("parseGroupId", () => {
  it("accepts only positive integers", () => {
    expect(parseGroupId("12")).toBe(12);
    expect(parseGroupId(" 12 ")).toBe(12);
    expect(parseGroupId("0007")).toBe(7);
    expect(parseGroupId("")).toBeNull();
    expect(parseGroupId("abc")).toBeNull();
    expect(parseGroupId("0")).toBeNull();
    expect(parseGroupId("-3")).toBeNull();
    expect(parseGroupId("1e3")).toBeNull();
  });
});

describe("GroupCard", () => {
  it("offers the focus sprint when quorum is met", () => {
    const html = renderToStaticMarkup(<GroupCard group={ready} onStart={() => {}} busy={false} />);
    expect(html).toContain("3 of 4 learners");
    expect(html).toContain("Ready to start");
    expect(html).toContain(PRIMARY_ACTIONS.startSprint);
  });

  it("explains what is missing when the group is queued", () => {
    const html = renderToStaticMarkup(<GroupCard group={queued} onStart={() => {}} busy={false} />);
    expect(html).toContain("Waiting for 1 more learner");
    expect(html).not.toContain(PRIMARY_ACTIONS.startSprint);
  });

  it("disables the start action while the request is in flight", () => {
    const html = renderToStaticMarkup(<GroupCard group={ready} onStart={() => {}} busy={true} />);
    expect(html).toContain("disabled");
  });
});