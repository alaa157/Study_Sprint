// User-facing API error copy. Pure and dependency-free so it is testable in node.
//
// FastAPI sends {"detail": "<DomainError code>"} for handled errors and
// {"detail": [{...pydantic...}]} for validation errors. `detail` is therefore
// `unknown` on the wire; normalizeDetail() collapses both to one line of text.

export const NETWORK_ERROR = "Could not reach the server. Check your connection and try again.";
export const VALIDATION_ERROR = "Please check that form and try again.";
export const FALLBACK_ERROR = "Request failed.";

export const DOMAIN_COPY: Record<string, string> = {
  EmailTaken: "That email is already registered. Try logging in instead.",
  BadCredentials: "Email or password is incorrect.",
  BadToken: "Your session expired. Please log in again.",
  Unauthorized: "Your session expired. Please log in again.",
  GroupNotFound: "That group does not exist. Try finding a new group.",
  GroupFull: "That group just filled up. Try finding another group.",
  QuorumNotMet: "A focus sprint needs 3 learners. Invite one more and try again.",
  NotGroupMember: "You are not a member of that group yet.",
  AlreadyPromised: "You already made a promise today.",
  PromiseNotFound: "Make your promise first, then mark it complete.",
  FutureDate: "You cannot check in for a future date.",
  InternalError: "Something went wrong on our side. Please try again.",
};

/** Collapse any FastAPI `detail` shape into a single non-empty string. */
export function normalizeDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim() !== "") return detail;
  if (Array.isArray(detail)) {
    const first = detail.find(
      (item): item is { msg: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { msg?: unknown }).msg === "string",
    );
    if (first) return first.msg;
  }
  return fallback;
}

/** Map a normalized detail + HTTP status to copy a student can act on. */
export function friendlyMessage(detail: string, status: number): string {
  if (status === 422) return VALIDATION_ERROR;
  if (Object.prototype.hasOwnProperty.call(DOMAIN_COPY, detail)) return DOMAIN_COPY[detail];
  if (detail.trim() === "") return FALLBACK_ERROR;
  return detail;
}
