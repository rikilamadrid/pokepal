import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateCreatureArt } from "@/lib/art-gen";
import {
  COLLECTION_KEY,
  TOMBSTONES_KEY,
  readCollection,
  readTombstones,
} from "@/lib/storage";

/**
 * Pins the CURRENT 1.x on-device format and its read-side normalization
 * (src/lib/storage.ts on main) so 2.0 work cannot silently change how an
 * existing collection loads. The fixture is a recorded 1.x `collection`
 * payload: valid seed/photo/synced cards plus the malformed rows the
 * normalizer repairs or drops.
 */

const FIXTURE = fileURLToPath(new URL("../fixtures/legacy/collection-1x.json", import.meta.url));
const RAW_PAYLOAD = readFileSync(FIXTURE, "utf8");
const payload = JSON.parse(RAW_PAYLOAD) as Record<string, unknown>[];

const NOW = new Date("2026-10-09T12:00:00.000Z");

function installStorage(entries: Record<string, string> = {}): Map<string, string> {
  const store = new Map(Object.entries(entries));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  });
  return store;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("readCollection — recorded 1.x payload", () => {
  it("loads the recorded payload to the pinned normalized output", () => {
    installStorage({ [COLLECTION_KEY]: RAW_PAYLOAD });
    const cards = readCollection();

    expect(cards).toEqual([
      // Valid rows pass through field-for-field.
      payload[0],
      payload[1],
      payload[2],
      // Repaired row: trimmed, invalid enums/booleans/owner/dates/img defaulted.
      {
        id: "card-repair",
        ownerId: "",
        name: "Mossling",
        dexNo: "010",
        type: "water",
        rarity: "common",
        favorite: false,
        img: generateCreatureArt("Mossling", "010", "water"),
        caughtAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
      // Missing id → recovered-{Date.now()}-{index in the raw array}.
      { ...payload[10], id: `recovered-${NOW.getTime()}-10`, ownerId: "" },
      // Missing dexNo/rarity/favorite/img/updatedAt → defaults; updatedAt = caughtAt.
      {
        id: "card-no-updated",
        ownerId: "",
        name: "Pebblor",
        dexNo: "000",
        type: "rock",
        rarity: "common",
        favorite: false,
        img: generateCreatureArt("Pebblor", "000", "rock"),
        caughtAt: "2026-06-30T12:00:00.000Z",
        updatedAt: "2026-06-30T12:00:00.000Z",
      },
    ]);
  });

  it("keeps a captured photo data URI byte-for-byte", () => {
    installStorage({ [COLLECTION_KEY]: RAW_PAYLOAD });
    const photo = readCollection()?.find((c) => c.id === "card-1751400000000");
    expect(photo?.img).toBe(payload[1].img);
    expect(photo?.img.startsWith("data:image/jpeg;base64,")).toBe(true);
  });

  it("keeps generated SVG art and Storage URLs unchanged", () => {
    installStorage({ [COLLECTION_KEY]: RAW_PAYLOAD });
    const cards = readCollection() ?? [];
    expect(cards.find((c) => c.id === "seed-7")?.img).toBe(payload[0].img);
    expect(cards.find((c) => c.id === "card-1751410000000")?.img).toBe(payload[2].img);
  });

  it("keeps Postgres-format timestamps as their original strings", () => {
    installStorage({ [COLLECTION_KEY]: RAW_PAYLOAD });
    const synced = readCollection()?.find((c) => c.id === "card-1751410000000");
    expect(synced?.caughtAt).toBe("2026-07-01T22:46:40+00:00");
    expect(synced?.updatedAt).toBe("2026-07-01T22:46:40.123456+00:00");
  });

  it("drops non-objects, arrays, and rows without a non-blank name", () => {
    installStorage({ [COLLECTION_KEY]: RAW_PAYLOAD });
    const ids = (readCollection() ?? []).map((c) => c.id);
    expect(ids).toHaveLength(6);
    expect(ids).not.toContain("blank-name");
  });

  it("is read-only: the stored payload is not rewritten", () => {
    const store = installStorage({ [COLLECTION_KEY]: RAW_PAYLOAD });
    readCollection();
    expect(store.get(COLLECTION_KEY)).toBe(RAW_PAYLOAD);
  });
});

describe("readCollection — absent or unreadable", () => {
  it("returns null without a window (SSR)", () => {
    expect(readCollection()).toBeNull();
  });

  it.each([
    ["absent", undefined],
    ["empty string", ""],
    ["invalid JSON", "{not json"],
    ["a JSON object", '{"0":{"name":"x"}}'],
    ["a JSON string", '"collection"'],
    ["JSON null", "null"],
  ])("returns null when the payload is %s", (_label, raw) => {
    installStorage(raw === undefined ? {} : { [COLLECTION_KEY]: raw });
    expect(readCollection()).toBeNull();
  });

  it("returns an empty array (not null) for a stored empty array", () => {
    installStorage({ [COLLECTION_KEY]: "[]" });
    expect(readCollection()).toEqual([]);
  });

  it("returns null when localStorage access throws", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("SecurityError");
        },
      },
    });
    expect(readCollection()).toBeNull();
  });
});

describe("readTombstones — 1.x format", () => {
  it("keeps valid id → ISO entries and drops blank ids and bad dates", () => {
    installStorage({
      [TOMBSTONES_KEY]: JSON.stringify({
        "seed-3": "2026-07-01T10:00:00.000Z",
        "card-1751400000000": "2026-07-02T08:00:00+00:00",
        "   ": "2026-07-01T10:00:00.000Z",
        "card-bad-date": "yesterday",
        "card-number": 1751400000000,
      }),
    });
    expect(readTombstones()).toEqual({
      "seed-3": "2026-07-01T10:00:00.000Z",
      "card-1751400000000": "2026-07-02T08:00:00+00:00",
    });
  });

  it.each([
    ["absent", undefined],
    ["invalid JSON", "{"],
    ["an array", '["seed-1"]'],
  ])("returns {} when the payload is %s", (_label, raw) => {
    installStorage(raw === undefined ? {} : { [TOMBSTONES_KEY]: raw });
    expect(readTombstones()).toEqual({});
  });

  it("returns {} without a window (SSR)", () => {
    expect(readTombstones()).toEqual({});
  });
});
