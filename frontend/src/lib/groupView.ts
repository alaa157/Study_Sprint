import type { Group } from "./api";

// Mirrors backend/app/modules/matching/service.py — keep both sides in step.
export const GROUP_SIZE = 4;
export const QUORUM_MIN = 3;

export interface Readiness {
  tone: "ready" | "waiting";
  label: string;
}

function learner(count: number): string {
  return count === 1 ? "learner" : "learners";
}

/**
 * Counts are authoritative: the server derives `status` from the same count, so a
 * stale response must never talk the UI out of a startable group.
 */
export function groupReadiness(group: Group): Readiness {
  if (group.member_count >= QUORUM_MIN) return { tone: "ready", label: "Ready to start" };
  const needed = QUORUM_MIN - group.member_count;
  return { tone: "waiting", label: `Waiting for ${needed} more ${learner(needed)}` };
}

export function seatsLeft(group: Pick<Group, "member_count" | "max_members">): number {
  return Math.max(0, group.max_members - group.member_count);
}

/** Accepts only a positive decimal integer: protects the API from 422s on bad input. */
export function parseGroupId(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const id = Number(trimmed);
  return Number.isInteger(id) && id > 0 ? id : null;
}
