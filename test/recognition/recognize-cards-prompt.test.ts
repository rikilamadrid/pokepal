import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { extractedCardFieldsSchema } from "@/types/scan.schema";
import type { ExtractedCardFields } from "@/types/scan";
import {
  CARD_JSON_SCHEMA,
  MAX_CARDS,
  MAX_OUTPUT_TOKENS,
  MODEL_ID,
  ModelOutputError,
  RECORD_CARDS_TOOL,
  TOOL_NAME,
  buildModelRequest,
  parseModelResponse,
} from "../../supabase/functions/recognize-cards/prompt";
import {
  ANTHROPIC_MESSAGES_URL,
  MAX_INPUT_TOKENS_ESTIMATE,
  ModelCallError,
  costUsd,
  createAnthropicModel,
  toBase64,
  worstCaseCostUsd,
} from "../../supabase/functions/recognize-cards/model";

const recorded = JSON.parse(
  readFileSync(new URL("../fixtures/recognition/batch-photo.json", import.meta.url), "utf8"),
) as { extractions: ExtractedCardFields[] };

const toolMessage = (cards: unknown[], overrides: Record<string, unknown> = {}) => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: MODEL_ID,
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id: "toolu_1", name: TOOL_NAME, input: { cards } }],
  usage: { input_tokens: 1800, output_tokens: 400 },
  ...overrides,
});

describe("structured-output contract", () => {
  it("asks for exactly the ExtractedCardFields keys", () => {
    const contractKeys = Object.keys(recorded.extractions[0]).sort();
    expect([...CARD_JSON_SCHEMA.required].sort()).toEqual(contractKeys);
    expect(Object.keys(CARD_JSON_SCHEMA.properties).sort()).toEqual(contractKeys);
    expect(RECORD_CARDS_TOOL.input_schema.properties.cards.maxItems).toBe(MAX_CARDS);
  });

  it("builds a Haiku-class request that forces the record_cards tool and carries the image once", () => {
    const request = buildModelRequest("QUJD", "image/jpeg", "trade-check");
    expect(request.model).toBe("claude-haiku-4-5");
    expect(request.max_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(request.tool_choice).toEqual({ type: "tool", name: TOOL_NAME });
    expect(request.tools).toEqual([RECORD_CARDS_TOOL]);
    const content = request.messages[0].content;
    expect(content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "QUJD" } });
    expect(JSON.stringify(request).split("QUJD")).toHaveLength(2);
    expect(JSON.stringify(buildModelRequest("QUJD", "image/jpeg", "batch"))).not.toEqual(JSON.stringify(request));
  });

  it("parses a recorded tool call into validated readings and usage", () => {
    const parsed = parseModelResponse(toolMessage(recorded.extractions));
    expect(parsed.usage).toEqual({ inputTokens: 1800, outputTokens: 400 });
    expect(parsed.readings).toEqual(recorded.extractions.map((extracted) => ({ ok: true, extracted })));
    for (const r of parsed.readings) if (r.ok) expect(extractedCardFieldsSchema.safeParse(r.extracted).success).toBe(true);
  });

  it("marks only the malformed card as failed (D11)", () => {
    const bad = { ...recorded.extractions[0], hp: "330" };
    const extra = { ...recorded.extractions[1], photo: "abc" };
    const parsed = parseModelResponse(toolMessage([recorded.extractions[0], bad, extra]));
    expect(parsed.readings.map((r) => r.ok)).toEqual([true, false, false]);
  });

  it("accepts an empty card list", () => {
    expect(parseModelResponse(toolMessage([])).readings).toEqual([]);
  });

  it.each([
    ["a refusal", toolMessage([], { stop_reason: "refusal" }), "refused"],
    ["truncated output", toolMessage([], { stop_reason: "max_tokens" }), "truncated"],
    ["no tool call", toolMessage([], { content: [{ type: "text", text: "hi" }] }), "no-tool-call"],
    ["another tool", toolMessage([], { content: [{ type: "tool_use", id: "t", name: "other", input: { cards: [] } }] }), "invalid-output"],
    ["more than ten cards", toolMessage(Array.from({ length: MAX_CARDS + 1 }, () => recorded.extractions[0])), "invalid-output"],
    ["extra tool input", toolMessage([], { content: [{ type: "tool_use", id: "t", name: TOOL_NAME, input: { cards: [], note: "x" } }] }), "invalid-output"],
    ["no usage", { stop_reason: "tool_use", content: [] }, "invalid-output"],
  ])("rejects the whole response for %s", (_what, message, code) => {
    const error = (() => {
      try {
        parseModelResponse(message);
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(ModelOutputError);
    expect((error as ModelOutputError).code).toBe(code);
  });
});

describe("pricing", () => {
  it("prices Haiku 4.5 at $1 / $5 per million tokens", () => {
    expect(costUsd({ inputTokens: 1_000_000, outputTokens: 0 })).toBe(1);
    expect(costUsd({ inputTokens: 0, outputTokens: 1_000_000 })).toBe(5);
    expect(costUsd({ inputTokens: 2000, outputTokens: 500 })).toBeCloseTo(0.0045, 10);
  });

  it("bounds one call by the input estimate plus the full output cap", () => {
    expect(worstCaseCostUsd()).toBeCloseTo((MAX_INPUT_TOKENS_ESTIMATE * 1 + MAX_OUTPUT_TOKENS * 5) / 1e6, 10);
    expect(worstCaseCostUsd()).toBeLessThan(0.02);
  });
});

describe("Anthropic model client (fake fetch, no network)", () => {
  const image = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), mediaType: "image/jpeg" as const };

  it("sends the key in a header, the image as base64, and parses the response", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify(toolMessage(recorded.extractions)), { status: 200 }),
    );
    const model = createAnthropicModel({ apiKey: "test-key", fetch: fetchMock });
    const result = await model.extract(image, "batch");
    expect(result.readings).toHaveLength(3);
    expect(result.usage).toEqual({ inputTokens: 1800, outputTokens: 400 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(ANTHROPIC_MESSAGES_URL);
    expect((init?.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
    const body = JSON.parse(String(init?.body));
    expect(body.messages[0].content[0].source.data).toBe(toBase64(image.bytes));
    expect(String(init?.body)).not.toContain("test-key");
  });

  it("encodes base64 like Node's Buffer", () => {
    const bytes = new Uint8Array(100_000).map((_, i) => (i * 31) % 256);
    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });

  it("fails with the HTTP status only, never the response body", async () => {
    const fetchMock = async () => new Response(JSON.stringify({ error: { message: "secret detail" } }), { status: 529 });
    const model = createAnthropicModel({ apiKey: "k", fetch: fetchMock as typeof fetch });
    const error = await model.extract(image, "batch").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ModelCallError);
    expect((error as ModelCallError).status).toBe(529);
    expect((error as Error).message).not.toContain("secret detail");
  });

  it("keeps the billed usage when a 200 response breaks the contract", async () => {
    const fetchMock = async () => new Response(JSON.stringify(toolMessage([], { stop_reason: "max_tokens" })), { status: 200 });
    const model = createAnthropicModel({ apiKey: "k", fetch: fetchMock as typeof fetch });
    const error = (await model.extract(image, "batch").catch((e: unknown) => e)) as ModelCallError;
    expect(error).toBeInstanceOf(ModelCallError);
    expect(error.usage).toEqual({ inputTokens: 1800, outputTokens: 400 });
  });

  it("refuses to build without a key", () => {
    expect(() => createAnthropicModel({ apiKey: "" })).toThrow();
  });
});
