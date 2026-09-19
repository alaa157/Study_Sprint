// Pure, unit-tested socket policy helpers (no React import: testable in node).

/** Snap to the server tick when local/remote clocks differ by more than this. */
export const DRIFT_THRESHOLD_S = 2;

/** Heartbeat cadence (server presence TTL is 45s: three misses = stale). */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/** Max auto-reconnect attempts after an unexpected close. */
export const MAX_RETRIES = 3;

/** Close code the server sends for missing/expired tokens. */
export const AUTH_CLOSE_CODE = 4401;

export function needsSnap(
  localRemaining: number,
  serverRemaining: number,
  threshold: number = DRIFT_THRESHOLD_S,
): boolean {
  return Math.abs(localRemaining - serverRemaining) > threshold;
}

export function backoffDelay(attempt: number): number {
  return 1000 * 2 ** attempt;
}
