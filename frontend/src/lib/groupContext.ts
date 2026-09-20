// The room route only receives `groupId` through router state, which is lost on
// reload or a shared link, and the API has no GET /sessions/{sid}. Persisting the
// id for the tab keeps the scoreboard and commitment list working after a refresh.

const GROUP_KEY = "ss_group";

export function rememberGroup(groupId: number): void {
  try {
    sessionStorage.setItem(GROUP_KEY, String(groupId));
  } catch {
    /* storage unavailable: the room still works, only reload recovery is lost */
  }
}

export function rememberedGroup(): number | null {
  try {
    const raw = sessionStorage.getItem(GROUP_KEY);
    if (raw === null) return null;
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

/** Route state wins; sessionStorage is the reload/deep-link fallback. */
export function resolveGroupId(stateGroupId?: number): number | null {
  if (typeof stateGroupId === "number" && Number.isInteger(stateGroupId) && stateGroupId > 0) {
    return stateGroupId;
  }
  return rememberedGroup();
}
