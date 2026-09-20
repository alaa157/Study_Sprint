import type { ScoreboardEntry } from "../lib/api";
import { scoreboardMessage } from "../lib/boardView";
import { ScoreboardRow } from "./ScoreboardRow";

export function ScoreboardTable({ rows }: { rows: ScoreboardEntry[] }) {
  const emptyMessage = scoreboardMessage(rows);
  if (emptyMessage !== null) return <p className="loading">{emptyMessage}</p>;
  return (
    <table className="scoreboard">
      <caption>Group check-ins for today</caption>
      <thead>
        <tr>
          <th scope="col">Member</th>
          <th scope="col">Streak</th>
          <th scope="col">Today</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((entry) => (
          <ScoreboardRow key={entry.email} entry={entry} />
        ))}
      </tbody>
    </table>
  );
}