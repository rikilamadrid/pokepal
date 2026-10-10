import { z } from "zod";
import {
  MAX_TEXT_LENGTH,
  RecognitionError,
  type RecognitionResponse,
  type RecognitionTransport,
} from "@/lib/recognition/transport";

export interface EdgeTransportOptions {
  /** Full URL of the `recognize-cards` function. */
  endpoint: string;
  /** Supabase anon (publishable) key, sent as `apikey`. */
  anonKey: string;
  /** The signed-in user's access token (JWT), or null when signed out. */
  getAccessToken: () => Promise<string | null>;
  fetch?: typeof fetch;
}

/** Function URL for a Supabase project URL. */
export function recognizeCardsEndpoint(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/recognize-cards`;
}

async function defaultEdgeOptions(): Promise<EdgeTransportOptions | null> {
  const { getSupabase } = await import("@/lib/supabase");
  const supabase = getSupabase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/^["']|["']$/g, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!supabase || !url || !anonKey) return null;
  return {
    endpoint: recognizeCardsEndpoint(url),
    anonKey,
    getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  };
}

/** Body of a non-2xx function response, read for its error code only. */
const edgeErrorSchema = z.object({ error: z.string().max(MAX_TEXT_LENGTH) });

const EDGE_ERROR_MESSAGES: Readonly<Record<number, string>> = {
  401: "Please sign in again to scan cards.",
  413: "That photo is too large to scan.",
  415: "That photo format can't be scanned.",
  429: "Too many scans in a row. Wait a minute and try again.",
};

/**
 * Transport to the `recognize-cards` Edge Function: one multipart POST with the
 * prepared JPEG and the mode, authorized by the user's Supabase JWT. Without
 * options it uses the app's Supabase client and public env. Signed out (no
 * token) it fails before making any request. The image goes in the request
 * body only; the response is validated by `recognize`.
 */
export function createEdgeTransport(options?: EdgeTransportOptions): RecognitionTransport {
  return {
    async recognize({ image, mode }) {
      const config = options ?? (await defaultEdgeOptions());
      if (!config) throw new RecognitionError("Card recognition is not set up on this device.");
      const token = await config.getAccessToken();
      if (!token) throw new RecognitionError("Sign in to scan cards.");

      const body = new FormData();
      body.append("mode", mode);
      body.append("image", image, "photo.jpg");
      const doFetch = config.fetch ?? fetch;
      const response = await doFetch(config.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, apikey: config.anonKey },
        body,
      });
      if (!response.ok) {
        const parsed = edgeErrorSchema.safeParse(await response.json().catch(() => null));
        const code = parsed.success ? ` (${parsed.data.error})` : "";
        const message = EDGE_ERROR_MESSAGES[response.status] ?? "Card recognition failed. Try again.";
        throw new RecognitionError(`${message} [HTTP ${response.status}${code}]`);
      }
      return (await response.json()) as RecognitionResponse;
    },
  };
}
