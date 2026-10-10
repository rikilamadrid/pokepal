import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUDGET_CAP_EUR,
  BudgetExceededError,
  createBudgetLedger,
  emptyLedger,
  fileLedgerStore,
  memoryLedgerStore,
  type LedgerEntry,
} from "../../evals/recognition/ledger";

const entry = (costEur: number, photo = "p1"): LedgerEntry => ({
  at: "2026-10-10T12:00:00.000Z",
  runId: "run-1",
  photo,
  inputTokens: 1000,
  outputTokens: 100,
  costEur,
});

describe("budget ledger", () => {
  it("caps total spend at €5", () => {
    expect(BUDGET_CAP_EUR).toBe(5);
    const ledger = createBudgetLedger(memoryLedgerStore());
    expect(ledger.capEur()).toBe(5);
    expect(ledger.remainingEur()).toBe(5);
  });

  it("refuses to start when one worst-case call no longer fits", () => {
    const ledger = createBudgetLedger(memoryLedgerStore({ capEur: 5, entries: [entry(4.99)] }));
    expect(() => ledger.assertCanStart(0.02)).toThrow(BudgetExceededError);
    expect(() => ledger.assertCanStart(0.02)).toThrow(/refuses to start/);
    expect(() => ledger.assertCanStart(0.01)).not.toThrow();
  });

  it("refuses to start once the budget is spent", () => {
    const ledger = createBudgetLedger(memoryLedgerStore({ capEur: 5, entries: [entry(5)] }));
    expect(() => ledger.assertCanStart(0)).not.toThrow();
    expect(() => ledger.assertCanStart(0.000001)).toThrow(BudgetExceededError);
  });

  it("refuses to continue past the cap as spend is recorded", () => {
    const ledger = createBudgetLedger(memoryLedgerStore({ capEur: 5, entries: [entry(4.95)] }));
    ledger.assertCanSpend(0.02);
    ledger.record(entry(0.02, "p2"));
    ledger.assertCanSpend(0.02);
    ledger.record(entry(0.02, "p3"));
    expect(() => ledger.assertCanSpend(0.02)).toThrow(/refuses to continue/);
    expect(ledger.spentEur()).toBeCloseTo(4.99, 6);
  });

  it("cannot be raised above €5 by editing the file", () => {
    const ledger = createBudgetLedger(memoryLedgerStore({ capEur: 50, entries: [entry(4.99)] }));
    expect(ledger.capEur()).toBe(5);
    expect(() => ledger.assertCanSpend(0.02)).toThrow(BudgetExceededError);
  });

  it("recomputes spend from entries and rejects bad entries and bad estimates", () => {
    const ledger = createBudgetLedger(memoryLedgerStore());
    expect(() => ledger.record(entry(-1))).toThrow();
    expect(() => ledger.assertCanSpend(Number.NaN)).toThrow(RangeError);
    ledger.record(entry(0.25));
    ledger.record(entry(0.5));
    expect(ledger.spentEur()).toBe(0.75);
  });

  it("persists every recorded call to the file immediately", () => {
    const file = join(mkdtempSync(join(tmpdir(), "ledger-")), "budget-ledger.json");
    writeFileSync(file, JSON.stringify(emptyLedger()));
    createBudgetLedger(fileLedgerStore(file)).record(entry(0.01));
    const reopened = createBudgetLedger(fileLedgerStore(file));
    expect(reopened.spentEur()).toBe(0.01);
    expect(JSON.parse(readFileSync(file, "utf8")).entries).toHaveLength(1);
  });

  it("treats a malformed ledger file as an error, never as a fresh budget", () => {
    const file = join(mkdtempSync(join(tmpdir(), "ledger-")), "budget-ledger.json");
    writeFileSync(file, JSON.stringify({ capEur: 5 }));
    expect(() => createBudgetLedger(fileLedgerStore(file)).spentEur()).toThrow(/malformed/);
  });

  it("the tracked ledger starts the €5 budget unspent", () => {
    const tracked = fileLedgerStore(new URL("../../evals/recognition/budget-ledger.json", import.meta.url).pathname);
    expect(tracked.read()).toEqual({ capEur: 5, entries: [] });
  });
});
