import { describe, expect, it } from "vitest";
import { HEADINGS } from "./copy";
import { guardRedirect, navTitle, roomSessionIdFromPath } from "./nav";

describe("roomSessionIdFromPath", () => {
  it("reads a valid session id and rejects everything else", () => {
    expect(roomSessionIdFromPath("/room/42")).toBe(42);
    expect(roomSessionIdFromPath("/room/42/")).toBe(42);
    expect(roomSessionIdFromPath("/room/abc")).toBeNull();
    expect(roomSessionIdFromPath("/room/0")).toBeNull();
    expect(roomSessionIdFromPath("/room/42/extra")).toBeNull();
  });
});

describe("navTitle", () => {
  it("labels each route from the shared copy module", () => {
    expect(navTitle("/find")).toBe(HEADINGS.findGroup);
    expect(navTitle("/board")).toBe(HEADINGS.board);
    expect(navTitle("/room/42")).toBe(HEADINGS.room);
    expect(navTitle("/login")).toBe(HEADINGS.app);
  });
});

describe("guardRedirect", () => {
  it("sends unauthenticated visitors to login", () => {
    expect(guardRedirect(null)).toBe("/login");
    expect(guardRedirect("")).toBe("/login");
    expect(guardRedirect("token")).toBeNull();
  });
});
