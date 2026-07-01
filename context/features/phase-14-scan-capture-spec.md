# PokéPal — Phase 14 Spec: Scan Capture Quality

## Overview

Enhancement phase (post-launch). On-device testing showed the Scan viewfinder's
target frame is sized so close to the card that you must push the camera right up
to it — inside the phone's macro focus range — producing blurry captures. This
phase relaxes the framing and adds capture aids so a sharp photo is easy at a
comfortable distance. No data-model or backend changes.

## Problem

- The golden target frame implies the card should fill it edge-to-edge, forcing an
  uncomfortably close shot where the lens can't focus.
- No focus assistance or guidance; a slightly-off or blurry frame is easy to keep.

## Requirements

- **Relax the target frame.** Shrink the overlay to ~70% of the viewport width
  (keep the trading-card aspect ratio ≈ 2.5 : 3.5) and reframe the copy as a guide
  ("Line the card up inside the frame") rather than a fill target. Capture is
  allowed regardless of how much of the frame the card fills.
- **Framing guides.** Corner brackets + a subtle center guide so alignment is
  obvious without demanding a tight crop.
- **Tap-to-focus** where supported: on tap, apply a `focusMode` / points-of-interest
  constraint via `track.applyConstraints` (feature-detected; silently no-op where
  unsupported). Optionally surface a torch toggle if `torch` is supported.
- **Keep existing fallbacks**: file-upload when the camera is unavailable, and the
  "Skip photo" → generated-art path. Capture still runs through `captureFrame` →
  canvas JPEG, then phase-2 `compressImage`.
- Respect reduced-motion and safe-area insets; no change to the sheet shell.
- `npm run build` + `npm run lint` pass; verify on a real device (the reason this
  phase exists) that a comfortable-distance shot is sharp.

## Touch points

- `src/components/scan/Viewfinder.tsx` (frame size + guides + tap-to-focus)
- `src/lib/camera.ts` (focus/torch constraint helpers, feature-detected)
- `src/app/globals.css` (target-frame styles)

## Out of scope

- AI recognition / autofill — phase 17.
- Native Capacitor camera plugin — phase 13 (adapter already isolates it).

## References

- @context/features/phase-8-scan-spec.md (camera flow, capture pipeline)
- @context/project-overview.md (Scan feature, camera fallback)
