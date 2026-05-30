import {
  differenceInDays,
  addDays,
  addMonths,
  addYears,
  parseISO,
  format,
} from "date-fns";
import { supabase } from "./supabase";
import type { Receipt, Subscription } from "./database.types";

/* ----------------------------------------------------------------------------
 * Subscription detection — classical pattern-finding, NO LLM.
 * Group charges by merchant; if the same merchant recurs at a regular interval
 * with a stable amount, it's a subscription. Deliberately rule-based.
 * -------------------------------------------------------------------------- */

export type Cadence = "weekly" | "monthly" | "annual";

export type DetectedSubscription = {
  merchant: string;
  amount: number;
  cadence: Cadence;
  last_seen: string; // yyyy-MM-dd
  next_expected: string; // yyyy-MM-dd
  occurrences: number;
};

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function classifyCadence(medianDays: number): Cadence | null {
  if (medianDays >= 5 && medianDays <= 9) return "weekly";
  if (medianDays >= 24 && medianDays <= 35) return "monthly";
  if (medianDays >= 350 && medianDays <= 380) return "annual";
  return null;
}

/** ~monthly cost of a subscription regardless of its native cadence. */
export function monthlyEquivalent(s: { amount: number | null; cadence: string | null }): number {
  const amt = s.amount ?? 0;
  if (s.cadence === "weekly") return amt * (52 / 12);
  if (s.cadence === "annual") return amt / 12;
  return amt; // monthly
}

export function detectSubscriptions(receipts: Receipt[]): DetectedSubscription[] {
  const groups = new Map<string, Receipt[]>();
  for (const r of receipts) {
    const key = (r.merchant_normalized || r.merchant || "").trim().toLowerCase();
    if (!key || r.txn_date == null || r.total == null) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const out: DetectedSubscription[] = [];
  for (const rs of groups.values()) {
    if (rs.length < 2) continue;

    const sorted = rs
      .slice()
      .sort((a, b) => (a.txn_date! < b.txn_date! ? -1 : 1));
    const dates = sorted.map((r) => parseISO(r.txn_date!));

    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push(differenceInDays(dates[i], dates[i - 1]));
    }
    const cadence = classifyCadence(median(intervals));
    if (!cadence) continue;

    // Amount must be stable — real subscriptions bill (nearly) the same each time.
    const amounts = sorted.map((r) => r.total!);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance =
      amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / amounts.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    if (cv > 0.2) continue;

    const last = dates[dates.length - 1];
    const next =
      cadence === "weekly"
        ? addDays(last, 7)
        : cadence === "annual"
          ? addYears(last, 1)
          : addMonths(last, 1);

    const latest = sorted[sorted.length - 1];
    out.push({
      merchant: latest.merchant_normalized || latest.merchant || "Unknown",
      amount: Math.round(median(amounts) * 100) / 100,
      cadence,
      last_seen: format(last, "yyyy-MM-dd"),
      next_expected: format(next, "yyyy-MM-dd"),
      occurrences: sorted.length,
    });
  }

  return out.sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a));
}

/**
 * Re-scan the user's receipts and sync the subscriptions table. Existing rows
 * are refreshed; rows the user has dismissed are left untouched (never resurfaced).
 */
export async function scanAndSyncSubscriptions(userId: string): Promise<void> {
  const { data: receipts, error } = await supabase.from("receipts").select("*");
  if (error) throw error;

  const detected = detectSubscriptions(receipts ?? []);
  const { data: existing } = await supabase.from("subscriptions").select("*");
  const byMerchant = new Map<string, Subscription>(
    (existing ?? []).map((s) => [(s.merchant ?? "").toLowerCase(), s]),
  );

  for (const d of detected) {
    const ex = byMerchant.get(d.merchant.toLowerCase());
    if (ex?.dismissed) continue; // respect the user's "not a subscription"
    if (ex?.source === "manual") continue; // never overwrite a hand-entered row
    if (ex) {
      await supabase
        .from("subscriptions")
        .update({
          amount: d.amount,
          cadence: d.cadence,
          last_seen: d.last_seen,
          next_expected: d.next_expected,
          active: true,
        })
        .eq("id", ex.id);
    } else {
      await supabase.from("subscriptions").insert({
        user_id: userId,
        merchant: d.merchant,
        amount: d.amount,
        cadence: d.cadence,
        last_seen: d.last_seen,
        next_expected: d.next_expected,
        active: true,
        dismissed: false,
        source: "auto",
      });
    }
  }
}

export async function dismissSubscription(id: string): Promise<void> {
  const { error } = await supabase
    .from("subscriptions")
    .update({ dismissed: true, active: false })
    .eq("id", id);
  if (error) throw error;
}

/* ----------------------------------------------------------------------------
 * Manual subscriptions — for things the user pays for but hasn't (or can't)
 * upload receipts for. These are tagged source='manual' and the auto-scanner
 * never touches them.
 * -------------------------------------------------------------------------- */

export type ManualSubInput = {
  merchant: string;
  amount: number;
  cadence: Cadence;
  next_expected: string | null; // yyyy-MM-dd
};

export async function addManualSubscription(
  userId: string,
  input: ManualSubInput,
): Promise<void> {
  const { error } = await supabase.from("subscriptions").insert({
    user_id: userId,
    merchant: input.merchant.trim(),
    amount: input.amount,
    cadence: input.cadence,
    next_expected: input.next_expected,
    last_seen: null,
    active: true,
    dismissed: false,
    source: "manual",
  });
  if (error) throw error;
}

export async function updateManualSubscription(
  id: string,
  input: ManualSubInput,
): Promise<void> {
  const { error } = await supabase
    .from("subscriptions")
    .update({
      merchant: input.merchant.trim(),
      amount: input.amount,
      cadence: input.cadence,
      next_expected: input.next_expected,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Hard-delete a subscription row (used for manual entries). */
export async function deleteSubscription(id: string): Promise<void> {
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
  if (error) throw error;
}
