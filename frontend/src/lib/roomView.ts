// Pure room presentation model. No React, no socket, no storage: every rule below
// is unit-tested in the node environment.

export type RoomStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "finalized"
  | "unavailable"
  | "error";

export const STATUS_LABEL: Record<RoomStatus, string> = {
  connecting: "Connecting to the room...",
  live: "Live session",
  reconnecting: "Reconnecting...",
  finalized: "Session finished",
  unavailable: "This session is no longer available",
  error: "Connection lost",
};

export function statusLabel(status: RoomStatus): string {
  return STATUS_LABEL[status];
}

export function statusDetail(
  status: RoomStatus,
  attempt: number,
  maxAttempts: number,
): string | null {
  if (status !== "reconnecting") return null;
  return `Reconnecting attempt ${attempt} of ${maxAttempts}`;
}

export type CommitmentTone = "attention" | "active" | "complete" | "waiting";

export interface PresencePerson {
  id: number;
  email: string;
  online: boolean;
}

export interface ScoreRow {
  email: string;
  done_today: boolean;
}

/**
 * `commitmentKnown` is the important field: the room snapshot never carries peer
 * promise text (backend/app/modules/rooms/ws.py), so peers only ever expose
 * presence plus today's completion from the scoreboard.
 */
export interface CommitmentInput extends PresencePerson {
  promiseText: string | null;
  promised: boolean;
  completed: boolean;
  completionKnown: boolean;
}

export interface CommitmentView {
  label: string;
  tone: CommitmentTone;
  action: "promise" | "complete" | null;
}

export function commitmentState(
  person: CommitmentInput,
  currentUserId: number,
): CommitmentView {
  if (person.completed) return { label: "Complete", tone: "complete", action: null };
  const isCurrentUser = person.id === currentUserId;
  if (isCurrentUser && !person.promised) {
    return { label: "Add your promise", tone: "attention", action: "promise" };
  }
  if (isCurrentUser) {
    return { label: "Mark today's promise done", tone: "active", action: "complete" };
  }
  if (!person.completionKnown) {
    return { label: "Completion status unavailable", tone: "waiting", action: null };
  }
  return { label: "Not complete yet", tone: "waiting", action: null };
}

export function mergeCommitments(
  people: PresencePerson[],
  rows: ScoreRow[] | null,
  currentUser: { id: number } | null,
  localPromise: { promised: boolean; text: string | null },
): CommitmentInput[] {
  return people.map((person) => {
    const isCurrentUser = currentUser !== null && person.id === currentUser.id;
    const row = rows?.find((r) => r.email === person.email) ?? null;
    return {
      ...person,
      promiseText: isCurrentUser ? localPromise.text : null,
      promised: isCurrentUser ? localPromise.promised : false,
      completed: row?.done_today ?? false,
      completionKnown: rows !== null,
    };
  });
}

export function timerAriaLabel(remaining: number | null): string {
  if (remaining === null) return "Timer connecting";
  if (remaining <= 0) return "Time is up";
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes} minute${minutes === 1 ? "" : "s"} ${seconds} second${seconds === 1 ? "" : "s"} remaining`;
}

/** After a successful completion the local user is complete even if the scoreboard is unreachable. */
export function markCompleted(people: CommitmentInput[], userId: number): CommitmentInput[] {
  return people.map((person) =>
    person.id === userId ? { ...person, completed: true, completionKnown: true } : person,
  );
}
