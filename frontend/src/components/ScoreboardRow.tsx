import type { ScoreboardEntry } from "../lib/api";
import { completionLabel } from "../lib/boardView";

export function ScoreboardRow({ entry }: { entry: ScoreboardEntry }) {
  return (
    <tr>
      <td>{entry.email}</td>
      <td>{entry.streak}</td>
      <td>{completionLabel(entry.done_today)}</td>
    </tr>
  );
}