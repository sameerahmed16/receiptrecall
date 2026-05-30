import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { RetroWindow } from "@/components/ui/RetroWindow";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSubscriptions } from "@/lib/queries";
import {
  monthlyEquivalent,
  dismissSubscription,
  deleteSubscription,
  addManualSubscription,
  updateManualSubscription,
  type Cadence,
  type ManualSubInput,
} from "@/lib/subscriptions";
import { useAuth } from "@/auth/AuthProvider";
import { formatMoney } from "@/lib/utils";
import {
  RefreshCw,
  Mail,
  X,
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Subscription } from "@/lib/database.types";

type FormState = { open: boolean; editing: Subscription | null };

export function Subscriptions() {
  const { user } = useAuth();
  const { data: subs, isLoading, isFetching } = useSubscriptions(user?.id);
  const [form, setForm] = useState<FormState>({ open: false, editing: null });
  const list = subs ?? [];
  const monthlyTotal = list.reduce((acc, s) => acc + monthlyEquivalent(s), 0);

  const openAdd = () => setForm({ open: true, editing: null });
  const openEdit = (s: Subscription) => setForm({ open: true, editing: s });
  const close = () => setForm({ open: false, editing: null });

  return (
    <div className="space-y-6">
      <RetroWindow title="subscriptions.scan" titleBarColor="bg-lilac">
        {/* Toolbar */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
            {isFetching ? "rescanning receipts…" : "detected + manual"}
          </p>
          <Button variant="lilac" onClick={openAdd} className="px-3 py-2 text-sm">
            <Plus className="h-4 w-4" strokeWidth={3} /> Add subscription
          </Button>
        </div>

        <AnimatePresence>
          {form.open && (
            <SubForm
              key={form.editing?.id ?? "new"}
              editing={form.editing}
              onClose={close}
            />
          )}
        </AnimatePresence>

        {isLoading ? (
          <Scanning />
        ) : list.length === 0 ? (
          <EmptyState onAdd={openAdd} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border-[3px] border-ink bg-gradient-to-r from-lilac to-blush p-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink/70">
                  recurring spend / month
                </p>
                <p className="font-display text-3xl font-extrabold bubble-shadow">
                  {formatMoney(monthlyTotal)}
                </p>
              </div>
              <p className="font-mono text-xs uppercase tracking-widest text-ink/70">
                {list.length} active
              </p>
            </div>

            <div className="space-y-3">
              {list.map((s) => (
                <SubRow key={s.id} sub={s} onEdit={openEdit} />
              ))}
            </div>
          </div>
        )}
      </RetroWindow>

      <Card color="bg-butter" className="flex items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border-[3px] border-ink bg-white">
          <Mail className="h-5 w-5" strokeWidth={2.5} />
        </div>
        <p className="font-body text-sm">
          <span className="font-display font-bold">How this works:</span> we group
          your receipts by merchant and flag charges that repeat on a regular
          cadence — pure pattern matching, no AI guessing. Paying for something we
          can't see on a receipt? Add it by hand — the auto-scan leaves manual
          entries alone.
        </p>
      </Card>
    </div>
  );
}

function SubForm({
  editing,
  onClose,
}: {
  editing: Subscription | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [merchant, setMerchant] = useState(editing?.merchant ?? "");
  const [amount, setAmount] = useState(editing?.amount?.toString() ?? "");
  const [cadence, setCadence] = useState<Cadence>(
    (editing?.cadence as Cadence) ?? "monthly",
  );
  const [next, setNext] = useState(editing?.next_expected ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const amt = Number(amount);
    if (!merchant.trim() || !Number.isFinite(amt) || amt <= 0) {
      setError("Enter a merchant name and a positive amount.");
      return;
    }
    setBusy(true);
    setError(null);
    const input: ManualSubInput = {
      merchant,
      amount: amt,
      cadence,
      next_expected: next || null,
    };
    try {
      if (editing) await updateManualSubscription(editing.id, input);
      else await addManualSubscription(user.id, input);
      await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <motion.form
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      onSubmit={submit}
      className="mb-4 overflow-hidden"
    >
      <div className="rounded-xl border-[3px] border-ink bg-mint/40 p-4">
        <p className="mb-3 font-display text-lg font-bold">
          {editing ? "Edit subscription" : "Add a subscription"}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/60">
              Merchant
            </span>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="e.g. Disney+"
              className="sticker-sm w-full bg-white px-3 py-2 font-mono text-sm outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/60">
              Amount
            </span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="9.99"
              className="sticker-sm w-full bg-white px-3 py-2 text-right font-mono text-sm outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/60">
              Cadence
            </span>
            <select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as Cadence)}
              className="sticker-sm w-full bg-white px-3 py-2 font-mono text-sm outline-none"
            >
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
              <option value="annual">annual</option>
            </select>
          </label>
          <label className="col-span-2 block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/60">
              Next charge (optional)
            </span>
            <input
              type="date"
              value={next ?? ""}
              onChange={(e) => setNext(e.target.value)}
              className="sticker-sm w-full bg-white px-3 py-2 font-mono text-sm outline-none"
            />
          </label>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border-2 border-tomato bg-tomato/10 px-3 py-2 font-mono text-xs text-tomato">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add it"}
          </Button>
        </div>
      </div>
    </motion.form>
  );
}

