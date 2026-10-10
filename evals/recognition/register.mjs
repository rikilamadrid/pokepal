// Lets plain Node (with built-in TypeScript type stripping) run the harness:
// resolves the project's "@/" alias to src/ and extensionless relative imports
// to .ts files, the same resolution Vitest and the Edge Runtime use.
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const SRC = new URL("../../src/", import.meta.url);
const HAS_EXTENSION = /\.(?:[cm]?[jt]s|json)$/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = specifier.startsWith("@/") ? new URL(specifier.slice(2), SRC).href : specifier;
    const local = target.startsWith(".") || target.startsWith("file:");
    if (local && !HAS_EXTENSION.test(target) && context.parentURL) {
      const base = new URL(target, context.parentURL).href;
      const found = [`${base}.ts`, `${base}/index.ts`].find((url) => existsSync(fileURLToPath(url)));
      if (found) target = found;
    }
    return nextResolve(target, context);
  },
});
