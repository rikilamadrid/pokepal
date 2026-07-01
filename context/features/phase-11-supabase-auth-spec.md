# PokéPal — Phase 11 Spec: Supabase Backend & Auth

## Overview

Phase 11 of 13. Introduces the **cloud backend**: a Supabase project (Postgres +
Auth + Storage), the `cards` schema with Row-Level Security, and a real
**sign-in / sign-out** flow wired into the Settings account row (phase 9). This
phase stands up the backend and authentication **only** — the actual local↔cloud
data reconciliation is phase 12. The app remains fully usable signed out
(local-only).

## Requirements

- **Supabase project**: create it; capture `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` in env. Add a typed **browser Supabase client**
  in `src/lib/supabase.ts` (client-side only; no server runtime in the exported
  app).
- **Schema via Prisma** (`prisma/schema.prisma`) against the Supabase Postgres:
  a `cards` table mirroring the `Card` type — `id`, `owner_id` (FK →
  `auth.users`), `name`, `dex_no`, `type`, `rarity`, `favorite`, `img`,
  `caught_at`, `updated_at`, plus a soft-delete `deleted_at` for sync. Manage with
  `prisma migrate`. (Prisma owns schema/migrations; runtime access is the
  Supabase client.)
- **Row-Level Security**: enable RLS on `cards`; policies so a user can only
  `select/insert/update/delete` rows where `owner_id = auth.uid()`. Verify no
  cross-user access is possible with the anon key.
- **Storage bucket** for card images (e.g. `card-images`), private, with per-user
  path policies (`{userId}/...`). (Upload wiring is phase 12; create the bucket +
  policies here.)
- **Auth flow**: kid-friendly, low-friction sign-in via Supabase Auth (magic link
  or a social provider, parent-assisted). A sign-in surface (sheet/dialog) opened
  from the Settings **Account** row; sign-out too. Reflect signed-in/out state
  (email/name) in Settings.
- **Session handling**: persist and restore the Supabase session on load; expose
  auth state via a hook/context (`useAuth`) so phase 12 and Settings can read it.
  Handle the auth redirect/callback in a static-export-compatible way.
- **No behavioral change to data yet**: signing in must not move or duplicate the
  local collection. Cards stay local until phase 12 syncs them. (Optionally set
  `ownerId` on new local cards once known — but no network writes here.)
- Validate all auth inputs with Zod; user-friendly error toasts (sonner).
- `npm run build` and `npm run lint` pass; verify sign-in/out, session
  persistence, and RLS (a second user cannot read the first's rows).

## Out of scope (later phases)

- Pushing/pulling cards, image upload, conflict resolution — phase 12
- Native packaging — phase 13

## References

- @context/project-overview.md (Backend, Data Model, Architecture)
- @context/coding-standards.md (Prisma migrations, Zod)
- @context/features/phase-2-data-storage-spec.md (local store shape)
- @context/features/phase-9-favorites-settings-spec.md (Account row)
- @context/features/phase-12-cloud-sync-spec.md
