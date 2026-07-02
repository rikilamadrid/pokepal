# Deploying PokéPal (Web / PWA → Vercel)

The web app ships as a Next.js **static export** (`output: 'export'`). Vercel
detects Next.js and builds it with no extra config — there is no server runtime,
so the exported PWA is served as static assets and all backend access goes
directly to Supabase (client SDK under RLS).

CI/CD split:

- **GitHub Actions** (`.github/workflows/ci.yml`) — quality gate. Lints and
  builds on every push to `main` and every PR. Visible green checks in the repo.
- **Vercel Git integration** — the deployer. Production on `main`, a preview URL
  for every PR. No Vercel CLI or GitHub secrets required.

---

## One-time setup

### 1. Connect the repo to Vercel

1. <https://vercel.com/new> → **Import** the `pokepal` GitHub repo.
2. Framework preset: **Next.js** (auto-detected). Leave build command
   (`next build`) and output as detected — do **not** override the output dir;
   Vercel handles `output: 'export'` automatically.
3. Don't deploy yet — add env vars first (next step), then deploy.

### 2. Add environment variables (Vercel → Project → Settings → Environment Variables)

Both are public (`NEXT_PUBLIC_*`) client keys — the anon key is RLS-guarded and
safe to expose. Copy the values from your local `.env`. Add to **Production**,
**Preview**, and **Development**:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon/public key |

> If these are omitted the site still builds and runs — it just falls back to
> **local-only** mode (no cloud backup / sync). Magic-link sign-in needs them.

### 3. Allow the Vercel domain in Supabase Auth

Magic-link sign-in redirects back to the site, so Supabase must trust the URL.

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://<your-project>.vercel.app`
- **Redirect URLs:** add both
  - `https://<your-project>.vercel.app` (and any custom domain)
  - `https://*-<your-team>.vercel.app` — optional, to test auth on PR previews
  - keep `pokepal://auth-callback` (native app) and `http://localhost:3002` (dev)

### 4. Deploy

Push to `main` (or hit **Deploy** in Vercel). Every later push to `main`
redeploys production; every PR gets its own preview URL.

---

## Notes

- **Native / Capacitor files are inert on web.** `capacitor.config.ts`, the
  `ios/` project, and the native plugins are dynamically imported and no-op off
  device, so they don't affect the Vercel build.
- **CI builds without secrets on purpose** — a green CI build proves the
  local-first fallback path works even with no Supabase config.
- **Custom domain:** add it under Vercel → Settings → Domains, then add it to the
  Supabase Redirect URLs above.
