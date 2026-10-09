import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CatalogFetch } from "@/lib/catalog/provider";

const FIXTURE_DIR = fileURLToPath(new URL("../fixtures/tcgdex", import.meta.url));

/** Recorded response file for a TCGdex path: `?` becomes `__`. */
export function fixturePath(path: string): string {
  return join(FIXTURE_DIR, `${path.replace(/^\//, "").replace("?", "__")}.json`);
}

/** Raw recorded TCGdex response (a recorded 404 is `null`). */
export function loadFixture(path: string): unknown {
  return JSON.parse(readFileSync(fixturePath(path), "utf8"));
}

/**
 * Offline transport over the recorded responses. An unrecorded path throws, so
 * a test can never pass by silently hitting a missing fixture.
 */
export function createFixtureFetch(requested: string[] = []): CatalogFetch {
  return async (path) => {
    requested.push(path);
    if (!existsSync(fixturePath(path))) throw new Error(`No TCGdex fixture for ${path}`);
    return loadFixture(path);
  };
}
