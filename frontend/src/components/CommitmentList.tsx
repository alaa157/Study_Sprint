import { HEADINGS } from "../lib/copy";
import { commitmentState, type CommitmentInput } from "../lib/roomView";

export interface CommitmentListProps {
  people: CommitmentInput[];
  currentUserId: number | null;
}

export function CommitmentList({ people, currentUserId }: CommitmentListProps) {
  return (
    <section className="card" aria-labelledby="commitments-heading">
      <h2 id="commitments-heading">{HEADINGS.commitments}</h2>
      {people.length === 0 ? (
        <p>Waiting for the group to join...</p>
      ) : (
        <ul className="commitments">
          {people.map((person) => {
            const view = commitmentState(person, currentUserId ?? -1);
            return (
              <li key={person.id} className={`commitment commitment--${view.tone}`}>
                <span className="commitment-owner">
                  {person.id === currentUserId ? "You" : person.email}
                </span>
                {person.promiseText !== null && <span>{person.promiseText}</span>}
                <span className="commitment-status">{view.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}