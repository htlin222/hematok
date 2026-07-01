import {
  addId,
  addItem,
  authedEmail,
  getState,
  json,
  putState,
  removeId,
  type Env,
  type Item,
} from "../../pages-lib/gate";

// POST /api/events — record one interaction. Body:
//   { action: "like" | "dislike", item: FeedItem }   — needs the full item
//   { action: "unlike" | "undislike" | "read" | "unread", id: string }
//
// like/dislike are mutually exclusive; each clears the other. "read" marks a
// card seen (feeds the recommendation exclusion + steers the algorithm).
type Action = "like" | "unlike" | "dislike" | "undislike" | "read" | "unread";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const email = authedEmail(request, env);
  if (!email) return json({ error: "unauthenticated" }, 401);

  let body: { action?: unknown; id?: unknown; item?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const action = String(body.action) as Action;
  const item = (body.item && typeof body.item === "object" ? body.item : null) as Item | null;
  const id = typeof body.id === "string" ? body.id : item?.id ?? "";
  if (!id) return json({ error: "missing id" }, 400);

  const s = await getState(env, email);
  switch (action) {
    case "like":
      if (!item) return json({ error: "like needs item" }, 400);
      s.liked = addItem(s.liked, item);
      s.disliked = removeId(s.disliked, id);
      break;
    case "unlike":
      s.liked = removeId(s.liked, id);
      break;
    case "dislike":
      if (!item) return json({ error: "dislike needs item" }, 400);
      s.disliked = addItem(s.disliked, item);
      s.liked = removeId(s.liked, id);
      break;
    case "undislike":
      s.disliked = removeId(s.disliked, id);
      break;
    case "read":
      s.read = addId(s.read, id);
      break;
    case "unread":
      s.read = removeId(s.read, id);
      break;
    default:
      return json({ error: "bad action" }, 400);
  }

  await putState(env, email, s);
  return json({
    ok: true,
    counts: { liked: s.liked.length, disliked: s.disliked.length, read: s.read.length },
  });
};
