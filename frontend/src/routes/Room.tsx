import { useState } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import { TimerDisplay } from "../components/TimerDisplay";
import { useRoomSocket } from "../hooks/useRoomSocket";
import { api, ApiError } from "../lib/api";

function todayLocal(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Room() {
  const { sid } = useParams<{ sid: string }>();
  const location = useLocation() as { state?: { groupId?: number } };
  const sessionId = Number(sid);
  const { remaining, participants, status, complete } = useRoomSocket(sessionId);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");

  async function promise() {
    setMessage("");
    try {
      await api.promise(text, todayLocal());
      setMessage("Promised for today.");
    } catch (e) {
      setMessage(e instanceof ApiError ? e.detail : "Request failed");
    }
  }

  async function done() {
    setMessage("");
    try {
      const res = await api.complete(todayLocal());
      complete(); // also finalize the live room for everyone
      setMessage(`Done! Streak: ${res.streak}`);
    } catch (e) {
      setMessage(e instanceof ApiError ? e.detail : "Request failed");
    }
  }

  return (
    <main>
      <h1>Room #{sessionId}</h1>
      <TimerDisplay remaining={remaining} />
      <p>Status: {status}</p>
      <h2>Participants</h2>
      <ul>
        {participants.map((p) => (
          <li key={p.id}>
            {p.email} {p.online ? "(online)" : "(away)"}
          </li>
        ))}
      </ul>
      <h2>Today&apos;s check-in</h2>
      <input placeholder="I will…" value={text} onChange={(e) => setText(e.target.value)} />
      <button type="button" onClick={promise}>
        Promise
      </button>
      <button type="button" onClick={done}>
        Complete
      </button>
      {message && <p role="status">{message}</p>}
      <p>
        <Link to={`/board${location.state?.groupId ? `?group=${location.state.groupId}` : ""}`}>
          Scoreboard
        </Link>
      </p>
    </main>
  );
}
