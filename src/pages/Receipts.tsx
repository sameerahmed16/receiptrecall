import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { RetroWindow } from "@/components/ui/RetroWindow";
import { Button } from "@/components/ui/Button";
import { useReceipts, useLineItems } from "@/lib/queries";
import { correctCategory } from "@/lib/categorization";
import { CATEGORY_META } from "@/lib/categoryMeta";
import { CATEGORIES, type Category, type Receipt } from "@/lib/database.types";
import { useAuth } from "@/auth/AuthProvider";
import { formatMoney, cn } from "@/lib/utils";
import { ReceiptText, ChevronDown, Check, TriangleAlert } from "lucide-react";

export function Receipts() {
  const { data: receipts, isLoading } = useReceipts();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <RetroWindow title="Receipts" titleBarColor="bg-butter">
      <div className="overflow-hidden rounded-lg border-[3px] border-ink">
        <div className="grid grid-cols-12 gap-2 border-b-[3px] border-ink bg-ink px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white">
          <span className="col-span-5 sm:col-span-4">Merchant</span>
          <span className="col-span-3 hidden sm:block">Date</span>
          <span className="col-span-3 sm:col-span-2">Items</span>
          <span className="col-span-4 sm:col-span-3 text-right">Total</span>
        </div>

        {isLoading && <RowMsg>Loading…</RowMsg>}
        {!isLoading && (receipts?.length ?? 0) === 0 && <EmptyState />}

        {receipts?.map((r) => (
          <ReceiptRow
            key={r.id}
            receipt={r}
            open={openId === r.id}
            onToggle={() => setOpenId(openId === r.id ? null : r.id)}
          />
        ))}
      </div>
    </RetroWindow>
  );
}

function ReceiptRow({
  receipt,
  open,
  onToggle,
}: {
  receipt: Receipt;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b-[3px] border-ink/15 last:border-b-0">
      <button
        onClick={onToggle}
        className={cn(
          "grid w-full grid-cols-12 items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-butter/40",
          open && "bg-butter/40",
        )}
      >
        <span className="col-span-5 flex items-center gap-2 sm:col-span-4">
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
            strokeWidth={2.75}
          />
          <span className="truncate font-display font-bold">
            {receipt.merchant_normalized || receipt.merchant || "Unknown"}
          </span>
          {receipt.math_ok === false && (
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-tomato" strokeWidth={2.75} />
          )}
        </span>
        <span className="col-span-3 hidden font-mono text-xs text-ink/70 sm:block">
          {receipt.txn_date ?? "—"}
        </span>
        <span className="col-span-3 font-mono text-xs text-ink/70 sm:col-span-2">
          <ItemCount receiptId={receipt.id} />
        </span>
        <span className="col-span-4 text-right font-display text-lg font-extrabold sm:col-span-3">
          {formatMoney(receipt.total)}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-cream"
          >
            <LineItemList receiptId={receipt.id} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ItemCount({ receiptId }: { receiptId: string }) {
  const { data } = useLineItems(receiptId);
  return <>{data ? `${data.length} item${data.length === 1 ? "" : "s"}` : "…"}</>;
}

function LineItemList({ receiptId }: { receiptId: string }) {
  const { data, isLoading } = useLineItems(receiptId);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState<string | null>(null);

  async function changeCategory(itemId: string, description: string, cat: Category) {
    if (!user) return;
    setSavingId(itemId);
    try {
      await correctCategory({ lineItemId: itemId, description, newCategory: cat, userId: user.id });
      await queryClient.invalidateQueries({ queryKey: ["line_items", receiptId] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } finally {
      setSavingId(null);
    }
  }

  if (isLoading) return <div className="px-4 py-3 font-mono text-xs text-ink/50">Loading items…</div>;

  return (
    <div className="space-y-2 px-4 py-3">
      {data?.map((li) => {
        const cat = (li.category ?? "Other") as Category;
        const Icon = CATEGORY_META[cat].icon;
        return (
          <div
            key={li.id}
            className="flex items-center gap-3 rounded-lg border-[3px] border-ink bg-white px-3 py-2"
          >
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md border-2 border-ink"
              style={{ background: CATEGORY_META[cat].color }}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <span className="flex-1 truncate font-body text-sm">{li.description}</span>
            <span className="font-mono text-xs text-ink/60">×{li.quantity ?? 1}</span>
            <select
              value={cat}
              onChange={(e) => changeCategory(li.id, li.description ?? "", e.target.value as Category)}
              disabled={savingId === li.id}
              className="rounded-md border-2 border-ink/30 bg-white px-1.5 py-1 font-mono text-[11px] outline-none focus:border-ink"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="w-16 text-right font-display text-sm font-bold">
              {formatMoney(li.total_price)}
            </span>
            {savingId === li.id && <Check className="h-3.5 w-3.5 text-mint" strokeWidth={3} />}
          </div>
        );
      })}
      {(data?.length ?? 0) === 0 && (
        <p className="py-2 text-center font-mono text-xs text-ink/50">No line items on this receipt.</p>
      )}
      <p className="pt-1 text-right font-mono text-[10px] uppercase tracking-widest text-ink/50">
        change a category to teach Sameer your preferences ✦
      </p>
    </div>
  );
}

function RowMsg({ children }: { children: React.ReactNode }) {
  return <div className="bg-white px-4 py-8 text-center font-mono text-xs text-ink/50">{children}</div>;
}

function EmptyState() {
  return (
    <div className="grid place-items-center gap-3 bg-white px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border-[3px] border-ink bg-blush shadow-hard-sm">
        <ReceiptText className="h-7 w-7" strokeWidth={2.5} />
      </div>
      <p className="font-display text-lg font-bold">No receipts yet</p>
      <p className="max-w-sm font-body text-sm text-ink/70">
        Once you upload a receipt, it shows up here with every line item,
        category, and the tax math double-checked.
      </p>
      <Link to="/upload">
        <Button variant="mint" className="mt-1">Upload a receipt</Button>
      </Link>
    </div>
  );
}
