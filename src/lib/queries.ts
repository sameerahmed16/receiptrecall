import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { supabase } from "./supabase";
import type { Receipt, LineItem, Category, Subscription } from "./database.types";
import { scanAndSyncSubscriptions } from "./subscriptions";
import { detectAnomalies, type Anomaly } from "./anomalies";

/** All of the signed-in user's receipts, newest first. */
export function useReceipts() {
  return useQuery({
    queryKey: ["receipts"],
    queryFn: async (): Promise<Receipt[]> => {
      const { data, error } = await supabase
        .from("receipts")
        .select("*")
        .order("txn_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Line items for a single receipt. */
export function useLineItems(receiptId: string | null) {
  return useQuery({
    queryKey: ["line_items", receiptId],
    enabled: !!receiptId,
    queryFn: async (): Promise<LineItem[]> => {
      const { data, error } = await supabase
        .from("line_items")
        .select("*")
        .eq("receipt_id", receiptId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type DashboardData = {
  totalThisMonth: number;
  totalAllTime: number;
  receiptCount: number;
  momChangePct: number | null;
  byCategory: { category: Category; amount: number }[];
  overTime: { month: string; amount: number }[];
};

/** Aggregations for the dashboard, computed from receipts + line items. */
export function useDashboardData() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const [{ data: receipts, error: rErr }, { data: items, error: liErr }] =
        await Promise.all([
          supabase.from("receipts").select("total,txn_date,created_at"),
          supabase.from("line_items").select("category,total_price"),
        ]);
      if (rErr) throw rErr;
      if (liErr) throw liErr;

      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));

      const dateOf = (r: { txn_date: string | null; created_at: string }) =>
        r.txn_date ? parseISO(r.txn_date) : parseISO(r.created_at);

      let totalThisMonth = 0;
      let totalLastMonth = 0;
      let totalAllTime = 0;
      const monthMap = new Map<string, number>();

      for (const r of receipts ?? []) {
        const amount = r.total ?? 0;
        totalAllTime += amount;
        const d = dateOf(r);
        if (d >= thisMonthStart) totalThisMonth += amount;
        else if (d >= lastMonthStart && d < thisMonthStart) totalLastMonth += amount;
        const key = format(d, "yyyy-MM");
        monthMap.set(key, (monthMap.get(key) ?? 0) + amount);
      }

      const catMap = new Map<Category, number>();
      for (const li of items ?? []) {
        const c = (li.category ?? "Other") as Category;
        catMap.set(c, (catMap.get(c) ?? 0) + (li.total_price ?? 0));
      }

      const byCategory = [...catMap.entries()]
        .map(([category, amount]) => ({ category, amount: round(amount) }))
        .sort((a, b) => b.amount - a.amount);

      const overTime = [...monthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({
          month: format(parseISO(month + "-01"), "MMM yy"),
          amount: round(amount),
        }));

      const momChangePct =
        totalLastMonth > 0
          ? round(((totalThisMonth - totalLastMonth) / totalLastMonth) * 100)
          : null;

      return {
        totalThisMonth: round(totalThisMonth),
        totalAllTime: round(totalAllTime),
        receiptCount: receipts?.length ?? 0,
        momChangePct,
        byCategory,
        overTime,
      };
    },
  });
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Active (non-dismissed) subscriptions. Re-scans receipts on load so newly
 * uploaded recurring charges surface automatically.
 */
export function useSubscriptions(userId: string | undefined) {
  return useQuery({
    queryKey: ["subscriptions"],
    enabled: !!userId,
    queryFn: async (): Promise<Subscription[]> => {
      await scanAndSyncSubscriptions(userId!);
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("dismissed", false)
        .order("amount", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAnomalies() {
  return useQuery<Anomaly[]>({
    queryKey: ["anomalies"],
    queryFn: detectAnomalies,
  });
}
