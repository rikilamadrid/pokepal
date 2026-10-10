import { z } from "zod";
import { extractedCardFieldsSchema } from "@/types/scan.schema";
import type { ExtractedCardFields, ScanBatch } from "@/types/scan";

/**
 * The recognition prompt family and its structured-output contract, shared by
 * the `recognize-cards` Edge Function and the evaluation harness so both run
 * exactly the same request.
 *
 * The model returns its reading through one tool, `record_cards`, whose input
 * mirrors `ExtractedCardFields`. Tool input is untrusted: every card is
 * validated with the same Zod schema the client uses.
 */

/** Cost-efficient Claude vision model (decision D2: Haiku-class first). */
export const MODEL_ID = "claude-haiku-4-5";
/** At most 10 cards per photo (Batch Scan reads 5–10). */
export const MAX_CARDS = 10;
/** Room for 10 cards of structured output; also the ledger's worst-case output. */
export const MAX_OUTPUT_TOKENS = 2048;
export const TOOL_NAME = "record_cards";

export const SYSTEM_PROMPT = `You read Pokémon Trading Card Game cards from one photo.
For every card that is visible in the photo (at most ${MAX_CARDS}), report only what is printed on it.
Never guess: use null for anything you cannot read clearly.

Fields, per card:
- name: the card title exactly as printed (keep suffixes such as "ex", "V", "VMAX", "VSTAR", "GX").
- collectorNumber: the number before the slash, as printed (e.g. "020" from "020/189"); for numbers without a slash, the whole printed code (e.g. "SWSH050", "TG05").
- setOfficialCount: the number after the slash (189 from "020/189"); null if there is no slash.
- setCodeHint: a printed set code or a short description of the set symbol; null if unsure.
- hp: the printed HP as an integer; null for Trainer and Energy cards.
- language: "en", "es" or "ja" if the card text is clearly in that language; otherwise null.
- regulationMark: the single printed regulation letter (e.g. "D"); null if none.
- finishHint: "holo", "reverse", "firstEdition" or "normal" if clearly visible; otherwise null.
- bbox: the card's box in the photo as fractions of width and height (0..1): x, y, w, h.
- modelConfidence: 0..1, how sure you are of this card's reading.

Record the cards by calling the ${TOOL_NAME} tool once. If no card is visible, call it with an empty list.`;

const MODE_HINT: Readonly<Record<ScanBatch["mode"], string>> = {
  batch: "This photo shows several cards laid out together. Read every card.",
  "trade-check": "This photo shows one card a friend is offering. Read that card.",
};

const nullable = (type: string, extra: Record<string, unknown> = {}) => ({
  anyOf: [{ type, ...extra }, { type: "null" }],
});

/** JSON Schema of one card reading — the same fields as `ExtractedCardFields`. */
export const CARD_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "collectorNumber",
    "setOfficialCount",
    "setCodeHint",
    "hp",
    "language",
    "regulationMark",
    "finishHint",
    "bbox",
    "modelConfidence",
  ],
  properties: {
    name: nullable("string"),
    collectorNumber: nullable("string"),
    setOfficialCount: nullable("integer", { minimum: 1 }),
    setCodeHint: nullable("string"),
    hp: nullable("integer", { minimum: 1 }),
    language: { anyOf: [{ enum: ["en", "es", "ja"] }, { type: "null" }] },
    regulationMark: nullable("string"),
    finishHint: { anyOf: [{ enum: ["normal", "holo", "reverse", "firstEdition"] }, { type: "null" }] },
    bbox: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["x", "y", "w", "h"],
          properties: {
            x: { type: "number", minimum: 0, maximum: 1 },
            y: { type: "number", minimum: 0, maximum: 1 },
            w: { type: "number", minimum: 0, maximum: 1 },
            h: { type: "number", minimum: 0, maximum: 1 },
          },
        },
        { type: "null" },
      ],
    },
    modelConfidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

export const RECORD_CARDS_TOOL = {
  name: TOOL_NAME,
  description: "Record what is printed on each card visible in the photo.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["cards"],
    properties: { cards: { type: "array", maxItems: MAX_CARDS, items: CARD_JSON_SCHEMA } },
  },
} as const;

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp";
export const IMAGE_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const satisfies readonly ImageMediaType[];

/** Messages API request body for one photo. The image appears here and nowhere else. */
export function buildModelRequest(imageBase64: string, mediaType: ImageMediaType, mode: ScanBatch["mode"]) {
  return {
    model: MODEL_ID,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    tools: [RECORD_CARDS_TOOL],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: MODE_HINT[mode] },
        ],
      },
    ],
  };
}

/** The model output did not satisfy the contract. Messages never quote the output. */
export class ModelOutputError extends Error {
  readonly code: "refused" | "truncated" | "no-tool-call" | "invalid-output";
  constructor(code: ModelOutputError["code"]) {
    super(`Model output rejected: ${code}`);
    this.name = "ModelOutputError";
    this.code = code;
  }
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
}

/** One card as the model read it: valid fields, or a reading that broke the contract. */
export type CardReading = { ok: true; extracted: ExtractedCardFields } | { ok: false };

export interface ParsedModelResponse {
  readings: CardReading[];
  usage: ModelUsage;
}

const messageSchema = z.looseObject({
  stop_reason: z.string().nullable(),
  content: z.array(z.looseObject({ type: z.string() })),
  usage: z.looseObject({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
});

const toolUseSchema = z.looseObject({
  type: z.literal("tool_use"),
  name: z.literal(TOOL_NAME),
  input: z.strictObject({ cards: z.array(z.unknown()).max(MAX_CARDS) }),
});

/** Token usage of a Messages API response, when it has a readable usage block. */
export function readUsage(message: unknown): ModelUsage | null {
  const parsed = messageSchema.safeParse(message);
  if (!parsed.success) return null;
  return { inputTokens: parsed.data.usage.input_tokens, outputTokens: parsed.data.usage.output_tokens };
}

/**
 * Validate a Messages API response: a refused, truncated or malformed response
 * fails the whole request; a single card that breaks the schema becomes a
 * failed reading and the rest of the batch survives (decision D11).
 */
export function parseModelResponse(message: unknown): ParsedModelResponse {
  const parsed = messageSchema.safeParse(message);
  if (!parsed.success) throw new ModelOutputError("invalid-output");
  const { stop_reason: stopReason, content, usage } = parsed.data;
  if (stopReason === "refusal") throw new ModelOutputError("refused");
  if (stopReason === "max_tokens") throw new ModelOutputError("truncated");
  const block = content.find((b) => b.type === "tool_use");
  if (!block) throw new ModelOutputError("no-tool-call");
  const call = toolUseSchema.safeParse(block);
  if (!call.success) throw new ModelOutputError("invalid-output");

  const readings = call.data.input.cards.map((card): CardReading => {
    const fields = extractedCardFieldsSchema.safeParse(card);
    return fields.success ? { ok: true, extracted: fields.data } : { ok: false };
  });
  return { readings, usage: { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens } };
}
