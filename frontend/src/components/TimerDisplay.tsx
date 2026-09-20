import { timerAriaLabel } from "../lib/roomView";

export function TimerDisplay({ remaining }: { remaining: number | null }) {
  if (remaining === null) return <p className="timer">Waiting for the timer...</p>;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return (
    <p className="timer" role="timer" aria-label={timerAriaLabel(remaining)}>
      {minutes}:{String(seconds).padStart(2, "0")}
    </p>
  );
}
