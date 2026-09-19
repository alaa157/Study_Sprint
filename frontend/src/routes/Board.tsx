import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, ApiError, type ScoreboardEntry } from "../lib/api";

export function Board() {
  const [params] = useSearchParams();
  const [groupId, setGroupId] = useState(params.get("group") ?? "");
  const [rows, setRows] = useState<ScoreboardEntry[]>([]);
  const [streak, setStreak] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .streak()
      .then((s) => setStreak(s.streak))
      .catch(() => {});
  }, []);

  async function load() {
    setError("");
    try {
      setRows(await api.scoreboard(Number(groupId)));
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Request failed");
    }
  }

  return (
    <main>
      <h1>Scoreboard</h1>
      {streak !== null && <p>Your streak: {streak}</p>}
      <input
        placeholder="group id"
        value={groupId}
        onChange={(e) => setGroupId(e.target.value)}
        inputMode="numeric"
      />
      <button type="button" onClick={load}>
        Load
      </button>
      {error && <p role="alert">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Streak</th>
            <th>Done today</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.email}>
              <td>{r.email}</td>
              <td>{r.streak}</td>
              <td>{r.done_today ? "yes" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        <Link to="/find">Find a group</Link>
      </p>
    </main>
  );
}
