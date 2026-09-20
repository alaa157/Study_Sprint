import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LoadingState } from "../components/LoadingState";
import { ScoreboardTable } from "../components/ScoreboardTable";
import { StatusMessage } from "../components/StatusMessage";
import { api, errorMessage, type ScoreboardEntry } from "../lib/api";
import { streakSummary } from "../lib/boardView";
import { HEADINGS } from "../lib/copy";
import { parseGroupId } from "../lib/groupView";
import { VALIDATION_ERROR } from "../lib/messages";

export function Board() {
  const [params] = useSearchParams();
  const preset = params.get("group") ?? "";
  const [groupId, setGroupId] = useState(preset);
  const [rows, setRows] = useState<ScoreboardEntry[] | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (raw: string) => {
    const id = parseGroupId(raw);
    if (id === null) {
      setError(VALIDATION_ERROR);
      return;
    }
    setError("");
    setLoading(true);
    try {
      setRows(await api.scoreboard(id));
    } catch (e) {
      setRows(null);
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api
      .streak()
      .then((s) => setStreak(s.streak))
      .catch(() => setStreak(null));
  }, []);

  useEffect(() => {
    if (preset !== "") void load(preset);
  }, [load, preset]);

  return (
    <>
      <section className="card">
        <h2>{HEADINGS.board}</h2>
        <p>{streakSummary(streak)}</p>
      </section>
      {preset === "" && (
        <section className="card">
          <h2>Load a scoreboard</h2>
          <label htmlFor="board-group-id">
            Group ID
            <input
              id="board-group-id"
              inputMode="numeric"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            />
          </label>
          <button type="button" onClick={() => void load(groupId)} disabled={loading}>
            Load scoreboard
          </button>
        </section>
      )}
      {loading && <LoadingState label="Loading check-ins..." />}
      {error !== "" && (
        <StatusMessage tone="error" assertive>
          {error}
        </StatusMessage>
      )}
      {rows !== null && <ScoreboardTable rows={rows} />}
      <p>
        <Link to="/find">Find a group</Link>
      </p>
    </>
  );
}
