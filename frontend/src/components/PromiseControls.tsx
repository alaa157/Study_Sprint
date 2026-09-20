import { PRIMARY_ACTIONS } from "../lib/copy";
import { StatusMessage, type StatusTone } from "./StatusMessage";

export interface PromiseControlsProps {
  text: string;
  onTextChange: (value: string) => void;
  onPromise: () => void;
  onComplete: () => void;
  pending: "promise" | "complete" | null;
  feedback: string;
  feedbackTone: StatusTone;
  nextAction: "promise" | "complete" | null;
}

export function PromiseControls({
  text,
  onTextChange,
  onPromise,
  onComplete,
  pending,
  feedback,
  feedbackTone,
  nextAction,
}: PromiseControlsProps) {
  return (
    <section className="card promise-controls" aria-labelledby="promise-heading">
      <h2 id="promise-heading">Today&apos;s promise</h2>
      <label htmlFor="promise-text">
        What will you finish?
        <input
          id="promise-text"
          maxLength={280}
          value={text}
          placeholder="Finish chapter 3 notes"
          onChange={(event) => onTextChange(event.target.value)}
        />
      </label>
      <button
        className="button-primary"
        type="button"
        onClick={onPromise}
        disabled={pending !== null || nextAction !== "promise"}
      >
        {PRIMARY_ACTIONS.promise}
      </button>
      <button
        type="button"
        onClick={onComplete}
        disabled={pending !== null || nextAction !== "complete"}
      >
        {PRIMARY_ACTIONS.complete}
      </button>
      {feedback !== "" && (
        <StatusMessage tone={feedbackTone} assertive={feedbackTone === "error"}>
          {feedback}
        </StatusMessage>
      )}
    </section>
  );
}