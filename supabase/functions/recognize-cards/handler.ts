import type { CatalogProvider } from "@/lib/catalog/provider";
import { containsInlineData } from "@/lib/recognition/image-guard";
import { resolve } from "@/lib/recognition/resolve";
import {
  recognitionResponseSchema,
  type CardFailure,
  type RecognitionResponse,
  type ResolvedCard,
} from "@/lib/recognition/transport";
import type { ExtractedCardFields, ScanBatch } from "@/types/scan";
import { ModelCallError, type VisionModel } from "./model";
import { IMAGE_MEDIA_TYPES, type CardReading, type ImageMediaType } from "./prompt";
import type { RateLimiter } from "./rate-limit";

/**
 * `recognize-cards` request handler, written against web-standard Request and
 * Response so it runs in the Supabase Edge Runtime and in tests alike.
 *
 * POST multipart/form-data { image: JPEG|PNG|WebP, mode: "batch"|"trade-check" }
 * with `Authorization: Bearer <Supabase JWT>` →
 * 200 RecognitionResponse (resolved cards + timings, no image data).
 *
 * The image is read into memory for the model call and never written, logged,
 * or returned. Logs carry a fixed event code and nothing else.
 */

/** The model accepts images up to 5 MB; a prepared JPEG is far smaller. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MODES = ["batch", "trade-check"] as const satisfies readonly ScanBatch["mode"][];

export type LogCode =
  | "unauthorized"
  | "rate-limited"
  | "bad-request"
  | "too-large"
  | "unsupported-media"
  | "model-error"
  | "card-failed"
  | "invalid-result"
  | "internal-error";

/** The only logging in this function: an event code, never a value from the request. */
export function logEvent(code: LogCode): void {
  console.error(`recognize-cards: ${code}`);
}

export interface HandlerDeps {
  /** User id for a valid Supabase access token, else null. */
  verifyUser(token: string): Promise<string | null>;
  rateLimiter: RateLimiter;
  model: VisionModel;
  catalog: CatalogProvider;
  now?: () => number;
  log?: (code: LogCode) => void;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json", ...headers },
  });
}

const BLANK_EXTRACTION: ExtractedCardFields = {
  name: null,
  collectorNumber: null,
  setOfficialCount: null,
  setCodeHint: null,
  hp: null,
  language: null,
  regulationMark: null,
  finishHint: null,
  bbox: null,
  modelConfidence: 0,
};

function failed(failure: CardFailure, extracted: ExtractedCardFields = BLANK_EXTRACTION): ResolvedCard {
  return { extracted, tier: "unmatched", matches: [], failure };
}

/**
 * Resolve each reading against the catalog. One card's failure — an invalid
 * reading, a failed lookup, or image-like data — makes that card `unmatched`
 * with a reason; the rest of the batch is still returned (decision D11).
 */
export async function resolveReadings(
  readings: readonly CardReading[],
  catalog: CatalogProvider,
  log: (code: LogCode) => void = logEvent,
): Promise<ResolvedCard[]> {
  const cards: ResolvedCard[] = [];
  for (const reading of readings) {
    if (!reading.ok) {
      cards.push(failed("invalid-extraction"));
      continue;
    }
    if (containsInlineData(reading.extracted)) {
      cards.push(failed("image-data"));
      continue;
    }
    try {
      const { tier, matches } = await resolve(reading.extracted, catalog);
      const card: ResolvedCard = { extracted: reading.extracted, tier, matches };
      cards.push(containsInlineData(card) ? failed("image-data", reading.extracted) : card);
    } catch {
      log("card-failed");
      cards.push(failed("catalog-error", reading.extracted));
    }
  }
  return cards;
}

type ParsedUpload =
  | { ok: true; bytes: Uint8Array; mediaType: ImageMediaType; mode: ScanBatch["mode"] }
  | { ok: false; status: number; code: LogCode };

/** The largest request body accepted: one image plus multipart overhead. */
export const MAX_BODY_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

/**
 * Read the body, stopping as soon as it passes MAX_BODY_BYTES, whatever
 * Content-Length says (a streamed upload may send none). Null means too large.
 */
async function readBoundedBody(request: Request): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return null;
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function readUpload(request: Request): Promise<ParsedUpload> {
  let form: FormData;
  try {
    const body = await readBoundedBody(request);
    if (!body) return { ok: false, status: 413, code: "too-large" };
    const contentType = request.headers.get("content-type") ?? "";
    form = await new Response(body, { headers: { "content-type": contentType } }).formData();
  } catch {
    return { ok: false, status: 400, code: "bad-request" };
  }
  const mode = form.get("mode");
  const image = form.get("image");
  if (typeof mode !== "string" || !(MODES as readonly string[]).includes(mode)) {
    return { ok: false, status: 400, code: "bad-request" };
  }
  if (!(image instanceof Blob)) return { ok: false, status: 400, code: "bad-request" };
  if (image.size === 0) return { ok: false, status: 400, code: "bad-request" };
  if (image.size > MAX_IMAGE_BYTES) return { ok: false, status: 413, code: "too-large" };
  const mediaType = image.type.split(";")[0].trim().toLowerCase();
  if (!(IMAGE_MEDIA_TYPES as readonly string[]).includes(mediaType)) {
    return { ok: false, status: 415, code: "unsupported-media" };
  }
  return {
    ok: true,
    bytes: new Uint8Array(await image.arrayBuffer()),
    mediaType: mediaType as ImageMediaType,
    mode: mode as ScanBatch["mode"],
  };
}

async function authorize(request: Request, deps: HandlerDeps): Promise<string | null> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return null;
  try {
    return await deps.verifyUser(match[1]);
  } catch {
    return null;
  }
}

export function createHandler(deps: HandlerDeps): (request: Request) => Promise<Response> {
  const now = deps.now ?? (() => performance.now());
  const log = deps.log ?? logEvent;
  const fail = (status: number, code: LogCode, headers?: Record<string, string>) => {
    log(code);
    return json(status, { error: code }, headers);
  };

  return async (request) => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
    if (request.method !== "POST") return json(405, { error: "method-not-allowed" }, { Allow: "POST, OPTIONS" });
    const started = now();
    try {
      const userId = await authorize(request, deps);
      if (!userId) return fail(401, "unauthorized");
      if (!deps.rateLimiter.take(userId)) return fail(429, "rate-limited", { "Retry-After": "60" });

      const upload = await readUpload(request);
      if (!upload.ok) return fail(upload.status, upload.code);
      const uploadMs = now() - started;

      let result;
      try {
        result = await deps.model.extract({ bytes: upload.bytes, mediaType: upload.mediaType }, upload.mode);
      } catch (error) {
        if (error instanceof ModelCallError) return fail(502, "model-error");
        throw error;
      }

      const resolveStarted = now();
      const cards = await resolveReadings(result.readings, deps.catalog, log);
      const body: RecognitionResponse = {
        cards,
        timings: { uploadMs, modelMs: result.modelMs, resolveMs: now() - resolveStarted },
      };
      const checked = recognitionResponseSchema.safeParse(body);
      if (!checked.success || containsInlineData(checked.data)) return fail(500, "invalid-result");
      return json(200, checked.data);
    } catch {
      return fail(500, "internal-error");
    }
  };
}
