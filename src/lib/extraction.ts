import { z } from "zod";
import { supabase } from "./supabase";
import { CATEGORIES, type Category } from "./database.types";

/* ----------------------------------------------------------------------------
 * Zod schema — the safety net for whatever the LLM returns. Bad reads are
 * coerced or rejected here BEFORE anything touches the database.
 * -------------------------------------------------------------------------- */

// Numbers may arrive as "12.99", "$12.99", "", or null. Normalize all of it.
const looseNumber = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => {
    if (v == null || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const cleaned = v.replace(/[^0-9.\-]/g, "");
    const n = Number.parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  });

const categorySchema = z
  .string()
  .nullable()
  .transform((c): Category => {
    const match = CATEGORIES.find(
      (cat) => cat.toLowerCase() === (c ?? "").toLowerCase().trim(),
    );
    return match ?? "Other";
  });

export const lineItemSchema = z.object({
  description: z.string().nullable().transform((d) => d ?? "Unknown item"),
  quantity: looseNumber.transform((q) => q ?? 1),
  unit_price: looseNumber,
  total_price: looseNumber,
  category: categorySchema,
});

export const extractionSchema = z.object({
  merchant: z.string().nullable().transform((m) => m ?? "Unknown merchant"),
  merchant_normalized: z.string().nullable().transform((m) => m ?? ""),
  txn_date: z
    .string()
    .nullable()
    .transform((d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null)),
  payment_method: z.string().nullable().default(null),
  subtotal: looseNumber,
  tax: looseNumber,
  total: looseNumber,
  line_items: z.array(lineItemSchema).default([]),
  confidence: looseNumber.transform((c) =>
    c == null ? 0.5 : Math.min(1, Math.max(0, c)),
  ),
});

export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractedLineItem = z.infer<typeof lineItemSchema>;

/* ----------------------------------------------------------------------------
 * Math check — do the line items + tax add up to the stated total?
 * -------------------------------------------------------------------------- */

const MATH_TOLERANCE = 0.05; // 5 cents

export function computeMathOk(ex: Extraction): boolean | null {
  if (ex.total == null || ex.line_items.length === 0) return null;
  const itemsSum = ex.line_items.reduce(
    (acc, li) => acc + (li.total_price ?? 0),
    0,
  );
  const expected = itemsSum + (ex.tax ?? 0);
  return Math.abs(expected - ex.total) <= MATH_TOLERANCE;
}

/** A read needs human review if confidence is low or the math doesn't add up. */
export function needsReview(ex: Extraction): boolean {
  const mathOk = computeMathOk(ex);
  return ex.confidence < 0.75 || mathOk === false;
}

/* ----------------------------------------------------------------------------
 * Call the edge function. The user's JWT is attached automatically by
 * supabase.functions.invoke, so the function only runs for signed-in users.
 * -------------------------------------------------------------------------- */

export async function extractReceipt(
  imageBase64: string,
  mimeType: string,
): Promise<Extraction> {
  const { data, error } = await supabase.functions.invoke("extract-receipt", {
    body: { imageBase64, mimeType },
  });

  if (error) throw new Error(error.message ?? "Extraction request failed.");
  if (data?.error) throw new Error(data.error);

  const parsed = extractionSchema.safeParse(data?.data);
  if (!parsed.success) {
    throw new Error(
      "The receipt was read but the data looked malformed. Try a clearer image.",
    );
  }
  return parsed.data;
}

/** Strip a data URL prefix to the bare base64 payload. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
