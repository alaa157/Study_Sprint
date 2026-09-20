import { HEADINGS } from "../lib/copy";
import type { PresencePerson, RoomStatus } from "../lib/roomView";

export interface PresenceListProps {
  people: PresencePerson[];
  status: RoomStatus;
}

export function PresenceList({ people, status }: PresenceListProps) {
  const stale = status === "connecting" || status === "reconnecting" || status === "error";
  return (
    <section className="card" aria-labelledby="presence-heading">
      <h2 id="presence-heading">{HEADINGS.presence}</h2>
      {stale && (
        <p>Presence updates paused — the list below may be out of date until we reconnect.</p>
      )}
      <ul className="presence">
        {people.map((person) => (
          <li key={person.id}>
            {person.email} — {person.online ? "focused" : "away"}
          </li>
        ))}
      </ul>
      {people.length === 0 && <p>No one has joined the room yet.</p>}
    </section>
  );
}