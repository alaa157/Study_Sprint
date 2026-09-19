import { useCallback, useEffect, useRef, useState } from "react";
import { logout, wsUrl } from "../lib/api";
import {
  AUTH_CLOSE_CODE,
  HEARTBEAT_INTERVAL_MS,
  MAX_RETRIES,
  backoffDelay,
  needsSnap,
} from "../lib/socket";

export interface Participant {
  id: number;
  email: string;
  online: boolean;
}

export type RoomStatus = "connecting" | "live" | "finalized" | "error";

interface TickMsg {
  type: "tick";
  remaining_s: number;
}

/** Live room socket: join → snapshot, 15s heartbeats, >2s drift snap, 3x reconnect. */
export function useRoomSocket(sessionId: number) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const remainingRef = useRef<number | null>(null);
  const finalizedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const setBoth = useCallback((value: number) => {
    remainingRef.current = value;
    setRemaining(value);
  }, []);

  const connect = useCallback(() => {
    const ws = new WebSocket(wsUrl(sessionId));
    wsRef.current = ws;

    ws.onopen = () => {
      retriesRef.current = 0;
      ws.send(JSON.stringify({ type: "join" }));
    };

    ws.onmessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data as string) as
        | { type: "state_snapshot"; remaining_s: number; participants: Participant[] }
        | TickMsg
        | { type: "presence"; participants: Participant[] }
        | { type: "finalized" };
      switch (msg.type) {
        case "state_snapshot":
          setStatus("live");
          setBoth(msg.remaining_s);
          setParticipants(msg.participants);
          break;
        case "tick":
          if (remainingRef.current !== null && needsSnap(remainingRef.current, msg.remaining_s)) {
            setBoth(msg.remaining_s); // drift >2s: snap to server, no local accumulation
          }
          break;
        case "presence":
          setParticipants(msg.participants);
          break;
        case "finalized":
          finalizedRef.current = true;
          setStatus("finalized");
          break;
      }
    };

    ws.onclose = (event: CloseEvent) => {
      if (event.code === AUTH_CLOSE_CODE) {
        logout(); // expired/bad token: back to login, no retry
        return;
      }
      if (finalizedRef.current) return;
      if (retriesRef.current < MAX_RETRIES) {
        const delay = backoffDelay(retriesRef.current);
        retriesRef.current += 1;
        const id = window.setTimeout(connect, delay);
        timersRef.current.push(id);
      } else {
        setStatus("error");
      }
    };
  }, [sessionId, setBoth]);

  useEffect(() => {
    connect();
    const heartbeat = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "heartbeat" }));
      }
    }, HEARTBEAT_INTERVAL_MS);
    const countdown = window.setInterval(() => {
      if (remainingRef.current !== null && remainingRef.current > 0) {
        setBoth(remainingRef.current - 1);
      }
    }, 1000);
    timersRef.current.push(heartbeat, countdown);
    return () => {
      timersRef.current.forEach((id) => window.clearInterval(id));
      timersRef.current = [];
      wsRef.current?.close();
    };
  }, [connect, setBoth]);

  const complete = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "complete" }));
    }
  }, []);

  return { remaining, participants, status, complete };
}
