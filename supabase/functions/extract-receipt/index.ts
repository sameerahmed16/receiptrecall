// Supabase Edge Function: extract-receipt
// Receives a receipt image (base64) from an authenticated client, sends it to
// Gemini for multimodal structured extraction, and returns the raw JSON the
// model produced. The Gemini key lives ONLY here as a Supabase secret — it is
// never shipped to the browser. The client validates the result with Zod.
//
// Deploy:  supabase functions deploy extract-receipt
// Secret:  supabase secrets set GEMINI_API_KEY=...

import { corsHeaders } from "../_shared/cors.ts";

const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_INSTRUCTION = `You extract structured data from receipt and order-confirmation images.
Return ONLY valid JSON, no markdown, no commentary, matching exactly:
{
  "merchant": string,
  "merchant_normalized": string,
  "txn_date": "YYYY-MM-DD" | null,
  "payment_method": string | null,
  "subtotal": number | null,
  "tax": number | null,
  "total": number | null,
  "line_items": [
    { "description": string, "quantity": number, "unit_price": number, "total_price": number, "category": string }
  ],
  "confidence": number
}
Categories must be one of: Groceries, Dining, Transport, Subscription,
Shopping, Entertainment, Health, Bills, Other.
If a value is unreadable, use null. Never invent numbers.
"confidence" is your own 0-1 confidence in the overall extraction.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({ error: "GEMINI_API_KEY secret not set on the function." }, 500);
    }

    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64 || !mimeType) {
      return json({ error: "imageBase64 and mimeType are required." }, 400);
    }

    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const body = {
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [
        {
          role: "user",
          parts: [
            { text: "Extract this receipt as JSON following the schema exactly." },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
      },
    };

    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text();
      return json({ error: `Gemini error ${res.status}`, detail }, 502);
    }

    const result = await res.json();
    const text: string | undefined =
      result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return json({ error: "Gemini returned no text.", raw: result }, 502);
    }

    // Gemini (with responseMimeType json) returns a JSON string. Parse it,
    // but stay defensive in case it wraps the JSON in stray text/markdown.
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return json({ error: "Could not parse JSON from model.", text }, 502);
      data = JSON.parse(match[0]);
    }

    return json({ data });
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
