// Client for the owner-only /api/* endpoints (same-origin Pages Functions).
//
// Two auth paths are supported by the backend; the client attaches both so
// whichever is active works:
//   • Cloudflare Access cookie (sent automatically via credentials:"include")
//     — the email login, active once /api is gated by Access.
//   • Owner bearer token (stored in localStorage) — works today, before the
//     Access gate exists. Entered through the header "Login" prompt.
import type { FeedItem } from "../types/feed";

export interface UserState {
  liked: FeedItem[];
  disliked: FeedItem[];
  read: string[];
}

const TOKEN_KEY = "ownerToken";

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string): void => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const t = getToken();
  return t ? { ...extra, authorization: `Bearer ${t}` } : extra;
}

async function getJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, {
      credentials: "include",
      headers: authHeaders({ accept: "application/json" }),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const api = {
  me: () => getJSON<{ email: string }>("/api/me"),

  state: () => getJSON<UserState>("/api/state"),

  // Fire-and-forget interaction record. Failures are swallowed — the local
  // state is still the source of truth for the current session.
  event: (
    action: "like" | "unlike" | "dislike" | "undislike" | "read" | "unread",
    payload: { id: string } | { item: FeedItem }
  ): void => {
    void fetch("/api/events", {
      method: "POST",
      credentials: "include",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ action, ...payload }),
    }).catch(() => {});
  },

  // Union local history into the server on login; returns the merged truth.
  merge: async (local: UserState): Promise<UserState | null> => {
    try {
      const res = await fetch("/api/merge", {
        method: "POST",
        credentials: "include",
        headers: authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(local),
      });
      if (!res.ok) return null;
      return (await res.json()) as UserState;
    } catch {
      return null;
    }
  },
};

// Verify a candidate owner token against /api/me. On success, persist it and
// return the email; otherwise return null and leave storage untouched.
export async function signInWithToken(token: string): Promise<string | null> {
  const trimmed = token.trim();
  if (!trimmed) return null;
  try {
    const res = await fetch("/api/me", {
      credentials: "include",
      headers: { accept: "application/json", authorization: `Bearer ${trimmed}` },
    });
    if (!res.ok) return null;
    const { email } = (await res.json()) as { email: string };
    setToken(trimmed);
    return email;
  } catch {
    return null;
  }
}

export function signOut(): void {
  clearToken();
  // Also clear any Cloudflare Access session, in case the email login is active.
  const hasAccess = document.cookie.includes("CF_Authorization");
  if (hasAccess) location.href = "/cdn-cgi/access/logout";
}
