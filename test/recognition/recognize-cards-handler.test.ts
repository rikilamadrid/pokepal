import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { recognitionResponseSchema } from "@/lib/recognition/transport";
import type { CatalogProvider } from "@/lib/catalog/provider";
import type { ExtractedCardFields } from "@/types/scan";
import {
  MAX_IMAGE_BYTES,
  createHandler,
  logEvent,
  type HandlerDeps,
  type LogCode,
} from "../../supabase/functions/recognize-cards/handler";
import { ModelCallError, type VisionModel } from "../../supabase/functions/recognize-cards/model";
import type { CardReading } from "../../supabase/functions/recognize-cards/prompt";
import { createMemoryRateLimiter } from "../../supabase/functions/recognize-cards/rate-limit";
import { createMemoryCatalog } from "../helpers/memory-catalog";

const recorded = JSON.parse(
  readFileSync(new URL("../fixtures/recognition/batch-photo.json", import.meta.url), "utf8"),
) as { extractions: ExtractedCardFields[] };

const SENTINEL = "PHOTO-BYTES-SENTINEL-19-2";
const TOKEN = "valid.jwt.token";
const URL_ = "https://project.supabase.co/functions/v1/recognize-cards";

const photo = (type = "image/jpeg", extra = "") =>
  new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), SENTINEL, extra], { type });

function request(
  { image = photo() as Blob | string | null, mode = "batch" as string | null, token = TOKEN as string | null, method = "POST" } = {},
): Request {
  const form = new FormData();
  if (mode !== null) form.append("mode", mode);
  if (image !== null) form.append("image", image);
  const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
  return new Request(URL_, method === "POST" ? { method, headers, body: form } : { method, headers });
}

const ok = (extracted: ExtractedCardFields): CardReading => ({ ok: true, extracted });

function modelReturning(readings: CardReading[]): VisionModel & { seen: Uint8Array[] } {
  const seen: Uint8Array[] = [];
  return {
    seen,
    async extract(image) {
      seen.push(image.bytes);
      return { readings, usage: { inputTokens: 1000, outputTokens: 200 }, modelMs: 900 };
    },
  };
}

function deps(overrides: Partial<HandlerDeps> = {}): HandlerDeps & { logged: LogCode[] } {
  const logged: LogCode[] = [];
  return {
    logged,
    verifyUser: async (token) => (token === TOKEN ? "user-1" : null),
    rateLimiter: createMemoryRateLimiter({ limit: 100, windowMs: 60_000 }),
    model: modelReturning(recorded.extractions.map(ok)),
    catalog: createMemoryCatalog(),
    log: (code) => logged.push(code),
    ...overrides,
  };
}

async function call(d: HandlerDeps, req: Request) {
  const response = await createHandler(d)(req);
  const text = await response.text();
  return { status: response.status, headers: response.headers, text, body: text ? (JSON.parse(text) as unknown) : null };
}

