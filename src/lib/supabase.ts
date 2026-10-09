import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-only Supabase client. The exported app has no server runtime, so all
 * backend access goes through this client (guarded by Row-Level Security).
 *
 * Credentials come from public env vars set at build time. When they are absent
 * (e.g. a fresh clone with no `.env.local`) the client is `null` and auth is
 * simply disabled — the app stays fully usable local-only. `isSupabaseConfigured`
 * lets the UI reflect that.
 */
// Trim so accidental surrounding whitespace or quotes (e.g. a value pasted into
// a dashboard env field as `"https://…"`) don't slip through as a valid config.
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, "");

/** A non-empty env var isn't enough — a malformed URL makes createClient throw. */
function isValidHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const url = isValidHttpUrl(rawUrl) ? rawUrl : undefined;

// Treat a missing OR malformed URL as "not configured" so a bad deploy env var
// degrades to local-only instead of crashing the whole app on first render.
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** Lazily create (and memoize) the singleton browser client, or `null` if unconfigured. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Parse the magic-link token from the URL on load (static-export safe:
        // no server callback route needed). Implicit flow keeps the token in the
        // URL hash so a link opened on any device signs that device in.
        detectSessionInUrl: true,
        flowType: "implicit",
      },
    });
  }
  return client;
}
