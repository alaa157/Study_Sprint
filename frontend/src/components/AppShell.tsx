import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { HEADINGS, NAV } from "../lib/copy";

export interface AppShellProps {
  title: string;
  roomSessionId: number | null;
  children: ReactNode;
}

/** Session-first chrome: identity, current page title, and the three nav targets. */
export function AppShell({ title, roomSessionId, children }: AppShellProps) {
  return (
    <>
      <header className="app-header">
        <p className="app-brand">{HEADINGS.app}</p>
        <h1 className="app-title">{title}</h1>
        <nav className="app-nav" aria-label={HEADINGS.app}>
          <Link to="/find">{NAV.findGroup}</Link>
          {roomSessionId !== null && <Link to={`/room/${roomSessionId}`}>{HEADINGS.room}</Link>}
          <Link to="/board">{NAV.scoreboard}</Link>
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </>
  );
}
