import { useCallback, useEffect, useRef, useState } from "react";
import { logout, wsUrl } from "../lib/api";
import { RoomSocketClient, type Participant } from "../lib/roomSocket";
import { HEARTBEAT_INTERVAL_MS, needsSnap } from "../lib/socket";

export type { Participant };
export type RoomStatus = "connecting" | "live" | "finalized" | "error";

/** Live room socket: join → snapshot, 15s heartbeats, >2s drift snap, 3x reconnect. */
export function useRoomSocket(sessionId: number) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const remainingRef = useRef<number | null>(null);
  const finalizedRef = useRef(false);
  const clientRef = useRef<RoomSocketClient | null>(null);

  const setBoth = useCallback((value: number) => {
    remainingRef.current = value;
    setRemaining(value);
  }, []);

  useEffect(() => {
    const client = new RoomSocketClient(wsUrl(sessionId), {
      onSnapshot: (serverRemaining, people) => {
        setStatus("live");
        setBoth(serverRemaining);
        setParticipants(people);
      },
      onTick: (serverRemaining) => {
        // Drift >2s: snap to server, never accumulate locally.
        if (remainingRef.current !== null && needsSnap(remainingRef.current, serverRemaining)) {
          setBoth(serverRemaining);
        }
      },
      onPresence: (people) => setParticipants(people),
      onFinalized: () => {
        finalizedRef.current = true;
        setStatus("finalized");
      },
      onAuthFailure: () => logout(), // expired/bad token: back to login, no retry
      onGaveUp: () => setStatus("error"),
    });
    clientRef.current = client;
    client.connect();

    const heartbeat = window.setInterval(() => client.heartbeat(), HEARTBEAT_INTERVAL_MS);
    const countdown = window.setInterval(() => {
      if (!finalizedRef.current && remainingRef.current !== null && remainingRef.current > 0) {
        setBoth(remainingRef.current - 1);
      }
    }, 1000);
    return () => {
      window.clearInterval(heartbeat);
      window.clearInterval(countdown);
      client.close(); // StrictMode-safe: closed clients never reconnect
      clientRef.current = null;
    };
  }, [sessionId, setBoth]);

  const finalizeRoom = useCallback(() => {
    clientRef.current?.finalizeRoom();
  }, []);

  return { remaining, participants, status, finalizeRoom };
}
