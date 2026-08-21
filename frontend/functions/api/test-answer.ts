import { authedEmail, json, type Env } from "../../pages-lib/gate";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const email = authedEmail(request, env);
    if (!email) return json({ error: "unauthenticated" }, 401);

    const { itemId, correct } = await request.json() as { itemId?: string, correct?: boolean };
    if (!itemId || typeof correct !== "boolean") {
      return json({ error: "Missing itemId or correct status" }, 400);
    }
    
    // Attempt to create the table if it doesn't exist (useful for quick start, though migrations are better)
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS quiz_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        item_id TEXT NOT NULL,
        correct BOOLEAN NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Insert the test answer
    await env.DB.prepare(`
      INSERT INTO quiz_progress (email, item_id, correct) VALUES (?, ?, ?)
    `).bind(email, itemId, correct ? 1 : 0).run();

    return json({ success: true });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
};