describe("recognize-cards handler", () => {
  it("returns a contract-valid response with exact, ambiguous and unmatched cards", async () => {
    const d = deps();
    const res = await call(d, request());
    expect(res.status).toBe(200);
    const parsed = recognitionResponseSchema.parse(res.body);
    expect(parsed.cards.map((c) => c.tier)).toEqual(["exact", "ambiguous", "unmatched"]);
    expect(parsed.cards[0].matches[0].printing.id).toBe("tcgdex:en:swsh3-20");
    expect(parsed.cards.every((c) => c.failure === undefined)).toBe(true);
    expect(parsed.timings.modelMs).toBe(900);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(d.logged).toEqual([]);
  });

  it("hands the uploaded bytes to the model and returns none of them", async () => {
    const model = modelReturning(recorded.extractions.map(ok));
    const res = await call(deps({ model }), request());
    expect(new TextDecoder().decode(model.seen[0])).toContain(SENTINEL);
    expect(res.text).not.toContain(SENTINEL);
    expect(res.text).not.toContain(Buffer.from(SENTINEL).toString("base64"));
    expect(res.text).not.toMatch(/data:|\/9j\//);
  });

  it("answers the CORS preflight and refuses other methods", async () => {
    const preflight = await createHandler(deps())(new Request(URL_, { method: "OPTIONS" }));
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-headers")).toContain("authorization");
    expect((await call(deps(), request({ method: "GET" }))).status).toBe(405);
  });

  describe("JWT verification", () => {
    it.each([
      ["no token", request({ token: null })],
      ["an invalid token", request({ token: "forged" })],
    ])("returns 401 for %s without calling the model", async (_what, req) => {
      const model = modelReturning([]);
      const d = deps({ model });
      const res = await call(d, req);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "unauthorized" });
      expect(model.seen).toHaveLength(0);
      expect(d.logged).toEqual(["unauthorized"]);
    });

    it("treats a verifier failure as unauthorized", async () => {
      const res = await call(deps({ verifyUser: async () => Promise.reject(new Error("auth down")) }), request());
      expect(res.status).toBe(401);
    });
  });

  it("rate-limits per user", async () => {
    let t = 0;
    const rateLimiter = createMemoryRateLimiter({ limit: 2, windowMs: 60_000, now: () => t });
    const model = modelReturning([]);
    const d = deps({ rateLimiter, model });
    expect((await call(d, request())).status).toBe(200);
    expect((await call(d, request())).status).toBe(200);
    const limited = await call(d, request());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(model.seen).toHaveLength(2);
    // Another user has their own window, and the window resets.
    const other = deps({ rateLimiter, model, verifyUser: async () => "user-2" });
    expect((await call(other, request())).status).toBe(200);
    t = 60_000;
    expect((await call(d, request())).status).toBe(200);
  });

  describe("upload validation", () => {
    it.each([
      ["a missing mode", request({ mode: null }), 400, "bad-request"],
      ["an unknown mode", request({ mode: "everything" }), 400, "bad-request"],
      ["a missing image", request({ image: null }), 400, "bad-request"],
      ["an image sent as text", request({ image: "abc" }), 400, "bad-request"],
      ["an empty image", request({ image: new Blob([], { type: "image/jpeg" }) }), 400, "bad-request"],
      ["a GIF", request({ image: photo("image/gif") }), 415, "unsupported-media"],
      ["an image over 5 MB", request({ image: photo("image/jpeg", "x".repeat(MAX_IMAGE_BYTES)) }), 413, "too-large"],
    ])("rejects %s", async (_what, req, status, code) => {
      const model = modelReturning([]);
      const res = await call(deps({ model }), req);
      expect(res.status).toBe(status);
      expect(res.body).toEqual({ error: code });
      expect(model.seen).toHaveLength(0);
    });

    it("rejects a body that is not multipart", async () => {
      const req = new Request(URL_, { method: "POST", headers: { authorization: `Bearer ${TOKEN}` }, body: "{}" });
      expect((await call(deps(), req)).status).toBe(400);
    });

    it("accepts PNG and WebP", async () => {
      expect((await call(deps(), request({ image: photo("image/png") }))).status).toBe(200);
      expect((await call(deps(), request({ image: photo("image/webp"), mode: "trade-check" }))).status).toBe(200);
    });
  });

  it("returns 502 when the model call fails", async () => {
    const model: VisionModel = { extract: async () => Promise.reject(new ModelCallError("Model request failed (HTTP 529)", 529)) };
    const d = deps({ model });
    const res = await call(d, request());
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: "model-error" });
    expect(d.logged).toEqual(["model-error"]);
  });

  it("returns 500 without detail on an unexpected error", async () => {
    const model: VisionModel = { extract: async () => Promise.reject(new Error(`boom ${SENTINEL}`)) };
    const res = await call(deps({ model }), request());
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "internal-error" });
  });

  describe("batch partial failure (D11)", () => {
    it("keeps the batch when one card's catalog lookup fails", async () => {
      const memory = createMemoryCatalog();
      const catalog: CatalogProvider = {
        ...memory,
        async findByNumber(number, count, lang) {
          if (count === 999) throw new Error("TCGdex 503");
          return memory.findByNumber(number, count, lang);
        },
      };
      const d = deps({ catalog });
      const res = await call(d, request());
      expect(res.status).toBe(200);
      const { cards } = recognitionResponseSchema.parse(res.body);
      expect(cards.map((c) => [c.tier, c.failure])).toEqual([
        ["exact", undefined],
        ["ambiguous", undefined],
        ["unmatched", "catalog-error"],
      ]);
      expect(cards[2].extracted).toEqual(recorded.extractions[2]);
      expect(d.logged).toEqual(["card-failed"]);
    });

    it("turns a malformed reading into an unmatched card with blank fields", async () => {
      const d = deps({ model: modelReturning([ok(recorded.extractions[0]), { ok: false }]) });
      const { cards } = recognitionResponseSchema.parse((await call(d, request())).body);
      expect(cards[0].tier).toBe("exact");
      expect(cards[1]).toMatchObject({ tier: "unmatched", matches: [], failure: "invalid-extraction" });
      expect(cards[1].extracted.name).toBeNull();
    });

    it("drops a reading that carries image data instead of returning it", async () => {
      const base64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]).toString("base64");
      const leaky = { ...recorded.extractions[0], setCodeHint: base64 };
      const res = await call(deps({ model: modelReturning([ok(leaky), ok(recorded.extractions[0])]) }), request());
      const { cards } = recognitionResponseSchema.parse(res.body);
      expect(cards[0]).toMatchObject({ tier: "unmatched", failure: "image-data" });
      expect(cards[1].tier).toBe("exact");
      expect(res.text).not.toContain(base64);
    });
  });
});

