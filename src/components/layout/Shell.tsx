import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { NavBar } from "./NavBar";
import { TwinkleSparkle, Starburst, Cloud } from "@/components/decor/Shapes";
import { useAuth } from "@/auth/AuthProvider";

/** App frame: bubble-headline header, nav, scattered decor, and page content. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Scattered decorative shapes (behind content) */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <TwinkleSparkle className="left-[6%] top-[18%] h-10 w-10" fill="var(--color-hotpink)" delay={0} />
        <TwinkleSparkle className="right-[8%] top-[12%] h-8 w-8" fill="var(--color-electric)" delay={1.2} />
        <TwinkleSparkle className="right-[14%] bottom-[10%] h-12 w-12" fill="var(--color-sunshine)" delay={0.6} />
        <motion.div
          className="absolute left-[3%] bottom-[14%] hidden md:block"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
        >
          <Starburst className="h-16 w-16" fill="var(--color-tomato)" />
        </motion.div>
        <Cloud className="absolute right-[4%] top-[34%] hidden h-14 w-24 opacity-90 lg:block" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Header />
        <main className="mt-6">{children}</main>
        <footer className="mt-12 pb-8 text-center font-mono text-[11px] uppercase tracking-widest text-ink/50">
          ReceiptRecall ✦ capture → extract → categorize → analyze → advise
        </footer>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="flex items-center gap-3"
      >
        <div className="grid h-12 w-12 place-items-center rounded-xl border-[3px] border-ink bg-sunshine shadow-hard-sm">
          <span className="text-2xl">🧾</span>
        </div>
        <div className="leading-none">
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight text-hotpink bubble-shadow sm:text-4xl">
            ReceiptRecall
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-ink/60">
            snap it · read it · spend smarter
          </p>
        </div>
      </motion.div>
      <div className="flex flex-col items-start gap-3 sm:items-end">
        <NavBar />
        <UserChip />
      </div>
    </header>
  );
}

function UserChip() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return (
    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest">
      <span className="text-ink/60">{user.email}</span>
      <button
        onClick={() => void signOut()}
        className="press inline-flex items-center gap-1 rounded-lg border-[3px] border-ink bg-white px-2 py-1 shadow-hard-sm"
      >
        <LogOut className="h-3.5 w-3.5" strokeWidth={2.75} />
        Log out
      </button>
    </div>
  );
}
