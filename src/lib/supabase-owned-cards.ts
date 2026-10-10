import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { CardPrinting } from "@/types/catalog";
import type { OwnedCard } from "@/types/collection";
import { cardFinishSchema, cardPrintingSchema } from "@/types/catalog.schema";
import { acquisitionSourceSchema } from "@/types/collection.schema";
import { isStorablePrinting } from "@/lib/storage";

/** The PokéPal 2.0 table (additive; the legacy `cards` table is untouched). */
export const OWNED_CARDS_TABLE = "owned_cards";

/** Row shape of the Supabase `owned_cards` table (snake_case, matches Prisma). */
export interface OwnedCardRow {
  id: string;
  owner_id: string;
  printing_id: string;
  /** Printing snapshot so another device can render the copy offline. */
  printing: CardPrinting;
  finish: OwnedCard["finish"];
  favorite: boolean;
  source: OwnedCard["source"];
  acquired_at: string;
  storage_location_id: string | null;
  updated_at: string;
  deleted_at: string | null;
}

const isoDateTime = z.iso.datetime({ offset: true });

/**
 * Validates a row read from Supabase. The printing snapshot must match the row's
 * `printing_id` and carry no inline image data (photos are never collection assets).
 */
export const ownedCardRowSchema: z.ZodType<OwnedCardRow> = z
  .object({
    id: z.uuid(),
    owner_id: z.uuid(),
    printing_id: z.string().min(1),
    printing: cardPrintingSchema,
    finish: cardFinishSchema.nullable(),
    favorite: z.boolean(),
    source: acquisitionSourceSchema,
    acquired_at: isoDateTime,
    storage_location_id: z.string().nullable(),
    updated_at: isoDateTime,
    deleted_at: isoDateTime.nullable(),
  })
  .refine((row) => row.printing.id === row.printing_id, {
    message: "printing snapshot does not match printing_id",
    path: ["printing"],
  })
  .refine((row) => isStorablePrinting(row.printing), {
    message: "printing image must be a catalog URL, never inline image data",
    path: ["printing", "imageUrl"],
  });

/** Result of reading `owned_cards`: valid rows plus ids of rows that failed validation. */
export interface ParsedOwnedRows {
  rows: OwnedCardRow[];
  /**
   * Ids of rows this client cannot read (e.g. written by a newer app version).
   * They still exist in the cloud, so sync must not overwrite them.
   */
  unreadableIds: string[];
}

/** Read a row's `id` without trusting the rest of it. */
function readRowId(item: unknown): string | null {
  if (typeof item !== "object" || item === null) return null;
  const id = (item as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Keep only rows that validate. Invalid rows are skipped rather than failing the
 * whole sync, so one bad row never blocks the rest of the collection; their ids
 * are reported so the push side treats them as present.
 */
export function parseOwnedRows(data: readonly unknown[]): ParsedOwnedRows {
  const rows: OwnedCardRow[] = [];
  const unreadableIds: string[] = [];
  for (const item of data) {
    const result = ownedCardRowSchema.safeParse(item);
    if (result.success) {
      rows.push(result.data);
    } else {
      const id = readRowId(item);
      if (id) unreadableIds.push(id);
    }
  }
  return { rows, unreadableIds };
}

/** Map a DB row to the client `OwnedCard` (the printing snapshot is returned separately). */
export function rowToOwnedCard(row: OwnedCardRow): OwnedCard {
  return {
    id: row.id,
    ownerId: row.owner_id,
    printingId: row.printing_id,
    finish: row.finish,
    favorite: row.favorite,
    source: row.source,
    acquiredAt: row.acquired_at,
    storageLocationId: row.storage_location_id,
    updatedAt: row.updated_at,
  };
}

/** Map a client `OwnedCard` to a DB row, forcing `owner_id` to the signed-in user. */
export function ownedCardToRow(
  card: OwnedCard,
  ownerId: string,
  printing: CardPrinting,
): OwnedCardRow {
  return {
    id: card.id,
    owner_id: ownerId,
    printing_id: card.printingId,
    printing,
    finish: card.finish,
    favorite: card.favorite,
    source: card.source,
    acquired_at: card.acquiredAt,
    storage_location_id: card.storageLocationId,
    updated_at: card.updatedAt,
    deleted_at: null,
  };
}

/**
 * The `owned_cards` table does not exist on this Supabase project yet (its
 * migration is applied separately, gate D9). Sync skips quietly until it does.
 */
export class OwnedCardsUnavailableError extends Error {
  constructor() {
    super("owned_cards table is not available");
    this.name = "OwnedCardsUnavailableError";
  }
}

/** PostgREST "table not in schema cache" / Postgres "undefined table". */
const MISSING_TABLE_CODES = new Set(["PGRST205", "42P01"]);

/** Fetch every owned-card row of the user (incl. soft-deleted). RLS scopes to owner. */
export async function fetchOwnedRows(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<ParsedOwnedRows> {
  const { data, error } = await supabase
    .from(OWNED_CARDS_TABLE)
    .select("*")
    .eq("owner_id", ownerId);
  if (error) {
    if (MISSING_TABLE_CODES.has(error.code)) throw new OwnedCardsUnavailableError();
    throw error;
  }
  return parseOwnedRows(data ?? []);
}

/** Insert/update owned-card rows by primary key. */
export async function upsertOwnedRows(
  supabase: SupabaseClient,
  rows: OwnedCardRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from(OWNED_CARDS_TABLE).upsert(rows);
  if (error) throw error;
}

/** Soft-delete one of the user's rows (propagates a release to other devices). */
export async function markOwnedRowDeleted(
  supabase: SupabaseClient,
  ownerId: string,
  id: string,
  deletedAt: string,
): Promise<void> {
  const { error } = await supabase
    .from(OWNED_CARDS_TABLE)
    .update({ deleted_at: deletedAt, updated_at: deletedAt })
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (error) throw error;
}
