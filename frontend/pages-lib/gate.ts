// Shared helpers for the Access-gated /api/* Pages Functions.
//
// Every /api/* route is protected by Cloudflare Access (see the Access app that
// gates `hematok.pages.dev/api`). A request only reaches these functions after
// Access has verified the visitor's identity, so we trust the injected
// `Cf-Access-Jwt-Assertion` header and simply read its `email` claim — with an
// allow-list check as defence in depth.

export interface Env {
  STATE: KVNamespace;
  ALLOW_EMAILS?: string; // comma-separated allow-list; defaults to the owner
  OWNER_TOKEN?: string; // bearer token for the owner login (see /api auth below)
  DEV_EMAIL?: string; // local-dev bypass ONLY (never set in production)
}

// A stored liked/disliked entry: the full feed item (so the Likes panel works
// across devices). We only ever touch `.id`, so the rest is opaque.
export interface Item {
  id: string;
  [k: string]: unknown;
}

export interface UserState {
  liked: Item[];
  disliked: Item[];
  read: string[]; // ids only — this set is large and needs no metadata
}

const DEFAULT_ALLOW = ["hsieh.ting.lin@gmail.com"];
const CAP = { liked: 5000, disliked: 5000, read: 20000 };

export function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function allowList(env: Env): string[] {
  const raw = env.ALLOW_EMAILS?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return raw && raw.length ? raw : DEFAULT_ALLOW;
}

// Decode the email from the Access JWT payload. Access already verified the
// signature (this path is gated), so we only base64url-decode the middle segment.
function emailFromJwt(req: Request): string | null {
  const jwt = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt) return null;
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

// Constant-time string comparison (avoids leaking the token via timing).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Owner bearer-token path. Works without the Cloudflare Access gate, so the
// owner can log in today; resolves to the first allow-listed email.
function ownerFromToken(req: Request, env: Env): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const tok = auth.slice(7);
  if (env.OWNER_TOKEN && tok && safeEqual(tok, env.OWNER_TOKEN)) return allowList(env)[0];
  return null;
}

// Returns the authenticated, allow-listed email, or null. Three paths, in order:
//   1. Cloudflare Access JWT (the designed email login; active once /api is gated)
//   2. Owner bearer token (works before the Access gate exists)
//   3. Local-dev bypass via DEV_EMAIL (never set in production)
export function authedEmail(req: Request, env: Env): string | null {
  const jwtEmail = emailFromJwt(req);
  if (jwtEmail && allowList(env).includes(jwtEmail)) return jwtEmail;

  const tokenEmail = ownerFromToken(req, env);
  if (tokenEmail) return tokenEmail;

  if (env.DEV_EMAIL) {
    const dev = env.DEV_EMAIL.toLowerCase();
    if (allowList(env).includes(dev)) return dev;
  }
  return null;
}

function asItems(x: unknown): Item[] {
  if (!Array.isArray(x)) return [];
  return x.filter((v): v is Item => !!v && typeof v === "object" && typeof (v as Item).id === "string");
}
function asIds(x: unknown): string[] {
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];
}

export async function getState(env: Env, email: string): Promise<UserState> {
  const raw = await env.STATE.get(`u:${email}`);
  if (!raw) return { liked: [], disliked: [], read: [] };
  try {
    const s = JSON.parse(raw);
    return { liked: asItems(s.liked), disliked: asItems(s.disliked), read: asIds(s.read) };
  } catch {
    return { liked: [], disliked: [], read: [] };
  }
}

export async function putState(env: Env, email: string, s: UserState): Promise<void> {
  const capped: UserState = {
    liked: s.liked.slice(-CAP.liked),
    disliked: s.disliked.slice(-CAP.disliked),
    read: s.read.slice(-CAP.read),
  };
  await env.STATE.put(`u:${email}`, JSON.stringify(capped));
}

// Small set helpers keyed by item id.
export const addItem = (a: Item[], it: Item): Item[] =>
  a.some((x) => x.id === it.id) ? a : [...a, it];
export const removeId = <T extends Item | string>(a: T[], id: string): T[] =>
  a.filter((x) => (typeof x === "string" ? x !== id : x.id !== id));
export const addId = (a: string[], id: string): string[] => (a.includes(id) ? a : [...a, id]);
