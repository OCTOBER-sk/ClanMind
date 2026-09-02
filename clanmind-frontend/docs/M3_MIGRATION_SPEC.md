# ClanMind — Google Material 3 UI/UX Migration Specification (Final)

**Version:** 2.0 (Final)
**Status:** Authoritative source-of-truth for the frontend presentation-layer rebuild
**Audience:** The AI coding agent executing the migration
**Scope:** Full presentation-layer rebuild of `clanmind-frontend` to Google Material 3 (Material Design 3 / "M3 Expressive"), preserving 100% of existing product logic, backend integration, and functional requirements defined in the two source-of-truth specs.
**Verified:** 2026-09-02 — M3 Expressive rollout status, `material-web` maintenance status, and MUI's M3 gap were re-checked against current sources before finalizing this document (Appendix A).

---

## 0. How to use this document

This is the **only** visual/UX design authority for the migration.

- Where this document and any older doc (`FRONTEND_BUILD_BIBLE.md`, `UIUX_REFINEMENT_DIRECTIVE.md`, inline CSS comments) disagree on **visuals**, this document wins.
- Where this document and the two product specs disagree on **product behavior or backend contracts**, the specs win and this document must be corrected:
  - `ClanMind_Frontend_Master_Implementation_Specification.md` → cited as **FE §n**
  - `ClanMind Backend — Master Implementation Specification.md` → cited as **BE §n**
- ClanMind is **already built** end-to-end per those two specs. This document does not change what the product does — it changes how it looks and feels. Nothing here invents a new feature, screen, or backend contract.

**Execution rules for the agent:**

1. Work **phase by phase** (§17). Do not start a phase until the previous phase's acceptance gate passes.
2. **Never touch** `src/api/`, `src/state/`, `src/realtime/`, `src/sync/`, `src/local/`, `src/hooks/`, `src/config/`, `src/tauri/`, or any `use*Controller.ts` file except to consume their existing outputs. This is a **presentation-layer rebuild**. The plumbing works and is covered by the existing test suite — do not regress it.
3. Every color, radius, spacing, duration, elevation, and type value **must** be a token from §3–§9. No hard-coded hex, px font-size, or ad-hoc `cubic-bezier` anywhere in feature components (FE §4: "No feature component should invent its own spacing scale").
4. Preserve all state matrices (FE §207–216). A screen is not done until every state renders correctly.
5. The dark-theme base surface is **`#000000` pure black** and stays that way. Hard requirement.
6. Do not delete or weaken any accessibility behavior. Target **WCAG 2.2 AA** (FE §7).
7. Run typecheck + lint + the existing test suite after every phase. Fix what you break before advancing.

**What "done" means (the quality bar):** nothing generic, nothing childish, no default-template look. Every screen reads as a *professional, AI-native team tool* — disciplined like Linear, calm like a good IDE, expressive only when Odin or an artifact is actively doing work. A screen that looks like a stock Material template or a Slack clone has failed (FE §3.1, §325.1).

---

## 1. Why Material 3, and how it's actually implemented

**Decision: implement the real M3 token system on the existing Tailwind v4 + Radix stack. Do not adopt MUI. Do not adopt Google's `material-web`.**

Rationale (re-verified 2026-09):

- **MUI (`@mui/material`) has not shipped Material 3.** Its component theming remains M2-era. Adopting it means an M2/M3 hybrid look, a full restyle of ~200 component files against a different styling engine, and still not true M3.
- **Google's own `material-web` web components remain in maintenance mode.** The repo still carries the "in maintenance mode pending new maintainers" notice; recent npm releases are patch-level only, not feature work. Building on it means depending on a stalled library, fighting Shadow DOM against Tailwind, and reworking desktop density by hand.
- **There is no first-party React M3 library.** The spec-accurate path is to encode M3's own primitives — HCT tonal palettes, color roles, state layers, elevation levels, the M3 type scale, the shape scale, and M3 Expressive motion — as design tokens, and drive the existing Radix headless primitives (which already provide the WCAG-grade accessibility the spec demands in FE §8/§310) with those tokens.
- **Material 3 Expressive is Google's current, live design direction**, not a legacy or superseded system — it rolled out across Android 16 (Sept 2025) and has been progressively rolling out across Google's own apps (Drive, Tasks, Gmail, Photos) through 2026. Building ClanMind on it is building on Google's present house style, not a dated one.

This gives genuine M3 fidelity, keeps the existing test suite and all backend wiring intact, and avoids a dead or non-M3 dependency.

**M3 concepts actually adopted** (not just "rounded corners"):

| M3 concept | What it means here | Section |
|---|---|---|
| **Tonal palettes (HCT)** | 6 palettes (primary, secondary, tertiary, neutral, neutral-variant, error), each a 0–100 tone ramp | §3 |
| **Color roles** | ~26 semantic roles (`primary`, `on-primary`, `primary-container`, `surface-container-*`, `outline`, …) mapped from tones per theme | §4 |
| **State layers** | Hover/focus/press = a tinted overlay at fixed opacity over the base, *not* a different color | §5 |
| **Tonal elevation** | Dark elevation is expressed by lighter **surface-container** tones, not by big shadows | §6 |
| **Type scale** | Display/Headline/Title/Body/Label × Large/Medium/Small, with M3's sizes/line-heights/tracking | §7 |
| **Shape scale** | none→full corner tokens applied by component category, with M3 Expressive's larger, more varied radii | §8 |
| **Expressive motion** | Spring-based spatial motion + standard easing set, mapped onto the spec's duration budget | §9 |

---

## 2. The ClanMind product in one screen (do not lose this)

ClanMind is a **Tauri 2 + React + TypeScript desktop** team environment on a strict `Account → Group → Projects` hierarchy — **no "Workspace" abstraction, ever** (FE §2.1–2.9, §328.3). A **Group** is the team container (Owner/Admin/Member/Guest roles); users belong to many Groups and keep private per-Group nicknames for teammates (FE §2.3–2.6, §86). Each Group has exactly **one shared AI teammate, default name "Odin"** (admin-renamable / avatar-configurable; Assist / Facilitate / Act modes; admin-configured provider / model / BYOK) (FE §2.11–2.15, §129, §156).

The whole UI exists to serve one loop:

> **Conversation → AI → Research → Decision → Artifact → Task → Approval → Execution → Memory** (FE §1)

Core objects: Groups; typed **Projects** (Software / IoT / Startup / Research / College / School / Personal / Other, each with goal, instructions, references, GitHub repo — FE §77); a **single unified message model** filtered by project context (never a second chat backend — FE §81); **private human and private AI** conversations on the same surface with hard privacy indicators (FE §2.10, §55–58); **Tasks** and **Decisions** as first-class objects (FE §119–122); scoped **Memory** (Group / Project / Private, six card types — FE §116); **Live Artifacts** in a right-side work surface with preserved versions (FE §94–110); local-first **Files** with nine sync states (FE §189, BE §4.3); **Meetings** as a first-class mode producing candidate decisions/tasks/questions (FE §123–128, BE §50A); the **Project Garage** as the library of everything useful (FE §87); and **approval-gated GitHub/AI actions** (FE §164A, BE §78A). Local-first: must behave sensibly offline (FE §2.24).

**The emotional arc every screen must protect (FE §326):**

```
Calm → team talks → Odin appears when needed → research arrives →
work surface expands → artifact forms visibly → team decides →
tasks appear → approved work moves toward GitHub → memory updates → calm again.
```

The message every screen sends is *"we work together and Odin helps us move,"* never *"look at all the AI features."*

---

## 3. Tonal palettes (the source of every color)

Source color: **`#4285F4`** (Google Blue) — a deliberately restrained, professional, unmistakably "Google" primary. Palettes below are generated in HCT/CIELAB and gamut-clipped per tone; every role in §4 is picked from these ramps. Do not invent colors outside them except the spectral gradient (§10).

> Ramp key: tone number = perceptual lightness (0 = black, 100 = white).

### 3.1 Primary (P) — hue ≈ 284, from `#4285F4`
```
P-0  #000001   P-10 #001B3F   P-20 #002F65   P-30 #00458E   P-40 #005CBA
P-50 #2375E1   P-60 #4F8EFE   P-70 #8AA8FF   P-80 #B5C4FF   P-90 #DBE1FF
P-95 #EDF0FF   P-99 #FBFCFF   P-100 #FFFFFF
extra: P-4 #000D29  P-6 #001231  P-12 #001F46  P-17 #002959  P-22 #00346D  P-24 #003875  P-87 #D0D8FF  P-92 #E3E7FF  P-94 #EAEDFF  P-96 #F1F3FF  P-98 #F8F9FF
```

### 3.2 Secondary (S) — same hue, muted chroma (C≈18)
```
S-10 #101B33  S-20 #272F4A  S-30 #3E4662  S-40 #565D7B  S-50 #6F7694
S-60 #888FAF  S-70 #A3AACB  S-80 #BEC5E7  S-90 #DBE1FF  S-100 #FFFFFF
extra: S-0 #000001  S-12 #151F37  S-17 #202943  S-22 #2B344E  S-24 #303853  S-87 #D2D9FB  S-95 #EDF0FF  S-99 #FBFCFF
```

