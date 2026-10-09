import { describe, expect, it } from "vitest";
import { reconcile, type SyncPlan } from "@/lib/sync";
import type { Tombstones } from "@/lib/storage";
import type { CardRow } from "@/lib/supabase-cards";
import type { Card } from "@/types/card";

/**
 * Pins the CURRENT 1.x `reconcile` (src/lib/sync.ts on main): last-writer-wins
 * by parsed epoch, tombstones, resurrection, and remote soft-deletes.
 */

const OWNER = "6f1c2a9e-3b4d-4e5f-8a7b-9c0d1e2f3a4b";
const T1 = "2026-07-01T10:00:00.000Z";
const T2 = "2026-07-01T11:00:00.000Z";

function card(id: string, updatedAt: string, overrides: Partial<Card> = {}): Card {
  return {
    id,
    ownerId: OWNER,
    name: "Tidaltail",
    dexNo: "008",
    type: "water",
    rarity: "holo",
    favorite: false,
    img: "data:image/svg+xml;utf8,art",
    caughtAt: T1,
    updatedAt,
    ...overrides,
  };
}

function row(id: string, updatedAt: string, overrides: Partial<CardRow> = {}): CardRow {
  return {
    id,
    owner_id: OWNER,
    name: "Tidaltail",
    dex_no: "008",
    type: "water",
    rarity: "holo",
    favorite: false,
    img: "data:image/svg+xml;utf8,art",
    caught_at: T1,
    updated_at: updatedAt,
    deleted_at: null,
    ...overrides,
  };
}

function plan(partial: Partial<SyncPlan> = {}): SyncPlan {
  return {
    localUpsertRows: [],
    localDeletes: {},
    clearTombstones: [],
    pushCards: [],
    pushDeletes: [],
    ...partial,
  };
}

const NONE: Tombstones = {};

describe("reconcile — last-writer-wins (both live)", () => {
  it("pulls the remote row when it is newer", () => {
    const r = row("a", T2);
    expect(reconcile([card("a", T1)], NONE, [r])).toEqual(plan({ localUpsertRows: [r] }));
  });

  it("pushes the local card when it is newer", () => {
    const l = card("a", T2);
    expect(reconcile([l], NONE, [row("a", T1)])).toEqual(plan({ pushCards: [l] }));
  });

  it("does nothing when the timestamps are equal", () => {
    expect(reconcile([card("a", T1)], NONE, [row("a", T1)])).toEqual(plan());
  });

  it("decides on updatedAt only, even when content differs", () => {
    const l = card("a", T1, { favorite: true, name: "Renamed" });
    expect(reconcile([l], NONE, [row("a", T1)])).toEqual(plan());
  });
});

describe("reconcile — one side only", () => {
  it("inserts a cloud-only row locally", () => {
    const r = row("cloud", T1);
    expect(reconcile([], NONE, [r])).toEqual(plan({ localUpsertRows: [r] }));
  });

  it("pushes a local-only card to the cloud", () => {
    const l = card("local", T1);
    expect(reconcile([l], NONE, [])).toEqual(plan({ pushCards: [l] }));
  });

  it("returns an empty plan for empty inputs", () => {
    expect(reconcile([], NONE, [])).toEqual(plan());
  });
});

describe("reconcile — ISO format differences", () => {
  it("treats Postgres microsecond +00:00 and local Z as the same instant", () => {
    const local = card("a", "2026-07-01T21:23:13.123Z");
    const remote = row("a", "2026-07-01T21:23:13.123456+00:00");
    expect(reconcile([local], NONE, [remote])).toEqual(plan());
  });

  it("compares numerically where lexicographic order would disagree", () => {
    // Remote string sorts after local, but 23:23:13+02:00 is 21:23:13Z — older.
    const local = card("a", "2026-07-01T21:23:14.000Z");
    const remote = row("a", "2026-07-01T23:23:13+02:00");
    expect(reconcile([local], NONE, [remote])).toEqual(plan({ pushCards: [local] }));
  });

  it("pulls a remote row whose offset form is numerically newer", () => {
    const remote = row("a", "2026-07-01T21:23:15.5+00:00");
    expect(reconcile([card("a", "2026-07-01T21:23:15.499Z")], NONE, [remote])).toEqual(
      plan({ localUpsertRows: [remote] }),
    );
  });

  it("pins current behavior: an unparseable timestamp makes both sides a no-op", () => {
    expect(reconcile([card("a", T1)], NONE, [row("a", "garbage")])).toEqual(plan());
  });
});

