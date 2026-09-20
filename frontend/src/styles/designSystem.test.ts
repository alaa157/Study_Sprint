import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { statusToneClass, type StatusTone } from "../components/StatusMessage";

const css = readFileSync(fileURLToPath(new URL("./app.css", import.meta.url)), "utf8");

const TONES: StatusTone[] = [
  "info",
  "ready",
  "waiting",
  "attention",
  "complete",
  "reconnecting",
  "error",
];

describe("design system", () => {
  it("defines the friendly-library tokens", () => {
    for (const token of ["--ss-sage-50", "--ss-cream", "--ss-ink", "--ss-amber", "--ss-border"]) {
      expect(css).toContain(token);
    }
  });

  it("styles every status tone", () => {
    for (const tone of TONES) {
      expect(css).toContain(`.status--${tone}`);
    }
    expect(statusToneClass("attention")).toBe("status status--attention");
  });

  it("has visible focus states and a single mobile stacking breakpoint", () => {
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (max-width:");
  });
});
