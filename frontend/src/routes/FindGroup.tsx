import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { GroupCard } from "../components/GroupCard";
import { LoadingState } from "../components/LoadingState";
import { StatusMessage } from "../components/StatusMessage";
import { api, errorMessage, type Group } from "../lib/api";
import { HEADINGS, PRIMARY_ACTIONS } from "../lib/copy";
import { rememberGroup } from "../lib/groupContext";
import { parseGroupId } from "../lib/groupView";
import { VALIDATION_ERROR } from "../lib/messages";

export function FindGroup() {
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [joinId, setJoinId] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"find" | "join" | "start" | null>(null);

  async function find() {
    setError("");
    setPending("find");
    try {
      setGroup(await api.findGroup());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  }

  async function join() {
    const id = parseGroupId(joinId);
    if (id === null) {
      setError(VALIDATION_ERROR);
      return;
    }
    setError("");
    setPending("join");
    try {
      setGroup(await api.joinGroup(id));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(null);
    }
  }

  async function start() {
    if (group === null) return;
    setError("");
    setPending("start");
    try {
      const session = await api.createSession(group.id);
      rememberGroup(group.id);
      navigate(`/room/${session.id}`, { state: { groupId: group.id } });
    } catch (e) {
      setError(errorMessage(e));
      setPending(null); // success intentionally leaves the action disabled
    }
  }

  return (
    <>
      <section className="card">
        <h2>{HEADINGS.findGroup}</h2>
        <p>We match you by subject, goals, and timezone so your study window is shared.</p>
        <button className="button-primary" type="button" onClick={find} disabled={pending !== null}>
          {PRIMARY_ACTIONS.findGroup}
        </button>
        {pending === "find" && <LoadingState label="Looking for learners who match you..." />}
      </section>
      <section className="card">
        <h2>Already have a group ID?</h2>
        <label htmlFor="group-id">
          Group ID
          <input
            id="group-id"
            inputMode="numeric"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
          />
        </label>
        <button type="button" onClick={join} disabled={pending !== null}>
          {PRIMARY_ACTIONS.joinById}
        </button>
        {pending === "join" && <LoadingState label="Joining the group..." />}
      </section>
      {error !== "" && (
        <StatusMessage tone="error" assertive>
          {error}
        </StatusMessage>
      )}
      {group !== null ? (
        <GroupCard group={group} onStart={start} busy={pending === "start"} />
      ) : (
        <EmptyState
          title="No group yet"
          description="Find a group to see who you are studying with, or join one with an ID."
        />
      )}
    </>
  );
}
