// Supabase Edge Function: chat
// "Sameer" — a retro budgeting assistant grounded strictly in the user's own
// transaction data. The client retrieves the relevant rows (under RLS) and
// sends them as `context`; Gemini answers using ONLY that context. No invented
// figures. Key stays server-side.
//
// Deploy: supabase functions deploy chat

import { corsHeaders } from "../_shared/cors.ts";

const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_INSTRUCTION = `You are "Sameer", a friendly retro-styled budgeting assistant inside a
1990s-themed spending app. You help the user understand their spending and
find realistic places to cut.

RULES:
- Answer ONLY from the transaction data provided in this message. Never
  invent figures. If the data doesn't contain the answer, say so plainly.
- You are an informational budgeting helper, NOT a licensed financial or
  investment advisor. Surface patterns and options ("you spend $X on dining;
  cutting to $Y frees up $Z"), don't give directive financial advice.
- Be concise, plain-spoken, and a little fun. A bright, upbeat retro-pop
  personality is welcome; never sacrifice clarity for it.
- Format money like $12.34. Keep answers short — a sentence or two plus an
  optional tiny list. No markdown headers.`;

type ChatTurn = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "GEMINI_API_KEY secret not set." }, 500);

    const { question, context, history } = await req.json();
    if (!question || typeof question !== "string") {
      return json({ error: "question (string) is required." }, 400);
    }

    const dataBlock =
      "DATA FOR THIS QUESTION (the user's real transactions — use only this):\n" +
      JSON.stringify(context ?? {}, null, 2);

    // Prior turns for conversational continuity (kept short).
    const priorTurns = (Array.isArray(history) ? history : [])
      .slice(-6)
      .map((t: ChatTurn) => ({
        role: t.role === "assistant" ? "model" : "user",
        parts: [{ text: t.content }],
      }));

    const contents = [
      ...priorTurns,
      { role: "user", parts: [{ text: `${dataBlock}\n\nQUESTION: ${question}` }] },
    ];

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: `Gemini error ${res.status}`, detail }, 502);
    }

    const result = await res.json();
    const answer: string | undefined =
      result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!answer) return json({ error: "Sameer drew a blank.", raw: result }, 502);

    return json({ answer: answer.trim() });
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
