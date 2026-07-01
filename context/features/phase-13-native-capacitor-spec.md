# PokéPal — Phase 13 Spec: Native Packaging (Capacitor → App Store & Play Store)

## Overview

Phase 13 of 13. Wraps the finished static build in **Capacitor** to ship native
**iPhone + iPad** (App Store) and **Android** (Google Play) apps from the same
React codebase. Swaps the web camera for the native Camera plugin behind the
adapter defined in phase 8, and handles native concerns (splash, icons, status
bar, safe areas, permissions). No new product features.

## Requirements

- **Capacitor setup**: install `@capacitor/core` + `@capacitor/cli` and add the
  `ios` and `android` platforms. Configure `capacitor.config.ts` with
  `webDir: 'out'` (the static export) and the app id / name. Build pipeline:
  `next build` → `npx cap sync` → open in Xcode / Android Studio.
- **Static export confirmed**: relies on phase 1's `output: 'export'`; verify the
  bundled `out/` runs inside the shell with no reliance on a Next.js server.
- **Native camera**: implement the phase-8 camera adapter's native branch with
  `@capacitor/camera` (capture + pick from library), returning an image the
  existing compression util can consume. Web build keeps `getUserMedia`.
- **Permissions**: declare camera (and photo library) usage with kid-appropriate
  copy — iOS `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription`,
  Android `<uses-permission>` + runtime requests. Handle denial gracefully
  (upload/generated-art fallback still works).
- **App icons & splash**: generate iOS/iPad/Android icon sets + splash screens
  from the phase-10 PWA icon (use `@capacitor/assets`). iPad-specific sizes
  included.
- **Status bar & safe areas**: `@capacitor/status-bar` + verify `env(safe-area-
  inset-*)` behaves inside the native webview on notched devices and iPad.
- **Deep-link / auth callback**: ensure the Supabase auth flow (phase 11) works in
  the native webview (custom URL scheme / universal link for the OAuth/magic-link
  callback).
- **iPad support**: verify layout at tablet sizes and both orientations (the shell
  centers; confirm it's not just a stretched phone UI). Set device family to
  iPhone + iPad.
- **Store readiness**: bundle identifiers, versioning, privacy manifest / data-
  safety form (declare Supabase auth + stored images), age rating (kids category
  considerations), screenshots, and store listings. Document the build/submit
  steps in a `NATIVE.md`.
- Verify on a real iPhone, a real iPad, and an Android device: scan (native
  camera), offline use, sign-in + sync, install, and app-store TestFlight/internal
  testing builds.

## Out of scope

- New product features (this is packaging only).
- Post-launch store maintenance / analytics (track separately if desired).

## References

- @context/project-overview.md (Distribution, Tech Stack → native packaging)
- @context/features/phase-1-foundation-spec.md (static export)
- @context/features/phase-8-scan-spec.md (camera adapter)
- @context/features/phase-10-pwa-spec.md (icon/splash source assets)
- @context/features/phase-11-supabase-auth-spec.md (auth callback in webview)
