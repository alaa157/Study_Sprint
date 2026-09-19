export function TimerDisplay({ remaining }: { remaining: number | null }) {
  if (remaining === null) return <p>Connecting…</p>;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return (
    <p style={{ fontSize: "3rem", fontVariantNumeric: "tabular-nums" }}>
      {minutes}:{String(seconds).padStart(2, "0")}
    </p>
  );
}