describe("reconcile — local tombstones", () => {
  it("pushes the soft-delete when the remote row is older than the tombstone", () => {
    expect(reconcile([], { a: T2 }, [row("a", T1)])).toEqual(
      plan({ pushDeletes: [{ id: "a", deletedAt: T2 }] }),
    );
  });

  it("pushes the soft-delete when the remote row has the same timestamp", () => {
    expect(reconcile([], { a: T1 }, [row("a", T1)])).toEqual(
      plan({ pushDeletes: [{ id: "a", deletedAt: T1 }] }),
    );
  });

  it("resurrects locally when the remote edit post-dates the local delete", () => {
    const r = row("a", T2);
    expect(reconcile([], { a: T1 }, [r])).toEqual(
      plan({ localUpsertRows: [r], clearTombstones: ["a"] }),
    );
  });

  it("does nothing (keeps the tombstone) when the remote row is already deleted", () => {
    expect(reconcile([], { a: T1 }, [row("a", T2, { deleted_at: T2 })])).toEqual(plan());
  });

  it("does nothing (keeps the tombstone) for a card that never reached the cloud", () => {
    expect(reconcile([], { a: T1 }, [])).toEqual(plan());
  });

  it("lets the tombstone win over a live local copy with the same id", () => {
    expect(reconcile([card("a", T2)], { a: T1 }, [])).toEqual(plan());
  });
});

describe("reconcile — remote soft-deletes", () => {
  it("accepts a remote delete for a card absent locally, tombstoning at updated_at", () => {
    expect(reconcile([], NONE, [row("a", T2, { deleted_at: T2 })])).toEqual(
      plan({ localDeletes: { a: T2 } }),
    );
  });

  it("accepts a remote delete newer than the local edit", () => {
    expect(reconcile([card("a", T1)], NONE, [row("a", T2, { deleted_at: T2 })])).toEqual(
      plan({ localDeletes: { a: T2 } }),
    );
  });

  it("accepts a remote delete with the same timestamp as the local edit", () => {
    expect(reconcile([card("a", T1)], NONE, [row("a", T1, { deleted_at: T1 })])).toEqual(
      plan({ localDeletes: { a: T1 } }),
    );
  });

  it("resurrects remotely when the local edit is newer than the remote delete", () => {
    const l = card("a", T2);
    expect(reconcile([l], NONE, [row("a", T1, { deleted_at: T1 })])).toEqual(
      plan({ pushCards: [l] }),
    );
  });

  it("uses updated_at, not deleted_at, as the delete's timestamp", () => {
    expect(
      reconcile([], NONE, [row("a", T1, { deleted_at: "2026-07-05T00:00:00.000Z" })]),
    ).toEqual(plan({ localDeletes: { a: T1 } }));
  });
});

describe("reconcile — purity", () => {
  it("does not mutate its inputs and is deterministic", () => {
    const local = [card("a", T2), card("b", T1)];
    const tombs: Tombstones = { c: T1 };
    const remote = [row("a", T1), row("c", T2), row("d", T1, { deleted_at: T1 })];
    const snapshot = JSON.stringify([local, tombs, remote]);

    const first = reconcile(local, tombs, remote);
    expect(reconcile(local, tombs, remote)).toEqual(first);
    expect(JSON.stringify([local, tombs, remote])).toBe(snapshot);
    expect(first).toEqual(
      plan({
        pushCards: [local[0], local[1]],
        localUpsertRows: [remote[1]],
        clearTombstones: ["c"],
        localDeletes: { d: T1 },
      }),
    );
  });
});

describe("reconcile — owner handling (documented finding, phase-16)", () => {
  // FINDING: reconcile never reads ownerId / owner_id. A local card stamped
  // with another account's id is planned for push like any other card; the
  // caller (useSync) rewrites owner_id on push. This is the known phase-16
  // cross-account owner issue. Pinned as current behavior, not endorsed.
  it("plans a push for a local card owned by a different account", () => {
    const foreign = card("a", T1, { ownerId: "other-account" });
    expect(reconcile([foreign], NONE, [])).toEqual(plan({ pushCards: [foreign] }));
  });

  it("pulls a remote row regardless of its owner_id", () => {
    const r = row("a", T2, { owner_id: "other-account" });
    expect(reconcile([card("a", T1)], NONE, [r])).toEqual(plan({ localUpsertRows: [r] }));
  });
});
