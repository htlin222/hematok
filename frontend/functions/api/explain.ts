import { json, type Env } from "../../pages-lib/gate";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { title, description } = await request.json() as { title?: string, description?: string };
    if (!title) {
      return json({ error: "Missing title" }, 400);
    }
    
    const prompt = `請描述這個診斷在玻片上的特徵，如何區分，跟它長得很像的ddx 有誰

Title: ${title}
Description: ${description || ""}`;

    if (!env.AI) {
      return json({ error: "AI binding (env.AI) is missing." }, 500);
    }
    const MODELS = [
      "@cf/meta/llama-3.1-8b-instruct",
      "@cf/meta/llama-3-8b-instruct",
      "@cf/meta/llama-2-7b-chat-int8"
    ];

    let lastError: any;
    for (const model of MODELS) {
      try {
        const response = await env.AI.run(model, {
          messages: [
            { role: "system", content: "You are a helpful medical expert assistant." },
            { role: "user", content: prompt }
          ]
        });
        return json({ explanation: response.response });
      } catch (error: any) {
        lastError = error;
        console.warn(`Model ${model} failed:`, error.message || String(error));
        // Continue to the next model in the fallback list
      }
    }

    return json({ error: `All models failed. Last error: ${lastError?.message || String(lastError)}` }, 500);
  } catch (error: any) {
    return json({ error: error.message || String(error) }, 500);
  }
};
