import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { CommitmentList } from "../components/CommitmentList";
import { EmptyState } from "../components/EmptyState";
import { LoadingState } from "../components/LoadingState";
import { PresenceList } from "../components/PresenceList";
import { PromiseControls } from "../components/PromiseControls";
import { RoomHeader } from "../components/RoomHeader";
import { StatusMessage, type StatusTone } from "../components/StatusMessage";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { ApiError, api, errorMessage, type ScoreboardEntry } from "../lib/api";
import { resolveGroupId } from "../lib/groupContext";
import { roomSessionIdFromPath } from "../lib/nav";
import { commitmentState, markCompleted, mergeCommitments } from "../lib/roomView";
import { MAX_RETRIES } from "../lib/socket";

/** Calendar date in the browser's local timezone (UTC slicing would be off by a day). */
export function todayLocal(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function Room() {
  const { sid } = useParams<{ sid: string }>();
  const sessionId = roomSessionIdFromPath(`/room/${sid ?? ""}`);
  if (sessionId === null) {
    return (
      <EmptyState
        title="Session unavailable"
        description="That room link is not valid. Choose a group to start a new focus sprint."
        action={<Link to="/find">Find a group</Link>}
      />
    );
  }
  return <RoomSession sessionId={sessionId} />;
}

function RoomSession({ sessionId }: { sessionId: number }) {
  const location = useLocation() as { state?: { groupId?: number } };
  const groupId = resolveGroupId(location.state?.groupId);
  const { remaining, participants, status, reconnectAttempt, finalizeRoom } =
    useRoomSocket(sessionId);
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string } | null>(null);
  const [rows, setRows] = useState<ScoreboardEntry[] | null>(null);
  const [localPromise, setLocalPromise] = useState<{ promised: boolean; text: string | null }>({
    promised: false,
    text: null,
  });
  const [completedLocally, setCompletedLocally] = useState(false);
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<StatusTone>("info");
  const [pending, setPending] = useState<"promise" | "complete" | null>(null);

  useEffect(() => {
    api
      .me()
      .then((me) => setCurrentUser({ id: me.id, email: me.email }))
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    if (groupId === null) {
      // No group id (deep link with empty storage): peer completion stays unknown, never guessed.
      setRows(null);
      return;
    }
    api.scoreboard(groupId).then(setRows).catch(() => setRows(null));
  }, [groupId]);

  const people = useMemo(() => {
    const merged = mergeCommitments(participants, rows, currentUser, localPromise);
    return completedLocally && currentUser !== null
      ? markCompleted(merged, currentUser.id)
      : merged;
  }, [participants, rows, currentUser, localPromise, completedLocally]);

  const me = currentUser === null ? null : (people.find((p) => p.id === currentUser.id) ?? null);
  const nextAction =
    me === null || currentUser === null ? null : commitmentState(me, currentUser.id).action;

  async function promise() {
    setFeedback("");
    setPending("promise");
    try {
      await api.promise(text, todayLocal());
      setLocalPromise({ promised: true, text });
      setFeedback("Promise saved for today.");
      setFeedbackTone("ready");
    } catch (e) {
      if (e instanceof ApiError && e.detail === "AlreadyPromised") {
        // A duplicate promise is state, not failure: stop asking for one.
        setLocalPromise({ promised: true, text: null });
        setFeedback(errorMessage(e));
        setFeedbackTone("attention");
      } else {
        setFeedback(errorMessage(e));
        setFeedbackTone("error");
      }
    } finally {
      setPending(null);
    }
  }

  async function complete() {
    setFeedback("");
    setPending("complete");
    try {
      const res = await api.complete(todayLocal());
      setCompletedLocally(true);
      setFeedback(`Done! Your streak is ${res.streak} day${res.streak === 1 ? "" : "s"}.`);
      setFeedbackTone("complete");
    } catch (e) {
      setFeedback(errorMessage(e));
      setFeedbackTone("error");
    } finally {
      setPending(null);
    }
  }

  if (status === "unavailable") {
    return (
      <EmptyState
        title="Session unavailable"
        description="This session is no longer available. Start a new focus sprint with your group."
        action={<Link to="/find">Find a group</Link>}
      />
    );
  }

  return (
    <>
      <RoomHeader
        sessionId={sessionId}
        status={status}
        attempt={reconnectAttempt}
        maxAttempts={MAX_RETRIES}
        remaining={remaining}
      />
      <div className="room-layout">
        <div className="room-main">
          <CommitmentList people={people} currentUserId={currentUser?.id ?? null} />
          <PresenceList people={participants} status={status} />
        </div>
        <div className="room-aside">
          <PromiseControls
            text={text}
            onTextChange={setText}
            onPromise={promise}
            onComplete={complete}
            pending={pending}
            feedback={feedback}
            feedbackTone={feedbackTone}
            nextAction={nextAction}
          />
          <section className="card" aria-labelledby="session-heading">
            <h2 id="session-heading">Session</h2>
            <button type="button" onClick={finalizeRoom} disabled={status !== "live"}>
              Finalize room session
            </button>
            <p>
              <Link to={groupId !== null ? `/board?group=${groupId}` : "/board"}>Scoreboard</Link>
            </p>
          </section>
        </div>
      </div>
      {currentUser === null && <LoadingState label="Loading your check-in status..." />}
      {rows === null && groupId !== null && (
        <StatusMessage tone="waiting">
          Group completion is temporarily unavailable. Your own promise still works.
        </StatusMessage>
      )}
    </>
  );
}
