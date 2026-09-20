import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CommitmentList } from "../components/CommitmentList";
import { PresenceList } from "../components/PresenceList";
import { RoomHeader } from "../components/RoomHeader";
import { HEADINGS } from "../lib/copy";

describe("room surface", () => {
  it("keeps identity and timer together, with commitments leading the main column", () => {
    const html = renderToStaticMarkup(
      <>
        <RoomHeader sessionId={12} status="live" attempt={0} maxAttempts={3} remaining={1472} />
        <CommitmentList people={[]} currentUserId={2} />
        <PresenceList people={[{ id: 2, email: "alex@example.com", online: true }]} status="live" />
      </>,
    );
    const heading = html.indexOf(HEADINGS.room);
    const timer = html.indexOf("24 minutes 32 seconds remaining");
    const commitments = html.indexOf("group commitments");
    const presence = html.indexOf(HEADINGS.presence);
    expect(heading).toBeGreaterThanOrEqual(0);
    expect(timer).toBeGreaterThan(heading); // spec 5.4: the timer stays near the header
    expect(commitments).toBeGreaterThan(timer); // spec 5.2: commitments lead the supporting context
    expect(presence).toBeGreaterThan(commitments);
  });

  it("announces the connection state but not the timer", () => {
    const html = renderToStaticMarkup(
      <RoomHeader sessionId={12} status="reconnecting" attempt={2} maxAttempts={3} remaining={1472} />,
    );
    expect(html).toContain("Reconnecting...");
    expect(html).toContain("Reconnecting attempt 2 of 3");
    expect(html).toContain('aria-label="24 minutes 32 seconds remaining"');
    expect(html.match(/aria-live="polite"/g) ?? []).toHaveLength(1);
  });

  it("has an explicit unavailable state", () => {
    const html = renderToStaticMarkup(
      <RoomHeader sessionId={12} status="unavailable" attempt={0} maxAttempts={3} remaining={null} />,
    );
    expect(html).toContain("This session is no longer available");
  });

  it("labels presence as focused or away in text", () => {
    const html = renderToStaticMarkup(
      <PresenceList
        people={[
          { id: 2, email: "alex@example.com", online: true },
          { id: 1, email: "maya@example.com", online: false },
        ]}
        status="live"
      />,
    );
    expect(html).toContain("focused");
    expect(html).toContain("away");
  });

  it("warns that presence may be stale while reconnecting", () => {
    const html = renderToStaticMarkup(<PresenceList people={[]} status="reconnecting" />);
    expect(html).toContain("Presence updates paused");
  });
});