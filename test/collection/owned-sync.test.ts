import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CardPrinting } from "@/types/catalog";
import type { OwnedCard } from "@/types/collection";
import { ownedCardSchema } from "@/types/collection.schema";
import { mapTcgdexCard } from "@/lib/catalog/tcgdex";
import { EMPTY_OWNED_STATE, type OwnedState } from "@/lib/owned-cards";
import {
  applyOwnedSync,
  buildPushRows,
  hasOwnedSyncChanges,
  reconcileOwnedCards,
  resetForOwner,
  toOwnedSyncChanges,
} from "@/lib/owned-sync";
import { runOwnedSyncRound } from "@/lib/owned-sync-round";
import {
  fetchOwnedRows,
  OwnedCardsUnavailableError,
  ownedCardToRow,
  parseOwnedRows,
  rowToOwnedCard,
  type OwnedCardRow,
} from "@/lib/supabase-owned-cards";
import { loadFixture } from "../helpers/tcgdex-fixtures";

const ALICE = "6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b";
const BOB = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const T1 = "2026-10-10T10:00:00.000Z";
const T2 = "2026-10-10T11:00:00.000Z";
const T3 = "2026-10-10T12:00:00.000Z";

const printing: CardPrinting = mapTcgdexCard(
  loadFixture("/en/cards/swsh3-20"),
  "en",
  "2026-10-09T12:00:00.000Z",
);

let seq = 0;
function uuid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

function copy(overrides: Partial<OwnedCard> = {}): OwnedCard {
  return {
    id: uuid(),
    ownerId: "",
    printingId: printing.id,
    finish: null,
    favorite: false,
    source: "scan",
    acquiredAt: T1,
    storageLocationId: null,
    updatedAt: T1,
    ...overrides,
  };
}

function row(card: OwnedCard, ownerId: string, overrides: Partial<OwnedCardRow> = {}): OwnedCardRow {
  return { ...ownedCardToRow(card, ownerId, printing), ...overrides };
}

function stateOf(owned: OwnedCard[], tombstones: Record<string, string> = {}): OwnedState {
  return { owned, printings: { [printing.id]: printing }, tombstones };
}

describe("row mappers", () => {
  it("round-trips an OwnedCard through a row, forcing owner_id", () => {
    const card = copy({ finish: "holo", favorite: true });
    const r = ownedCardToRow(card, ALICE, printing);
    expect(r.owner_id).toBe(ALICE);
    expect(r.printing).toEqual(printing);
    expect(r.deleted_at).toBeNull();
    expect(rowToOwnedCard(r)).toEqual({ ...card, ownerId: ALICE });
    expect(ownedCardSchema.safeParse(rowToOwnedCard(r)).success).toBe(true);
  });

  it("accepts Postgres timestamp formats and skips invalid rows", () => {
    const good = row(copy(), ALICE, { updated_at: "2026-10-10T10:00:00.123456+00:00" });
    const mismatch = row(copy(), ALICE, { printing_id: "tcgdex:en:other-1" });
    const inline = row(copy(), ALICE, {
      printing: { ...printing, imageUrl: "data:image/jpeg;base64,AAAA" },
    });
    const badSource = { ...row(copy(), ALICE), source: "stolen" };
    expect(parseOwnedRows([good, mismatch, inline, badSource, null, { id: 7 }])).toEqual({
      rows: [good],
      unreadableIds: [mismatch.id, inline.id, badSource.id],
    });
  });
});

