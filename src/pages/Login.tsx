import { useState } from "react";
import { motion } from "framer-motion";
import { RetroWindow } from "@/components/ui/RetroWindow";
import { Button } from "@/components/ui/Button";
import { Smiley } from "@/components/decor/Smiley";
import { TwinkleSparkle } from "@/components/decor/Shapes";
import { useAuth } from "@/auth/AuthProvider";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Mail, Lock } from "lucide-react";

export function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const fn = mode === "signin" ? signIn : signUp;
    const { error } = await fn(email.trim(), password);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    if (mode === "signup") {
      setNotice("Account created! If email confirmation is on, check your inbox — otherwise you're in.");
    }
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4">
      <TwinkleSparkle className="left-[12%] top-[18%] h-12 w-12" fill="var(--color-hotpink)" />
      <TwinkleSparkle className="right-[14%] top-[24%] h-8 w-8" fill="var(--color-electric)" delay={1} />
      <TwinkleSparkle className="right-[20%] bottom-[18%] h-10 w-10" fill="var(--color-sunshine)" delay={0.5} />

      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 16 }}
        className="w-full max-w-md"
      >
        <div className="mb-5 text-center">
          <h1 className="font-display text-4xl font-extrabold uppercase text-hotpink bubble-shadow">
            ReceiptRecall
          </h1>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">
            snap it · read it · spend smarter
          </p>
        </div>

        <RetroWindow
          title={mode === "signin" ? "Log in" : "Create account"}
          titleBarColor="bg-blush"
          icon={<Smiley className="h-5 w-5" />}
        >
          {!isSupabaseConfigured && (
            <div className="mb-4 rounded-lg border-[3px] border-ink bg-butter px-3 py-2 font-mono text-[11px] uppercase tracking-wide">
              ⚠ Supabase not configured — add your keys to .env
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              icon={<Mail className="h-4 w-4" strokeWidth={2.5} />}
              label="Email"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-transparent font-mono text-sm outline-none placeholder:text-ink/30"
              />
            </Field>

            <Field
              icon={<Lock className="h-4 w-4" strokeWidth={2.5} />}
              label="Password"
            >
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent font-mono text-sm outline-none placeholder:text-ink/30"
              />
            </Field>

            {error && (
              <p className="rounded-lg border-2 border-tomato bg-tomato/10 px-3 py-2 font-mono text-xs text-tomato">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-lg border-2 border-ink bg-mint px-3 py-2 font-mono text-xs">
                {notice}
              </p>
            )}

            <Button
              type="submit"
              variant="pink"
              className="w-full"
              disabled={busy}
            >
              {busy ? "…" : mode === "signin" ? "Log in" : "Sign up"}
            </Button>
          </form>

          <p className="mt-4 text-center font-mono text-xs">
            {mode === "signin" ? "No account yet?" : "Already have one?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
                setNotice(null);
              }}
              className="font-bold text-electric underline underline-offset-2"
            >
              {mode === "signin" ? "Sign up" : "Log in"}
            </button>
          </p>
        </RetroWindow>
      </motion.div>
    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/70">
        {label}
      </span>
      <span className="sticker-sm flex items-center gap-2 bg-white px-3 py-2.5">
        {icon}
        {children}
      </span>
    </label>
  );
}
