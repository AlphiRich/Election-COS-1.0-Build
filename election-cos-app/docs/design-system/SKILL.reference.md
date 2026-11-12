---
name: ecos-design-system
description: Use this skill to design or build any Election-COS 1.0 (ECOS / EC OS) interface or asset — War Room desktop screens, Field mobile screens, RBAC/settings panels, marketing collateral, decks, newsletters. Contains the approved palette, WCAG 2.2 AA rules, type system, layout systems, voice, component reference and RBAC UI patterns.
user-invocable: true
---

# Election-COS 1.0 design system

Paper-and-ink civic document: clean, exact, strategic highlights. Voice is authoritative, calm, precise, empowering and politically neutral.

## Non-negotiables
1. **Eight approved colours only.** Ink #1A2246 (text, headings, dark fields) · Paper #F7F4EE (background) · Amber #B7913F (CTA fill, markers) · Slate #6A6E7E (secondary text) · Blue #33427E (links, secondary actions, info) · Green #2F7E4A (success, "Built") · Roadmap #8A6A2A (planned/in progress, warning text) · Line #DCD6C8 (borders only). Tints are `color-mix()` of these — never new hues. **No red** (no party-colour signifiers): critical = Ink field + Amber glyph.
2. **Contrast.** Ink on Paper 14.05:1 for body. Amber on Ink 5.24:1. **Never Amber text or vital UI on Paper (2.68:1).** Primary button = Amber fill + Ink label. Focus ring: Blue on Paper, Amber on Ink.
3. **Type.** Archivo 700 headings (H1 48/52, H2 32/36, H3 24/30). Public Sans 400/600 body, line-height 1.65 (16/26, 14/23, 12/20). IBM Plex Mono **only and always** for IDs, ward codes (NW405-W07), VD numbers, IEC tracking numbers, capability keys and Rand figures.
4. **Layout.** War Room (desktop): 12 columns, 24px gutter, max 1,200px, Ink left rail. Field (mobile): single column, 48px minimum touch targets, full-width controls.
5. **Imagery.** Authentic, diverse South African civic settings. No ballot-box clichés, no party logos or colours, no candidate faces. Prove capability with crisp vector UI mockups.
6. **Logo.** Use only the approved Primary / Compact / Monochrome symbol files; never redraw. Without them, set "Election-COS 1.0" in Archivo 700 as plain type.
7. **RBAC screens** follow `references/rbac-ui.md` — six roles only, live delegation checks, honest offline-revocation copy.

## Shape & motion
2px control radius, 4px cards/dialogs; hairline Line borders; 2px Ink rule under table headers; whitespace over boxes. Signature accent: a thin Amber line (active nav, tab underline, toast edge, invalid input). Shadows only for dialogs/toasts. 120–180ms colour transitions, no bounce. Hover = one mixed step; press = one deeper; disabled = 45% opacity.

## Copy
Short declaratives ("Comply before you campaign." · "Take the War Room to the Streets." · "Every case, followed through."). Sentence case in UI; uppercase tracked system labels (BUILT, ROADMAP). Second person. Name the law (POPIA, PPFA, IEC). South African English, SAST. No emoji, no exclamation marks in product UI. Paid media carries "Paid for by Innovation Consult (Pty) Ltd".

## Icons
Phosphor duotone (CDN `@phosphor-icons/web@2.1.1`), currentColor.

## Files
- `references/tokens.css` — all CSS custom properties + font/icon imports; paste into any page.
- `references/components.css` — the `.ecos-*` component classes with themed states.
- `references/components.md` — 26 React components: usage + props.
- `references/rbac-ui.md` — role registry, capability matrix, delegation, token and audit patterns.

If invoked without guidance, ask what they want to build (War Room screen, Field screen, collateral, deck), then produce HTML artifacts or production code using these files.
