# PokéPal — Native Builds (Capacitor)

PokéPal ships from **one React codebase** to three targets: the web PWA and, via
[Capacitor](https://capacitorjs.com), native **iPhone + iPad** (App Store) and
**Android** (Google Play). This doc covers everything from a clean checkout to a
store submission. No new product features live here — it's packaging only.

> **Toolchain is pinned to Capacitor 7** because the Capacitor 8 CLI requires
> Node ≥ 22 and this project targets Node 20. If you upgrade Node to 22+, you can
> bump the whole `@capacitor/*` set to 8 together.

---

## Prerequisites

| Target | You need |
| --- | --- |
| **Both** | Node 20+, this repo installed (`npm install`) |
| **iOS/iPad** | macOS, **Xcode** (+ Command Line Tools), **CocoaPods** (`sudo gem install cocoapods`), an **Apple Developer** account ($99/yr) for TestFlight/App Store |
| **Android** | **Android Studio** (SDK + platform tools), a **Google Play Console** account ($25 once) |

---

## How the pieces fit

- `next build` runs the Next.js **static export** (`output: 'export'`, set in
  phase 1) and writes the app to `out/`.
- `capacitor.config.ts` points Capacitor at `out/` (`webDir`), with app id
  `com.pokepal.app` and name `PokéPal`.
- `npx cap sync` copies `out/` into the native `ios/` and `android/` projects and
  installs native plugin pods/gradle deps.
- There is **no Next.js server** in the shipped app — all backend access is the
  Supabase client SDK over HTTPS under Row-Level Security (phases 11–12).

The camera is the one platform seam: `src/lib/camera.ts` branches on
`Capacitor.isNativePlatform()`. Web uses a live `getUserMedia` stream + shutter;
native hands off to the OS camera/library via `@capacitor/camera`. Callers (the
Scan flow) don't change.

---

## First-time setup (once per machine)

```bash
npm install

# 1. Generate the native icon + splash source art from the brand Pokéball.
npm run native:assets            # writes assets/{icon,icon-foreground,splash,splash-dark}.png

# 2. Add the native platforms (creates ios/ and android/).
npx cap add ios
npx cap add android

# 3. Rasterize icons + splash screens into both native projects.
npx capacitor-assets generate --iconBackgroundColor '#14151a' --splashBackgroundColor '#14151a'
```

> `assets/` (the 1024px icon + 2732px splash sources) is committed; regenerate any
> time with `npm run native:assets`. `ios/` and `android/` are generated locally.

---

## Everyday build loop

```bash
npm run native:ios       # next build → cap sync ios → open Xcode
npm run native:android   # next build → cap sync android → open Android Studio
# or just sync both without opening an IDE:
npm run native:sync
```

Then **Run** from Xcode (device/simulator) or Android Studio (device/emulator).

---

## Native configuration checklist

Do these once in the generated projects (they persist across `cap sync`; only
`out/` is overwritten).

### iOS (`ios/App/App/Info.plist`)
- **`NSCameraUsageDescription`** — kid-appropriate copy, e.g.
  _"PokéPal uses the camera so you can take a photo of your Pokémon card."_
- **`NSPhotoLibraryUsageDescription`** — e.g.
  _"PokéPal lets you pick a card photo from your library."_
- **Deep link for magic-link auth** (phase 11): add a URL scheme (e.g.
  `pokepal`) under _URL Types_, and set the Supabase **Redirect URL** to it (see
  Auth below). Signing team + bundle id `com.pokepal.app` under _Signing &
  Capabilities_.
- **Device family:** iPhone **and** iPad. **Orientation:** portrait (the shell is
  a centered phone-width column; verify it's centered, not stretched, on iPad).

### Android (`android/app/src/main/AndroidManifest.xml`)
- `<uses-permission android:name="android.permission.CAMERA" />` (runtime prompt
  is handled by `@capacitor/camera`).
- **Deep link:** add an `<intent-filter>` for the auth redirect scheme/host on the
  main activity.
- `applicationId` = `com.pokepal.app`; set `versionCode` / `versionName`.

### Both — safe areas & status bar
`NativeInit` (`src/components/native/NativeInit.tsx`) sets a dark status-bar style
and hides the splash on first paint. The app already respects
`env(safe-area-inset-*)`; verify the nav bar/tab bar clear the notch and home
indicator on a notched iPhone and on iPad.

---

## Supabase auth in the native webview

Magic-link sign-in (phase 11) opens the link in the system browser, which must
return to the app via a **custom URL scheme / universal link**:

1. Pick a scheme, e.g. `pokepal://auth-callback`.
2. Register it in iOS _URL Types_ and the Android `<intent-filter>` (above).
3. Add it to **Supabase → Authentication → URL Configuration → Redirect URLs**.
4. Confirm `detectSessionInUrl` (already enabled in `src/lib/supabase.ts`) parses
   the token when the app is reopened by the link.

Set the Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`) in `.env` **before** `next build` — they are
inlined into the static bundle Capacitor ships.

---

## Store readiness

| Item | Notes |
| --- | --- |
| **Bundle id** | `com.pokepal.app` (iOS + Android must match the config) |
| **Versioning** | Bump `package.json` `version`; set iOS `CFBundleShortVersionString`/build and Android `versionName`/`versionCode` per release |
| **Privacy / data safety** | Declare: account **email** (Supabase Auth) and **card photos** (Supabase Storage). No ads, no tracking, no third-party sharing. |
| **Age rating** | Kids audience — review Apple's _Kids Category_ and Google's _Designed for Families_ rules (parent-assisted magic-link sign-in was chosen to fit these) |
| **Camera/photo strings** | Must be present or the store rejects the build (see plist/manifest above) |
| **Screenshots** | Capture iPhone, iPad, and Android sizes from real devices/simulators |
| **Listings** | App name, subtitle, description, keywords, support URL, privacy-policy URL |

Distribution: **iOS** → Archive in Xcode → upload to **App Store Connect** →
TestFlight → submit. **Android** → `Build > Generate Signed Bundle (AAB)` → Play
Console **internal testing** → production.

---

## On-device verification (before submitting)

Run through on a real iPhone, a real iPad, and a real Android phone:

- [ ] Scan → native camera capture **and** "Choose from library"
- [ ] Camera-permission **denial** still allows Skip → generated art
- [ ] Offline use (airplane mode): app opens, browse/add works
- [ ] Magic-link sign-in returns to the app and the session sticks
- [ ] Cloud sync: add on device A → appears on device B; image shows via signed URL
- [ ] Safe areas correct on a notched iPhone and on iPad (both orientations)
- [ ] Splash → first paint has no white flash; status bar legible

---

## Troubleshooting

- **`The Capacitor CLI requires NodeJS >=22`** — you're on the v8 CLI. Stay on the
  pinned v7 set, or upgrade Node to 22+ and bump all `@capacitor/*` to 8.
- **White flash on launch** — confirm `backgroundColor` in `capacitor.config.ts`
  and that `NativeInit` calls `SplashScreen.hide()` after mount.
- **Blank webview** — you didn't `next build` before `cap sync`, so `out/` is
  stale/empty. Use `npm run native:sync`.
- **Auth never returns to the app** — the redirect scheme isn't registered in the
  native project or isn't in Supabase's Redirect URLs.
