import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { PhotoScore, RunMetrics } from "./metrics";

/** Everything a report states, in one serializable record. */
export interface EvalReport {
  runId: string;
  dryRun: boolean;
  status: "complete" | "budget-stopped";
  model: string;
  startedAt: string;
  manifest: { name: string; path: string; synthetic: boolean; photos: number };
  /** Photos evaluated before the run ended (all of them unless budget-stopped). */
  evaluatedPhotos: number;
  ledger: { capEur: number; spentBeforeEur: number; spentAfterEur: number };
  metrics: RunMetrics;
  scores: PhotoScore[];
  photoErrors: { photo: string; error: string }[];
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const eur = (x: number) => `€${x.toFixed(4)}`;

export function renderMarkdown(report: EvalReport): string {
  const { metrics: m } = report;
  const banner = report.dryRun
    ? "> **Dry run.** No model was called; recorded readings were replayed. These numbers check the pipeline and are **not** accuracy.\n"
    : report.manifest.synthetic
      ? "> **Synthetic fixture.** These photos are not real cards; the numbers are **not** accuracy.\n"
      : "";
  const stopped =
    report.status === "budget-stopped"
      ? `> **Stopped by the budget ledger** after ${report.evaluatedPhotos} of ${report.manifest.photos} photos.\n`
      : "";
  const rows = report.scores
    .map(
      (s) =>
        `| ${s.photo} | ${s.expected} | ${s.cards} | ${s.correct} | ${s.wrongMatch} | ${s.ambiguous} (${s.ambiguousWithTruth}) | ${s.unmatched} | ${s.failed} | ${s.missed.join(", ") || "—"} |`,
    )
    .join("\n");
  const errors = report.photoErrors.map((e) => `- ${e.photo}: ${e.error}`).join("\n");
  return `# Recognition evaluation — ${report.runId}

${banner}${stopped}
- Model: \`${report.model}\`${report.dryRun ? " (not called)" : ""}
- Started: ${report.startedAt}
- Fixture: **${report.manifest.name}** (\`${report.manifest.path}\`), ${report.manifest.photos} photos, synthetic: ${report.manifest.synthetic}
- Budget: ${eur(report.ledger.spentBeforeEur)} → ${eur(report.ledger.spentAfterEur)} of €${report.ledger.capEur.toFixed(2)}

## Results

| Metric | Value |
| --- | --- |
| Photos evaluated (failed) | ${m.photos} (${m.photosFailed}) |
| Expected cards / returned cards | ${m.expectedCards} / ${m.returnedCards} |
| Exact-printing accuracy | ${pct(m.exactAccuracy)} |
| Wrong-match rate (confident, incorrect) | ${pct(m.wrongMatchRate)} |
| Ambiguity rate (truth in shortlist) | ${pct(m.ambiguityRate)} (${pct(m.ambiguousWithTruthRate)}) |
| Unmatched rate | ${pct(m.unmatchedRate)} |
| Latency p50 / p95 | ${Math.round(m.latencyP50Ms)} ms / ${Math.round(m.latencyP95Ms)} ms |
| Cost per photo | ${eur(m.costPerPhotoEur)} |
| Total cost | ${eur(m.totalCostEur)} |

Accuracy is over expected cards; the other rates are over returned cards.

## Per photo

| Photo | Expected | Cards | Correct | Wrong match | Ambiguous (truth) | Unmatched | Failed | Missed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}
${errors ? `\n## Photo errors\n\n${errors}\n` : ""}`;
}

/** Write `<runId>.md` and `<runId>.json` into `dir`; returns their paths. */
export function writeReport(report: EvalReport, dir: string): { markdown: string; json: string } {
  mkdirSync(dir, { recursive: true });
  const markdown = join(dir, `${report.runId}.md`);
  const json = join(dir, `${report.runId}.json`);
  writeFileSync(markdown, renderMarkdown(report));
  writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`);
  return { markdown, json };
}

export function displayPath(path: string): string {
  return relative(process.cwd(), path) || path;
}
