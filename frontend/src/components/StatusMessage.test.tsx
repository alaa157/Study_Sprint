import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusMessage, statusToneClass, type StatusTone } from "./StatusMessage";

const TONES: StatusTone[] = [
  "info",
  "ready",
  "waiting",
  "attention",
  "complete",
  "reconnecting",
  "error",
];

describe("statusToneClass", () => {
  it("maps a reconnecting tone to a stable class", () => {
    expect(statusToneClass("reconnecting")).toBe("status status--reconnecting");
  });

  it("names a class for every tone", () => {
    expect(TONES.map(statusToneClass)).toEqual(TONES.map((tone) => `status status--${tone}`));
  });
});

describe("StatusMessage", () => {
  it("announces non-critical feedback politely", () => {
    const html = renderToStaticMarkup(<StatusMessage tone="ready">Ready to start</StatusMessage>);
    expect(html).toContain('role="status"');
    expect(html).toContain("status--ready");
  });

  it("announces errors assertively", () => {
    const html = renderToStaticMarkup(
      <StatusMessage tone="error" assertive>
        Could not load the scoreboard
      </StatusMessage>,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
  });
});
