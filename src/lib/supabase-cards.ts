import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, CardType, Rarity } from "@/types/card";

/** Row shape of the Supabase `cards` table (snake_case, matches Prisma schema). */
export interface CardRow {
  id: string;
  owner_id: string;
  name: string;
  dex_no: string;
  type: string;
  rarity: string;
  favorite: boolean;
  img: string;
  caught_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const CARD_IMAGE_BUCKET = "card-images";
/** Signed-URL lifetime for private card images (7 days). */
const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

/** Storage object path for a card's image, scoped to the owner's folder. */
export function imagePath(ownerId: string, cardId: string): string {
  return `${ownerId}/${cardId}.jpg`;
}

/** A locally-usable image value that never needs Storage resolution. */
function isInlineImage(img: string): boolean {
  return img.startsWith("data:") || img.startsWith("http");
}

/** Map a DB row to the client `Card` shape (img left raw; resolve separately). */
export function rowToCard(row: CardRow): Card {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    dexNo: row.dex_no,
    type: row.type as CardType,
    rarity: row.rarity as Rarity,
    favorite: row.favorite,
    img: row.img,
    caughtAt: row.caught_at,
    updatedAt: row.updated_at,
  };
}

/** Map a client `Card` to a DB row, forcing `owner_id` and the resolved `img`. */
export function cardToRow(card: Card, ownerId: string, img: string): CardRow {
  return {
    id: card.id,
    owner_id: ownerId,
    name: card.name,
    dex_no: card.dexNo,
    type: card.type,
    rarity: card.rarity,
    favorite: card.favorite,
    img,
    caught_at: card.caughtAt,
    updated_at: card.updatedAt,
    deleted_at: null,
  };
}

/** Fetch every row owned by the user (incl. soft-deleted). RLS scopes to owner. */
export async function fetchAllRows(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<CardRow[]> {
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .eq("owner_id", ownerId);
  if (error) throw error;
  return (data ?? []) as CardRow[];
}

/** Insert/update rows by primary key. */
export async function upsertRows(
  supabase: SupabaseClient,
  rows: CardRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("cards").upsert(rows);
  if (error) throw error;
}

/** Soft-delete an existing row (propagates a release to other devices). */
export async function markRowDeleted(
  supabase: SupabaseClient,
  id: string,
  deletedAt: string,
): Promise<void> {
  const { error } = await supabase
    .from("cards")
    .update({ deleted_at: deletedAt, updated_at: deletedAt })
    .eq("id", id);
  if (error) throw error;
}

/** Upload a data-URI image to the owner's Storage folder; returns the object path. */
export async function uploadImage(
  supabase: SupabaseClient,
  ownerId: string,
  cardId: string,
  dataUri: string,
): Promise<string> {
  const path = imagePath(ownerId, cardId);
  const blob = await (await fetch(dataUri)).blob();
  const { error } = await supabase.storage
    .from(CARD_IMAGE_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return path;
}

/** Sign a private Storage object path into a temporary displayable URL. */
export async function signImageUrl(
  supabase: SupabaseClient,
  path: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(CARD_IMAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/**
 * Resolve the `img` value to store in a DB row when pushing a card.
 * - generated SVG data-URI → stored inline (no upload)
 * - captured JPEG data-URI → uploaded once to Storage, row stores the path
 * - already-signed http URL → the card came from a prior pull; store its path
 * The `uploaded` set is mutated + persisted by the caller to skip re-uploads.
 */
export async function resolvePushImg(
  supabase: SupabaseClient,
  ownerId: string,
  card: Card,
  uploaded: Set<string>,
): Promise<{ img: string; uploadedId?: string }> {
  const img = card.img;
  if (img.startsWith("data:image/svg")) return { img };
  if (img.startsWith("data:")) {
    if (uploaded.has(card.id)) return { img: imagePath(ownerId, card.id) };
    const path = await uploadImage(supabase, ownerId, card.id, img);
    return { img: path, uploadedId: card.id };
  }
  if (img.startsWith("http")) return { img: imagePath(ownerId, card.id) };
  return { img }; // already a Storage path
}

/** Resolve a pulled row's `img` to a value the UI can render directly. */
export async function resolvePullImg(
  supabase: SupabaseClient,
  row: CardRow,
): Promise<string> {
  if (isInlineImage(row.img)) return row.img;
  const signed = await signImageUrl(supabase, row.img);
  return signed ?? row.img;
}
