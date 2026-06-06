/**
 * Hematok recommendation Worker.
 *
 * POST /recommend  { liked: string[], seen?: string[], n?: number }
 *   -> { ids: string[] }   ranked most-similar unseen image ids
 *
 * Stateless: the client sends its liked ids (from localStorage) each call; we
 * average their stored vectors and query Vectorize for nearest neighbours.
 */

interface Env {
  VEC: VectorizeIndex;
}

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "hematok-rec" });
    }
    if (req.method !== "POST" || url.pathname !== "/recommend") {
      return json({ error: "POST /recommend" }, 404);
    }

    let body: { liked?: unknown; seen?: unknown; n?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid JSON body" }, 400);
    }

    const liked = (Array.isArray(body.liked) ? body.liked : []).map(String).slice(-50);
    const seen = (Array.isArray(body.seen) ? body.seen : []).map(String);
    const n = Math.min(Math.max(Number(body.n) || 20, 1), 50);

    if (liked.length === 0) return json({ ids: [], reason: "no-likes" });

    try {
      // 1. Fetch the liked items' stored vectors and average them into a profile.
      const got = await env.VEC.getByIds(liked);
      const vecs = got
        .map((v) => v.values as number[] | undefined)
        .filter((v): v is number[] => Array.isArray(v) && v.length > 0);
      if (vecs.length === 0) return json({ ids: [], reason: "no-vectors" });

      const dim = vecs[0].length;
      const profile = new Array(dim).fill(0);
      for (const v of vecs) for (let i = 0; i < dim; i++) profile[i] += v[i] / vecs.length;

      // 2. Nearest neighbours, excluding what the user has already liked or seen.
      const exclude = new Set([...liked, ...seen]);
      const topK = Math.min(n + exclude.size + 10, 100);
      const res = await env.VEC.query(profile, { topK });
      const ids = res.matches
        .map((m) => m.id)
        .filter((id) => !exclude.has(id))
        .slice(0, n);

      return json({ ids, profileSize: vecs.length });
    } catch (err) {
      // Degrade gracefully — the client falls back to random when ids is empty.
      return json({ ids: [], error: String(err instanceof Error ? err.message : err) }, 200);
    }
  },
};
