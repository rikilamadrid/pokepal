# PokéPal — Project Overview

> **A mobile-first, iOS-style Pokémon companion app for kids. Scan your cards, explore creature info, and keep track of your collection — installable as a PWA today, shippable to the App Store (iPhone + iPad) and Google Play later.**

---

## Table of Contents

- [Concept](#concept)
- [Target Users](#target-users)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [File Structure](#file-structure)
- [Backend (Supabase)](#backend-supabase)
- [Distribution (PWA → App Stores)](#distribution-pwa--app-stores)
- [Data Model](#data-model)
- [Features](#features)
- [UI / UX](#ui--ux)
- [App Shell & Navigation](#app-shell--navigation)
- [Screens](#screens)

---

## Concept

PokéPal is a **Next.js / React** Pokémon companion app for kids. It lets them
photograph or upload a card, tag it with name, type, rarity, and dex number, and
keeps a running collection they can browse, favorite, and track for duplicates.

The audience is children who love the battles and the creatures, not the market
value. The experience is intentionally simple and joyful: scan → name → done.

The app is **local-first**: it works fully offline against on-device storage, so
it opens instantly and never blocks on the network. When a child signs in, their
collection **syncs to a cloud backend (Supabase)** so it survives a reinstall and
follows them across devices (phone ↔ iPad). It ships first as an **installable
PWA**, then as a **native app** (iPhone, iPad, Android) via Capacitor — one React
codebase, three distribution targets.

---

## Target Users

| Persona | Need |
| --- | --- |
| **Kid collector** | A fun, visual way to log and browse their cards — no spreadsheets, no prices |
| **Battle fan** | Quick access to creature info, types, and rarity at a glance |
| **Duplicate hunter** | Instantly see which cards they have multiples of for trading with friends |
| **Parent / gift-giver** | Simple enough for a child to use independently; installable from the App Store on their iPhone/iPad |

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Framework** | Next.js 16 (App Router), configured for **static export** (`output: 'export'`) so the same build ships as a PWA and inside the native shell |
| **Language** | TypeScript (strict mode; no `any`) |
| **UI** | React 19 — functional components + hooks only |
| **Styling** | Tailwind CSS v4 (CSS-based `@theme` config in `globals.css`) + shadcn/ui primitives. No `tailwind.config.*` |
| **Fonts** | Google Fonts via `next/font` — Lilita One (display), Space Mono (mono/data) + system-ui (body) |
| **Local storage** | `localStorage` / IndexedDB — the local-first offline cache and source of truth when signed out |
| **Backend** | **Supabase** — Postgres database, Auth, and Storage (card images) |
| **Schema / migrations** | **Prisma** against the Supabase Postgres (schema + migrations). Runtime reads/writes go through the **Supabase JS client** (Row-Level-Security-enforced) since the exported app has no Next.js server |
| **Validation** | Zod for all user input (scan form, etc.) |
| **Camera** | Web: `navigator.mediaDevices.getUserMedia` (`facingMode: environment`). Native: Capacitor **Camera** plugin |
| **Image capture** | HTML5 Canvas — scales and encodes captured frames as JPEG (max 640px, quality 0.78) |
| **PWA** | Web app manifest + service worker (installable, offline), `viewport-fit=cover`, `theme-color` |
| **Native packaging** | **Capacitor** → iOS/iPadOS (App Store) + Android (Play Store) |

> **Why static export + Supabase client SDK?** Capacitor bundles a static build,
> so there is no Next.js server (no API routes / Server Actions) *inside the app*.
> The client talks directly to Supabase over HTTPS, and Row-Level Security keeps
> each user scoped to their own cards. Prisma still owns the schema/migrations.

---

## Architecture

- **Local-first data flow.** The UI always reads from and writes to the local
  store first, so every screen is instant and works offline. A sync layer
  reconciles the local store with Supabase in the background when signed in.
- **Client-side data access.** No server runtime in the shipped app; the Supabase
  JS client is the data API, guarded by RLS policies (owner-only rows).
- **Server Components where they still apply.** Static/marketing/content routes
  can be RSC at build time; interactive app surfaces are client components
  (`'use client'`) because they use hooks, storage, and the camera.
- **Code splitting.** Heavy or rarely-used surfaces (the Scan camera flow, the
  card detail sheet, any future creature-info views) are lazy-loaded with
  `next/dynamic`; routes split at the route boundary. The camera stack is never
  in the initial bundle.
- **One codebase, three targets.** The same static build serves the web PWA and
  is wrapped by Capacitor for iOS/iPad and Android. Platform differences (camera,
  storage, safe areas) are isolated behind small adapter modules.

---

## File Structure

Follows @context/coding-standards.md.

```
src/
  app/                 # App Router routes, layout.tsx, globals.css (Tailwind @theme)
  components/
    shell/             # navbar, tab bar, fixed app frame
    card/              # PokeCard, CardTile, badges, holo sweep
    home/ collection/  # screen-specific components
    scan/ settings/    # screen-specific components
    ui/                # shadcn/ui primitives
  hooks/               # useCollection, useCamera, useTheme, useSync, …
  lib/                 # storage, art-gen (SVG), type-gradients, image-compress,
                       # supabase client, sync engine
  types/               # Card, CardType, Rarity, …
  data/                # seed cards
prisma/                # schema.prisma + migrations (Supabase Postgres)
public/                # icons, manifest, PWA assets
```

- Components: `src/components/[feature]/ComponentName.tsx` (PascalCase).
- Hooks/utils: `src/hooks`, `src/lib` (camelCase files or kebab-case).
- Types: `src/types/[feature].ts` (PascalCase, no prefix).

---

## Backend (Supabase)

- **Auth.** Supabase Auth for accounts. Kid-friendly, low-friction sign-in
  (magic link / social, parent-assisted); the app is fully usable **signed out**
  (local-only) and prompts to sign in to enable cloud backup + multi-device.
- **Database.** A `cards` table in Postgres mirroring the [Data Model](#data-model),
  keyed by `id`, owned by `owner_id` (the Supabase user). Prisma defines the
  schema and migrations.
- **Storage.** A Supabase Storage bucket holds card images; the row stores the
  object URL. Locally-captured images live as data URIs until synced, then upload
  to Storage and the row's `img` becomes the Storage URL.
- **Row-Level Security.** Policies restrict every row to its `owner_id`, so the
  client SDK can be used safely without a custom server.
- **Sync.** Local-first: the local store is authoritative offline; a background
  sync engine pushes local changes and pulls remote changes, using `updatedAt`
  (and a soft-delete flag) for last-writer-wins reconciliation.

---

## Distribution (PWA → App Stores)

1. **PWA (first milestone).** Manifest + service worker make PokéPal installable
   to the home screen and offline-capable. Shippable on its own.
2. **Native via Capacitor.** The static export is wrapped in a Capacitor shell to
   produce **iPhone + iPad** (App Store) and **Android** (Play Store) binaries.
   Native plugins replace web APIs where it matters (Camera, filesystem, status
   bar, safe areas). Same React code; no rewrite.

---

## Data Model

Each card is a typed object. Locally it is stored in a JSON array under the key
`"collection"` in the on-device store; in the cloud it is a row in the Supabase
`cards` table.

```ts
interface Card {
  id:        string;   // "card-{timestamp}" or "seed-{n}"
  ownerId:   string;   // Supabase user id (empty string while signed out / local-only)
  name:      string;   // e.g. "Tidaltail"
  dexNo:     string;   // zero-padded, e.g. "008"
  type:      CardType; // fire | water | grass | electric | psychic | rock
  rarity:    Rarity;   // common | uncommon | rare | holo
  favorite:  boolean;
  img:       string;   // base64 JPEG data URI (local) | Supabase Storage URL (synced) | generated SVG data URI
  caughtAt:  string;   // ISO 8601 timestamp
  updatedAt: string;   // ISO 8601 — sync reconciliation
}
```

### Type system

| Type | Gradient (light → dark) |
| --- | --- |
| `fire` | `#ffb27a` → `#ff6a3d` |
| `water` | `#8fd2ff` → `#2f8fe0` |
| `grass` | `#b6e89a` → `#4fae4f` |
| `electric` | `#fff0a0` → `#ffce2e` |
| `psychic` | `#e3bdff` → `#a85bf0` |
| `rock` | `#e3cf9e` → `#a9824a` |

Each type maps to a gradient used consistently across card art backgrounds, card
frame tints, tile backgrounds, and type-picker buttons. Defined once as CSS
tokens and mirrored in a typed map in `src/lib`.

### Generated art

When no photo is taken, PokéPal generates a unique SVG creature for the card
using a deterministic hash of the card's name + dex number. The SVG uses a blob
body path, a type gradient fill, and simple face elements (eyes + mouth). Three
blob shapes are available; the hash selects one and varies the eye offset,
keeping creatures visually distinct without storing any extra data.

### Duplicate detection

A card is considered a duplicate if the collection contains more than one entry
with the same `dexNo`. No extra model field is needed — duplicate count is
computed on read.

---

## Features

### A. Home screen

- **Hero card** — the most recently caught card displayed prominently with a
  floating tilt animation and holo-foil sweep effect for `rarity: "holo"` cards.
- **Favorites row** — horizontal scroll strip of starred cards, capped at 8.
  "See all" navigates to the Favorites tab.
- **Duplicates row** — horizontal scroll strip of all cards that share a dex
  number with at least one other card.

### B. Collection tab

- Full grid (2 columns) of all cards, sorted newest first.
- iOS-style search bar that filters by name, dex number, or type in real time
  (120 ms debounce).
- Card count shown as a pill next to the eyebrow label.

### C. Scan (modal, opened from center tab bar button)

Three-step flow:

| Step | What happens |
| --- | --- |
| **1 — Viewfinder** | Live rear camera feed with a golden target frame overlay. Tap the shutter to capture. Falls back to a file-upload button if the camera is unavailable/denied. Native builds use the Capacitor Camera plugin. |
| **2 — Confirm** | Shows the captured frame. "Retake" restarts the camera; "Use this photo" advances. |
| **3 — Tag** | Name input, type picker (pill buttons), dex number input (auto-increments if left blank), rarity selector, and a favorite toggle (iOS-style switch). "Add to collection" saves and returns to Home. |

### D. Favorites tab

Full-page grid of all starred cards. Live-updates when cards are
favorited/unfavorited from the detail sheet.

### E. Settings tab

| Setting | Behavior |
| --- | --- |
| **Account** | Sign in / out (Supabase). Signed out = local only; signed in = cloud backup + multi-device sync. |
| **Dark mode** | iOS-style toggle switch. Reads `prefers-color-scheme` on load; persists per toggle. |
| **Total caught** | Live count of all cards in the collection. |
| **Unique species** | Live count of distinct dex numbers. |
| **Release entire collection** | Confirms, then clears the collection and re-renders all screens. |

### F. Card detail sheet (bottom sheet modal)

Opened by tapping any card anywhere in the app.

- Displays the full card at the top.
- Shows dex number, type, rarity, and caught date in a 2×2 stat grid.
- **Favorite** button toggles star and updates all screens instantly.
- **Release** button removes the card from the collection.

---

## UI / UX

### Design principles

- **iOS-native feel** — frosted-glass nav bar and tab bar, bottom-sheet modals
  with drag handle, `scale(.96)` press response on every tappable element,
  safe-area insets for notch and home indicator.
- **Bold nostalgia** — Lilita One display font, Pokéball-red accent, gold for
  favorites and duplicate badges, near-black base.
- **Dark mode first** — all color decisions made in dark mode first; light mode
  swaps to cool gray surfaces.
- **No decoration without purpose** — the one exception is the holo sweep
  animation, which is earned (only on `rarity: "holo"` cards).

### Color tokens

| Token | Dark mode | Light mode | Role |
| --- | --- | --- | --- |
| `--bg` | `#14151a` | `#eceef2` | Page canvas |
| `--surface` | `#1e2029` | `#ffffff` | Cards, inputs |
| `--surface-raised` | `#262934` | `#ffffff` | Elevated surfaces |
| `--border` | `#323542` | `#dadce3` | Hairlines |
| `--text` | `#f5f3ec` | `#1b1c22` | Primary text |
| `--text-muted` | `#8d909c` | `#6b6e78` | Labels, hints |
| `--red` | `#ff4655` | `#ff4655` | Primary accent |
| `--gold` | `#ffc857` | `#ffc857` | Favorites, duplicates |

### Typography

| Role | Font | Usage |
| --- | --- | --- |
| Display | Lilita One | Card names, section titles, screen headings, wordmark |
| Mono | Space Mono | Dex numbers, eyebrow labels, card metadata, type badges |
| Body / UI | system-ui / SF Pro | All other UI copy, form labels, buttons |

---

## App Shell & Navigation

The app uses a fixed-position shell (`position: fixed; inset: 0`) with three
layers stacked vertically:

```
┌─────────────────────────────────────────┐
│  Navbar (frosted glass, 48px + safe-top)│
├─────────────────────────────────────────┤
│                                         │
│  Screens (flex:1, overflow-y:auto)      │
│                                         │
│  .screen — absolute, fills parent       │
│  opacity + translateY transition        │
│  only .active is visible                │
│                                         │
├─────────────────────────────────────────┤
│  Tab bar (frosted glass, 54px + safe-b) │
└─────────────────────────────────────────┘
```

### Navbar behavior

- Shows the **PokéPal wordmark + Pokéball** on the Home tab.
- Switches to a centered **screen title** (SF Pro 17px semibold) on Collection /
  Favorites / Settings — matching native iOS large-title-to-inline-title
  convention.
- Gains a hairline bottom border only once the active screen is scrolled past 4px.

### Tab bar

| Position | Tab | Icon |
| --- | --- | --- |
| 1 | Home | House outline |
| 2 | Collection | 2×2 grid outline |
| 3 (center) | **Scan** | Raised Pokéball puck (floats above bar, no label padding) |
| 4 | Favorites | Star outline |
| 5 | Settings | Gear outline |

Active tabs render in `--red`. The Scan button is never "active" — it opens a
modal instead. Tapping the active tab a second time scrolls the screen to top.

### Screen transitions

Screens cross-fade with a subtle `translateY(6px) → translateY(0)` lift over
280 ms (`cubic-bezier(.2,.8,.2,1)`). Only one screen is `pointer-events:auto` at
a time.

---

## Screens

### Home (`/`)

```
┌──────────────────────────────────┐
│ PokéPal ⚾                        │  ← navbar
├──────────────────────────────────┤
│  LATEST CATCH                    │
│        ┌────────┐                │
│        │  CARD  │  ← hero, float │
│        │  ART   │    + tilt anim │
│        └────────┘                │
│     Tidaltail                    │
│     #008 · Water · Holo          │
│  FAVORITES ●3        See all >   │
│  ┌────┐ ┌────┐ ┌────┐ →scroll   │
│  DUPLICATES ●4                   │
│  ┌────┐ ┌────┐ ┌────┐ →scroll   │
├──────────────────────────────────┤
│  🏠   ▦   ⚾   ☆   ⚙            │  ← tab bar
└──────────────────────────────────┘
```

### Collection

```
┌──────────────────────────────────┐
│ Collection                       │  ← big display title
│ ┌──────────────────────────────┐ │
│ │ 🔍 Search by name, dex…  ✕  │ │  ← iOS search bar
│ └──────────────────────────────┘ │
│ ALL CARDS ●10                    │
│ ┌─────────┐ ┌─────────┐         │
│ │ Tile    │ │ Tile    │         │  ← 2-col grid
│ └─────────┘ └─────────┘         │
└──────────────────────────────────┘
```

### Scan modal (bottom sheet, 3 steps)

```
Step 1 — Viewfinder     Step 2 — Confirm       Step 3 — Tag
[live camera + gold     [captured preview]     NAME / TYPE / DEX
 frame + shutter]       [Retake][Use this ✓]   RARITY / favorite
[Upload instead]                               [Add to collection]
```

### Card detail sheet (bottom sheet)

```
┌─────────────────────────────┐
│ Tidaltail               ✕   │
│       ┌────────┐            │
│       │  CARD  │            │
│       └────────┘            │
│ [Dex #008] [Type Water]     │
│ [Holo]     [Caught Today]   │
│ [ ☆ Favorite ] [ Release ]  │
└─────────────────────────────┘
```

---

## Key Implementation Notes

- **Local-first store** — the app reads/writes an on-device store
  (`localStorage`/IndexedDB) so it is instant and offline. On first run (empty
  store) it seeds ~10 cards with generated SVG art so it never opens empty.
- **Cloud sync** — when signed in, a background engine reconciles the local store
  with the Supabase `cards` table (push local changes, pull remote), uploading
  locally-captured images to Supabase Storage and rewriting `img` to the Storage
  URL. `updatedAt` + soft-delete drive last-writer-wins.
- **Camera fallback** — if `getUserMedia` fails (permission, no camera, non-HTTPS
  web), the viewfinder hides and an upload button takes over
  (`<input type="file" capture="environment">`). Native builds use the Capacitor
  Camera plugin.
- **Image compression** — captured/uploaded images are drawn to a canvas at max
  640px wide and re-encoded as JPEG 0.78 before storing/uploading.
- **Auto dex number** — blank dex on the Scan form → `nextDexNumber()` finds the
  highest numeric dex value and increments, zero-padded to 3 digits.
- **Render cycle** — screens render from collection state via React; mutations
  (add, favorite, release) update the store and re-render. No manual DOM.
- **Theme** — reads `prefers-color-scheme` on init and sets `data-theme`; the
  Settings toggle updates it; all color tokens respond via CSS custom properties.
- **Safe-area insets** — tab bar and all modals account for
  `env(safe-area-inset-bottom)`; navbar accounts for `env(safe-area-inset-top)`.
  `viewport-fit=cover` ensures non-zero insets on notched devices.
- **Static export** — `output: 'export'`; no API routes / Server Actions in the
  shipped bundle. All backend access is via the Supabase client SDK under RLS.
