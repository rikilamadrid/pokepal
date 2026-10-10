import { createClient } from "@supabase/supabase-js";
import { createTcgdexProvider } from "@/lib/catalog/tcgdex";
import { createHandler } from "./handler";
import { createAnthropicModel } from "./model";
import { createMemoryRateLimiter } from "./rate-limit";

/**
 * Supabase Edge Function entry point (Deno). Not deployed by this ticket:
 * deploying it and setting `ANTHROPIC_API_KEY` with `supabase secrets set` are
 * human-gated. `SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided by the
 * Edge Runtime. JWT verification at the gateway stays on (the default), and
 * the handler resolves the token to a user for the per-user rate limit.
 */

// The Deno global, declared locally so the Next.js type check accepts this file.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

function secret(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`recognize-cards: missing ${name}`);
  return value;
}

/** Scans per user per minute: a batch session sends a handful, not dozens. */
const SCANS_PER_MINUTE = 10;

const supabase = createClient(secret("SUPABASE_URL"), secret("SUPABASE_ANON_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(
  createHandler({
    async verifyUser(token) {
      const { data, error } = await supabase.auth.getUser(token);
      return error || !data.user ? null : data.user.id;
    },
    rateLimiter: createMemoryRateLimiter({ limit: SCANS_PER_MINUTE, windowMs: 60_000 }),
    model: createAnthropicModel({ apiKey: secret("ANTHROPIC_API_KEY") }),
    catalog: createTcgdexProvider(),
  }),
);