### 3.3 Tertiary (T) — cyan, hue ≈ 221, from the spectral gradient's cool mid `#00B8D4`
Used sparingly for accent chips, "AI-active but calm" affordances, and selected-node detail — a bridge between the neutral base and the full spectral moments.
```
T-10 #001F26  T-20 #00363F  T-30 #004E5B  T-40 #006879  T-50 #008397
T-60 #009FB7  T-70 #11BBD7  T-80 #49D7F4  T-90 #A7EEFF  T-100 #FFFFFF
extra: T-0 #000000  T-87 #85E8FF  T-95 #D5F6FF  T-99 #F7FDFF
```

### 3.4 Neutral (N) — the surface/text backbone (C≈2)
```
N-0  #000001  N-4 #0D0E12  N-6 #131316  N-10 #1B1B1E  N-12 #1F1F22
N-17 #292A2D  N-20 #303033  N-22 #343537  N-24 #38393C  N-30 #46474A
N-40 #5E5E61  N-50 #76777A  N-60 #909094  N-70 #AAABAF  N-80 #C6C6CA
N-87 #D9DADE  N-90 #E2E2E6  N-92 #E7E8EC  N-94 #EDEEF1  N-95 #F0F0F4
N-96 #F3F3F7  N-98 #F8F9FD  N-99 #FBFCFF  N-100 #FFFFFF
```
> **True-black override (hard requirement):** in the dark theme, `surface`/`background` = **`#000000`**, not N-6. Surface-container tones step up from black (§4.2). Light theme uses the N ramp as generated.

### 3.5 Neutral-variant (NV) — outlines & secondary text (C≈6)
```
NV-10 #191B23  NV-20 #2E3039  NV-30 #45464F  NV-40 #5C5E68  NV-50 #757781
NV-60 #8E909B  NV-70 #A9ABB6  NV-80 #C4C6D1  NV-90 #E0E2ED  NV-100 #FFFFFF
extra: NV-22 #33343D  NV-24 #373942  NV-87 #D8D9E5
```

### 3.6 Error (E) — M3 canonical red
```
E-10 #410E0B  E-20 #601410  E-30 #8C1D18  E-40 #B3261E  E-50 #DC362E
E-60 #E46962  E-70 #EC928E  E-80 #F2B8B5  E-90 #F9DEDC  E-100 #FFFFFF
```

### 3.7 Extended semantic palettes (success / warning / info)
ClanMind needs success + warning + info as first-class semantics (FE §4). These are **not** part of stock M3 but follow the same tonal method.
```
Success (G) src #00A05A:  G-30 #00522B  G-40 #006D3B  G-70 #3FC178  G-80 #5FDE92  G-90 #7DFBAD
Warning (Y) src #F2A600:  Y-30 #614000  Y-40 #805600  Y-70 #E59D00  Y-80 #FFBA48  Y-90 #FFDDB3
Info      : reuse Tertiary (T) cyan ramp.
```

---

## 4. Color roles (the tokens components actually consume)

Components **never** reference a tone directly. They reference a **role**. Roles are defined once per theme as CSS custom properties, then exposed to Tailwind v4 via `@theme` (§11). All contrast figures below are WCAG 2.2 AA (4.5:1 normal, 3:1 large) unless marked otherwise.

### 4.1 Role list (26 core M3 roles + ClanMind extensions)

`primary, on-primary, primary-container, on-primary-container, secondary, on-secondary, secondary-container, on-secondary-container, tertiary, on-tertiary, tertiary-container, on-tertiary-container, error, on-error, error-container, on-error-container, background, on-background, surface, on-surface, surface-variant, on-surface-variant, outline, outline-variant, inverse-surface, inverse-on-surface, inverse-primary, scrim, shadow`

Plus **M3 surface-container tiers** (the elevation backbone): `surface-container-lowest, surface-container-low, surface-container, surface-container-high, surface-container-highest, surface-dim, surface-bright`.

Plus **ClanMind extensions**: `success, on-success, success-container, on-success-container, warning, on-warning, warning-container, on-warning-container, info, on-info` (info aliases tertiary), and `focus-ring`.

### 4.2 DARK theme mapping (base = `#000000`)

```
/* Surfaces — true-black base, tonal-step containers */
background                 #000000
on-background              #E2E2E6   (16.3:1)
surface                    #000000
on-surface                 #E2E2E6   (16.3:1)
surface-dim                #000000
surface-bright             #38393C
surface-container-lowest   #000000
surface-container-low       #0D0E12
surface-container           #131316
surface-container-high      #1F1F22
surface-container-highest   #292A2D
surface-variant            #2E3039
on-surface-variant         #C4C6D1   (12.4:1 on black; 9.5:1 on surface-container)
outline                    #8E909B   (6.6:1 — meets 3:1 large / UI component contrast)
outline-variant            #33343D   (structural dividers; not a text color)
scrim                      #000000   (used at 60% for modal overlays)
shadow                     #000000

/* Primary */
primary                    #B5C4FF   (12.3:1 on black)
on-primary                 #002F65
primary-container          #00458E
on-primary-container       #DBE1FF   (7.2:1 on container)
inverse-primary             #005CBA

/* Secondary */
secondary                  #BEC5E7
on-secondary               #272F4A
secondary-container        #3E4662
on-secondary-container     #DBE1FF

/* Tertiary (cyan) */
tertiary                   #49D7F4   (12.3:1)
on-tertiary                #00363F
tertiary-container         #004E5B
on-tertiary-container      #A7EEFF

/* Error */
error                      #F2B8B5   (12.3:1)
on-error                   #601410
error-container            #8C1D18
on-error-container         #F9DEDC

/* Extended */
success                    #5FDE92   (12.4:1)
on-success                 #00391C
success-container          #00522B
on-success-container       #7DFBAD
warning                    #FFBA48   (12.4:1)
on-warning                 #432C00
warning-container          #614000
on-warning-container       #FFDDB3
info / on-info             = tertiary / on-tertiary

/* Inverse (for snackbars/tooltips that invert) */
inverse-surface            #E2E2E6
inverse-on-surface         #1B1B1E

/* Focus ring — monochrome, per FE (not blue) */
focus-ring                 0 0 0 2px #000000, 0 0 0 3px #E2E2E6
```

