import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { computeMathOk, type Extraction } from "@/lib/extraction";
import { CATEGORIES, type Category } from "@/lib/database.types";
import { formatMoney } from "@/lib/utils";
import { Check, TriangleAlert, Trash2, Plus } from "lucide-react";

type Props = {
  initial: Extraction;
  imagePreview: string | null;
  onSave: (edited: Extraction) => void;
  onCancel: () => void;
  saving: boolean;
};

export function ReceiptReview({ initial, imagePreview, onSave, onCancel, saving }: Props) {
  const [ex, setEx] = useState<Extraction>(initial);
  const mathOk = computeMathOk(ex);
  const lowConfidence = ex.confidence < 0.75;

  function setField<K extends keyof Extraction>(key: K, value: Extraction[K]) {
    setEx((prev) => ({ ...prev, [key]: value }));
  }

  function setItem(idx: number, patch: Partial<Extraction["line_items"][number]>) {
    setEx((prev) => ({
      ...prev,
      line_items: prev.line_items.map((li, i) => (i === idx ? { ...li, ...patch } : li)),
    }));
  }

  function removeItem(idx: number) {
    setEx((prev) => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== idx),
    }));
  }

  function addItem() {
    setEx((prev) => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        { description: "", quantity: 1, unit_price: null, total_price: null, category: "Other" },
      ],
    }));
  }

  return (
    <div className="space-y-5">
      {/* Status badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge ok={!lowConfidence}>
          confidence {Math.round(ex.confidence * 100)}%
        </Badge>
        {mathOk === true && <Badge ok>math checks out</Badge>}
        {mathOk === false && <Badge ok={false}>math mismatch — please verify</Badge>}
        {mathOk === null && <Badge neutral>math not checkable</Badge>}
      </div>

      {(lowConfidence || mathOk === false) && (
        <p className="rounded-lg border-[3px] border-ink bg-butter px-3 py-2 font-mono text-xs">
          ⚠ This read needs a quick human check. Fix anything below, then save.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(0,1.4fr)]">
        {/* Image preview */}
        {imagePreview && (
          <div className="sticker-sm overflow-hidden bg-cream">
            <img src={imagePreview} alt="receipt" className="max-h-80 w-full object-contain" />
          </div>
        )}

        {/* Header fields */}
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Merchant" value={ex.merchant} onChange={(v) => setField("merchant", v)} className="col-span-2" />
          <TextField label="Brand (normalized)" value={ex.merchant_normalized} onChange={(v) => setField("merchant_normalized", v)} />
          <TextField label="Date" value={ex.txn_date ?? ""} onChange={(v) => setField("txn_date", v || null)} placeholder="YYYY-MM-DD" />
          <NumField label="Subtotal" value={ex.subtotal} onChange={(v) => setField("subtotal", v)} />
          <NumField label="Tax" value={ex.tax} onChange={(v) => setField("tax", v)} />
          <NumField label="Total" value={ex.total} onChange={(v) => setField("total", v)} />
          <TextField label="Payment" value={ex.payment_method ?? ""} onChange={(v) => setField("payment_method", v || null)} />
        </div>
      </div>

      {/* Line items */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">Line items</h3>
          <button
            onClick={addItem}
            className="press inline-flex items-center gap-1 rounded-lg border-[3px] border-ink bg-mint px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest shadow-hard-sm"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} /> Add
          </button>
        </div>

        <div className="space-y-2">
          {ex.line_items.map((li, idx) => (
            <div
              key={idx}
              className="grid grid-cols-12 items-center gap-2 rounded-lg border-[3px] border-ink bg-white p-2"
            >
              <input
                value={li.description}
                onChange={(e) => setItem(idx, { description: e.target.value })}
                placeholder="description"
                className="col-span-12 rounded border-2 border-ink/20 px-2 py-1 font-mono text-xs outline-none focus:border-ink sm:col-span-4"
              />
              <select
                value={li.category}
                onChange={(e) => setItem(idx, { category: e.target.value as Category })}
                className="col-span-5 rounded border-2 border-ink/20 px-1 py-1 font-mono text-[11px] outline-none focus:border-ink sm:col-span-3"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="number"
                value={li.quantity ?? ""}
                onChange={(e) => setItem(idx, { quantity: e.target.value === "" ? 1 : Number(e.target.value) })}
                className="col-span-2 rounded border-2 border-ink/20 px-1 py-1 text-center font-mono text-xs outline-none focus:border-ink sm:col-span-1"
                title="qty"
              />
              <input
                type="number"
                step="0.01"
                value={li.total_price ?? ""}
                onChange={(e) => setItem(idx, { total_price: e.target.value === "" ? null : Number(e.target.value) })}
                className="col-span-3 rounded border-2 border-ink/20 px-2 py-1 text-right font-mono text-xs outline-none focus:border-ink sm:col-span-3"
                title="total price"
                placeholder="0.00"
              />
              <button
                onClick={() => removeItem(idx)}
                className="col-span-2 grid place-items-center text-tomato sm:col-span-1"
                title="remove"
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          ))}
          {ex.line_items.length === 0 && (
            <p className="rounded-lg border-[3px] border-dashed border-ink/30 px-3 py-4 text-center font-mono text-xs text-ink/50">
              No line items read. Add them manually or save header totals only.
            </p>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-4 font-mono text-xs">
          <span>items: {formatMoney(ex.line_items.reduce((a, li) => a + (li.total_price ?? 0), 0))}</span>
          <span>+ tax: {formatMoney(ex.tax)}</span>
          <span className="font-bold">total: {formatMoney(ex.total)}</span>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button variant="primary" onClick={() => onSave(ex)} disabled={saving}>
          {saving ? "Saving…" : "Save receipt"}
        </Button>
      </div>
    </div>
  );
}

function Badge({
  children,
  ok,
  neutral,
}: {
  children: React.ReactNode;
  ok?: boolean;
  neutral?: boolean;
}) {
  const color = neutral ? "bg-sky" : ok ? "bg-mint" : "bg-tomato text-white";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border-2 border-ink px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${color}`}>
      {!neutral && (ok ? <Check className="h-3 w-3" strokeWidth={3} /> : <TriangleAlert className="h-3 w-3" strokeWidth={3} />)}
      {children}
    </span>
  );
}

function TextField({
  label,
  value,
  onChange,
  className,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/60">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="sticker-sm w-full bg-white px-3 py-2 font-mono text-sm outline-none"
      />
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-ink/60">{label}</span>
      <input
        type="number"
        step="0.01"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="sticker-sm w-full bg-white px-3 py-2 text-right font-mono text-sm outline-none"
      />
    </label>
  );
}
