import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Guard so the app doesn't crash before env vars are set during Phase 1 setup.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

export function requireSupabase() {
  if (!supabase) {
    console.warn(
      "Supabase env vars missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env"
    );
  }
  return supabase;
}