**Dark elevation rule (M3, not shadows):** raise a surface by moving **up** the container ramp — `surface` (#000000) → `surface-container-low` (#0D0E12) → `surface-container` (#131316) → `-high` (#1F1F22) → `-highest` (#292A2D). Shadows in dark are near-invisible and used only for genuinely floating layers (menu/dialog/tooltip). This fixes "cards inside cards on the same black, no depth."

### 4.3 LIGHT theme mapping (base = `#FFFFFF`)

```
background                 #FFFFFF
on-background              #1B1B1E   (16.3:1)
surface                    #FFFFFF
on-surface                 #1B1B1E
surface-dim                #E2E2E6
surface-bright             #FFFFFF
surface-container-lowest   #FFFFFF
surface-container-low       #F8F9FD
surface-container           #F3F3F7
surface-container-high      #EDEEF1
surface-container-highest   #E7E8EC
surface-variant            #E0E2ED
on-surface-variant         #45464F   (9.4:1)
outline                    #757781   (4.5:1 as text / >3:1 as UI edge)
outline-variant            #C4C6D1

primary                    #005CBA   (5.4:1)
on-primary                 #FFFFFF
primary-container          #DBE1FF
on-primary-container       #00184A

secondary                  #565D7B
on-secondary               #FFFFFF
secondary-container        #DBE1FF
on-secondary-container     #101B33

tertiary                   #006879
on-tertiary                #FFFFFF
tertiary-container         #A7EEFF
on-tertiary-container      #001F26

error                      #B3261E
on-error                   #FFFFFF
error-container             #F9DEDC
on-error-container          #410E0B

success                    #006D3B   (5.9:1)
on-success                 #FFFFFF
success-container          #7DFBAD
on-success-container       #00522B
warning                    #805600   (6.5:1)
on-warning                 #FFFFFF
warning-container          #FFDDB3
on-warning-container       #614000

inverse-surface            #303033
inverse-on-surface         #F0F0F4
focus-ring                 0 0 0 2px #FFFFFF, 0 0 0 3px #005CBA
```

### 4.4 State layers (replaces ad-hoc hover colors)

Interaction states are a **tinted overlay** of the *content* color (`on-surface`, or the role's on-color) at a fixed opacity, composited over the base surface. Never swap to a different named color for hover.

```
state-hover     8%   opacity of the layer color
state-focus     10%
state-press     10%
state-drag      16%
state-selected  the primary/secondary-container fill (not an overlay)
disabled        content at 38% opacity; container at 12%
```
Implementation token: `--state-opacity-hover: 0.08`, etc. Apply as `background: color-mix(in srgb, var(--layer-color) 8%, transparent)` on a pseudo-element or overlay div, so it stacks correctly on any surface.

---

## 5. Elevation model

Two mechanisms, used together but weighted by theme:

**Tonal elevation (primary in dark):** raise via the container ramp (§4.2). Level → role:
```
Level 0  surface / surface-container-lowest   (page canvas)
Level 1  surface-container-low                 (resting cards, list rows)
Level 2  surface-container                     (raised cards, message hover, chips)
Level 3  surface-container-high                (menus, dropdowns, snackbar)
Level 4  surface-container-high + shadow-md    (nav drawer, FAB pressed)
Level 5  surface-container-highest + shadow-lg (dialogs, modal sheets)
```

**Shadow elevation (primary in light, accent in dark):**
```
shadow-0  none
shadow-1  0 1px 2px rgb(0 0 0 / .30), 0 1px 3px 1px rgb(0 0 0 / .15)
shadow-2  0 1px 2px rgb(0 0 0 / .30), 0 2px 6px 2px rgb(0 0 0 / .15)
shadow-3  0 4px 8px 3px rgb(0 0 0 / .15), 0 1px 3px rgb(0 0 0 / .30)
shadow-4  0 6px 10px 4px rgb(0 0 0 / .15), 0 2px 3px rgb(0 0 0 / .30)
shadow-5  0 8px 12px 6px rgb(0 0 0 / .15), 0 4px 4px rgb(0 0 0 / .30)
```
In dark theme, shadows are subtle (black-on-black barely reads) — depth comes from tone. Only floating layers (menu/dialog/tooltip/popover) get a shadow **and** a tonal bump. Restraint per FE §13/§325: no shadow on flat list content.

---

## 6. Type scale (M3, mapped to ClanMind)

One UI family + one code family (FE §5).
```
--font-brand:  "Google Sans Text", "Product Sans", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-ui:     "Roboto Flex", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-code:   "Roboto Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
```
> If Google Sans / Roboto are not bundled, `Inter` + `Roboto Mono` are the fallbacks — layout must not depend on the exact face. Ship fonts locally (Tauri offline). **No ultra-light weights for critical text** (FE §5).

**M3 type scale** — `role: size / line-height / tracking / weight`, trimmed toward desktop density (FE §5, §221):
```
display-large    57px / 64 / -0.25 / 400      (marketing/hero only — first launch)
display-medium   45px / 52 /  0    / 400
display-small    36px / 44 /  0    / 400
headline-large   32px / 40 /  0    / 400       (empty-state hero, onboarding)
headline-medium  28px / 36 /  0    / 400
headline-small   24px / 32 /  0    / 400       (page titles: Overview, Settings section)
title-large      22px / 28 /  0    / 400       (dialog titles, artifact name)
title-medium     16px / 24 / +0.15 / 500       (card titles, section headers)
title-small      14px / 20 / +0.10 / 500       (list subheads, tab labels)
body-large       16px / 24 / +0.50 / 400       (message body, long-form reading)
body-medium      14px / 20 / +0.25 / 400       (default UI text, secondary copy)
body-small       12px / 16 / +0.40 / 400       (metadata, timestamps, captions)
label-large      14px / 20 / +0.10 / 500       (buttons, chips, primary controls)
label-medium     12px / 16 / +0.50 / 500       (small buttons, badges)
label-small      11px / 16 / +0.50 / 500       (overline, dense tags)
code             13px / 20 /  0    / 400        (monospace, ligatures contextual)
```
Message bodies use **body-large** for readability (FE §5). Chrome/metadata uses body-medium/small. AI response headings map to title-medium/small so the hierarchy inside a long Odin answer is clear.

---

## 7. Shape scale (corner radius)

M3 Expressive shape tokens, applied by component category:
```
corner-none        0px
corner-extra-small 4px    (text fields, small chips, code blocks)
corner-small       8px    (buttons default, badges, menu items)
corner-medium      12px   (cards, list containers, composer)
corner-large       16px   (dialogs, sheets, artifact panel, large cards)
corner-extra-large 28px   (hero surfaces, FAB, prominent onboarding cards)
corner-full        9999px (avatars, pills, icon buttons, toggle chips, FAB round)
```
**Application map:**
- Buttons: `corner-full` for the M3 pill look (filled/tonal/outlined/text). *Exception:* squarer preference → `corner-small`; default is pill.
- Chips (filter, input, assist, mention token): `corner-small`.
- Cards (task, decision, artifact, garage, source, approval): `corner-medium`.
- Dialogs / bottom & side sheets / artifact work surface / thread panel: `corner-large`.
- Text fields / composer: `corner-medium` (composer), `corner-extra-small` (inline inputs).
- Avatars, IconButtons, FAB, presence dots, toggle pills: `corner-full`.

M3 Expressive shape **morph** (FE §6, "Morph reserved for meaningful transformations"): only for FAB↔sheet expansion and the loading indicator's shape-morph. Do not morph routine controls.

---

## 8. Motion (M3 Expressive springs + the spec's duration budget)

FE §6 sets a strict budget — **micro 80–120ms, small 120–180ms, standard 180–280ms, large 280–420ms** — and no animation may cause typing lag (FE §288). M3 Expressive is spring-based; springs are expressed but clamped to that budget.

**Easing set (M3 standard, for non-spring transitions):**
```
emphasized            cubic-bezier(0.2, 0.0, 0.0, 1.0)     (default for most)
emphasized-decelerate cubic-bezier(0.05, 0.7, 0.1, 1.0)    (enter)
emphasized-accelerate cubic-bezier(0.3, 0.0, 0.8, 0.15)    (exit)
standard              cubic-bezier(0.2, 0.0, 0.0, 1.0)
standard-decelerate   cubic-bezier(0, 0, 0, 1)
standard-accelerate   cubic-bezier(0.3, 0, 1, 1)
```

**Duration tokens (mapped to FE budget):**
```
duration-micro     100ms   (state-layer fade, icon swap, copy→check)
duration-small     150ms   (chip select, tooltip, toggle)
duration-standard  220ms   (panel width, dialog scale, tab slide, node arrival)
duration-large     360ms   (sheet slide-over, drawer, onboarding beats)
```

**M3 Expressive spatial springs (for movement — panels, node arrival, FAB):**
```
spring-fast     ~350ms  cubic-bezier(0.42, 1.67, 0.21, 0.90)   (small quick moves)
spring-default  ~500ms  cubic-bezier(0.38, 1.21, 0.22, 1.00)   → clamp to 360ms in-app
spring-slow     ~650ms  cubic-bezier(0.39, 1.29, 0.35, 0.98)   → onboarding only
```
Effects (opacity/color) never overshoot — use `emphasized`, not a spring.

**Motion verbs (FE §6, unchanged):** Fade = secondary appear/disappear · Slide = panels/drawers · Scale = dialogs/reactions/node creation · Draw = diagram edges/progress · Morph = rare. "Motion communicates state; it is not decoration" (FE §2.28).

**Reduced motion (FE §6, §219, §314) — mandatory:** `prefers-reduced-motion` removes moving spectral lines, removes large panel motion, and replaces artifact construction animation with immediate state changes + text status (`Odin is building the architecture.` → `Architecture ready.`). Never remove information. A frozen rainbow must collapse to solid readable text (contrast-safe).

---

## 9. Spacing, sizing, density, icons

**Spacing scale (4px base):** `4, 8, 12, 16, 20, 24, 32, 40, 48px` as `space-1..space-12`. No component invents its own (FE §4).

**Density (reconciling M3's 48dp default with FE §221's 24px floor / 32–40px core controls):** this is a **desktop** app, so use M3's *comfortable/compact density* deltas:
```
Button height:      sm 32 · md 40 · lg 48
IconButton hit-area: 40 (visual glyph 20–24, padding fills to 40)
List row:           40–48
Menu item:          40
Text field:         48 (composer auto-grows 48→280, FE §43)
Chip:               32
Every interactive target ≥ 24×24 CSS px hard floor (FE §221).
```
This keeps M3 proportions while honoring the spec's desktop density and WCAG 2.2 target-size requirement.

**Icons:** Material Symbols (Rounded, weight 400, optical 20/24). Sizes `16 / 20 / 24` (`icon-sm/md/lg`). Every icon-only control needs a tooltip + accessible name (FE §64). If the repo currently uses `lucide-react`, **migrate icon usages to Material Symbols** for M3 fidelity, keeping a thin `<Icon name=…/>` wrapper so swaps are one-line. Lucide may remain as fallback during migration but the shipped look is Material Symbols.

---

## 10. The spectral gradient under M3 (the anti-generic signature)

The spectral/rainbow accent is what stops this from looking like a stock Material template. **It is an accent, not the theme** (FE §3.3). Keep the existing gradient:
```
--spectral-gradient: linear-gradient(135deg,
  #FF5F6D 0%, #FFC371 20%, #80FF72 40%, #7EE8FA 60%, #EEC0C6 80%, #7E57C2 100%);
```
**Allowed — exactly six uses (FE §3.3):** (1) Odin active state, (2) AI generation status, (3) artifact construction, (4) progress/milestone animation, (5) selected visual state, (6) a few onboarding moments.

**Forbidden (FE §3.3, §325.3):** behind body text · around every card · permanent button fills · default message background · every loading state · any indefinite pulse.

**M3-specific integration rules:**
- The spectral gradient is the only place chroma goes "loud." Everywhere else, color is the restrained tonal system (§4).
- Odin's avatar ring, the AI "working" indicator, and live artifact edges use spectral **while active**, then settle to a static tonal state (`tertiary` cyan) at rest (FE §99, §223).
- Project Pulse travels the gradient **once** per progress change, then stops (FE §85).
- The base UI must remain fully readable in grayscale — spectral is never the sole signifier of any state (FE §3.2, §222). Every spectral moment has a text/shape/icon equivalent.
- Reduced motion freezes and then removes moving spectral; the underlying state stays conveyed by text.

Acceptance for any screen touching AI: `[ ] Spectral accent is restrained` (FE §321).

---

## 11. Token wiring (exact implementation contract)

Single source of truth: `src/index.css` (rewrite) + `src/design-system/tokens/index.ts` (rewrite to reference the CSS vars). No Tailwind arbitrary hex in components.

**`src/index.css` structure:**
```css
@import "tailwindcss";

/* 1) Static tokens exposed to Tailwind utilities */
@theme {
  /* map every role in §4 to a Tailwind color utility */
  --color-primary: var(--md-primary);
  --color-on-primary: var(--md-on-primary);
  --color-primary-container: var(--md-primary-container);
  /* …all 26 roles + surface-container tiers + success/warning/info… */
  --color-surface: var(--md-surface);
  --color-surface-container: var(--md-surface-container);
  /* shape */
  --radius-xs: 4px; --radius-sm: 8px; --radius-md: 12px;
  --radius-lg: 16px; --radius-xl: 28px; --radius-full: 9999px;
  /* motion */
  --duration-micro: 100ms; --duration-small: 150ms;
  --duration-standard: 220ms; --duration-large: 360ms;
  --ease-emphasized: cubic-bezier(0.2,0,0,1);
  --ease-emphasized-decelerate: cubic-bezier(0.05,0.7,0.1,1);
  --ease-emphasized-accelerate: cubic-bezier(0.3,0,0.8,0.15);
  /* type — expose the 16 roles as utilities or a plugin */
}

@layer base {
  :root { /* LIGHT role values from §4.3, as --md-* */ }
  .dark { /* DARK role values from §4.2, base #000000 */ }
}
```
Rules:
- Feature components use `bg-surface-container`, `text-on-surface`, `rounded-md`, `duration-standard`, etc. — **never** `bg-[#131316]`.
- `tokens/index.ts` re-exports the same roles as JS constants (for `recharts`, `@xyflow/react`, canvas, and inline-style needs) by reading the CSS vars, so charts/diagrams theme correctly in both modes.
- Theme switch = toggling `.dark` on `<html>`; Settings offers light / dark / system (FE §281). System uses `prefers-color-scheme`.
- Keep existing `.selectable-text`, Tauri drag-region, and scrollbar rules; restyle the scrollbar thumb to `outline`/`outline-variant`.

---

## 12. Component library — M3 restyle spec

Rebuild every primitive in `src/design-system/components/` on Radix (keep the a11y wiring; swap the visual layer). Each component gets its M3 identity, variants, and the states it must render (FE §207/§215/§216). **Backend-permitted actions only** render (FE §25, §325.10).

### 12.1 Foundational primitives

**Button** — M3 five variants (replace current `primary/secondary/outline/ghost/danger/spectral`):
```
filled     bg=primary        text=on-primary          (primary CTA)
tonal      bg=secondary-container text=on-secondary-container  (secondary CTA — was "secondary")
outlined   border=outline    text=primary  bg=transparent
text       text=primary      bg=transparent           (was "ghost")
elevated   bg=surface-container-low + shadow-1 text=primary
destructive= filled but role=error/on-error           (was "danger")
spectral   = tonal shell + spectral state-layer, ONLY for "Ask Odin"/AI-invoking CTAs
```
Shape `corner-full`. Heights sm32/md40/lg48 (§9). State layer (§4.4) on hover/focus/press. States (FE §215): default, hover, focus-visible (focus-ring), pressed, loading (spinner + `aria-busy`), disabled (38%), success (temporary check + `Copied`/`Saved`), destructive. Keep `leftIcon/rightIcon/loading/success` API so callers don't change.

**IconButton** — 40px hit-area, glyph 20/24, `corner-full`, state-layer circle on hover. Standard / filled / tonal / outlined. Tooltip mandatory.

**FAB / Extended FAB** — new for M3: primary action affordance where appropriate (e.g. "New Project", "Ask Odin" in narrow mode). `corner-large`/`corner-full`, `tertiary-container` or `primary-container`, shadow-3. Use sparingly; desktop app leans on toolbar buttons, so FAB mainly in <900px sheet mode.

**Input / Text field** — M3 **outlined** text field by default: `outline` border, label floats to a notched position on focus/fill, `primary` border + 2px on focus, `error` + helper text on invalid. Filled variant for search. States (FE §216): default, focused, filled, invalid, valid, disabled, read-only, loading. `corner-extra-small`.

**Textarea** — outlined, auto-grow (composer uses its own rules §14.3).

**Select / Dropdown / ContextMenu (Radix Menu)** — M3 menu: `surface-container-high`, shadow-2, `corner-extra-small` container, 40px items with leading icon slot + trailing shortcut, state-layer rows, selected = `secondary-container`.

**Checkbox / Switch / Radio** — M3 shapes: checkbox `corner-extra-small` with `primary` fill when checked; **Switch** = M3 track+handle (handle grows when on, `primary` track, `on-primary` handle, optional check icon). Focus-ring on all.

**Tabs** — M3 primary tabs: `title-small` labels, active indicator = 3px `primary` bar with `emphasized` slide, `on-surface-variant`→`primary` text, state-layer on hover.

**Chip** — filter / input / assist / suggestion. `corner-small`, 32px, `outline` border (unselected) → `secondary-container` fill (selected) with leading check. Mention tokens and context chips are input chips.

**Badge** — M3 small/large badge; status pills (task status, risk level, sync state) are **tonal containers** (e.g. `warning-container`/`on-warning-container`) — **never raw ALL-CAPS enum values** (fixes the `IN_PROGRESS`/`TODO` leak — see §13 humanization map).

**Avatar** — `corner-full`, initials fallback on `secondary-container`. Odin's avatar gets the spectral ring **only while active** (§10).

**Tooltip** — M3 plain tooltip: `inverse-surface` bg, `inverse-on-surface` text, `corner-extra-small`, body-small, short (FE §64 "not paragraphs").

**Dialog** — `surface-container-high`, `corner-large`, shadow-5, scrim 60%, scale-in 220ms `emphasized`. Focus trap, Esc-to-close-when-safe, title (title-large), explicit actions bottom-right (FE §66).

**Sheet (side/bottom)** — `corner-large` leading edges, slide 360ms `emphasized-decelerate` in / `emphasized-accelerate` out. Used for narrow-mode right surface and mobile-width nav.

**Toast / Snackbar** — M3 snackbar: `inverse-surface`, single line + optional action, bottom, 4–6s, `corner-extra-small`. Policy (FE §65): yes for copy/save/invite/reversible-delete/bg-job; no for destructive confirm / long instructions / ongoing AI.

**Progress** — M3 linear + circular; **M3 Expressive loading indicator** (shape-morph) allowed for Odin "working" where a spinner would otherwise sit; wavy linear for determinate long jobs. Determinate for measurable work, indeterminate only for short actions (FE §180).

**Skeleton** — `surface-container` blocks with a subtle shimmer (not spectral), for content loading (FE §180).

**ScrollArea** — Radix; thin thumb `outline-variant`→`outline` on hover.

**CommandPalette (cmdk)** — see §14.7.

### 12.2 Product components (restyle, keep logic)

`AppShell, GroupSwitcher, ProjectSwitcher, LeftNav, TopBar, MemberList, MessageList, MessageRow, MessageActions, ReactionPicker, ThreadPanel, Composer, AttachmentTray, MentionPicker, SlashCommandPicker, AIMessage (MessageRow AI mode), AiStatusIndicator, AiToolTimeline, Citation, SourceCard, ResearchDrawer, ArtifactPanel, ArtifactToolbar, ArtifactVersionMenu, ChartViewer, DiagramViewer, DocumentViewer, TableArtifactViewer, GarageCard, LocalFileTreeView, FileSyncIcon, TaskCard, DecisionCard, MeetingPanel, MeetingActiveHeader, ApprovalCard, GitHubActionCard, GitHubDiffViewer, GitHubPanel, SyncBanner, SyncConflictCard, AiQuotaCard, NotificationCenterPanel, ActivityView, SettingsView` (full inventory FE §310).

Each keeps its current props/controller wiring; only the render + className layer changes to tokens.

---

## 13. Content humanization map (fixes the "childish / broken" look)

The single biggest "unpolished" tell is raw backend enums leaking to the screen (`IN_PROGRESS`, `TODO`, `PROPOSED`, `REMOTE_CHANGED`). **No raw enum or SCREAMING_SNAKE value ever renders.** Extend the central display maps that already partly exist (`taskDisplay.ts`, `decisionOrdinal.ts`, `notificationDisplay.ts`, `FileSyncIcon.tsx`) — don't fork them:

```
Task status:    TODO→"To do"  IN_PROGRESS→"In progress"  BLOCKED→"Blocked"
                IN_REVIEW→"In review"  DONE→"Done"  CANCELLED→"Cancelled"
Priority:       LOW/MEDIUM/HIGH/URGENT → "Low/Medium/High/Urgent" (tonal chip, color by level)
Decision status:PROPOSED→"Proposed"  APPROVED→"Approved"  REJECTED→"Rejected"  SUPERSEDED→"Superseded"
Risk level:     READ_ONLY→"Read-only" LOW/MEDIUM/HIGH/CRITICAL → sentence case, tonal container
AI run state:   QUEUED→"Odin is starting…" RUNNING→"Odin is working…" STREAMING→(live) … (FE §134A)
Sync state (9): SYNCED→"Up to date" LOCAL_ONLY→"On this device" UPLOADING→"Saving…"
                DOWNLOADING→"Getting latest…" REMOTE_CHANGED→"Update available"
                CONFLICT→"Needs review" ERROR→"Sync problem" PENDING→"Waiting to sync" STALE→"Out of date"
Index state:    INDEXED / INDEXING("Preparing for Odin…") / NOT_INDEXED / STALE / INDEX_ERROR
Notification:   map all categories per FE §171 to friendly section names.
```
Status chips use tonal containers (§12.1 Badge): To do = `surface-variant`, In progress = `info/tertiary-container`, Blocked = `warning-container`, Done = `success-container`, Cancelled = `outline` text. Never the four-caps token.

Also fix, per known repo issues: (a) truncated titles get a tooltip with full text; (b) sidebar project name + percent must not collide — use a two-line row or a right-aligned pill with min-gap; (c) hide the `@xyflow/react` "React Flow" attribution watermark via `proOptions={{hideAttribution:true}}` (allowed for the OSS build) or CSS; (d) the artifact panel must render diagrams at a **legible default zoom (fit-to-width)**, never a tiny default zoom.

---

## 14. Screen-by-screen M3 specification

Every screen keeps its FE-spec behavior; below is the M3 visual treatment + the states that must render. Section refs point back to the FE and BE specs so nothing is lost.

### 14.0 Shell (all screens) — FE §12–20, §195, §199, §249, §286
Three-pane desktop shell: **TopBar** (level 0, `surface`, bottom hairline `outline-variant`) · **LeftNav** (navigation rail/drawer, `surface-container-low`) · **Center** conversation (`surface`) · **Right** contextual work surface (`surface-container-low`, `corner-large` leading edge, shadow only when floating).

- LeftNav = M3 **navigation drawer** ≥1200px (icon+label, active item = `secondary-container` pill, `corner-full`), collapses to a **navigation rail** (icon-only, tooltips) 900–1199px, and to a bottom/hamburger sheet <900px. Sections: Projects (active/other), Team, Garage, Activity, Settings — flat, no deep tree (FE §17).
- TopBar: `ClanMind · Group ▸ Project · [Search Ctrl+K] · sync · notifications · profile` — must answer "where am I" (FE §14). Group/Project switchers are M3 menus (§12.1).
- **Responsive (FE §13):**
```
≥1440  three-pane · 1200–1439 compressed · 900–1199 two-pane (right→sheet) · <900 single + sheets
```
Composer stays bottom-anchored in every mode. Right surface must **not** occupy half the screen when empty (FE §12) — collapse to a thin edge/hidden.
- SyncBanner states (FE §185): connected=invisible · "Reconnecting…" · "Offline" · "Syncing N changes…" · "✓ Synced" (count from real PENDING ops). Style = slim `surface-container-high` bar, `info`/`warning`/`success` leading dot.
- Per-feature ErrorBoundary + global catastrophe screen (FE §199, §286): "ClanMind encountered an unexpected problem. Local drafts are preserved." + Restart / Copy diagnostics, on `surface`, headline-small.
- Persist: window size/pos/maximized, sidebar width, artifact width, last Group/Project (FE §195). Panel resizer needs a keyboard alternative (FE §220).

### 14.1 Auth / onboarding — FE §67–79, §197, §322
- Login/Signup on `surface` (dark = pure black), centered card `surface-container-low` `corner-large`, `ClanMind` wordmark in `--font-brand` headline. Outlined text fields, filled primary button. First launch extremely clean (FE §68); recovery must not reveal whether an email exists.
- First-launch hero (FE §69): "A shared project room for people + AI." + Create a group / Join a group. Minimal motion: logo, **one spectral line**, soft fade (allowed spectral moment).
- Create-Group flow (FE §70–77): ≤7 short, skippable steps. Odin intro card (FE §73) uses the spectral ring on Odin's avatar. **AI-potential demo (FE §74–76):** the 10-beat animated story (chat → @Odin → research → source cards → panel expands → diagram nodes → decision → tasks → GitHub approval → settle) — the showcase; use node-arrival scale + one-time edge draw + spectral-while-active, all reduced-motion aware. No 20-step onboarding, no configure-everything-first (FE §325.12–13).
- Empty states (FE §78–79, §179): every one says what's empty, why it matters, what to do next. Illustration optional but not childish.
- Session expiry (FE §197): "Your session expired. Local work is safe." + Sign in again; queued work preserved.

### 14.2 Main chat — FE §21–60, §80–81, §217, §320
The core screen. M3 treatment:
- Header (FE §80): group/project title (title-medium), context chip `Project: …` or `Group chat` (input chip), Search, Meeting toggle, presence cluster.
- Messages (FE §22–24): comfortable **max reading width** (~720px) for prose; full width only for AI research/tables/code/artifacts. Consecutive same-author messages grouped under one avatar/name. Body = **body-large**. Row bg `surface`; hover = state-layer, not a new card. Avatars `corner-full`.
- Hover/focus actions (FE §25): Reply · React · Copy · More (Edit/Delete/Pin/Quote/Create task/Save decision/Use as context/Mark unread) — only backend-permitted ones; important controls not hover-only (FE §325.8) → also reachable via keyboard/`More`.
- Copy (FE §26–27): icon→check + "Copied" tooltip, reset ~1.5–2s, no big toast; preserves Markdown/code. Code block toolbar: language + Copy + optional Copy Markdown.
- Reactions (FE §28–29): quick set 👍❤️😂🔥 + `+` picker; toggle; scale `0.85→1` once, no bounce, no repeat; optimistic + rollback.
- Threads (FE §30): open in the **one** primary right surface (tabs if artifact competes — never stacked overlapping panels); Esc closes, restores focus.
- Edit/delete/pin (FE §31–33): inline edit (Enter save / Shift+Enter newline / Esc cancel), subtle "edited"; soft-delete "This message was deleted." with no empty gap; pin indicator + pinned surface.
- Mentions (FE §34–36): caret-tracked, viewport-clamped `@` popover, group members + **Odin as distinct AI entry**; tokens are stable-ID chips (input-chip style, subtle); mention → subtle highlight + Activity + preference OS notification, no full-screen interruption.
- Typing/presence/unread (FE §37–41): ephemeral "typing…"; subtle presence (don't overuse dots, FE §18); "── New messages ──" divider; `↓ N new messages` button. **Auto-scroll only when near bottom; never move the viewport while the user reads** (FE §41, §217, §325.6).
- Virtualization: `@tanstack/react-virtual`, stable keys, preserved anchors, 10k+ messages, no scroll jump (FE §202, §289, §318).
- Message state matrix (FE §209): normal, hovered, focused, pending, failed(`Not sent · Retry`, text kept), edited, deleted, mentioned, reply-target, search-highlighted, selected.

### 14.3 Composer — FE §42–60, §208 (a first-class writing surface)
- Outlined container `corner-medium`, `surface-container-low`, auto-grow 48→220–280px then scroll; must not eat the conversation, must not feel cramped (FE §43, §325.18).
- Left: attach IconButton; `/` and `@` triggers; right: Send FAB-ish filled IconButton (disabled/subdued when empty; enabled + state layers when filled; brief sending state; dedupe the pending op only — never lock the whole composer, FE §242).
- Keyboard (FE §44): Enter send / Shift+Enter newline, invertible preference; native undo/redo intact. Focus stays after send; failed send keeps draft + Retry (FE §46, §245).
- Attachments (FE §47–53): AttachmentTray chips (icon/name/size/remove) with states selected→uploading(`name · 64%` + Cancel)→uploaded→`Uploaded · Preparing for Odin…`→failed(`Couldn't upload this file.` Retry/Remove). Small thumbnails. Drag overlay "Drop files to attach"; paste maps text→text/image→attachment/url→text; **never auto-send, never silently drop.**
- Slash menu (FE §54): Ask Odin / Private / Meeting / Research / Memory / Project, icon+desc, keyboard filter. `/private` → recipient chooser → header becomes `🔒 Private with Odin/Arun` (unmistakable privacy scope, always-visible recipient, guard stale selection — FE §55–58).
- Reply mode chip "Replying to Arun" + quoted preview + ×. Near-limit char counter for long bodies.
- Full composer state matrix (FE §208): empty, focused, typing, mention-picker, command-picker, attachments, uploading, ready, sending, offline, queued, failed, AI-command, private, reply.
- Offline composer (FE §183–184): still sends into queue, `Queued · Offline` chip at normal visual weight + small clock/network glyph.

### 14.4 Project overview + navigation — FE §82–85, §265–271
- Project tabs (FE §82): Overview · Conversation · Artifacts · Tasks · Decisions · Context · GitHub (M3 tabs, no deep hierarchy). Feature-flagged tabs (GitHub) hidden when off (FE §165A).
- Overview (FE §83): a concise operating view — Goal, **Project Pulse**, Current focus, Open decisions, Active tasks, Recent artifacts, Recent activity, GitHub status. Cards on `surface-container-low`/`surface-container` (distinct tones give visible depth).
- **Project Pulse (FE §84–85):** progress bar/marker; on change, marker moves and a spectral sweep travels the bar **once**, number updates, settle. Never animate continuously; never a cluttered dashboard (FE §325.20). Layout:
```
PROJECT PULSE                                   68%
Goal      ●───────────────
Focus     Authentication
Blocked   GitHub OAuth decision
Next      Finalize API contract
Odin      2 unresolved decisions need attention.  [Review →]
```
- Switching project preserves drafts/scroll/panel state, changes default AI scope, refreshes side surfaces, **never leaks project A into B** (FE §192, §268, §306).

### 14.5 Team — FE §18, §86, §272–273
Member list rows (`surface-container-low`, 48px): avatar, name/nickname, role badge (Owner/Admin/Member/Guest — compact tonal), professional presence, current project. Row actions: Private chat, Mention, Profile, "Nickname for me." Don't overuse status dots; don't show disabled admin controls to members without reason (FE §20). Odin profile = `Odin · AI teammate`, skills, current config where allowed.

### 14.6 Garage + file viewers — FE §87–93, §257–259, §187–189
- Feels like a **project library**, not an uploads folder. Sections: All / Artifacts / Files / Research / Pinned / Recent (M3 tabs or segmented). Grid of cards (visual artifacts) + list (technical files), remember preferred view locally. Cards `corner-medium`: preview, title, type, creator, updated, version, pin; hover Open/Pin/More. Pinned first.
- File viewer (FE §91–93): header (name/type/size/sharing) + Use as context / Send to chat / Open locally / More. PDF viewer (pages, zoom, search, fit-width, lazy pages, page-linked AI refs). Image viewer (fit/zoom/pan/copy/open).
- Local folder connect (FE §187–189): "Connect a local folder. ClanMind will only access the folder you choose." Tree: name, type, modified, **sync-state icon (9 states, §13)** + index state as a second subtle indicator; plain-language tooltips; never expose unauthorized absolute paths.
- Snapshots (FE §258–259): snapshot card (title/date/counts/commit) + `Current vs Snapshot` compare.

### 14.7 Command palette / search — FE §61–63, §175–178, §233–235, §304
`Ctrl/Cmd+K` (cmdk). M3 dialog `surface-container-high`, `corner-large`, shadow-5. Sections: Messages, Files, Artifacts, Tasks, Decisions, People, Projects, Commands — commands contextually ranked for current view (Linear-style grouping, not a clone). Rows: type icon, title/snippet, author, date, project. Debounce 200–250ms, cancel stale, privacy-filter. Open → group→project→load→scroll→**subtle** highlight (FE §177, §246). Empty: "No matches. Try a shorter phrase or another filter."

### 14.8 Artifact work surface — FE §94–111, §200, §248–256, §290–291, §321
The signature ClanMind experience. Right-side panel, `surface-container-low`, `corner-large` leading edge.
- Open (FE §95, §248, §252–253): expand panel width (spring-default clamped 360ms), **preserve chat scroll**, auto-open only when the user explicitly requested a substantial output or backend names a primary artifact; never steal focus from a typing user; close restores chat width + focus; no violent reflow.
- Header (FE §96): artifact name (title-large), `Type · v4`, Pin, Version menu, More, optional `3 teammates here`.
- **Live construction (FE §97–100):** progressively create nodes/cards/sections as backend events arrive; only changed items animate. Node arrival = fade + slight scale + settle. Edge = draw along the path **once** then static. Spectral edges move only while creating/updating — **never pulse forever** (FE §99). Completion = status "Ready", toolbar activates, **one subtle completion glow, no confetti** (FE §100). Reduced motion → immediate state + text ("Odin is building the architecture." → "Architecture ready.").
- Types (FE §101): Document, Markdown, Diagram, Flowchart, Architecture, Graph, Chart, Timeline, Mind map, Table, Research, Image, Interactive, Code, HTML, Git diff. **Default zoom = fit-to-width.** `@xyflow/react` attribution hidden (§13).
- Versions (FE §102–103): v4/v3/v2/v1 with creator/timestamp/source-run; View / Compare / Restore; type-aware compare (doc diff, diagram structural diff, table changed rows, changed task cards) — **no raw JSON by default**.
- Fullscreen + zoom (FE §104–105): Esc exits; +/−/Fit/Reset with keyboard equivalents.
- Selection (FE §106–107): selected node = strong `primary`/spectral outline + details panel + **`Ask Odin about this`** (attaches selected object ID/context to the AI request).
- Comments, presence, context actions (FE §108–110): comment/reply/resolve; realtime `3 viewers`/`Arun is editing`; Use as context / Send to chat / Create task / Create decision / Pin / Export.
- Permissions (FE §111): creator edits own; Admin/Owner full; Member view/comment/context; Guest view — hide unavailable actions.
- Export (FE §254): MD/SVG/PNG/PDF/JSON/source — only supported ones; share defaults to Group/Project, never accidental web publish (FE §255); delete = soft + undo + admin recovery (FE §256).
- Failure (FE §200, §291): "This artifact was created by a newer ClanMind version. Update to view it." / "…cannot be rendered in this version." + view raw/export/update. **One broken artifact must never break chat** (FE §325.9).
- State matrix (FE §211): loading, generating, updating, ready, version-switching, compare, editing, conflict, failed, deleted, restoring. Multiple artifacts: newest active, older in tabs/recents/Garage (FE §251).

### 14.9 Context page + inspector — FE §112–115, §260–261
Context page: Goal, Instructions, References, Files, Artifacts, Decisions, Memory summary, GitHub, Skills — clearly distinguishing shared vs local-only vs AI-eligible. `Use as Project Context` → "Odin may reference this item when working on this Project." Indicator `✓ Used by Odin`. Inspector shows **human-readable provenance** ("Odin used: Architecture v3 / Decision #14 / requirements.pdf / 6 recent messages / Web research"). **Never** show secret system instructions or chain-of-thought (FE §261, §325.5).

### 14.10 Team memory — FE §116–118
Three sections: Group / Project / Your Private. Six card types (Decision, Constraint, Convention, Preference, Finding, Lesson), each `corner-medium` card showing source/created/updated/scope, tonal type badge. Candidate card: "Odin noticed a possible project memory / '…' / [Save] [Dismiss]." Explicit "Remember this" → scope chooser (Project/Group/Private), default Project inside a project. Private AI never auto-enters public memory (FE §57).

### 14.11 Tasks & decisions — FE §119–122
- TaskCard (`corner-medium`): title, owner avatar, status chip (§13), priority chip, due, related decision — compact. DecisionCard: `Decision #14`, title, `Status: Approved` (tonal), Reason, Sources, Approved by.
- Chat → Task/Decision: prefilled forms keeping the **source message link**; decision defaults to "Proposed."
- Optimistic status updates reconcile 409 conflicts into the FE §186 conflict card.

### 14.12 Meeting mode — FE §123–128, §124A, §213, §263, BE §50/§50A
First-class mode, **not a separate app** (FE §325.14). Active header: `● Meeting`, `00:42:13`, Pause, End (the meeting dot uses `error`/live red, not spectral). Panel sections: Live notes, Potential decisions, Action items, Open questions, Odin suggestions; candidate cards Accept/Edit/Dismiss.
- Candidate lifecycle (FE §124A, BE §50A) — real `meeting_candidates` rows: type→section (DECISION→Potential decisions, TASK→Action items, OPEN_QUESTION→Open questions, **CONTRADICTION→distinct inline treatment, not folded into questions**, RESEARCH_NEED→Odin suggestions + `/research` shortcut, MILESTONE_CHANGE→inline Pulse note). status→card (PENDING active / ACCEPTED collapsed row linking real object via `promoted_to_id` / REJECTED recoverable in session "Dismissed" / MERGED hidden note / EXPIRED silent only via explicit end-skip). **Accept waits for backend promotion before collapsing** (FE §124A.2).
- Odin facilitation (FE §125): identify decisions/tasks/contradictions, suggest research, focused questions; unprompted only when active + high-value + high-confidence + cooldown; must not interrupt continuously.
- End (FE §127–128): summary `Decisions 4 / Tasks 7 / Questions 3 / Research 2` → Review & Save (unresolved PENDING included, not silently expired); saved summary → optional Garage artifact.
- State matrix (FE §213): not-started, starting, active, paused, ending, summary-ready, saved. Entry point hidden when `meeting_mode` flag off (FE §165A.2). Updates never interrupt an active meeting (FE §309).

### 14.13 AI surfaces in chat — FE §129–158, §210, BE §52–§57A, §78A, §141
- Identity (FE §129): "Odin / AI teammate" (configured name everywhere). Status vocabulary (FE §130): Available, Working, Researching, Building, Waiting for approval, Limited, Offline — **avoid "thinking"** (implies hidden reasoning).
- AI message (FE §131): AI avatar (spectral ring while active), name, subtle accent, content, source/tool metadata, actions. **No huge colored AI bubble; not every response a big card** (FE §325.2). Same row style as human messages with a subtle `tertiary`/spectral accent edge.
- Working indicator (FE §132): "Odin is researching…" + high-level activity (🌐 Searching current sources… / 📄 Reading project references… / ✦ Building architecture…), not private reasoning. Use the M3 Expressive loading indicator (shape morph) or spectral pulse **while active only**.
- Tool timeline (FE §133): "✓ 6 sources found / ✓ 3 relevant / • Synthesizing…," auto-collapses on completion. Tool cards show `tool_name`, never "thinking."
- Streaming (FE §134–135, §203): shell created immediately; incremental Markdown; batch deltas at render-friendly cadence; **only the active message rerenders** — never the whole list/nav/artifact tree per delta (perf: FE §288 zero typing lag).
- Canonical run states (BE §52, must map 1:1): QUEUED→"Odin is starting…" (subdued pulse, no content) · RUNNING→"Odin is working…" · WAITING_TOOL→tool card visible · STREAMING→incremental · COMPLETED→final + sources + artifacts · FAILED→AI Error card · CANCELLED→"Stopped," partial preserved. Tool-call states (BE §57A): PENDING/APPROVED(HIGH/CRITICAL gate — a tool card can become an ApprovalCard mid-stream)/EXECUTING/SUCCEEDED/FAILED/DENIED.
- Cancel/retry/regenerate (FE §137–139): Stop while active preserves partial + offers retry; retry = **new run** (never overwrite); regenerate producing an artifact = **new version**, not overwrite.
- Error (FE §140): "Odin couldn't complete this response. / Provider temporarily unavailable." + Retry / Try fallback.
- **Quota (FE §141, BE §94)** — branch on exact contract `{code: APPLICATION_AI_QUOTA_EXHAUSTED, can_continue_with_byok}`: `true` → near-invisible, subtle "Odin · BYOK" indicator, continue; `false` → "Application AI quota reached. An administrator can configure BYOK to continue." + Open AI settings **for admins only**. Never a generic "AI unavailable" for this code. Fallback (FE §142): subtle "Odin · fallback model," no alarm.
- Research (FE §143–148): "Web research · 8 sources" when web used (no "No web" label otherwise); inline citations + citation popover (title/domain/retrieved/Open↗) + SourceCards; **ResearchDrawer** in right surface (Summary, Findings, Sources, **Project Impact** — a signature block "This affects the current database decision because…," Uncertainty) while the response stays in chat; deep-research staged progress (Planning → Searching → Reviewing → Cross-checking → Synthesizing → Validating citations).
- Proactive Odin (FE §149–150): high-confidence/high-value only in normal mode ("Odin noticed two conflicting architecture assumptions." + Review); admin setting Off/Low/Balanced/High, default Balanced; lower than in meetings.
- Skills (FE §152–155): explicit `/research`; show "Skill used: Deep Research"; skill cards show Name/Description/Scope/Enabled/Required tools/Risk; file-read or GitHub-write skills flagged "High access" with the consequence explained.
- AI state matrix (FE §210): queued, working, tool-active, streaming, completed, failed, cancelled + overlays fallback / approval-pending. Accessibility: announce only Odin started/completed/failed — **never per token** (FE §218).

### 14.14 Approvals (generic) — FE §164A, §300–302, BE §78A
One reusable **ApprovalCard** drives every HIGH/CRITICAL AI action; `GitHubActionCard` is a specialization, not a parallel path. Card fields (FE §164A.1, BE §78A): action_kind (human-readable), risk_level chip (READ_ONLY/LOW/MEDIUM/HIGH/CRITICAL, tonal — not scary red unless destructive, FE §300), payload summary (per-`action_kind` renderer), requested_by (AI run + triggering user), created_at/expires_at, [Reject] [Approve]. **Client never sends `approved:true`** — Approve submits the exact displayed `payload_hash` + `payload_version`; approve validity never cached (FE §164A.2, BE §78A.1). Status→state (FE §164A.3): PROPOSED "Odin is preparing this action" · WAITING_APPROVAL active · APPROVED "Approved — starting…" · EXECUTING progress (no approve/reject, optional Cancel) · SUCCEEDED collapsed + result link · FAILED retry-eligible · REJECTED "Rejected by {name}" · EXPIRED → "This action changed since you last saw it. Review the latest version before approving." + single `Review latest` (never silently retry old hash, FE §301). Non-GitHub examples (FE §164A.5): bulk artifact deletion, bulk task reassignment, memory purge. Permission denial copy (FE §302): "Only Owners and Admins can change Group AI settings." — never internal codes.

### 14.15 GitHub — FE §159–165, §214, §231, §238, §298–299, BE §76–§80
Panel: Connected, `owner/repo`, branch, last synced, pending actions, PRs. Public URL = read only; write requires Connect GitHub (FE §160). ActionCard (FE §161): "Odin wants to change GitHub / feat/auth-flow / +auth.ts +routes.ts ~README.md / Risk: High / [Review changes]." DiffViewer (FE §162, §299): file tree, diff, +/− counts, syntax highlight, hunk collapse, copy, PR preview; show exact files/base/target/counts/risk before approval. Approval dialog enumerates effects (FE §163). Merge gated by `github_merge` flag (FE §164). Connection states (FE §165, §214): not-connected, connecting, read-only, read/write, needs-reauth, disconnected + action-pending/approval-required/executing/PR-created/failed. Disconnect (FE §231): "ClanMind will stop repository actions. Existing project history remains." Offline (FE §238): "GitHub requires an internet connection. Your local project is still available." Never silently delete local files / reset tree / overwrite (FE §298).

### 14.16 Activity + notifications — FE §36, §171–174, §276–278, BE §95/§95A
Activity = attention view (mentions, replies, reactions, approvals, task assignments, key AI events — not every presence event, FE §172). Categories map 1:1 to backend (FE §171): MENTION→Mentions, PRIVATE_MESSAGE→Private, AI_RESPONSE→AI, AI_ACTION_APPROVAL→Approvals, TASK_ASSIGNMENT→Tasks, DECISION_APPROVAL→Decisions, ARTIFACT_READY→Artifacts, GITHUB_EVENT→GitHub, MEETING_SUMMARY→Meeting, PROACTIVE_AI→Odin suggestions, SYSTEM→System. Channels In-app/Desktop/Email. OS notifications (FE §174) only for mention/private/approval/task-assignment/critical-system; option to hide content in previews. Batching when away (FE §173): "12 new messages. Arun, Priya and Odin mentioned you." Read state subtle badge, mark read only when viewed. Deep link → load → scroll → brief highlight (FE §247, §177). Delivery states exposed **verbatim** only in Sync Diagnostics (FE §171A).

### 14.17 Settings — FE §166–170, §279–282, §323
Two-column M3 layout: sections list (nav rail) + detail. Sections: General, Members, AI, Skills, Research, GitHub, Notifications, Usage, Security, Danger Zone. **AI**: Identity, Provider, Models, Fallbacks, Research, Skills, Permissions (8 toggles FE §169), Proactivity; personality presets Balanced/Direct/Creative/Analytical/Custom + textarea. **BYOK** (FE §156–157): Provider, API key, Test connection (Testing…/Connected/3 models found; fail "Couldn't authenticate. Check the provider key."), Primary + Fallback 1–3; **never reveal a saved key**; removal explains consequence. **Members** (FE §170, §229–230): admin invite/role/remove/ownership-transfer with confirm dialogs; member sees own profile/prefs/nicknames. **Appearance** (FE §281): theme light/dark/system, Group avatar (upload or generated initials), limited accent. Save discipline (FE §279–280): dirty indicator only when meaningful; section-level save for AI/GitHub/permissions, auto-save for simple prefs. **Danger Zone** (FE §228, §282): visually + structurally separate, `error` accent, explains recovery window. **Sync Diagnostics** (FE §285): Connection, Protocol version, Last sequence, Last sync, Pending ops, Conflicts — excludes keys/private conversations/secrets (FE §287). **Guest UX** (FE §303): clean restricted nav, **not a sea of disabled controls**.

### 14.18 Feature-flag absence — FE §165A, BE §166
Flags: `meeting_mode, proactive_ai, github_write, github_merge, custom_skills, deep_research, offline_sync_v2, interactive_artifacts`. When off, entry points are **hidden entirely, not shown-disabled** (a greyed button is worse than absence). Nav items and header buttons must be conditionally absent, and **layouts must not break with items missing** — verify each responsive mode with flags off.

---

## 15. Cross-cutting rules the rebuild must not break

- **State matrices are mandatory (FE §207–216).** Every interactive surface renders: default, hover, focus, pressed, selected, disabled, loading, success, error, offline, permission-denied — plus the component-specific matrices (composer §208, message §209, AI §210, artifact §211, file §212, meeting §213, GitHub §214, button §215, input §216). File state = **two indicators**: primary = sync (9 states, BE §4.3), secondary = index (5 states), with STALE distinct from INDEXING.
- **Loading vocabulary (FE §180):** skeletons for content, progress for measurable work, status indicators for AI, spinners only for short actions — never one full-screen spinner for everything (FE §325.15).
- **Error copy formula (FE §225):** *what happened → what is safe → next action.* e.g. "Couldn't sync this change. / Your local version is safe. / Review the conflict to continue."
- **Success copy (FE §226):** "Copied." "Saved." "Connected." "Invite sent." "Artifact pinned."
- **Toast policy (FE §65):** yes for copy/save/invite/reversible-delete/bg-job; no for destructive confirm / long instructions / ongoing AI activity.
- **Confirmation policy (FE §227):** confirm destructive / external-impact / security-sensitive / ownership changes; never confirm copy/reaction/panel-open.
- **Per-screen review questions (FE §319)** — apply to every screen before marking done: Does the user know where they are? What changed? Can they undo/recover? Do they understand why an action is unavailable? Can they work offline? Does it work from keyboard? Does the animation help? Does the screen remain calm?
- **Do-Not-Ship list (FE §325)** — hard fails: Slack clone; large colored card per AI response; permanent rainbow; per-message animation; chain-of-thought UI; scroll movement while reading; discarded failed messages; hover-only important controls; artifact failure breaking chat; frontend-trusted permissions; client-stored BYOK; configure-everything-first; twenty onboarding steps; Meeting Mode as a separate app; universal spinner; drag-only interaction; contrast sacrificed for aesthetics; cramped composer; permanent empty right panel; cluttered Pulse.
- **Final orientation goal (FE §329):** on open, a user immediately understands where the team is, what project, what's discussed, what Odin is doing, what was decided, what artifacts exist, what needs attention, what's approved, what's next.

---

## 16. Offline / sync / realtime (visual states only — do not touch the plumbing)

Available offline (FE §182): cached projects/conversation, local artifacts/files, local Git, drafts, queued supported edits. Unavailable: cloud AI, web research, GitHub network ops — state clearly without looking broken (FE §238–239). Local op states mirror `sync_operations` (BE §20A): PENDING/APPLIED/REJECTED(dismissible error, never silent drop)/CONFLICT (FE §186A.2); `client_operation_id` reused verbatim on retry. Conflict copy by type (FE §186A.3): version_mismatch "This was updated by someone else while you were offline." · concurrent_edit "You and someone else both changed this." · deleted_upstream "This was deleted by someone else while you were offline." (actions only [Restore mine as new] [Discard mine]). SyncConflictCard offers Your/Remote/Compare/Keep mine/Use remote/Create new version; nothing silently overwritten. Crash recovery restores drafts/pending ops/last Group-Project + surfaces conflicts (FE §198). Protocol handshake every connection (FE §309A): recommended-update = non-blocking dismissible once/session; `CLIENT_UPDATE_REQUIRED` = blocking full-screen ("ClanMind needs an update to continue. / Your team has moved to a newer version. / Local drafts and cached data are safe." + Update now) but still allows read of cached local state.

---

## 17. Phased execution plan (work in this order; each phase has an acceptance gate)

> The agent commits per phase, runs `pnpm build` (tsc -b + vite), `pnpm lint` (oxlint), and `pnpm test` (vitest) at each gate, and does not advance until green. Visual work is verified with the existing `scripts/capture*.py` screenshot flow at the breakpoints in §14.0.

### Phase 0 — Token foundation & theme engine
**Do:** Rewrite `src/index.css` and `src/design-system/tokens/index.ts` to encode §3–§11 exactly (all roles both themes, base `#000000` dark, surface-container tiers, state-layer opacities, shape, motion, type scale). Wire `@theme` so Tailwind utilities resolve to roles. Add theme controller (light/dark/system) reading `prefers-color-scheme`, toggling `.dark` on `<html>`, persisted via existing store. Bundle fonts (Google Sans Text/Roboto Flex/Roboto Mono or Inter fallback) + Material Symbols locally.
**Gate:** every text/bg role pair meets WCAG 2.2 AA (4.5:1 / 3:1 large) in both themes, verified programmatically (extend `tokens.a11y.test.ts`). Existing suite still green. No component references a raw hex.

### Phase 1 — Foundational components
**Do:** Restyle Button, IconButton, Input, Textarea, Select, Checkbox, Switch, Tabs, Badge, Avatar, Tooltip, Popover, Dialog, Dropdown, ContextMenu, Toast, Progress (+ M3 Expressive loading indicator), Skeleton, ScrollArea per §12.1. Add FAB. Keep every prop/ref API and Radix wiring. Introduce `<Icon>` (Material Symbols) wrapper.
**Gate:** component a11y tests green. Every component renders its full state matrix (add a visual states story/harness). Keyboard + focus-ring verified.

### Phase 2 — Shell & responsive layout
**Do:** Rebuild `AppShell` into the M3 three-pane shell with the responsive modes in §14.0. Split any monolithic shell file into subcomponents (TopBar, LeftNav drawer/rail, right-surface host, resizer with keyboard alt). Navigation drawer↔rail↔sheet transitions. SyncBanner, error boundaries, catastrophe screen. Persist window/panel state.
**Gate:** shell/layout tests green. Manual: all four breakpoints correct, composer stays anchored, empty right surface collapses, feature-flag-off layouts don't break.

### Phase 3 — Chat & composer
**Do:** MessageList, MessageRow (human + AI modes), MessageActions, ReactionPicker, ThreadPanel, Composer, AttachmentTray, MentionPicker, SlashCommandPicker, PrivateRecipientChooser per §14.2–14.3, §14.13. Content humanization (§13) applied. Auto-scroll discipline, virtualization intact.
**Gate:** all chat/composer tests (scroll/virtualization/reduced-motion, message a11y, attachments, AI streaming, markdown security, private-message isolation) green. Manual per FE §319 for chat + composer + private + streaming.

### Phase 4 — AI, research, approvals
**Do:** AiStatusIndicator, AiToolTimeline, AiStreamAnnouncer, AiErrorCard, AiQuotaCard (exact quota contract §14.13), ResearchDrawer + Project Impact, Citation/SourceCard, ApprovalCard + GitHubActionCard + GitHubDiffViewer per §14.14–14.15. Spectral discipline (§10) enforced.
**Gate:** approvals + GitHub tests green. Manual: run-state 1:1 mapping (§14.13), quota true/false branches, approval hash/version flow, spectral only in the six allowed places + grayscale-readable.

### Phase 5 — Artifacts & Garage
**Do:** ArtifactPanel, ArtifactToolbar, ArtifactVersionMenu, ArtifactCompare, Chart/Diagram/Document/Table viewers, ContextInspector, live construction (§14.8), GarageView, GarageCard, LocalFileTreeView, FileSyncIcon (9+5 states §13). Fit-to-width default; hide xyflow attribution; theme charts/diagrams from tokens.
**Gate:** artifact + garage tests green. Manual: live construction + reduced-motion equivalent, version compare (no raw JSON), one broken artifact doesn't break chat, diagrams legible.

### Phase 6 — Projects, tasks, decisions, memory, meetings, team
**Do:** ProjectOverview + ProjectPulse (§14.4), TasksView/TaskCard, DecisionsView/DecisionCard, MemoryView, MeetingPanel/MeetingActiveHeader/MeetingDialogs (§14.12), TeamView. Humanized statuses everywhere.
**Gate:** tasks/decisions/memory/meetings tests green. Manual: Pulse animates once, meeting candidate lifecycle waits for backend promotion, contradiction distinct treatment.

### Phase 7 — Command palette, activity, settings, auth, onboarding
**Do:** CommandPalette (§14.7), ActivityView + NotificationCenterPanel (§14.16), SettingsView all sections + BYOK + Danger Zone + Sync Diagnostics (§14.17), AuthScreen, onboarding + AI-potential demo (§14.1), SyncConflictCard, SyncDiagnosticsView.
**Gate:** notifications/settings/BYOK tests green. Manual: onboarding ≤7 steps, demo runs + reduced-motion, guest UX not a wall of disabled controls, keys never revealed.

### Phase 8 — Global QA & re-baseline
**Do:** Re-run the FE §312 visual-regression surfaces (login, create group, onboarding demo, chat, composer, mention picker, private chat, AI streaming, research, artifact, garage, meeting, settings, GitHub approval) via `scripts/capture_all.py` at all breakpoints, light + dark. Reduced-motion QA (FE §314). Keyboard-only task-completion script (FE §313) end-to-end. axe-clean critical flows. Perf budgets: zero composer typing lag, 60fps virtualized scroll, view switch <150ms, message arrival <100ms.
**Gate:** full suite green; axe clean; keyboard script passes; perf budgets met; every §325 do-not-ship item confirmed absent; every screen passes the §319 questions in both themes.

---

## 18. Definition of done

- [ ] Every screen in §14 rebuilt in M3, both themes, dark base `#000000`.
- [ ] Every component in §12 restyled; every state matrix (FE §207–216) renders.
- [ ] Zero raw enum/SCREAMING_SNAKE strings on screen (§13).
- [ ] Zero hard-coded colors/sizes/durations in feature code — tokens only.
- [ ] Spectral used only in the six allowed places; UI fully readable in grayscale (§10).
- [ ] WCAG 2.2 AA verified programmatically + axe-clean critical flows.
- [ ] Responsive at all four breakpoints; feature-flag-off layouts intact.
- [ ] All existing tests still green; backend/plumbing untouched.
- [ ] Perf budgets met; reduced-motion complete; keyboard-only flows pass.
- [ ] No item on the FE §325 do-not-ship list present.
- [ ] The emotional arc (FE §326) holds: calm at rest, alive only during real AI/artifact work, calm again.

---

## Appendix A — Sources (verified 2026-09-02)

- Material 3 Expressive design language, rollout, and motion — Android 16 / Pixel rollout (Sept 2025), progressive rollout across Google apps (Drive completed Jan 2026, Tasks widget updated June 2026) confirms M3 Expressive is Google's current, actively-shipping direction, not a legacy system.
- `material-web` (`@material/web`) status — GitHub repo and npm package both still carry the "in maintenance mode pending new maintainers" notice; recent releases are patch-level. Confirms it remains unsuitable as a foundation dependency.
- MUI M3 status — MUI's theming remains M2-era; no first-party M3 release as of this writing.
- ClanMind product/behavior requirements — `ClanMind_Frontend_Master_Implementation_Specification.md` (§1–§329), `ClanMind Backend — Master Implementation Specification.md` (§1–§197), cross-checked section-by-section for this document (AI run states §52, tool-call ledger §57A, sync tables §20A, file sync enum §4.3, notifications §95/§95A, approval engine §78A, meeting candidates §50A all verified against the backend spec directly).
- WCAG 2.2 — focus visibility/not-obscured, minimum target size, dragging alternatives, contrast requirements underlie §7, §9, and the accessibility gates in §17.

*Tonal palettes in §3 were generated in HCT/CIELAB from the stated source colors and gamut-clipped per tone; every role pairing in §4 is contrast-verified against WCAG 2.2 AA.*
