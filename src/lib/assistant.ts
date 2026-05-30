import { format, parseISO, subMonths } from "date-fns";
import { supabase } from "./supabase";
import { monthlyEquivalent } from "./subscriptions";
import { detectAnomalies } from "./anomalies";
import type { ChatMessage } from "./database.types";

/* ----------------------------------------------------------------------------
 * RAG context builder. Pulls the user's real rows (under RLS) and distills
 * them into a compact, deterministic snapshot of their finances. Sameer answers
 * from THIS — never from the model's memory — so figures can't be hallucinated.
 * -------------------------------------------------------------------------- */

const round = (n: number) => Math.round(n * 100) / 100;

export type SameerContext = Record<string, unknown>;

export async function buildContext(): Promise<SameerContext> {
  const [{ data: receipts }, { data: items }, { data: subs }, anomalies] =
    await Promise.all([
      supabase
        .from("receipts")
        .select("id,merchant,merchant_normalized,txn_date,total,created_at"),
      supabase.from("line_items").select("category,total_price,description,receipt_id"),
      supabase.from("subscriptions").select("*").eq("dismissed", false),
      detectAnomalies().catch(() => []),
    ]);

  const now = new Date();
  const thisMonth = format(now, "yyyy-MM");
  const lastMonth = format(subMonths(now, 1), "yyyy-MM");

  const monthOfReceipt = new Map<string, string>();
  const merchantOfReceipt = new Map<string, string>();
  for (const r of receipts ?? []) {
    const d = r.txn_date ? parseISO(r.txn_date) : parseISO(r.created_at);
    monthOfReceipt.set(r.id, format(d, "yyyy-MM"));
    merchantOfReceipt.set(r.id, r.merchant_normalized || r.merchant || "Unknown");
  }

  // Totals by month (from receipts).
  const byMonth = new Map<string, number>();
  for (const r of receipts ?? []) {
    if (r.total == null) continue;
    byMonth.set(monthOfReceipt.get(r.id)!, (byMonth.get(monthOfReceipt.get(r.id)!) ?? 0) + r.total);
  }
  const allTime = [...byMonth.values()].reduce((a, b) => a + b, 0);
  const thisMonthTotal = byMonth.get(thisMonth) ?? 0;
  const lastMonthTotal = byMonth.get(lastMonth) ?? 0;

  // Category breakdown (from line items, joined to receipt month).
  const catAll = new Map<string, number>();
  const catThisMonth = new Map<string, number>();
  const merchantTotals = new Map<string, number>();
  for (const li of items ?? []) {
    const cat = li.category ?? "Other";
    const amt = li.total_price ?? 0;
    catAll.set(cat, (catAll.get(cat) ?? 0) + amt);
    if (monthOfReceipt.get(li.receipt_id) === thisMonth) {
      catThisMonth.set(cat, (catThisMonth.get(cat) ?? 0) + amt);
    }
    const m = merchantOfReceipt.get(li.receipt_id) ?? "Unknown";
    merchantTotals.set(m, (merchantTotals.get(m) ?? 0) + amt);
  }

  // Recent line items with their date + merchant (last 30, newest first).
  const recentItems = (items ?? [])
    .map((li) => ({
      date: receiptDate(li.receipt_id, receipts ?? []),
      merchant: merchantOfReceipt.get(li.receipt_id) ?? "Unknown",
      description: li.description,
      category: li.category,
      amount: round(li.total_price ?? 0),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 30);

  return {
    today: format(now, "yyyy-MM-dd"),
    currency: "USD",
    totals: {
      allTime: round(allTime),
      thisMonth: round(thisMonthTotal),
      lastMonth: round(lastMonthTotal),
      monthOverMonthPct:
        lastMonthTotal > 0
          ? round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100)
          : null,
      receiptCount: receipts?.length ?? 0,
    },
    spendingByCategory: [...catAll.entries()]
      .map(([category, total]) => ({
        category,
        allTime: round(total),
        thisMonth: round(catThisMonth.get(category) ?? 0),
      }))
      .sort((a, b) => b.allTime - a.allTime),
    spendingByMonth: [...byMonth.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([month, total]) => ({ month, total: round(total) })),
    topMerchants: [...merchantTotals.entries()]
      .map(([merchant, total]) => ({ merchant, total: round(total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8),
    subscriptions: (subs ?? []).map((s) => ({
      merchant: s.merchant,
      amount: s.amount,
      cadence: s.cadence,
      monthlyEquivalent: round(monthlyEquivalent(s)),
      next_expected: s.next_expected,
      source: s.source,
    })),
    activeSubscriptionsMonthlyTotal: round(
      (subs ?? []).reduce((a, s) => a + monthlyEquivalent(s), 0),
    ),
    anomalies,
    recentItems,
  };
}

function receiptDate(receiptId: string, receipts: { id: string; txn_date: string | null; created_at: string }[]) {
  const r = receipts.find((x) => x.id === receiptId);
  if (!r) return "0000-00-00";
  return r.txn_date ?? r.created_at.slice(0, 10);
}

/* ----------------------------------------------------------------------------
 * Chat history + asking Sameer.
 * -------------------------------------------------------------------------- */

export async function loadChatHistory(): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function saveMessage(
  userId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await supabase.from("chat_messages").insert({ user_id: userId, role, content });
}

export async function askSameer(
  question: string,
  history: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const context = await buildContext();
  const { data, error } = await supabase.functions.invoke("chat", {
    body: { question, context, history },
  });
  if (error) throw new Error(error.message ?? "Sameer couldn't respond.");
  if (data?.error) throw new Error(data.error);
  return data.answer as string;
}
