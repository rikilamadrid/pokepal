/**
 * Image-data guard shared by the recognition client and the `recognize-cards`
 * Edge Function: recognition results must never carry image bytes, crops or
 * data URIs.
 */

/** Base64 openings of JPEG, PNG, GIF and WebP files. */
const IMAGE_BASE64_MAGIC = /\/9j\/|iVBORw0KGgo|R0lGOD|UklGR/;
/** An unbroken base64 run this long is encoded bytes, not card text. */
const BASE64_RUN = /[A-Za-z0-9+/=_-]{120,}/;

/** True if a string looks like image bytes: a data URI, image base64, or a long base64 run. */
export function looksLikeImageData(value: string): boolean {
  return /^\s*data:/i.test(value) || IMAGE_BASE64_MAGIC.test(value) || BASE64_RUN.test(value);
}

/** True if any string inside `value` looks like inline image data. */
export function containsInlineData(value: unknown): boolean {
  if (typeof value === "string") return looksLikeImageData(value);
  if (Array.isArray(value)) return value.some(containsInlineData);
  if (value !== null && typeof value === "object") {
    return Object.values(value).some(containsInlineData);
  }
  return false;
}
