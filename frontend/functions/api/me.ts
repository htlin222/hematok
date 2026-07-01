import { authedEmail, json, type Env } from "../../pages-lib/gate";

// GET /api/me — who is logged in. Behind Access: an unauthenticated caller is
// redirected to the Access login (cross-origin) and the client's fetch throws,
// which the frontend reads as "logged out".
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = authedEmail(request, env);
  if (!email) return json({ error: "unauthenticated" }, 401);
  return json({ email });
};
