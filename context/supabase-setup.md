# Supabase Setup (Phase 11)

Step-by-step to stand up the PokéPal backend. The app works **fully signed-out**
without any of this; these steps enable cloud backup + magic-link sign-in.

## 1. Create the project

1. Go to <https://supabase.com> → sign in → **New project**.
2. Name it `pokepal`, pick a region near you, set a strong **database password**
   (save it), and create. Wait ~2 min for it to provision.

## 2. Grab the keys → `.env.local`

1. Copy `.env.example` to `.env.local` (git-ignored).
2. **Project Settings → API**: copy the **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   and the **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. **Project Settings → Database → Connection string**:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL` (append `?pgbouncer=true`).
   - **Direct connection** (port `5432`) → `DIRECT_URL`.
   - Replace `[YOUR-PASSWORD]` in both with the DB password from step 1.

## 3. Create the table (Prisma)

```bash
npx prisma migrate dev --name init_cards   # creates public.cards + migration
```

Verify: `npx prisma migrate status` should say the schema is up to date.

## 4. Security & Storage (SQL editor)

In the Supabase dashboard → **SQL Editor** → paste and run
`prisma/supabase-setup.sql`. This adds the `owner_id → auth.users` FK, enables
Row-Level Security (owner-only select/insert/update/delete), and creates the
private `card-images` bucket with per-user folder policies.

## 5. Auth (magic link)

1. **Authentication → Providers → Email**: ensure **Email** is enabled and
   **"Confirm email"** / magic links are on (Supabase sends OTP links by default).
2. **Authentication → URL Configuration**: add your dev + prod origins to
   **Redirect URLs** (e.g. `http://localhost:3002`, your Cloudflare tunnel URL,
   and the deployed PWA origin). The magic link redirects back here and the app
   parses the token on load.

## 6. Verify

- `npm run dev`, open **Settings → Account → Sign in**, enter your email, and
  confirm the magic-link email arrives and signs you in (email shows in the row).
- **RLS check:** sign in as a second user; confirm they cannot read the first
  user's rows (query `cards` with each anon session — should only see their own).

> Runtime data access is the Supabase JS client under RLS. Prisma owns the schema
> and migrations only. Cloud sync of the local collection is **phase 12**.
