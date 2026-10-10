-- PokéPal 2.0 — additive `owned_cards` table (ticket 18.3).
-- Apply RLS afterwards with `prisma/owned-cards-rls.sql`.
-- Applying this to the live Supabase project is human gate D9.
--
-- Rollback (no legacy data is touched):
--   DROP TABLE IF EXISTS "owned_cards";
--   DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261010120000_add_owned_cards';

-- CreateTable
CREATE TABLE "owned_cards" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "printing_id" TEXT NOT NULL,
    "printing" JSONB NOT NULL,
    "finish" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL,
    "acquired_at" TIMESTAMPTZ(6) NOT NULL,
    "storage_location_id" TEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "owned_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owned_cards_owner_id_idx" ON "owned_cards"("owner_id");

-- CreateIndex
CREATE INDEX "owned_cards_owner_id_printing_id_idx" ON "owned_cards"("owner_id", "printing_id");

