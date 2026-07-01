import type { CardType } from "@/types/card";
import { TYPE_GRADIENTS } from "@/lib/type-gradients";

/** Small deterministic string hash (FNV-1a-ish). Stable across reloads. */
function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // force unsigned
  return h >>> 0;
}

/** Three blob body silhouettes on a 0..200 viewBox. */
const BLOB_PATHS = [
  "M100 30c34 0 62 22 62 58 0 26-8 44-26 60-14 12-22 22-36 22s-22-10-36-22c-18-16-26-34-26-60 0-36 28-58 62-58Z",
  "M100 26c40 0 66 30 66 66 0 30-14 48-34 62-10 7-20 16-32 16s-22-9-32-16c-20-14-34-32-34-62 0-36 26-66 66-66Z",
  "M100 34c30 0 54 18 62 46 4 14 4 26 0 40-6 22-20 40-38 52-8 5-16 10-24 10s-16-5-24-10c-18-12-32-30-38-52-4-14-4-26 0-40 8-28 32-46 62-46Z",
];

/**
 * Deterministic generated creature SVG for a card, encoded as a data URI.
 * Same `name + dexNo` always yields the same creature — no extra stored fields.
 * The hash selects one of three blob bodies, varies the eye offset, and the
 * type gradient fills the body.
 */
export function generateCreatureArt(
  name: string,
  dexNo: string,
  type: CardType,
): string {
  const h = hashString(`${name}#${dexNo}`);
  const { from, to } = TYPE_GRADIENTS[type];

  const blob = BLOB_PATHS[h % BLOB_PATHS.length];
  // eye horizontal spread 22..34, slight vertical wobble -4..+4
  const eyeSpread = 22 + (h % 13);
  const eyeY = 92 + (((h >> 4) % 9) - 4);
  const gradId = `g${h.toString(36)}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0.4" y2="1">
<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
</linearGradient></defs>
<path d="${blob}" fill="url(#${gradId})"/>
<circle cx="${100 - eyeSpread}" cy="${eyeY}" r="9" fill="#1b1c22"/>
<circle cx="${100 + eyeSpread}" cy="${eyeY}" r="9" fill="#1b1c22"/>
<circle cx="${100 - eyeSpread + 3}" cy="${eyeY - 3}" r="3" fill="#fff"/>
<circle cx="${100 + eyeSpread + 3}" cy="${eyeY - 3}" r="3" fill="#fff"/>
<path d="M${100 - 16} ${eyeY + 22}q16 16 32 0" stroke="#1b1c22" stroke-width="5" stroke-linecap="round" fill="none"/>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
