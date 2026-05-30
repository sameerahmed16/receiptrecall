import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Public Supabase config.
 *
 * These two values are designed to live in the browser — the project URL and
 * the *publishable* (anon) key ship in every client bundle and are protected
 * by Row Level Security, so committing them is safe (per Supabase's own docs).
 * Environment variables still take precedence for local dev / other deploys.
 */
const FALLBACK_URL = "https://tusfvrwybedrxobxahhu.supabase.co";
const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_jJgPCLG_Bj_udK3oGnxxBw_trBqW7Ti";

const url = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_PUBLISHABLE_KEY;

/** Always true now that we ship safe public defaults; kept for the UI to check. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient<Database>(url, anonKey);
