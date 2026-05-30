import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { RetroWindow } from "@/components/ui/RetroWindow";
import { Button } from "@/components/ui/Button";
import { ReceiptReview } from "@/components/ReceiptReview";
import { Smiley } from "@/components/decor/Smiley";
import { useAuth } from "@/auth/AuthProvider";
import {
  extractReceipt,
  fileToBase64,
  needsReview,
  type Extraction,
} from "@/lib/extraction";
import {
  uploadReceiptImage,
  saveReceipt,
  guessSourceType,
} from "@/lib/receipts";
import { applyLearnedCategories } from "@/lib/categorization";
import { cn } from "@/lib/utils";
import { UploadCloud, CheckCircle2, AlertTriangle } from "lucide-react";

type Stage = "idle" | "working" | "review" | "saved" | "error";

const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
const MAX_MB = 10;

export function Upload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStage("idle");
    setFile(null);
    setPreview(null);
    setExtraction(null);
    setError(null);
    setStatusMsg("");
  }

  async function handleFile(picked: File) {
    setError(null);
    if (picked.size > MAX_MB * 1024 * 1024) {
      setError(`File is too big (max ${MAX_MB}MB).`);
      setStage("error");
      return;
    }
    setFile(picked);
    setPreview(picked.type.startsWith("image/") ? URL.createObjectURL(picked) : null);
    setStage("working");

    try {
      setStatusMsg("Reading your receipt with Gemini…");
      const base64 = await fileToBase64(picked);
      const raw = await extractReceipt(base64, picked.type);
      // Fold in anything this user has previously taught us.
      const ex = user ? await applyLearnedCategories(raw, user.id) : raw;
      setExtraction(ex);
      setStatusMsg("");
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage("error");
    }
  }

  async function handleSave(edited: Extraction) {
    if (!user || !file) return;
    setStage("working");
    setStatusMsg("Saving to your spending log…");
    try {
      const imagePath = file.type.startsWith("image/")
        ? await uploadReceiptImage(file, user.id)
        : null;
      await saveReceipt({
        extraction: edited,
        userId: user.id,
        imagePath,
        sourceType: guessSourceType(file),
      });
      await queryClient.invalidateQueries();
      setStage("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage("error");
    }
  }

  const titleByStage: Record<Stage, string> = {
    idle: "upload_receipt.exe",
    working: "reading…",
    review: "review_receipt.exe",
    saved: "saved!",
    error: "error.dlg",
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <RetroWindow title={titleByStage[stage]} titleBarColor="bg-mint">
        {stage === "idle" && (
          <DropZone
            dragging={dragging}
            setDragging={setDragging}
            onPick={() => inputRef.current?.click()}
            onDrop={handleFile}
          />
        )}

        {stage === "working" && <Working msg={statusMsg} />}

        {stage === "review" && extraction && (
          <>
            {needsReview(extraction) ? null : (
              <p className="mb-4 flex items-center gap-2 rounded-lg border-[3px] border-ink bg-mint px-3 py-2 font-mono text-xs">
                <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                High-confidence read — looks good, but give it a glance before saving.
              </p>
            )}
            <ReceiptReview
              initial={extraction}
              imagePreview={preview}
              onSave={handleSave}
              onCancel={reset}
              saving={false}
            />
          </>
        )}

        {stage === "saved" && (
          <Saved
            onAnother={reset}
            onView={() => navigate("/receipts")}
          />
        )}

        {stage === "error" && <ErrorView msg={error} onRetry={reset} />}
      </RetroWindow>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function DropZone({
  dragging,
  setDragging,
  onPick,
  onDrop,
}: {
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onPick: () => void;
  onDrop: (f: File) => void;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onDrop(f);
      }}
      className={cn(
        "grid place-items-center rounded-xl border-[3px] border-dashed border-ink bg-cream px-6 py-14 text-center transition-colors",
        dragging && "bg-butter",
      )}
    >
      <div className="grid h-16 w-16 place-items-center rounded-2xl border-[3px] border-ink bg-hotpink text-white shadow-hard-sm">
        <UploadCloud className="h-8 w-8" strokeWidth={2.5} />
      </div>
      <p className="mt-4 font-display text-xl font-bold">Drop a receipt or screenshot</p>
      <p className="mt-1 font-mono text-xs uppercase tracking-widest text-ink/60">
        jpg · png · webp · pdf — up to 10MB
      </p>
      <Button className="mt-5" variant="primary" onClick={onPick}>
        Choose a file
      </Button>
    </div>
  );
}

function Working({ msg }: { msg: string }) {
  return (
    <div className="grid place-items-center gap-4 py-14 text-center">
      <motion.div
        animate={{ rotate: [0, 12, -12, 0], y: [0, -10, 0] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      >
        <Smiley className="h-16 w-16" />
      </motion.div>
      <p className="font-display text-lg font-bold">{msg || "Working…"}</p>
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink/50">
        hang tight — Sameer is on it
      </p>
    </div>
  );
}

function Saved({ onAnother, onView }: { onAnother: () => void; onView: () => void }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="grid place-items-center gap-4 py-12 text-center"
    >
      <div className="grid h-16 w-16 place-items-center rounded-2xl border-[3px] border-ink bg-mint shadow-hard-sm">
        <CheckCircle2 className="h-8 w-8" strokeWidth={2.5} />
      </div>
      <p className="font-display text-2xl font-extrabold">Receipt saved! 🎉</p>
      <p className="max-w-sm font-body text-sm text-ink/70">
        It's now folded into your spending. Add another, or head to your receipts.
      </p>
      <div className="flex gap-3">
        <Button variant="mint" onClick={onAnother}>+ Add another</Button>
        <Button variant="primary" onClick={onView}>View receipts</Button>
      </div>
    </motion.div>
  );
}

function ErrorView({ msg, onRetry }: { msg: string | null; onRetry: () => void }) {
  return (
    <div className="grid place-items-center gap-4 py-12 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-2xl border-[3px] border-ink bg-tomato text-white shadow-hard-sm">
        <AlertTriangle className="h-8 w-8" strokeWidth={2.5} />
      </div>
      <p className="font-display text-xl font-bold">Something went sideways</p>
      <p className="max-w-md break-words font-mono text-xs text-ink/70">{msg}</p>
      <Button variant="primary" onClick={onRetry}>Try again</Button>
    </div>
  );
}
