import { supabase } from "./supabase";
import type { Category } from "./database.types";
import type { Extraction } from "./extraction";

/** Embed an array of texts via the `embed` edge function (768-dim vectors). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { data, error } = await supabase.functions.invoke("embed", {
    body: { texts },
  });
  if (error) throw new Error(error.message ?? "Embedding request failed.");
  if (data?.error) throw new Error(data.error);
  return data.embeddings as number[][];
}

/**
 * Apply the user's learned preferences to a fresh extraction. For each line
 * item we embed its description and look for the nearest past correction
 * (cosine similarity in pgvector). If one is close enough, we override the
 * model's guess with the user's preferred category. No model retraining.
 */
export async function applyLearnedCategories(
  ex: Extraction,
  userId: string,
): Promise<Extraction> {
  if (ex.line_items.length === 0) return ex;

  let embeddings: number[][];
  try {
    embeddings = await embedTexts(ex.line_items.map((li) => li.description));
  } catch {
    // Learning is best-effort — never block a save on it.
    return ex;
  }

  const items = await Promise.all(
    ex.line_items.map(async (li, i) => {
      const vec = embeddings[i];
      if (!vec) return li;
      const { data } = await supabase.rpc("match_category_correction", {
        query_embedding: JSON.stringify(vec),
        match_user_id: userId,
        // Calibrated for gemini-embedding-001 (768-dim): true item variants
        // score ~0.74+, unrelated items ~0.6 and below.
        similarity_threshold: 0.68,
      });
      const match = data?.[0]?.corrected_category as Category | undefined;
      return match ? { ...li, category: match } : li;
    }),
  );

  return { ...ex, line_items: items };
}

/**
 * Record a user's category correction so similar items learn from it, and
 * update the line item itself. Embedding failure still updates the item.
 */
export async function correctCategory(params: {
  lineItemId: string;
  description: string;
  newCategory: Category;
  userId: string;
}): Promise<void> {
  const { lineItemId, description, newCategory, userId } = params;

  // 1. Update the line item now (instant feedback).
  const { error: upErr } = await supabase
    .from("line_items")
    .update({ category: newCategory })
    .eq("id", lineItemId);
  if (upErr) throw new Error(upErr.message);

  // 2. Store the correction with an embedding (best-effort learning).
  try {
    const [vec] = await embedTexts([description]);
    await supabase.from("category_corrections").insert({
      user_id: userId,
      description,
      corrected_category: newCategory,
      embedding: JSON.stringify(vec) as unknown as number[],
    });
  } catch {
    // ignore — the visible category change already succeeded
  }
}
