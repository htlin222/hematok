import { authedEmail, getState, json, type Env } from "../../pages-lib/gate";

// GET /api/state — the owner's server-persisted liked / disliked / read sets.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = authedEmail(request, env);
  if (!email) return json({ error: "unauthenticated" }, 401);
  return json(await getState(env, email));
};
