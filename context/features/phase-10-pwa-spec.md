# PokéPal — Phase 10 Spec: PWA — Installable + Offline (Milestone)

## Overview

Phase 10 of 13. **First shippable milestone.** Turns the finished core app
(phases 1–9) into an **installable, offline-capable PWA**. No new product
features — this is the packaging + polish pass that makes PokéPal a real
home-screen app on the web, and it sets up the assets the native build (phase 13)
reuses.

## Requirements

- **Web app manifest** (`public/manifest.webmanifest` or app metadata): name,
  short name, description, `display: standalone`, `theme_color`,
  `background_color`, `orientation`, start URL, and a full **icon set**
  (192 / 512 / maskable, apple-touch-icon). On-brand icon (Pokéball / card motif).
- **Service worker**: precache the static export (app shell + assets) so the app
  loads offline and instantly on repeat visits; a sensible runtime-caching
  strategy for fonts/images. Given `output: 'export'`, use a static-export-
  compatible approach (e.g. `next-pwa`/Serwist or a hand-rolled SW registered
  client-side). Handle SW updates (prompt or auto-refresh).
- **iOS install support**: `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style: black-translucent`, apple touch icons,
  `viewport-fit=cover` — so Add-to-Home-Screen renders the status bar over the
  frosted navbar and insets are correct.
- **Offline UX**: the app is fully usable offline against the local store; verify
  seed + captured cards persist and all screens work with no network.
- **Installability audit**: passes Lighthouse "Installable" PWA checks; verify the
  install prompt on Android/Chrome and Add-to-Home-Screen on iOS Safari.
- **Theme color** meta reflects the active day/night theme.
- `npm run build` emits a clean `out/`; serve it and verify install + offline +
  every route/screen.

## Out of scope (later phases)

- Accounts / cloud backup — phase 11
- Cloud sync — phase 12
- Native App Store / Play Store binaries — phase 13

## References

- @context/project-overview.md (Distribution, Key Implementation Notes:
  safe-area, PWA)
- @context/features/phase-1-foundation-spec.md (static export config)
- @context/features/phase-13-native-capacitor-spec.md (reuses these icons/assets)
