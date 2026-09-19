// Typed fetch wrapper over the StudySprint HTTP API with JWT handling.

const API_BASE: string = import.meta.env?.VITE_API_URL ?? "http://localhost:8000";

const ACCESS_KEY = "ss_access";
const REFRESH_KEY = "ss_refresh";

export function getToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function logout(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  window.location.assign("/login");
}

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof ApiError ? e.detail : "Request failed";
}

function storeAuth(auth: AuthResponse): void {
  localStorage.setItem(ACCESS_KEY, auth.access_token);
  localStorage.setItem(REFRESH_KEY, auth.refresh_token);
}

async function req<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401 && retry && path !== "/auth/refresh") {
    // Access token may have expired: try one silent refresh, then retry once.
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (refresh) {
      try {
        const auth = await req<AuthResponse>(
          "/auth/refresh",
          { method: "POST", body: JSON.stringify({ refresh_token: refresh }) },
          false,
        );
        storeAuth(auth);
        return req<T>(path, init, false);
      } catch {
        /* refresh failed: fall through to logout */
      }
    }
    logout();
    throw new ApiError(401, "Unauthorized");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: { id: number; email: string; timezone: string; subjects: string[]; goals: string[] };
}

export interface Group {
  id: number;
  member_count: number;
  max_members: number;
  status: "queued" | "matched";
}

export interface LiveSession {
  id: number;
  group_id: number;
  starts_at: string;
  duration_s: number;
  status: "live" | "finalized";
}

export interface ScoreboardEntry {
  email: string;
  streak: number;
  done_today: boolean;
}

export const api = {
  async register(payload: {
    email: string;
    password: string;
    timezone?: string;
    subjects?: string[];
    goals?: string[];
  }): Promise<AuthResponse> {
    const auth = await req<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    storeAuth(auth);
    return auth;
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const auth = await req<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    storeAuth(auth);
    return auth;
  },

  me(): Promise<AuthResponse["user"]> {
    return req("/auth/me");
  },

  findGroup(): Promise<Group> {
    return req("/groups/find", { method: "POST" });
  },

  joinGroup(id: number): Promise<Group> {
    return req(`/groups/${id}/join`, { method: "POST" });
  },

  createSession(groupId: number, duration_s = 1500): Promise<LiveSession> {
    return req(`/groups/${groupId}/sessions`, {
      method: "POST",
      body: JSON.stringify({ duration_s }),
    });
  },

  promise(text: string, date: string): Promise<unknown> {
    return req("/checkins/promise", {
      method: "POST",
      body: JSON.stringify({ text, date }),
    });
  },

  complete(date: string): Promise<{ date: string; completed: boolean; streak: number }> {
    return req("/checkins/complete", {
      method: "POST",
      body: JSON.stringify({ date }),
    });
  },

  streak(): Promise<{ streak: number }> {
    return req("/checkins/streak");
  },

  scoreboard(groupId: number): Promise<ScoreboardEntry[]> {
    return req(`/groups/${groupId}/scoreboard`);
  },
};

export function wsUrl(sessionId: number): string {
  const base = API_BASE.replace(/^http/, "ws");
  const token = getToken() ?? "";
  return `${base}/ws/rooms/${sessionId}?token=${token}`;
}
