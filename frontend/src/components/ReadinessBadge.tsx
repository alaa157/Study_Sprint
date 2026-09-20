import { statusToneClass } from "./StatusMessage";

/** Text label + tone, so readiness is never signalled by colour alone. */
export function ReadinessBadge({
  tone,
  label,
}: {
  tone: "ready" | "waiting";
  label: string;
}) {
  return <p className={statusToneClass(tone)}>{label}</p>;
}