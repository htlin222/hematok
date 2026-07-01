import type { Env } from "../../pages-lib/gate";

// GET /api/login?rd=<same-origin path> — the login trampoline. This route sits
// behind Cloudflare Access, so simply requesting it forces the Access login
// flow; once authenticated, we bounce the user back to where they started.
export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const url = new URL(request.url);
  const rd = url.searchParams.get("rd");

  let target = "/";
  if (rd) {
    try {
      const u = new URL(rd, url.origin);
      if (u.origin === url.origin) target = u.pathname + u.search + u.hash;
    } catch {
      /* ignore malformed rd — fall back to "/" */
    }
  }

  return new Response(null, {
    status: 302,
    headers: { location: target, "cache-control": "no-store" },
  });
};
