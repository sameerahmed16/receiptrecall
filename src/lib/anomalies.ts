import { format, parseISO } from "date-fns";
import { supabase } from "./supabase";
import type { Category } from "./database.types";

/* ----------------------------------------------------------------------------
 * Anomaly detection — statistical outlier flagging, NO LLM.
 * For each category, compare the current month against the user's own typical
 * monthly spend (mean + standard deviation of prior months).
 * -------------------------------------------------------------------------- */

export type Anomaly = {
  category: Category;
  thisMonth: number;
  usual: number; // mean of prior months
  ratio: number; // thisMonth / usual
  message: string;
};

const round = (n: number) => Math.round(n * 100) / 100;

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export async function detectAnomalies(): Promise<Anomaly[]> {
  // Pull line items and their receipts' dates (joined in JS to keep types clean).
  const [{ data: items, error: liErr }, { data: receipts, error: rErr }] =
    await Promise.all([
      supabase.from("line_items").select("category,total_price,receipt_id"),
      supabase.from("receipts").select("id,txn_date,created_at"),
    ]);
  if (liErr) throw liErr;
  if (rErr) throw rErr;

  const monthOf = new Map<string, string>();
  for (const r of receipts ?? []) {
    const d = r.txn_date ? parseISO(r.txn_date) : parseISO(r.created_at);
    monthOf.set(r.id, format(d, "yyyy-MM"));
  }

  // category -> month -> total
  const byCat = new Map<Category, Map<string, number>>();
  for (const li of items ?? []) {
    const month = monthOf.get(li.receipt_id);
    if (!month) continue;
    const cat = (li.category ?? "Other") as Category;
    if (!byCat.has(cat)) byCat.set(cat, new Map());
    const m = byCat.get(cat)!;
    m.set(month, (m.get(month) ?? 0) + (li.total_price ?? 0));
  }

  const currentMonth = format(new Date(), "yyyy-MM");
  const anomalies: Anomaly[] = [];

  for (const [category, months] of byCat) {
    const thisMonth = months.get(currentMonth) ?? 0;
    if (thisMonth <= 0) continue;

    const prior = [...months.entries()]
      .filter(([m]) => m < currentMonth)
      .map(([, v]) => v);
    if (prior.length < 2) continue; // need a baseline of at least 2 months

    const mean = prior.reduce((a, b) => a + b, 0) / prior.length;
    if (mean <= 0) continue;
    const std = Math.sqrt(
      prior.reduce((a, b) => a + (b - mean) ** 2, 0) / prior.length,
    );

    const ratio = thisMonth / mean;
    // Flag clear outliers: well above the mean AND beyond normal variation.
    const isOutlier = thisMonth > mean + 2 * std && ratio >= 1.5;
    if (!isOutlier) continue;

    anomalies.push({
      category,
      thisMonth: round(thisMonth),
      usual: round(mean),
      ratio: round(ratio),
      message: `${category} is ${ratio.toFixed(1)}× your usual — ${money(
        thisMonth,
      )} this month vs ${money(mean)} average.`,
    });
  }

  return anomalies.sort((a, b) => b.ratio - a.ratio);
}
