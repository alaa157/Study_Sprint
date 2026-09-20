import { HEADINGS } from "./copy";

/** `/room/42` -> 42. Anything else (missing, non-numeric, zero, extra segments) -> null. */
export function roomSessionIdFromPath(pathname: string): number | null {
  const match = /^\/room\/(\d+)\/?$/.exec(pathname);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function navTitle(pathname: string): string {
  if (pathname.startsWith("/find")) return HEADINGS.findGroup;
  if (pathname.startsWith("/board")) return HEADINGS.board;
  if (roomSessionIdFromPath(pathname) !== null) return HEADINGS.room;
  return HEADINGS.app;
}

/** Mirrors the existing `Guard` behaviour in App.tsx, as a pure decision. */
export function guardRedirect(token: string | null): string | null {
  return token === null || token === "" ? "/login" : null;
}
