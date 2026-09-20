import type { ReactNode } from "react";

export type StatusTone =
  | "info"
  | "ready"
  | "waiting"
  | "attention"
  | "complete"
  | "reconnecting"
  | "error";

export function statusToneClass(tone: StatusTone): string {
  return `status status--${tone}`;
}

/**
 * `assertive` renders role="alert" for failures; everything else is a polite
 * role="status" so screen readers are not interrupted for progress updates.
 */
export function StatusMessage({
  tone = "info",
  assertive = false,
  children,
}: {
  tone?: StatusTone;
  assertive?: boolean;
  children: ReactNode;
}) {
  return (
    <p className={statusToneClass(tone)} role={assertive ? "alert" : "status"} aria-live={assertive ? "assertive" : "polite"}>
      {children}
    </p>
  );
}
