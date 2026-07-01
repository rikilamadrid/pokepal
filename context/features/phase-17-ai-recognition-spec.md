# PokéPal — Phase 17 Spec: AI Card Auto-Recognition (Premium)

## Overview

Enhancement phase (post-launch), **premium / subscription-gated**. After capturing
a card photo, an AI vision model reads it and pre-fills the Tag form (name, type,
HP/dex, rarity, stage) so the child confirms rather than types. Manual tagging
stays free; AI autofill is the paid tier.

## Decisions (locked 2026-07-01)

- **Behind a subscription.** Free users tag manually; subscribers get AI autofill
  (optionally with a small number of free trial scans).
- **Server-side only.** The app is a static export — the AI key must never ship to
  the client. All AI calls go through a **Supabase Edge Function** that verifies the
  user's JWT *and* their subscription entitlement before calling the model.

## Flow

1. Scan → capture/compress image (existing phase-8 pipeline).
2. If the user is entitled, call the Edge Function with the image (JWT attached).
3. Edge Function calls **Claude vision** with a structured extraction prompt and
   returns JSON validated against a Zod schema: `{ name, type, stage, dexNo,
   rarity, hp?, confidence }`.
4. Prefill the Tag form; show a "review the details" hint and let the user edit
   anything before saving. Low confidence → highlight fields to check.
5. On any error / not-entitled → silent fallback to the normal manual form.

## Requirements

- **Entitlement**: a subscription/entitlement check the Edge Function trusts
  (see Billing). Client shows an upsell on the Scan sheet for non-subscribers.
- **Edge Function** (`supabase/functions/recognize-card`): holds `ANTHROPIC_API_KEY`,
  verifies JWT + entitlement, rate-limits, calls the latest Claude vision model,
  returns validated JSON. Never persists the image.
- **Billing** (its own sub-effort): web via Stripe; native via App Store / Play IAP
  (e.g. RevenueCat for the Capacitor build). Entitlement stored so the Edge Function
  and client agree. *Scope/vendor to be chosen when this phase starts.*
- **Privacy (kids category)**: images are sent to a third-party AI for processing —
  requires a clear parental-consent notice and a privacy-policy update; do not
  retain images server-side beyond the request. Confirm App Store kids-category
  compliance before shipping.
- **Types & validation**: Zod schema for the AI response; strict TS; no `any`.
- Verify: entitled scan prefills correctly and is fully editable; non-entitled scan
  shows the upsell and manual form; errors fall back cleanly; no key in the bundle.

## Open decisions (resolve at phase start)

- Subscription vendor + price, and whether to offer N free trial scans.
- Exact model + prompt, and a confidence threshold for "please double-check".
- Whether recognition also suggests the generated-art fallback when it can't read
  the card.

## Dependencies

- Phase 15 (types + stage) so the model can target the full field set.
- Phase 11/12 (auth, Edge-Function-capable Supabase project).

## References

- @context/project-overview.md (static export, Supabase, Scan)
- @context/features/phase-15-type-system-spec.md
- @context/coding-standards.md (Zod validation, no `any`)
