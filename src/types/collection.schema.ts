import { z } from "zod";
import { cardFinishSchema } from "@/types/catalog.schema";
import type {
  AcquisitionSource,
  OwnedCard,
  OwnershipSummary,
  StorageLocation,
} from "@/types/collection";

/** Zod schemas for the collection contract in `collection.ts`. */

const isoDateTime = z.iso.datetime({ offset: true });

export const ACQUISITION_SOURCES = [
  "scan",
  "manual",
  "trade",
  "legacy-migration",
] as const satisfies readonly AcquisitionSource[];

export const acquisitionSourceSchema: z.ZodType<AcquisitionSource> =
  z.enum(ACQUISITION_SOURCES);

export const ownedCardSchema: z.ZodType<OwnedCard> = z.strictObject({
  id: z.uuid(),
  ownerId: z.string(),
  printingId: z.string().min(1),
  finish: cardFinishSchema.nullable(),
  favorite: z.boolean(),
  source: acquisitionSourceSchema,
  acquiredAt: isoDateTime,
  storageLocationId: z.string().nullable(),
  updatedAt: isoDateTime,
});

export const storageLocationSchema: z.ZodType<StorageLocation> =
  z.strictObject({
    id: z.string().min(1),
    ownerId: z.string(),
    kind: z.enum(["album", "tin", "box", "deck"]),
    name: z.string().min(1),
    updatedAt: isoDateTime,
  });

export const ownershipSummarySchema: z.ZodType<OwnershipSummary> =
  z.strictObject({
    printingId: z.string().min(1),
    copies: z.number().int().nonnegative(),
    finishes: z.partialRecord(cardFinishSchema, z.number().int().nonnegative()),
  });
