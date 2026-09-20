import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { HEADINGS } from "../lib/copy";

// react-router v6 uses useLayoutEffect; the server renderer warns about it.
React.useLayoutEffect = React.useEffect;

function render(pathname: string, roomSessionId: number | null): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <AppShell title={HEADINGS.findGroup} roomSessionId={roomSessionId}>
        <p>page body</p>
      </AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  it("renders landmarks, navigation, and the page body", () => {
    const html = render("/find", null);
    expect(html).toContain("<header");
    expect(html).toContain("<main");
    expect(html).toContain('href="/find"');
    expect(html).toContain('href="/board"');
    expect(html).toContain(HEADINGS.findGroup);
    expect(html).toContain("page body");
  });

  it("only offers the current-room link inside a room", () => {
    expect(render("/room/7", 7)).toContain('href="/room/7"');
    expect(render("/find", null)).not.toContain('href="/room/');
  });
});