describe("reconcileOwnedCards (LWW + tombstones)", () => {
  it("pushes local-only copies and pulls cloud-only rows", () => {
    const local = copy();
    const remote = row(copy(), ALICE);
    const plan = reconcileOwnedCards([local], {}, [remote], ALICE);
    expect(plan.pushCards).toEqual([local]);
    expect(plan.localUpsertRows).toEqual([remote]);
  });

  it("newer updatedAt wins in both directions; equal is in sync", () => {
    const a = copy({ ownerId: ALICE, updatedAt: T2 });
    const b = copy({ ownerId: ALICE, updatedAt: T1 });
    const c = copy({ ownerId: ALICE, updatedAt: T1 });
    const plan = reconcileOwnedCards(
      [a, b, c],
      {},
      [row(a, ALICE, { updated_at: T1 }), row(b, ALICE, { updated_at: T2 }), row(c, ALICE)],
      ALICE,
    );
    expect(plan.pushCards).toEqual([a]);
    expect(plan.localUpsertRows.map((r) => r.id)).toEqual([b.id]);
  });

  it("propagates a local release unless the remote edit is newer", () => {
    const released = copy({ ownerId: ALICE });
    const resurrected = copy({ ownerId: ALICE });
    const plan = reconcileOwnedCards(
      [],
      { [released.id]: T2, [resurrected.id]: T1 },
      [row(released, ALICE, { updated_at: T1 }), row(resurrected, ALICE, { updated_at: T2 })],
      ALICE,
    );
    expect(plan.pushDeletes).toEqual([{ id: released.id, deletedAt: T2 }]);
    expect(plan.clearTombstones).toEqual([resurrected.id]);
  });

  it("accepts a remote delete unless the local edit is newer", () => {
    const gone = copy({ ownerId: ALICE, updatedAt: T1 });
    const kept = copy({ ownerId: ALICE, updatedAt: T3 });
    const plan = reconcileOwnedCards(
      [gone, kept],
      {},
      [
        row(gone, ALICE, { updated_at: T2, deleted_at: T2 }),
        row(kept, ALICE, { updated_at: T2, deleted_at: T2 }),
      ],
      ALICE,
    );
    expect(plan.localDeletes).toEqual({ [gone.id]: T2 });
    expect(plan.pushCards).toEqual([kept]);
  });
});

describe("owner guard", () => {
  it("never pushes another user's copies, even with no remote row", () => {
    const alices = copy({ ownerId: ALICE });
    const unclaimed = copy();
    const plan = reconcileOwnedCards([alices, unclaimed], {}, [], BOB);
    expect(plan.pushCards).toEqual([unclaimed]);
  });

  it("buildPushRows drops foreign copies and stamps the signed-in owner", () => {
    const rows = buildPushRows(
      [copy({ ownerId: ALICE }), copy(), copy({ ownerId: BOB })],
      { [printing.id]: printing },
      BOB,
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.owner_id === BOB)).toBe(true);
  });

  it("buildPushRows keeps a copy local when its printing snapshot is missing", () => {
    expect(buildPushRows([copy()], {}, BOB)).toEqual([]);
  });

  it("ignores rows owned by someone else even if the server returned them", () => {
    const plan = reconcileOwnedCards([], {}, [row(copy(), ALICE)], BOB);
    expect(plan.localUpsertRows).toEqual([]);
  });

  it("account-change reset drops the previous owner's copies, keeps unclaimed work", () => {
    const alices = copy({ ownerId: ALICE });
    const bobs = copy({ ownerId: BOB });
    const unclaimed = copy();
    const state = stateOf([alices, bobs, unclaimed], { gone: T1 });
    const reset = resetForOwner(state, BOB);
    expect(reset.owned).toEqual([bobs, unclaimed]);
    expect(reset.tombstones).toEqual({ gone: T1 });
    expect(reset.printings).toBe(state.printings);
    expect(resetForOwner(reset, BOB)).toBe(reset);
  });

  it("first sign-in adopts a signed-out collection", () => {
    const local = [copy(), copy()];
    const plan = reconcileOwnedCards(local, {}, [], ALICE);
    const pushed = buildPushRows(plan.pushCards, { [printing.id]: printing }, ALICE);
    const next = applyOwnedSync(stateOf(local), toOwnedSyncChanges(plan, pushed, ALICE));
    expect(pushed).toHaveLength(2);
    expect(next.owned.every((c) => c.ownerId === ALICE)).toBe(true);
  });
});

