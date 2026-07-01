# PokéPal — Phase 4 Spec: Navigation & Screen Transitions

## Overview

Phase 4 of 13. Turns the static shell from phase 1 into a **navigable app**. Wires
the tab bar, screen switching with iOS-style cross-fade transitions, the navbar's
title modes, and the scroll-aware border. No real screen content yet beyond
labeled placeholders — those land in phases 5, 6, 9.

## Requirements

- **Tab navigation state**: a lightweight client store/hook (`useActiveTab` or
  similar) tracking the active screen (`home | collection | favorites | settings`)
  and whether the Scan modal is open. Since the app is a single fixed shell,
  screen switching is client state, not route changes (routes stay for
  deep-linkable surfaces only if needed).
- **Tab bar wired**: Home / Collection / Favorites / Settings switch the active
  screen; the active tab renders in `--red`. The center **Scan** puck opens the
  Scan modal (placeholder here — real flow in phase 8) and is **never** marked
  active.
- **Tap-active-to-top**: tapping the already-active tab scrolls its screen back to
  the top (smooth).
- **Screen container**: renders all screens; only the active one is visible and
  `pointer-events:auto`. Cross-fade with `translateY(6px) → translateY(0)` over
  ~280 ms `cubic-bezier(.2,.8,.2,1)`. Respect `prefers-reduced-motion` (instant
  swap when reduced).
- **Navbar title modes**: Home shows the PokéPal wordmark + Pokéball; Collection /
  Favorites / Settings show a centered inline title (SF Pro 17px semibold),
  matching iOS large-title→inline convention.
- **Scroll-aware border**: the navbar gains a hairline bottom border only once the
  active screen is scrolled past ~4px.
- Placeholder bodies for each screen (labeled) so navigation is verifiable.
- Keyboard/focus: tabs are focusable and operable via keyboard with visible focus
  rings (`:focus-visible`).
- `npm run build` and `npm run lint` pass; verify tab switching, transitions,
  title modes, and scroll border in the browser.

## Out of scope (later phases)

- Real screen content — Home (5), Collection (6), Favorites/Settings (9)
- The actual Scan flow behind the puck — phase 8
- The card detail sheet — phase 7

## References

- @context/project-overview.md (App Shell & Navigation, Screen transitions)
- @context/screenshots/pokepal_1.png (tab bar, active state)
- @context/features/phase-1-foundation-spec.md
- @context/features/phase-5-home-spec.md
- @context/features/phase-8-scan-spec.md
