-- PokéPal 2.0 — Row-Level Security for `public.owned_cards` (ticket 18.3).
-- Run in the Supabase SQL editor AFTER the `20261010120000_add_owned_cards`
-- migration has created the table. Safe to re-run (idempotent).
-- Applying this to the live project is part of human gate D9.
--
-- Rollback: dropping the table (see the migration's rollback note) removes the
-- constraint and every policy below with it.

-- 1. Foreign key owned_cards.owner_id → auth.users (Prisma can't reference the
--    auth schema). Cascade-delete a user's owned cards with the user.
alter table public.owned_cards
  drop constraint if exists owned_cards_owner_id_fkey;
alter table public.owned_cards
  add constraint owned_cards_owner_id_fkey
  foreign key (owner_id) references auth.users (id) on delete cascade;

-- 2. Owner-only Row-Level Security, same as the legacy `cards` table.
alter table public.owned_cards enable row level security;

drop policy if exists "owned_cards_select_own" on public.owned_cards;
create policy "owned_cards_select_own" on public.owned_cards
  for select using (auth.uid() = owner_id);

drop policy if exists "owned_cards_insert_own" on public.owned_cards;
create policy "owned_cards_insert_own" on public.owned_cards
  for insert with check (auth.uid() = owner_id);

drop policy if exists "owned_cards_update_own" on public.owned_cards;
create policy "owned_cards_update_own" on public.owned_cards
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owned_cards_delete_own" on public.owned_cards;
create policy "owned_cards_delete_own" on public.owned_cards
  for delete using (auth.uid() = owner_id);
