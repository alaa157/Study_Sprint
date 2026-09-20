import type { Group } from "../lib/api";
import { PRIMARY_ACTIONS } from "../lib/copy";
import { groupReadiness, seatsLeft } from "../lib/groupView";
import { ReadinessBadge } from "./ReadinessBadge";

export interface GroupCardProps {
  group: Group;
  onStart: () => void;
  busy: boolean;
}

export function GroupCard({ group, onStart, busy }: GroupCardProps) {
  const readiness = groupReadiness(group);
  const seats = seatsLeft(group);
  return (
    <section className="card" aria-labelledby="matched-group">
      <h2 id="matched-group">Your group</h2>
      <p>
        Group #{group.id} — {group.member_count} of {group.max_members} learners
        {seats === 0 ? " (full)" : ` (${seats} seat${seats === 1 ? "" : "s"} left)`}
      </p>
      <ReadinessBadge tone={readiness.tone} label={readiness.label} />
      {readiness.tone === "ready" ? (
        <button className="button-primary" type="button" onClick={onStart} disabled={busy}>
          {PRIMARY_ACTIONS.startSprint}
        </button>
      ) : (
        <p>Matching keeps running while you wait — check back in a moment.</p>
      )}
    </section>
  );
}