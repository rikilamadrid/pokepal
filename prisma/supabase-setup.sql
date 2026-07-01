-- PokéPal — Supabase Row-Level Security & Storage setup.
-- Run this in the Supabase SQL editor AFTER `prisma migrate deploy` has created
-- the `public.cards` table. Prisma owns the table shape; this file owns the
-- security policies + the card-images bucket (auth/storage schemas are outside
-- what Prisma manages). Safe to re-run (idempotent).

-- 1. Foreign key from cards.owner_id → auth.users (Prisma can't reference the
--    auth schema, so add it here). Cascade-delete a user's cards with the user.
alter table public.cards
  drop constraint if exists cards_owner_id_fkey;
alter table public.cards
  add constraint cards_owner_id_fkey
  foreign key (owner_id) references auth.users (id) on delete cascade;

-- 2. Enable Row-Level Security: every row is scoped to its owner.
alter table public.cards enable row level security;

drop policy if exists "cards_select_own" on public.cards;
create policy "cards_select_own" on public.cards
  for select using (auth.uid() = owner_id);

drop policy if exists "cards_insert_own" on public.cards;
create policy "cards_insert_own" on public.cards
  for insert with check (auth.uid() = owner_id);

drop policy if exists "cards_update_own" on public.cards;
create policy "cards_update_own" on public.cards
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "cards_delete_own" on public.cards;
create policy "cards_delete_own" on public.cards
  for delete using (auth.uid() = owner_id);

-- 3. Private Storage bucket for card images, one folder per user: `{userId}/...`.
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', false)
on conflict (id) do nothing;

-- Per-user path policies: the first path segment must equal the user's id.
drop policy if exists "card_images_select_own" on storage.objects;
create policy "card_images_select_own" on storage.objects
  for select using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "card_images_insert_own" on storage.objects;
create policy "card_images_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "card_images_update_own" on storage.objects;
create policy "card_images_update_own" on storage.objects
  for update using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "card_images_delete_own" on storage.objects;
create policy "card_images_delete_own" on storage.objects
  for delete using (
    bucket_id = 'card-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
