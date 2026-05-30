import { supabase } from "./supabase";
import { computeMathOk, type Extraction } from "./extraction";
import type { Receipt, SourceType } from "./database.types";

const BUCKET = "receipts";

/** Upload the original image to the user's private storage folder. */
export async function uploadReceiptImage(
  file: File,
  userId: string,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

export function guessSourceType(file: File): SourceType {
  if (file.type === "application/pdf") return "pdf";
  // Screenshots are typically PNG; photos typically JPEG. Best-effort guess.
  return file.type.includes("png") ? "screenshot" : "photo";
}

/**
 * Persist a (possibly user-edited) extraction as a receipt + its line items.
 * Returns the new receipt id.
 */
export async function saveReceipt(params: {
  extraction: Extraction;
  userId: string;
  imagePath: string | null;
  sourceType: SourceType;
  rawText?: string | null;
}): Promise<string> {
  const { extraction: ex, userId, imagePath, sourceType, rawText } = params;
  const mathOk = computeMathOk(ex);

  const receiptInsert: Partial<Receipt> = {
    user_id: userId,
    image_url: imagePath,
    merchant: ex.merchant,
    merchant_normalized: ex.merchant_normalized || ex.merchant,
    txn_date: ex.txn_date,
    subtotal: ex.subtotal,
    tax: ex.tax,
    total: ex.total,
    payment_method: ex.payment_method,
    raw_text: rawText ?? null,
    source_type: sourceType,
    confidence: ex.confidence,
    math_ok: mathOk,
  };

  const { data: receipt, error: rErr } = await supabase
    .from("receipts")
    .insert(receiptInsert)
    .select("id")
    .single();
  if (rErr) throw new Error(`Saving receipt failed: ${rErr.message}`);

  const receiptId = receipt.id;

  if (ex.line_items.length > 0) {
    const items = ex.line_items.map((li) => ({
      receipt_id: receiptId,
      user_id: userId,
      description: li.description,
      category: li.category,
      quantity: li.quantity,
      unit_price: li.unit_price,
      total_price: li.total_price,
    }));
    const { error: liErr } = await supabase.from("line_items").insert(items);
    if (liErr) throw new Error(`Saving line items failed: ${liErr.message}`);
  }

  return receiptId;
}
