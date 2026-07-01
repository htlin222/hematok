import { authedEmail, getState, json, putState, type Env, type Item } from "../../pages-lib/gate";

// POST /api/merge — union the caller's local (localStorage) history into the
// server state. Called once right after login so a device's local-only likes
// aren't lost, and returns the merged truth for the client to adopt.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = authedEmail(request, env);
  if (!email) return json({ error: "unauthenticated" }, 401);

  let body: { liked?: unknown; disliked?: unknown; read?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const s = await getState(env, email);

  const localItems = (x: unknown): Item[] =>
    Array.isArray(x)
      ? x.filter((v): v is Item => !!v && typeof v === "object" && typeof (v as Item).id === "string")
      : [];
  const localIds = (x: unknown): string[] =>
    Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : [];

  const unionItems = (base: Item[], extra: Item[]): Item[] => {
    const seen = new Set(base.map((i) => i.id));
    const out = [...base];
    for (const it of extra) if (!seen.has(it.id)) { seen.add(it.id); out.push(it); }
    return out;
  };

  s.liked = unionItems(s.liked, localItems(body.liked));
  const likedIds = new Set(s.liked.map((i) => i.id));
  // A locally-disliked item that is now liked stays liked (like wins).
  s.disliked = unionItems(s.disliked, localItems(body.disliked)).filter((i) => !likedIds.has(i.id));
  const readSet = new Set([...s.read, ...localIds(body.read)]);
  s.read = [...readSet];

  await putState(env, email, s);
  return json(s);
};