describe("applyOwnedSync", () => {
  it("upserts, deletes with tombstones, clears tombstones, and caches printings", () => {
    const pulled = copy({ ownerId: ALICE, acquiredAt: T2 });
    const removed = copy({ ownerId: ALICE });
    const next = applyOwnedSync(
      { ...EMPTY_OWNED_STATE, owned: [removed], tombstones: { back: T1 } },
      {
        upsert: [pulled],
        printings: [printing],
        deletes: { [removed.id]: T2 },
        clearTombstones: ["back"],
        claimedIds: [],
        ownerId: ALICE,
      },
    );
    expect(next.owned).toEqual([pulled]);
    expect(next.tombstones).toEqual({ [removed.id]: T2 });
    expect(next.printings[printing.id]).toEqual(printing);
  });

  it("does not resurrect a copy released, or overwrite an edit made, during the sync", () => {
    const released = copy({ ownerId: ALICE });
    const edited = copy({ ownerId: ALICE, updatedAt: T3, favorite: true });
    const changes = {
      upsert: [released, { ...edited, updatedAt: T2, favorite: false }],
      printings: [],
      deletes: {},
      clearTombstones: [],
      claimedIds: [],
      ownerId: ALICE,
    };
    const next = applyOwnedSync(stateOf([edited], { [released.id]: T2 }), changes);
    expect(next.owned).toEqual([edited]);
  });

  it("claims only still-unclaimed pushed copies", () => {
    const unclaimed = copy();
    const later = copy();
    const changes = toOwnedSyncChanges(
      { localUpsertRows: [], localDeletes: {}, clearTombstones: [], pushCards: [], pushDeletes: [] },
      [row(unclaimed, ALICE)],
      ALICE,
    );
    expect(hasOwnedSyncChanges(changes)).toBe(true);
    const next = applyOwnedSync(stateOf([unclaimed, later]), changes);
    expect(next.owned.map((c) => c.ownerId)).toEqual([ALICE, ""]);
  });
});

/**
 * Two devices against an in-memory `owned_cards` table that enforces owner-only
 * access the way RLS does. Exercises the same pure functions useOwnedSync runs;
 * it does not replace the manual check against a real Supabase database.
 */
describe("two-session round trip (simulated RLS table)", () => {
  class FakeTable {
    rows = new Map<string, OwnedCardRow>();
    select(uid: string): OwnedCardRow[] {
      return [...this.rows.values()].filter((r) => r.owner_id === uid);
    }
    upsert(uid: string, rows: OwnedCardRow[]): void {
      for (const r of rows) {
        const existing = this.rows.get(r.id);
        if (r.owner_id !== uid || (existing && existing.owner_id !== uid)) {
          throw new Error("RLS violation");
        }
        this.rows.set(r.id, r);
      }
    }
    softDelete(uid: string, id: string, at: string): void {
      const r = this.rows.get(id);
      if (r && r.owner_id === uid) this.rows.set(id, { ...r, deleted_at: at, updated_at: at });
    }
  }

  function sync(table: FakeTable, state: OwnedState, uid: string): OwnedState {
    const current = resetForOwner(state, uid);
    const plan = reconcileOwnedCards(current.owned, current.tombstones, table.select(uid), uid);
    const pushed = buildPushRows(plan.pushCards, current.printings, uid);
    table.upsert(uid, pushed);
    for (const d of plan.pushDeletes) table.softDelete(uid, d.id, d.deletedAt);
    return applyOwnedSync(current, toOwnedSyncChanges(plan, pushed, uid));
  }

  it("round-trips add, favorite, and release between two devices", () => {
    const table = new FakeTable();
    const added = copy();
    let phone = sync(table, stateOf([added]), ALICE);
    let ipad = sync(table, EMPTY_OWNED_STATE, ALICE);
    expect(ipad.owned).toEqual([{ ...added, ownerId: ALICE }]);
    expect(ipad.printings[printing.id]).toEqual(printing);

    ipad = sync(
      table,
      { ...ipad, owned: ipad.owned.map((c) => ({ ...c, favorite: true, updatedAt: T2 })) },
      ALICE,
    );
    phone = sync(table, phone, ALICE);
    expect(phone.owned[0].favorite).toBe(true);

    phone = sync(table, { ...phone, owned: [], tombstones: { [added.id]: T3 } }, ALICE);
    ipad = sync(table, ipad, ALICE);
    expect(ipad.owned).toEqual([]);
    expect(ipad.tombstones[added.id]).toBe(T3);
  });

  it("a different user on the same device neither receives nor pushes the first user's copies", () => {
    const table = new FakeTable();
    const alicesCopy = copy();
    const device = sync(table, stateOf([alicesCopy]), ALICE);
    const bobsOwn = copy({ ownerId: BOB, id: uuid() });
    table.rows.set(bobsOwn.id, row(bobsOwn, BOB));

    // Alice signs out (local copies stay), Bob signs in on the same device.
    const asBob = sync(table, device, BOB);
    expect(asBob.owned.map((c) => c.id)).toEqual([bobsOwn.id]);
    expect(table.select(ALICE)).toEqual([row({ ...alicesCopy, ownerId: ALICE }, ALICE)]);
    expect(table.select(BOB).map((r) => r.id)).toEqual([bobsOwn.id]);
  });
});

