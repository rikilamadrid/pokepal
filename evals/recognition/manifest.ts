import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { z } from "zod";
import type { ImageMediaType } from "../../supabase/functions/recognize-cards/prompt";

/**
 * A labelled fixture: photos with the exact printings they show. Real accuracy
 * needs real photos labelled by the human (ticket 19.3). A manifest marked
 * `synthetic` only drives the pipeline; its numbers are never accuracy.
 */

const photoSchema = z.strictObject({
  id: z.string().min(1),
  /** Photo file, relative to the manifest. */
  path: z.string().min(1),
  mode: z.enum(["batch", "trade-check"]).default("batch"),
  /** Language-qualified printing ids of the cards in the photo, e.g. "tcgdex:en:swsh3-20". */
  expected: z.array(z.string().regex(/^tcgdex:(en|es|ja):\S+$/)),
  /** Dry runs only: the tool input a model would return, replayed instead of a paid call. */
  recordedCards: z.array(z.unknown()).optional(),
});

const manifestSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string(),
  synthetic: z.boolean(),
  photos: z.array(photoSchema).min(1),
});

export type ManifestPhoto = z.infer<typeof photoSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

export interface LoadedManifest extends Manifest {
  /** Absolute manifest path. */
  file: string;
}

export function loadManifest(file: string): LoadedManifest {
  const absolute = resolve(file);
  const parsed = manifestSchema.safeParse(JSON.parse(readFileSync(absolute, "utf8")));
  if (!parsed.success) throw new Error(`Manifest ${file} is invalid: ${parsed.error.message}`);
  const ids = parsed.data.photos.map((p) => p.id);
  if (new Set(ids).size !== ids.length) throw new Error(`Manifest ${file} repeats a photo id`);
  return { ...parsed.data, file: absolute };
}

const MEDIA_TYPES: Readonly<Record<string, ImageMediaType>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function photoFile(manifest: LoadedManifest, photo: ManifestPhoto): string {
  return resolve(dirname(manifest.file), photo.path);
}

export function mediaTypeFor(path: string): ImageMediaType {
  const type = MEDIA_TYPES[extname(path).toLowerCase()];
  if (!type) throw new Error(`Unsupported photo type: ${path}`);
  return type;
}
