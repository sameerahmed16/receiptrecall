import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when Supabase env vars are present. Lets the UI degrade gracefully. */
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  // Loud, friendly warning rather than a hard crash during early phases.
  console.warn(
    "[ReceiptRecall] Supabase env vars missing. Copy .env.example to .env " +
      "and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
  );
}

export const supabase = createClient<Database>(
  url ?? "http://localhost:54321",
  anonKey ?? "public-anon-key-placeholder",
);