describe("fetchOwnedRows", () => {
  function client(result: { data: unknown[] | null; error: { code: string } | null }): SupabaseClient {
    const query = { select: () => query, eq: () => Promise.resolve(result) };
    return { from: () => query } as unknown as SupabaseClient;
  }

  it("reports a project without the owned_cards table as unavailable", async () => {
    await expect(
      fetchOwnedRows(client({ data: null, error: { code: "PGRST205" } }), ALICE),
    ).rejects.toBeInstanceOf(OwnedCardsUnavailableError);
  });

  it("rethrows other errors and validates returned rows", async () => {
    await expect(
      fetchOwnedRows(client({ data: null, error: { code: "500" } }), ALICE),
    ).rejects.toEqual({ code: "500" });
    const good = row(copy(), ALICE);
    await expect(
      fetchOwnedRows(client({ data: [good, { id: "x" }], error: null }), ALICE),
    ).resolves.toEqual({ rows: [good], unreadableIds: ["x"] });
  });
});

/**
 * A row this client cannot validate (e.g. written by a newer app version with a
 * new printing field or finish value) still exists in the cloud. Its state is
 * unknown, so it must count as present: never overwrite or resurrect it.
 */
describe("unreadable remote rows", () => {
  function unreadable(card: OwnedCard, overrides: Partial<OwnedCardRow>): unknown {
    return { ...row(card, ALICE, overrides), finish: "galaxy-foil" };
  }

  it("a newer remote soft-delete it cannot read is not undone", () => {
    const local = copy({ ownerId: ALICE, updatedAt: T1 });
    const { rows, unreadableIds } = parseOwnedRows([
      unreadable(local, { updated_at: T3, deleted_at: T3 }),
    ]);
    expect(rows).toEqual([]);
    const plan = reconcileOwnedCards([local], {}, rows, ALICE, unreadableIds);
    expect(plan.pushCards).toEqual([]);
    expect(plan.pushDeletes).toEqual([]);
    expect(plan.localDeletes).toEqual({});
    expect(plan.localUpsertRows).toEqual([]);
  });

  it("a newer remote edit it cannot read is not overwritten", () => {
    const local = copy({ ownerId: ALICE, updatedAt: T1, favorite: false });
    const { rows, unreadableIds } = parseOwnedRows([
      unreadable(local, { updated_at: T3, favorite: true }),
    ]);
    const plan = reconcileOwnedCards([local], {}, rows, ALICE, unreadableIds);
    expect(plan.pushCards).toEqual([]);
    expect(buildPushRows(plan.pushCards, { [printing.id]: printing }, ALICE)).toEqual([]);
  });

  it("a local release of an unreadable row is not pushed", () => {
    const released = copy({ ownerId: ALICE });
    const { rows, unreadableIds } = parseOwnedRows([unreadable(released, { updated_at: T1 })]);
    const plan = reconcileOwnedCards([], { [released.id]: T2 }, rows, ALICE, unreadableIds);
    expect(plan.pushDeletes).toEqual([]);
  });

  it("valid rows in the same batch still reconcile normally", () => {
    const blocked = copy({ ownerId: ALICE, updatedAt: T1 });
    const newerLocal = copy({ ownerId: ALICE, updatedAt: T3 });
    const newerRemote = copy({ ownerId: ALICE, updatedAt: T1 });
    const released = copy({ ownerId: ALICE });
    const localOnly = copy();
    const { rows, unreadableIds } = parseOwnedRows([
      unreadable(blocked, { updated_at: T3, deleted_at: T3 }),
      row(newerLocal, ALICE, { updated_at: T1 }),
      row(newerRemote, ALICE, { updated_at: T2 }),
      row(released, ALICE, { updated_at: T1 }),
    ]);
    expect(unreadableIds).toEqual([blocked.id]);
    const plan = reconcileOwnedCards(
      [blocked, newerLocal, newerRemote, localOnly],
      { [released.id]: T2 },
      rows,
      ALICE,
      unreadableIds,
    );
    expect(plan.pushCards).toEqual([newerLocal, localOnly]);
    expect(plan.localUpsertRows.map((r) => r.id)).toEqual([newerRemote.id]);
    expect(plan.pushDeletes).toEqual([{ id: released.id, deletedAt: T2 }]);
  });
});

