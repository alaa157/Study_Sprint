import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, errorMessage, type Group } from "../lib/api";

export function FindGroup() {
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [joinId, setJoinId] = useState("");
  const [error, setError] = useState("");

  async function find() {
    setError("");
    try {
      setGroup(await api.findGroup());
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function join() {
    setError("");
    try {
      setGroup(await api.joinGroup(Number(joinId)));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function start() {
    if (!group) return;
    try {
      const session = await api.createSession(group.id);
      navigate(`/room/${session.id}`, { state: { groupId: group.id } });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <main>
      <h1>Find a group</h1>
      <button type="button" onClick={find}>
        Find group
      </button>
      <div>
        <input
          placeholder="group id"
          value={joinId}
          onChange={(e) => setJoinId(e.target.value)}
          inputMode="numeric"
        />
        <button type="button" onClick={join}>
          Join by ID
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {group && (
        <section>
          <p>
            Group #{group.id} — {group.member_count}/{group.max_members} ({group.status})
          </p>
          <button type="button" onClick={start}>
            Start session
          </button>
        </section>
      )}
    </main>
  );
}
