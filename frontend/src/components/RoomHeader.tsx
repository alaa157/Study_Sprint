import { HEADINGS, SHARED_INTENT } from "../lib/copy";
import { statusDetail, statusLabel, type RoomStatus } from "../lib/roomView";
import { TimerDisplay } from "./TimerDisplay";

export interface RoomHeaderProps {
  sessionId: number;
  status: RoomStatus;
  attempt: number;
  maxAttempts: number;
  remaining: number | null;
}

export function RoomHeader({ sessionId, status, attempt, maxAttempts, remaining }: RoomHeaderProps) {
  const detail = statusDetail(status, attempt, maxAttempts);
  return (
    <header className="card room-header">
      <h2>
        {HEADINGS.room} #{sessionId}
      </h2>
      <p>{SHARED_INTENT}</p>
      <p role="status" aria-live="polite">
        {statusLabel(status)}
      </p>
      {detail !== null && <p>{detail}</p>}
      <TimerDisplay remaining={remaining} />
    </header>
  );
}