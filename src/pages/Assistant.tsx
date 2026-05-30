import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { RetroWindow } from "@/components/ui/RetroWindow";
import { Button } from "@/components/ui/Button";
import { Smiley } from "@/components/decor/Smiley";
import { useAuth } from "@/auth/AuthProvider";
import {
  askSameer,
  loadChatHistory,
  saveMessage,
} from "@/lib/assistant";
import { cn } from "@/lib/utils";
import { Send } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const SAMPLE_QUESTIONS = [
  "What's my biggest spending category?",
  "How much am I paying for subscriptions?",
  "Where can I cut $50?",
  "How much did I spend this month?",
];

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi! I'm Sameer, your retro budgeting buddy. Ask me anything about your spending — I only answer from your real numbers, never made-up ones.",
};

export function Assistant() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChatHistory()
      .then((rows) => {
        if (rows.length > 0) {
          setMessages([GREETING, ...rows.map((r) => ({ role: r.role, content: r.content }))]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy || !user) return;
    setError(null);
    setInput("");
    const history = messages.filter((m) => m !== GREETING);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setBusy(true);

    try {
      void saveMessage(user.id, "user", question);
      const answer = await askSameer(question, history);
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      void saveMessage(user.id, "assistant", answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <RetroWindow
        title="Chat with Sameer"
        titleBarColor="bg-hotpink"
        icon={<Smiley className="h-5 w-5" />}
        bodyClassName="p-0"
      >
        {/* Messages */}
        <div ref={scrollRef} className="max-h-[52vh] min-h-[340px] space-y-4 overflow-y-auto bg-cream p-5">
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))}
          {busy && <Typing />}
          {error && (
            <p className="rounded-lg border-2 border-tomato bg-tomato/10 px-3 py-2 font-mono text-xs text-tomato">
              {error}
            </p>
          )}
        </div>

        {/* Suggested questions (only before the user has asked anything) */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 border-t-[3px] border-ink bg-white px-5 py-3">
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={busy}
                className="press rounded-full border-2 border-ink bg-mint px-3 py-1 font-mono text-[10px] uppercase tracking-wide"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-center gap-2 border-t-[3px] border-ink bg-blush p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Sameer about your spending…"
            disabled={busy}
            className="sticker-sm flex-1 bg-white px-4 py-2.5 font-mono text-sm outline-none placeholder:text-ink/40"
          />
          <Button type="submit" variant="primary" disabled={busy || !input.trim()} aria-label="Send">
            <Send className="h-4 w-4" strokeWidth={2.75} />
          </Button>
        </form>
      </RetroWindow>
    </div>
  );
}

function Bubble({ role, content }: Msg) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}
    >
      {!isUser && <Smiley className="h-9 w-9 shrink-0" />}
      <div
        className={cn(
          "sticker-sm max-w-sm whitespace-pre-wrap px-4 py-3 font-body text-sm",
          isUser ? "bg-sky" : "bg-white",
        )}
      >
        {content}
      </div>
    </motion.div>
  );
}

function Typing() {
  return (
    <div className="flex items-center gap-3">
      <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 1, repeat: Infinity }}>
        <Smiley className="h-9 w-9" />
      </motion.div>
      <div className="sticker-sm flex gap-1 bg-white px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2 w-2 rounded-full bg-ink"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}
