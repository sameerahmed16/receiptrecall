// Supabase Edge Function: embed
// Turns an array of short texts (line-item descriptions) into 768-dim
// embedding vectors using Gemini's gemini-embedding-001 model. Used by the
// self-improving categorizer: corrections and incoming items are embedded and
// compared with pgvector cosine similarity. Key stays server-side.
//
// Deploy: supabase functions deploy embed

import { corsHeaders } from "../_shared/cors.ts";

const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMS = 768; // must match the vector(768) column in the schema

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "GEMINI_API_KEY secret not set." }, 500);

    const { texts } = await req.json();
    if (!Array.isArray(texts) || texts.length === 0) {
      return json({ error: "texts (non-empty array) is required." }, 400);
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`;

    // gemini-embedding-001 supports embedContent (single) with a configurable
    // outputDimensionality. Embed each text; receipts have only a handful of
    // line items so a small sequential batch is fine.
    const embeddings: number[][] = [];
    for (const t of texts as string[]) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text: String(t).slice(0, 2000) }] },
          outputDimensionality: EMBED_DIMS,
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        return json({ error: `Gemini embed error ${res.status}`, detail }, 502);
      }
      const result = await res.json();
      embeddings.push(result?.embedding?.values ?? []);
    }

    return json({ embeddings });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
