# PokéPal — Phase 8 Spec: Scan Flow (Camera → Confirm → Tag)

## Overview

Phase 8 of 13. Builds the **Scan modal** — the app's only *write* path and its
most complex surface. A three-step bottom sheet opened from the center tab-bar
puck: capture a photo, confirm it, then tag it and save to the collection. Uses
the phase-2 image-compression util and `addCard` action, and the phase-3 card
preview.

## Requirements

- **Modal**: bottom sheet (shadcn `sheet`) opened by the Scan puck (phase 4),
  with a drag handle, `✕`, and safe-area insets. Opening resets to step 1;
  closing tears down the camera stream. **Lazy-load** the whole flow via
  `next/dynamic` — the camera stack must not be in the initial bundle.
- **Step 1 — Viewfinder**: live rear camera feed (`getUserMedia`,
  `facingMode: 'environment'`) inside a framed preview with a **golden target
  frame** overlay and a hint line. A circular **shutter** captures the current
  frame to a canvas.
  - **Fallback**: if `getUserMedia` throws (permission denied, no camera,
    non-HTTPS), hide the viewfinder and show "Upload a photo instead"
    (`<input type="file" accept="image/*" capture="environment">`).
  - **Native touch point**: behind a small adapter so phase 13 can swap in the
    Capacitor **Camera** plugin without touching the flow. Web build uses
    `getUserMedia`.
- **Step 2 — Confirm**: show the captured/uploaded frame. "Retake" restarts the
  camera (back to step 1); "Use this photo" runs the **image-compression util**
  (max 640px, JPEG 0.78) and advances.
- **Step 3 — Tag** (validated with Zod):
  - **Name** text input (required).
  - **Type picker**: pill buttons for the six types, tinted by their gradients;
    single-select.
  - **Dex number** input — if left blank, `nextDexNumber()` fills the next
    zero-padded value on save.
  - **Rarity** selector (common / uncommon / rare / holo).
  - **Favorite** toggle (iOS-style `switch`).
  - Optional: a live `PokeCard` preview reflecting the entered values.
  - **"Add to collection"**: constructs the `Card` (new `id`, `caughtAt`/
    `updatedAt` now, `img` = compressed capture, or generated SVG art if the user
    skipped the photo), calls `addCard`, closes the modal, returns to Home, and
    toasts success (sonner).
- Step transitions animate; back-navigation between steps works; `prefers-
  reduced-motion` respected.
- Handle the no-photo path (generated art) and the upload path identically
  downstream.
- `npm run build` and `npm run lint` pass; verify capture (or upload fallback),
  compression, validation, and that the new card appears on Home/Collection.

## Out of scope (later phases)

- Uploading the image to Supabase Storage / cloud persistence — phase 12
- Swapping in the native Capacitor Camera plugin — phase 13 (adapter defined here)

## References

- @context/project-overview.md (Features C, Screens → Scan modal, Key
  Implementation Notes: camera fallback, image compression, auto dex number)
- @context/features/phase-2-data-storage-spec.md (compression util, addCard,
  nextDexNumber, generated art)
- @context/features/phase-3-card-system-spec.md (preview card)
- @context/features/phase-13-native-capacitor-spec.md
