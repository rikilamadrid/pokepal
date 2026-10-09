import { describe, expect, it } from "vitest";
import { regionForDexNo } from "@/lib/catalog/regions";

describe("regionForDexNo", () => {
  it.each([
    [1, "kanto"],
    [6, "kanto"],
    [151, "kanto"],
    [152, "johto"],
    [251, "johto"],
    [252, "hoenn"],
    [387, "sinnoh"],
    [494, "unova"],
    [650, "kalos"],
    [722, "alola"],
    [809, "alola"],
    [810, "galar"],
    [898, "galar"],
    [899, "hisui"],
    [905, "hisui"],
    [906, "paldea"],
    [1025, "paldea"],
  ])("dex %i is %s", (dexNo, region) => {
    expect(regionForDexNo(dexNo)).toBe(region);
  });

  it.each([0, -1, 1026, 1.5, Number.NaN])("returns null for %s", (dexNo) => {
    expect(regionForDexNo(dexNo)).toBeNull();
  });
});
