import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createTcgdexProvider } from "@/lib/catalog/tcgdex";
import { createAnthropicModel } from "../../supabase/functions/recognize-cards/model";
import { createMemoryCatalog } from "../../test/helpers/memory-catalog";
import { createRecordedModel, runEvaluation } from "./harness";
import { BudgetExceededError, createBudgetLedger, fileLedgerStore, memoryLedgerStore } from "./ledger";
import { loadManifest } from "./manifest";
import { displayPath, writeReport } from "./report";

/**
 * Recognition evaluation CLI.
 *
 *   npm run eval:recognition                      dry run over the synthetic fixture
 *   npm run eval:recognition -- --manifest <file> dry run over another manifest
 *   npm run eval:recognition -- --live --spend-limit-confirmed --manifest <file>
 *
 * A dry run calls no model and no network: recorded readings are replayed and
 * the catalog is the offline recorded one. The budget ledger is read but never
 * written.
 *
 * A live run is a human gate (paid calls). It needs `ANTHROPIC_API_KEY` in the
 * environment and `--spend-limit-confirmed`, which states that the human has
 * confirmed a spend limit on the API account. The ledger in
 * `budget-ledger.json` caps total spend at €5 across all runs.
 */

const HERE = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_MANIFEST = `${HERE}fixtures/dry-run/manifest.json`;
const LEDGER_FILE = `${HERE}budget-ledger.json`;
const REPORTS_DIR = `${HERE}reports`;

function runIdFor(dryRun: boolean, date: Date): string {
  return `${date.toISOString().replace(/[:.]/g, "-")}-${dryRun ? "dry-run" : "live"}`;
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      manifest: { type: "string", default: DEFAULT_MANIFEST },
      live: { type: "boolean", default: false },
      "spend-limit-confirmed": { type: "boolean", default: false },
      reports: { type: "string", default: REPORTS_DIR },
    },
  });
  const dryRun = !values.live;
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  if (!dryRun && (!apiKey || !values["spend-limit-confirmed"])) {
    console.error(
      "A live run makes paid model calls. It needs ANTHROPIC_API_KEY and --spend-limit-confirmed " +
        "(the human has confirmed an account spend limit). Nothing was called.",
    );
    return 2;
  }

  const manifest = loadManifest(values.manifest);
  const fileStore = fileLedgerStore(LEDGER_FILE);
  const ledger = createBudgetLedger(dryRun ? memoryLedgerStore(fileStore.read()) : fileStore);
  const paid = dryRun ? null : createAnthropicModel({ apiKey });
  const runId = runIdFor(dryRun, new Date());

  try {
    const report = await runEvaluation({
      manifest,
      modelFor: (photo) => paid ?? createRecordedModel(photo),
      catalog: dryRun ? createMemoryCatalog() : createTcgdexProvider(),
      ledger,
      dryRun,
      runId,
      progress: (line) => console.log(line),
    });
    const files = writeReport(report, values.reports);
    console.log(`${report.status}: ${report.evaluatedPhotos}/${report.manifest.photos} photos`);
    console.log(`Report: ${displayPath(files.markdown)}`);
    return 0;
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      console.error(error.message);
      return 3;
    }
    throw error;
  }
}

main().then((code) => {
  process.exitCode = code;
});