function SubRow({
  sub,
  onEdit,
}: {
  sub: Subscription;
  onEdit: (s: Subscription) => void;
}) {
  const queryClient = useQueryClient();
  const next = sub.next_expected ? parseISO(sub.next_expected) : null;
  const daysAway = next ? differenceInCalendarDays(next, new Date()) : null;
  const isManual = sub.source === "manual";

  async function remove() {
    if (isManual) await deleteSubscription(sub.id);
    else await dismissSubscription(sub.id);
    await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
  }

  const due = daysAway != null && daysAway <= 5 && daysAway >= 0;

  return (
    <div className="flex items-center gap-3 rounded-lg border-[3px] border-ink bg-white p-3 shadow-hard-sm">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border-[3px] border-ink bg-lilac">
        <RefreshCw className="h-5 w-5" strokeWidth={2.5} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate font-display text-lg font-bold">
          {sub.merchant}
          <span
            className={`rounded border-2 border-ink px-1.5 py-px font-mono text-[8px] font-bold uppercase tracking-wider ${
              isManual ? "bg-butter" : "bg-mint"
            }`}
          >
            {isManual ? "manual" : "auto"}
          </span>
        </p>
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/60">
          <CalendarClock className="h-3 w-3" strokeWidth={2.75} />
          {sub.cadence}
          {next && (
            <>
              {" · next "}
              {format(next, "MMM d")}
              {daysAway != null && daysAway >= 0 && ` (${daysAway}d)`}
            </>
          )}
        </p>
      </div>

      {due && (
        <span className="hidden rounded-md border-2 border-ink bg-tomato px-2 py-0.5 font-mono text-[9px] font-bold uppercase text-white sm:block">
          due soon
        </span>
      )}

      <div className="text-right">
        <p className="font-display text-lg font-extrabold">{formatMoney(sub.amount)}</p>
        <p className="font-mono text-[9px] uppercase tracking-widest text-ink/50">
          {formatMoney(monthlyEquivalent(sub))}/mo
        </p>
      </div>

      <div className="flex shrink-0 gap-1.5">
        {isManual && (
          <button
            onClick={() => onEdit(sub)}
            title="Edit"
            className="press grid h-8 w-8 place-items-center rounded-lg border-[3px] border-ink bg-white"
          >
            <Pencil className="h-4 w-4" strokeWidth={2.5} />
          </button>
        )}
        <button
          onClick={remove}
          title={isManual ? "Delete" : "Not a subscription"}
          className="press grid h-8 w-8 place-items-center rounded-lg border-[3px] border-ink bg-white text-tomato"
        >
          {isManual ? (
            <Trash2 className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <X className="h-4 w-4" strokeWidth={3} />
          )}
        </button>
      </div>
    </div>
  );
}

function Scanning() {
  return (
    <div className="grid place-items-center gap-3 px-6 py-14 text-center">
      <RefreshCw className="h-10 w-10 animate-spin text-lilac" strokeWidth={2.5} />
      <p className="font-display text-lg font-bold">Scanning your history…</p>
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
        looking for charges that repeat
      </p>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="grid place-items-center gap-3 px-6 py-14 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl border-[3px] border-ink bg-lilac shadow-hard-sm">
        <RefreshCw className="h-8 w-8" strokeWidth={2.5} />
      </div>
      <p className="font-display text-xl font-bold">No subscriptions yet</p>
      <p className="max-w-md font-body text-sm text-ink/70">
        Upload a few months of receipts and recurring charges (like Netflix every
        month) appear here automatically — or add the ones you already know about.
      </p>
      <Button variant="lilac" onClick={onAdd} className="mt-1">
        <Plus className="h-4 w-4" strokeWidth={3} /> Add one manually
      </Button>
    </div>
  );
}
