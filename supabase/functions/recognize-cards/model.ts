import type { ScanBatch } from "@/types/scan";
import {
  MAX_OUTPUT_TOKENS,
  ModelOutputError,
  buildModelRequest,
  parseModelResponse,
  readUsage,
  type CardReading,
  type ImageMediaType,
  type ModelUsage,
} from "./prompt";

/**
 * The paid call: one photo → the model's card readings. The only module that
 * talks to the model provider. The API key is passed in by the caller (Edge
 * Function secret or the harness's environment) and never logged.
 */

export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_TIMEOUT_MS = 45_000;

/** Claude Haiku 4.5 list price, USD per million tokens (2026-09-25). */
export const PRICE_USD_PER_MTOK = { input: 1, output: 5 } as const;
/**
 * Upper bound on input tokens for one photo: the API scales images to at most
 * ~1.15 megapixels (≈1,600 tokens); 6,000 also covers the system prompt and
 * tool schema with room to spare.
 */
export const MAX_INPUT_TOKENS_ESTIMATE = 6_000;

export function costUsd(usage: ModelUsage): number {
  return (usage.inputTokens * PRICE_USD_PER_MTOK.input + usage.outputTokens * PRICE_USD_PER_MTOK.output) / 1e6;
}

/** The most one call can cost: estimated input ceiling plus the full output cap. */
export function worstCaseCostUsd(): number {
  return costUsd({ inputTokens: MAX_INPUT_TOKENS_ESTIMATE, outputTokens: MAX_OUTPUT_TOKENS });
}

export interface ModelImage {
  bytes: Uint8Array;
  mediaType: ImageMediaType;
}

export interface ModelResult {
  readings: CardReading[];
  usage: ModelUsage;
  modelMs: number;
}

export interface VisionModel {
  extract(image: ModelImage, mode: ScanBatch["mode"]): Promise<ModelResult>;
}

/** The provider call failed. Carries the HTTP status and, when billed, the usage. */
export class ModelCallError extends Error {
  readonly status: number | null;
  readonly usage: ModelUsage | null;
  constructor(message: string, status: number | null, usage: ModelUsage | null = null) {
    super(message);
    this.name = "ModelCallError";
    this.status = status;
    this.usage = usage;
  }
}

/** Base64 without Node's Buffer, so it runs in Deno and Node alike. */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export interface AnthropicModelOptions {
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
}

/** Claude vision over the Messages API (raw HTTP: works unchanged in Deno and Node). */
export function createAnthropicModel(options: AnthropicModelOptions): VisionModel {
  if (!options.apiKey) throw new Error("A model API key is required");
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? (() => performance.now());
  return {
    async extract(image, mode) {
      const body = JSON.stringify(buildModelRequest(toBase64(image.bytes), image.mediaType, mode));
      const started = now();
      let response: Response;
      try {
        response = await doFetch(ANTHROPIC_MESSAGES_URL, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": options.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body,
          signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        });
      } catch {
        throw new ModelCallError("Model request did not complete", null);
      }
      const json: unknown = await response.json().catch(() => null);
      const modelMs = now() - started;
      if (!response.ok) throw new ModelCallError(`Model request failed (HTTP ${response.status})`, response.status);
      try {
        return { ...parseModelResponse(json), modelMs };
      } catch (error) {
        if (error instanceof ModelOutputError) {
          // A rejected response was still billed; keep its usage for the ledger.
          throw new ModelCallError(error.message, response.status, readUsage(json));
        }
        throw error;
      }
    },
  };
}
