import { readFileSync } from "node:fs";
import { relative } from "node:path";
import type { CatalogProvider } from "@/lib/catalog/provider";
import { resolveReadings } from "../../supabase/functions/recognize-cards/handler";
import {
  ModelCallError,
  costUsd,
  toBase64,
  worstCaseCostUsd,
  type ModelImage,
  type VisionModel,
} from "../../supabase/functions/recognize-cards/model";
import {
  MODEL_ID,
  TOOL_NAME,
  buildModelRequest,
  parseModelResponse,
} from "../../supabase/functions/recognize-cards/prompt";
import { BudgetExceededError, usdToEur, type BudgetLedger } from "./ledger";
import { mediaTypeFor, photoFile, type LoadedManifest, type ManifestPhoto } from "./manifest";
import { computeMetrics, type PhotoOutcome } from "./metrics";
import type { EvalReport } from "./report";

/**
 * Evaluation harness: runs the Edge Function's prompt, model client, and
 * resolver over a labelled fixture, guarded by the budget ledger.
 */

export interface HarnessOptions {
  manifest: LoadedManifest;
  /** The model for a photo: the paid client for every photo, or a recorded one per photo. */
  modelFor: (photo: ManifestPhoto) => VisionModel;
  catalog: CatalogProvider;
  ledger: BudgetLedger;
  dryRun: boolean;
  runId: string;
  now?: () => Date;
  clock?: () => number;
  /** Silenced in tests. Never receives image data. */
  progress?: (line: string) => void;
}

/**
 * Dry-run stand-in for the paid call, for one photo. It builds and serializes
 * the exact request the paid call would send, then discards it, and replays the
 * photo's recorded tool input through the same response parser. Zero tokens,
 * zero cost, no network.
 */
export function createRecordedModel(photo: ManifestPhoto): VisionModel {
  return {
    async extract(image, mode) {
      JSON.stringify(buildModelRequest(toBase64(image.bytes), image.mediaType, mode));
      if (!photo.recordedCards) throw new ModelCallError("No recorded model output for this photo", null);
      const message = {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "recorded", name: TOOL_NAME, input: { cards: photo.recordedCards } }],
        usage: { input_tokens: 0, output_tokens: 0 },
      };
      return { ...parseModelResponse(message), modelMs: 0 };
    },
  };
}

async function evaluatePhoto(options: HarnessOptions, photo: ManifestPhoto): Promise<PhotoOutcome> {
  const clock = options.clock ?? (() => performance.now());
  const file = photoFile(options.manifest, photo);
  const image: ModelImage = { bytes: new Uint8Array(readFileSync(file)), mediaType: mediaTypeFor(file) };
  const base = { photo: photo.id, mode: photo.mode, expected: photo.expected };
  const record = (inputTokens: number, outputTokens: number, costEur = usdToEur(costUsd({ inputTokens, outputTokens }))) => {
    if (!options.dryRun || costEur > 0) {
      options.ledger.record({
        at: (options.now?.() ?? new Date()).toISOString(),
        runId: options.runId,
        photo: photo.id,
        inputTokens,
        outputTokens,
        costEur,
      });
    }
    return costEur;
  };

  try {
    const result = await options.modelFor(photo).extract(image, photo.mode);
    const costEur = record(result.usage.inputTokens, result.usage.outputTokens);
    const resolveStarted = clock();
    const cards = await resolveReadings(result.readings, options.catalog, () => {});
    return { ...base, cards, latencyMs: result.modelMs + (clock() - resolveStarted), costEur };
  } catch (error) {
    if (!(error instanceof ModelCallError)) throw error;
    // A failed call is recorded with the usage it was billed for. When that is
    // unknown and the provider may have done the work (timeout, network, 5xx),
    // the worst case is recorded; a 4xx refusal is not billed.
    const unknownBilling = error.usage === null && (error.status === null || error.status >= 500);
    const costEur =
      unknownBilling && !options.dryRun
        ? record(0, 0, usdToEur(worstCaseCostUsd()))
        : record(error.usage?.inputTokens ?? 0, error.usage?.outputTokens ?? 0);
    return { ...base, cards: [], latencyMs: 0, costEur, error: error.message };
  }
}

export async function runEvaluation(options: HarnessOptions): Promise<EvalReport> {
  const { manifest, ledger } = options;
  const progress = options.progress ?? (() => {});
  const worstCaseEur = options.dryRun ? 0 : usdToEur(worstCaseCostUsd());
  const spentBeforeEur = ledger.spentEur();
  ledger.assertCanStart(worstCaseEur);

  const startedAt = (options.now?.() ?? new Date()).toISOString();
  const outcomes: PhotoOutcome[] = [];
  let status: EvalReport["status"] = "complete";
  for (const photo of manifest.photos) {
    try {
      ledger.assertCanSpend(worstCaseEur);
    } catch (error) {
      if (!(error instanceof BudgetExceededError)) throw error;
      progress(error.message);
      status = "budget-stopped";
      break;
    }
    const outcome = await evaluatePhoto(options, photo);
    outcomes.push(outcome);
    progress(`${photo.id}: ${outcome.error ?? `${outcome.cards.length} card(s)`}`);
  }

  const { metrics, scores } = computeMetrics(outcomes);
  return {
    runId: options.runId,
    dryRun: options.dryRun,
    status,
    model: MODEL_ID,
    startedAt,
    manifest: { name: manifest.name, path: relative(process.cwd(), manifest.file), synthetic: manifest.synthetic, photos: manifest.photos.length },
    evaluatedPhotos: outcomes.length,
    ledger: { capEur: ledger.capEur(), spentBeforeEur, spentAfterEur: ledger.spentEur() },
    metrics,
    scores,
    photoErrors: outcomes.filter((o) => o.error).map((o) => ({ photo: o.photo, error: o.error ?? "" })),
  };
}
