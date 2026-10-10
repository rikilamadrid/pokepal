import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { z } from "zod";

/**
 * Budget ledger for paid recognition calls. The evaluation budget is €5 in
 * total, across every run (decision D2), so spend persists in a tracked file
 * (`budget-ledger.json`) and each billed call is written before the next one
 * starts.
 *
 * The ledger refuses to start a run, and refuses each further call, when the
 * worst case of one more call would take total spend past the cap.
 */

export const BUDGET_CAP_EUR = 5;
/**
 * Prices are in USD. Counting 1 USD as 1 EUR overstates spend (a dollar is
 * worth less than a euro), so the cap is reached early rather than late.
 */
export const EUR_PER_USD = 1;

export function usdToEur(usd: number): number {
  return usd * EUR_PER_USD;
}

const entrySchema = z.strictObject({
  at: z.iso.datetime({ offset: true }),
  runId: z.string().min(1),
  photo: z.string().min(1),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  costEur: z.number().nonnegative(),
});

const stateSchema = z.strictObject({
  capEur: z.number().positive(),
  entries: z.array(entrySchema),
});

export type LedgerEntry = z.infer<typeof entrySchema>;
export type LedgerState = z.infer<typeof stateSchema>;

export interface LedgerStore {
  read(): LedgerState;
  write(state: LedgerState): void;
}

/** A paid call was refused because it could take spend past the cap. */
export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

export function emptyLedger(): LedgerState {
  return { capEur: BUDGET_CAP_EUR, entries: [] };
}

/** The tracked ledger file. A missing or malformed file is an error, never a fresh budget. */
export function fileLedgerStore(path: string): LedgerStore {
  return {
    read() {
      const parsed = stateSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
      if (!parsed.success) throw new Error(`Budget ledger ${path} is malformed: ${parsed.error.message}`);
      return parsed.data;
    },
    write(state) {
      const temp = `${path}.tmp`;
      writeFileSync(temp, `${JSON.stringify(state, null, 2)}\n`);
      renameSync(temp, path);
    },
  };
}

/** In-memory store, seeded from a snapshot (dry runs and tests). */
export function memoryLedgerStore(initial: LedgerState = emptyLedger()): LedgerStore & { state: LedgerState } {
  const store = {
    state: structuredClone(initial),
    read: () => structuredClone(store.state),
    write: (state: LedgerState) => {
      store.state = structuredClone(state);
    },
  };
  return store;
}

const round = (eur: number) => Math.round(eur * 1e6) / 1e6;

export interface BudgetLedger {
  /** The effective cap: the file's cap, never more than €5. */
  capEur(): number;
  /** Sum of every recorded call, recomputed from the entries. */
  spentEur(): number;
  remainingEur(): number;
  /** Refuse to start a run that cannot afford even one worst-case call. */
  assertCanStart(worstCaseEur: number): void;
  /** Refuse the next call unless its worst case still fits under the cap. */
  assertCanSpend(worstCaseEur: number): void;
  /** Record one billed call and persist it immediately. */
  record(entry: LedgerEntry): void;
}

export function createBudgetLedger(store: LedgerStore): BudgetLedger {
  const capEur = () => Math.min(store.read().capEur, BUDGET_CAP_EUR);
  const spentEur = () => round(store.read().entries.reduce((sum, e) => sum + e.costEur, 0));
  const remainingEur = () => round(capEur() - spentEur());
  const check = (worstCaseEur: number, what: string) => {
    if (!(worstCaseEur >= 0)) throw new RangeError("Worst-case cost must be a non-negative number");
    const remaining = remainingEur();
    if (worstCaseEur > remaining) {
      throw new BudgetExceededError(
        `Budget ledger refuses to ${what}: €${spentEur().toFixed(4)} of €${capEur().toFixed(2)} spent, ` +
          `€${remaining.toFixed(4)} left, next call could cost €${worstCaseEur.toFixed(4)}.`,
      );
    }
  };
  return {
    capEur,
    spentEur,
    remainingEur,
    assertCanStart: (worstCaseEur) => check(worstCaseEur, "start"),
    assertCanSpend: (worstCaseEur) => check(worstCaseEur, "continue"),
    record(entry) {
      const valid = entrySchema.parse(entry);
      const state = store.read();
      store.write({ ...state, entries: [...state.entries, valid] });
    },
  };
}