describe("no logging of request data", () => {
  let spies: MockInstance[];
  beforeEach(() => {
    spies = (["log", "info", "warn", "error", "debug", "trace"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("logs only fixed event codes, on every path, with the default logger", async () => {
    const memory = createMemoryCatalog();
    const flaky: CatalogProvider = { ...memory, findByNumber: async () => Promise.reject(new Error(SENTINEL)) };
    const failing: VisionModel = { extract: async () => Promise.reject(new Error(SENTINEL)) };
    const scenarios: [Partial<HandlerDeps>, Request][] = [
      [{}, request()],
      [{}, request({ token: "forged" })],
      [{}, request({ image: photo("image/gif") })],
      [{ catalog: flaky }, request()],
      [{ model: failing }, request()],
      [{ model: { extract: async () => Promise.reject(new ModelCallError("x", 500)) } }, request()],
    ];
    for (const [overrides, req] of scenarios) {
      const { log: _ignored, ...rest } = deps(overrides);
      void _ignored;
      await createHandler(rest)(req);
    }
    const calls = spies.flatMap((s) => s.mock.calls);
    expect(calls.length).toBeGreaterThan(0);
    for (const args of calls) {
      expect(args).toHaveLength(1);
      expect(args[0]).toMatch(/^recognize-cards: [a-z-]+$/);
      expect(String(args[0])).not.toContain(SENTINEL);
    }
    // The success path logs nothing at all.
    spies.forEach((s) => s.mockClear());
    const { log: _l, ...quiet } = deps();
    void _l;
    await createHandler(quiet)(request());
    expect(spies.every((s) => s.mock.calls.length === 0)).toBe(true);
  });

  it("logEvent writes the code and nothing else", () => {
    logEvent("rate-limited");
    expect(spies[3]).toHaveBeenCalledWith("recognize-cards: rate-limited");
  });

  it("has a single console call in the function source, inside logEvent", () => {
    const dir = fileURLToPath(new URL("../../supabase/functions/recognize-cards/", import.meta.url));
    const uses = readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .flatMap((f) =>
        readFileSync(join(dir, f), "utf8")
          .split("\n")
          .filter((line) => /\bconsole\./.test(line))
          .map((line) => `${f}: ${line.trim()}`),
      );
    expect(uses).toEqual(["handler.ts: console.error(`recognize-cards: ${code}`);"]);
  });
});