describe("runOwnedSyncRound (account switch mid-flight)", () => {
  interface Calls {
    upserts: OwnedCardRow[][];
    deletes: string[];
  }

  /** Fake client whose fetch resolves only when `release` is called. */
  function delayedClient(remote: unknown[]): {
    supabase: SupabaseClient;
    calls: Calls;
    release: () => void;
  } {
    const calls: Calls = { upserts: [], deletes: [] };
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ok = Promise.resolve({ error: null });
    const table = {
      select: () => ({
        eq: async () => {
          await gate;
          return { data: remote, error: null };
        },
      }),
      upsert: (rows: OwnedCardRow[]) => {
        calls.upserts.push(rows);
        return ok;
      },
      update: () => ({
        eq: (_col: string, id: string) => ({
          eq: () => {
            calls.deletes.push(id);
            return ok;
          },
        }),
      }),
    };
    return { supabase: { from: () => table } as unknown as SupabaseClient, calls, release };
  }

  it("stops without pushing or returning changes when the owner changed during the fetch", async () => {
    const unclaimed = copy();
    const { supabase, calls, release } = delayedClient([]);
    let signedIn = ALICE;
    const round = runOwnedSyncRound({
      supabase,
      ownerId: ALICE,
      state: stateOf([unclaimed]),
      isCurrentOwner: () => signedIn === ALICE,
    });
    signedIn = BOB;
    release();
    await expect(round).resolves.toBeNull();
    expect(calls.upserts).toEqual([]);
  });

  it("returns no changes when the owner changed during the push", async () => {
    const unclaimed = copy();
    const { supabase, calls, release } = delayedClient([]);
    let signedIn = ALICE;
    release();
    const round = runOwnedSyncRound({
      supabase,
      ownerId: ALICE,
      state: stateOf([unclaimed]),
      isCurrentOwner: () => {
        const current = signedIn === ALICE;
        // Flip after the fetch check, so the switch lands while upserting.
        if (calls.upserts.length === 0) return current;
        signedIn = BOB;
        return false;
      },
    });
    await expect(round).resolves.toBeNull();
    expect(calls.upserts).toHaveLength(1);
  });

  it("returns the local changes when the owner is unchanged", async () => {
    const unclaimed = copy();
    const released = copy({ ownerId: ALICE });
    const { supabase, calls, release } = delayedClient([row(released, ALICE, { updated_at: T1 })]);
    release();
    const changes = await runOwnedSyncRound({
      supabase,
      ownerId: ALICE,
      state: stateOf([unclaimed], { [released.id]: T2 }),
      isCurrentOwner: () => true,
    });
    expect(changes?.claimedIds).toEqual([unclaimed.id]);
    expect(calls.upserts[0].map((r) => r.owner_id)).toEqual([ALICE]);
    expect(calls.deletes).toEqual([released.id]);
  });
});
