-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "dex_no" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "img" TEXT NOT NULL,
    "caught_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cards_owner_id_idx" ON "cards"("owner_id");

-- CreateIndex
CREATE INDEX "cards_owner_id_dex_no_idx" ON "cards"("owner_id", "dex_no");
