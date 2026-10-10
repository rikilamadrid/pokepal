import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRecordedModel, runEvaluation, type HarnessOptions } from "../../evals/recognition/harness";
import {
  createBudgetLedger,
  emptyLedger,
  fileLedgerStore,
  memoryLedgerStore,
  BudgetExceededError,
} from "../../evals/recognition/ledger";
import { loadManifest, type LoadedManifest } from "../../evals/recognition/manifest";
import { computeMetrics, percentile, scorePhoto } from "../../evals/recognition/metrics";
import { renderMarkdown, writeReport } from "../../evals/recognition/report";
import { ModelCallError, worstCaseCostUsd, type VisionModel } from "../../supabase/functions/recognize-cards/model";
import { createMemoryCatalog, recordedPrinting } from "../helpers/memory-catalog";

const DRY_RUN_MANIFEST = fileURLToPath(new URL("../../evals/recognition/fixtures/dry-run/manifest.json", import.meta.url));
const LEDGER_FILE = fileURLToPath(new URL("../../evals/recognition/budget-ledger.json", import.meta.url));

function options(overrides: Partial<HarnessOptions> = {}): HarnessOptions {
  return {
    manifest: loadManifest(DRY_RUN_MANIFEST),
    modelFor: createRecordedModel,
    catalog: createMemoryCatalog(),
    ledger: createBudgetLedger(memoryLedgerStore(fileLedgerStore(LEDGER_FILE).read())),
    dryRun: true,
    runId: "test-dry-run",
    now: () => new Date("2026-10-10T12:00:00.000Z"),
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("dry run", () => {
  it("exercises the whole pipeline with zero paid calls and no network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const ledgerBefore = readFileSync(LEDGER_FILE, "utf8");
    const report = await runEvaluation(options());

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(readFileSync(LEDGER_FILE, "utf8")).toBe(ledgerBefore);
    expect(report.status).toBe("complete");
    expect(report.dryRun).toBe(true);
    expect(report.evaluatedPhotos).toBe(3);
    expect(report.metrics.totalCostEur).toBe(0);
    expect(report.ledger.spentAfterEur).toBe(report.ledger.spentBeforeEur);
    expect(report.photoErrors).toEqual([]);
    expect(report.manifest).toMatchObject({ name: "dry-run-synthetic", synthetic: true, photos: 3 });
    expect(report.manifest.path).not.toMatch(/^\//);
  });

  it("scores the synthetic fixture as designed (exact, ambiguous, unmatched, wrong match, malformed)", async () => {
    const { scores, metrics } = await runEvaluation(options());
    expect(scores.map((s) => [s.photo, s.correct, s.wrongMatch, s.ambiguous, s.unmatched, s.failed])).toEqual([
      ["batch-three-cards", 1, 0, 1, 1, 0],
      ["trade-check-spanish-read-as-english", 0, 1, 0, 0, 0],
      ["batch-one-malformed-reading", 1, 0, 0, 1, 1],
    ]);
    expect(metrics.exactAccuracy).toBeCloseTo(2 / 5);
    expect(metrics.wrongMatchRate).toBeCloseTo(1 / 6);
    expect(metrics.ambiguityRate).toBeCloseTo(1 / 6);
  });

  it("labels the report as a dry run, not accuracy", async () => {
    const markdown = renderMarkdown(await runEvaluation(options()));
    expect(markdown).toContain("**Dry run.**");
    expect(markdown).toContain("**not** accuracy");
    expect(markdown).toContain("Wrong-match rate");
    expect(markdown).toContain("Ambiguity rate");
  });

  it("writes markdown and JSON reports", async () => {
    const dir = mkdtempSync(join(tmpdir(), "reports-"));
    const files = writeReport(await runEvaluation(options()), dir);
    expect(readFileSync(files.markdown, "utf8")).toContain("# Recognition evaluation — test-dry-run");
    expect(JSON.parse(readFileSync(files.json, "utf8")).metrics.photos).toBe(3);
  });
});

describe("paid runs are budget-capped (fake paid model, no network)", () => {
  const billed = (inputTokens = 2000, outputTokens = 400): VisionModel => ({
    extract: async () => ({ readings: [], usage: { inputTokens, outputTokens }, modelMs: 1000 }),
  });

  function ledgerFile(entries: { costEur: number }[] = []) {
    const file = join(mkdtempSync(join(tmpdir(), "ledger-")), "budget-ledger.json");
    writeFileSync(
      file,
      JSON.stringify({
        ...emptyLedger(),
        entries: entries.map((e, i) => ({ at: "2026-10-10T00:00:00.000Z", runId: "old", photo: `p${i}`, inputTokens: 0, outputTokens: 0, ...e })),
      }),
    );
    return file;
  }

  it("refuses to start when the remaining budget cannot cover one call", async () => {
    const file = ledgerFile([{ costEur: 5 - worstCaseCostUsd() / 2 }]);
    const extract = vi.fn();
    await expect(
      runEvaluation(options({ dryRun: false, modelFor: () => ({ extract }), ledger: createBudgetLedger(fileLedgerStore(file)) })),
    ).rejects.toBeInstanceOf(BudgetExceededError);
    expect(extract).not.toHaveBeenCalled();
  });

  it("records every billed call and stops before the call that could pass €5", async () => {
    // Room for exactly two worst-case calls.
    const file = ledgerFile([{ costEur: 5 - 2.5 * worstCaseCostUsd() }]);
    const model = billed(6000, 2048);
    const extract = vi.spyOn(model, "extract");
    const report = await runEvaluation(options({ dryRun: false, modelFor: () => model, ledger: createBudgetLedger(fileLedgerStore(file)) }));
    expect(extract).toHaveBeenCalledTimes(2);
    expect(report.status).toBe("budget-stopped");
    expect(report.evaluatedPhotos).toBe(2);
    const saved = fileLedgerStore(file).read();
    expect(saved.entries).toHaveLength(3);
    expect(saved.entries.slice(1).map((e) => [e.photo, e.inputTokens, e.outputTokens])).toEqual([
      ["batch-three-cards", 6000, 2048],
      ["trade-check-spanish-read-as-english", 6000, 2048],
    ]);
    expect(report.ledger.spentAfterEur).toBeLessThanOrEqual(5);
    expect(renderMarkdown(report)).toContain("Stopped by the budget ledger");
  });

  it("records the worst case for a failed call whose billing is unknown", async () => {
    const file = ledgerFile();
    const model: VisionModel = { extract: async () => Promise.reject(new ModelCallError("timeout", null)) };
    const report = await runEvaluation(options({ dryRun: false, modelFor: () => model, ledger: createBudgetLedger(fileLedgerStore(file)) }));
    expect(report.photoErrors).toHaveLength(3);
    expect(fileLedgerStore(file).read().entries.map((e) => e.costEur)).toEqual([
      worstCaseCostUsd(),
      worstCaseCostUsd(),
      worstCaseCostUsd(),
    ]);
  });

  it("records nothing for an unbilled 4xx refusal", async () => {
    const file = ledgerFile();
    const model: VisionModel = { extract: async () => Promise.reject(new ModelCallError("HTTP 401", 401)) };
    await runEvaluation(options({ dryRun: false, modelFor: () => model, ledger: createBudgetLedger(fileLedgerStore(file)) }));
    expect(fileLedgerStore(file).read().entries.every((e) => e.costEur === 0)).toBe(true);
  });
});

describe("metrics", () => {
  const exact = (id: string) => ({
    extracted: { name: null, collectorNumber: null, setOfficialCount: null, setCodeHint: null, hp: null, language: null, regulationMark: null, finishHint: null, bbox: null, modelConfidence: 1 },
    tier: "exact" as const,
    matches: [{ printing: { ...recordedPrinting("en", "swsh3-20"), id }, score: 1, reasons: [] }],
  });

  it("counts a duplicate exact card as correct only once per expected copy", () => {
    const score = scorePhoto({
      photo: "p",
      mode: "batch",
      expected: ["tcgdex:en:swsh3-20"],
      cards: [exact("tcgdex:en:swsh3-20"), exact("tcgdex:en:swsh3-20")],
      latencyMs: 1,
      costEur: 0,
    });
    expect([score.correct, score.wrongMatch, score.missed]).toEqual([1, 1, []]);
  });

  it("uses nearest-rank percentiles and ignores failed photos for latency", () => {
    expect(percentile([], 50)).toBe(0);
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile(Array.from({ length: 20 }, (_, i) => i + 1), 95)).toBe(19);
    const { metrics } = computeMetrics([
      { photo: "a", mode: "batch", expected: [], cards: [], latencyMs: 100, costEur: 0.01 },
      { photo: "b", mode: "batch", expected: [], cards: [], latencyMs: 0, costEur: 0.02, error: "x" },
    ]);
    expect(metrics.latencyP50Ms).toBe(100);
    expect(metrics.costPerPhotoEur).toBeCloseTo(0.015);
    expect(metrics.photosFailed).toBe(1);
  });
});

describe("manifest", () => {
  it("rejects printing ids that are not language-qualified", () => {
    const file = join(mkdtempSync(join(tmpdir(), "manifest-")), "manifest.json");
    const bad: Omit<LoadedManifest, "file"> = {
      name: "x",
      description: "",
      synthetic: true,
      photos: [{ id: "a", path: "a.jpg", mode: "batch", expected: ["swsh3-20"] }],
    };
    writeFileSync(file, JSON.stringify(bad));
    expect(() => loadManifest(file)).toThrow(/invalid/);
  });
});
