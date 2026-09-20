import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getToken } from "../lib/api";
import { guardRedirect, navTitle, roomSessionIdFromPath } from "../lib/nav";
import { AppShell } from "./AppShell";

/**
 * Layout route for every authenticated page. Rendering the shell here (instead of
 * wrapping <Routes>) is what lets it read the current pathname and session id.
 */
export function ProtectedLayout() {
  const { pathname } = useLocation();
  const redirect = guardRedirect(getToken());
  if (redirect !== null) return <Navigate to={redirect} replace />;
  return (
    <AppShell title={navTitle(pathname)} roomSessionId={roomSessionIdFromPath(pathname)}>
      <Outlet />
    </AppShell>
  );
}
