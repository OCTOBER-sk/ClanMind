# ClanMind Frontend — Deep UI/UX Refinement & Visual System Directive

> **Target agent:** Atom (Hermes Agent) using OpenCode / Alpha free-form coding agents
>
> **Primary objective:** Transform the current ClanMind frontend from a functional AI-generated dashboard into a coherent, premium, production-quality desktop application while preserving every existing product contract and feature defined by the ClanMind Master Specifications.
>
> **Authoritative sources:**
> 1. `ClanMind Backend — Master Implementation Specification.md`
> 2. `ClanMind_Frontend_Master_Implementation_Specification.md`
> 3. the actual current frontend repository/code
> 4. the two uploaded brand assets supplied with this directive (ClanMind mark + temporary Odin avatar reference)
>
> This directive is an implementation/refinement layer. It does **not** replace the Master Specifications. Where this document describes visual or interaction refinements, apply them only where they do not contradict the Master Specifications.

---

# 0. EXECUTIVE DIRECTIVE

Atom: treat the current frontend as **functionally valuable but visually under-refined**.

Do not perform a superficial CSS repaint.

Do not simply change colors and call the job complete.

The work must include a genuine UI/UX audit of the running application, followed by targeted refactoring/reconstruction of weak components and a visual verification pass.

The final ClanMind experience should feel like:

> **A calm, exact, premium engineering environment where a team works together and Odin becomes visibly active when useful.**

The interface must be:

- clean;
- white/black dominant;
- crisp;
- highly legible;
- technically polished;
- spatially disciplined;
- responsive within a desktop-first model;
- accessible;
- highly consistent;
- visually quiet when idle;
- visibly alive during meaningful AI/artifact activity.

It must **not** feel like:

- a generic SaaS admin panel;
- a Slack clone;
- a Notion clone;
- a Linear clone;
- a Vercel clone;
- a generic AI-chat shell;
- a futuristic sci-fi dashboard;
- a rainbow-heavy AI product;
- a card-everywhere UI;
- a collection of independently designed screens.

---

# 1. SOURCE-OF-TRUTH PRECEDENCE

Before touching code, read the two Master Specifications completely.

## Required reading order

1. `ClanMind Backend — Master Implementation Specification.md`
2. `ClanMind_Frontend_Master_Implementation_Specification.md`
3. current frontend repository
4. current screenshots / rendered app
5. uploaded ClanMind and Odin image assets

The backend specification remains authoritative for:

- authorization;
- privacy;
- persistence;
- realtime protocol;
- sequence/idempotency;
- synchronization;
- AI run/tool states;
- approval lifecycle;
- notifications;
- file synchronization state;
- artifact versions;
- GitHub permissions;
- backend contracts.

The frontend specification remains authoritative for:

- information architecture;
- screen behavior;
- interaction semantics;
- frontend state handling;
- visual direction;
- accessibility;
- artifacts/work surface behavior;
- empty/loading/error/offline states;
- interaction detail.

This directive adds the visual/UX refinement layer requested by the product owner.

The current code is **not** a source of truth when it conflicts with either Master Specification.

---

# 2. PRODUCT MODEL — DO NOT DRIFT

ClanMind remains:

```text
Account
   ↓
Group
   ↓
Projects
```

There is **no Workspace abstraction**.

There is one shared Group-level AI identity, defaulting to **Odin**.

The main team conversation remains Group-level and can carry optional Project context.

Private human and private AI conversations remain strictly privacy-isolated.

The UI must never make the product look as though ClanMind has:

```text
Organization → Workspace → Team → Project
```

Do not invent channels, workspaces, AI personas, or other top-level concepts merely because they are familiar from other products.

---

# 3. FIRST ACTION — DEEP FRONTEND RECONNAISSANCE

Before implementing the design changes, inspect the repository and the running application.

Create an internal inventory of:

- route structure;
- page/screen list;
- layout shell;
- design system primitives;
- CSS/token structure;
- icon system;
- typography system;
- theme implementation;
- state architecture;
- realtime layer;
- API layer;
- artifact rendering system;
- file viewer system;
- modal/dialog system;
- notification system;
- composer implementation;
- message implementation;
- responsive behavior;
- accessibility primitives;
- animation system;
- Tauri bridge usage;
- local persistence;
- offline/sync UI;
- current test coverage;
- current visual inconsistencies.

Do not start by editing random components.

First understand how the UI is actually assembled.

---

# 4. REQUIRED UI/UX AUDIT OUTPUT BEFORE MAJOR EDITS

Before large-scale modifications, make an internal or repository-local audit checklist covering at minimum:

### Global visual issues
- color inconsistency;
- typography inconsistency;
- spacing inconsistency;
- radius inconsistency;
- icon inconsistency;
- border inconsistency;
- button inconsistency;
- focus-state inconsistency;
- surface hierarchy inconsistency;
- duplicated styling;
- magic numbers;
- page-specific hacks;
- overflow/clipping;
- poor alignment.

### Interaction issues
- broken hover/focus behavior;
- missing loading states;
- missing empty states;
- poor error recovery;
- accidental focus stealing;
- stale data overwriting new data;
- poor optimistic behavior;
- bad scrolling behavior;
- inconsistent dialogs/popovers;
- inconsistent keyboard behavior.

### Product-model issues
- any Workspace terminology;
- any duplicate chat concept;
- fake permissions;
- private-data leakage risk;
- incorrect AI state mapping;
- incorrect sync-state rendering;
- incorrect artifact lifecycle.

### Visual-QA issues
- misaligned artifact nodes;
- connector drift;
- panel geometry problems;
- inconsistent toolbar positions;
- text baseline differences;
- incorrect panel widths;
- layout collapse at smaller window sizes.

Do not skip the audit because the current UI “already works.”

---

# 5. CLANMIND VISUAL NORTH STAR

## 5.1 Core feeling

The product should feel:

> **quiet, exact, intelligent, technical, confident.**

Use visual restraint rather than visual emptiness.

The UI should have enough hierarchy that the user immediately understands:

1. where they are;
2. what they are working on;
3. what needs attention;
4. what Odin is doing;
5. what action they can take next.

## 5.2 The most important visual principle

**Black and white are the language. Spectral color is the event.**

At rest, the app should largely resolve to monochrome.

When Odin or an artifact is actively doing meaningful work, color can enter temporarily.

When the operation completes, the interface should settle again.

This directly reinforces the Frontend Master Specification's principle that rainbow/spectral styling is an accent and that motion communicates state rather than decoration.

---

# 6. BRAND ASSETS — USE THEM INTENTIONALLY

Two uploaded image assets accompany this directive.

They are **brand references**, not permission to place large artwork everywhere.

## 6.1 ClanMind desktop/application mark

Use the uploaded ClanMind monogram/mark as the primary visual reference for:

- desktop application identity;
- app icon / shell identity where the current codebase supports it;
- login branding where appropriate;
- onboarding branding;
- compact top-left application identity;
- favicon/window identity where applicable.

Do not redraw the logo as text if a valid image/vector asset already exists.

Do not distort the aspect ratio.

Do not add decorative backgrounds behind it unless the screen specifically requires one.

The mark should remain crisp in:

- light theme;
- dark theme;
- compact shell sizes;
- onboarding.

If the uploaded asset is raster-only, preserve it as a source/reference and prefer a proper vectorized implementation only if the repository's existing licensing/asset workflow permits this safely.

## 6.2 Temporary Odin avatar reference

Use the uploaded Viking/warrior image as the **current temporary visual reference for Odin's AI identity**.

Do not assume it is the permanent final Odin avatar.

It should be used where the product currently needs an Odin profile/avatar and should remain visually compatible with the black/white ClanMind language.

Do not turn Odin's avatar into a giant UI decoration.

Odin's identity should primarily be communicated through:

- avatar;
- configured name;
- subtle AI activity state;
- provenance/tool information;
- restrained spectral activity.

If a generated/final AI avatar later replaces this temporary asset, the component system should make the swap trivial.

---

# 7. THEME SYSTEM

## 7.1 Dark theme

The dark theme must genuinely read as **black**, not navy.

Use semantic tokens with approximately this direction:

```text
color.background        #000000
color.surface           #080808
color.surfaceRaised     #101010
color.surfaceElevated   #181818

color.text              #FFFFFF
color.textSecondary     #A0A0A0
color.textTertiary      #666666
color.textDisabled      #454545

color.border            #1A1A1A
color.borderStrong      #2A2A2A
```

Do not literally use these values everywhere. Create semantic tokens and allow the design system to evolve.

## 7.2 Light theme

Light mode should be primarily white/off-white:

```text
color.background        #FFFFFF
color.surface           #FAFAFA
color.surfaceRaised     #F5F5F5
color.surfaceElevated   #FFFFFF

color.text              #000000
color.textSecondary     #555555
color.textTertiary      #888888
color.textDisabled      #AAAAAA

color.border            #E5E5E5
color.borderStrong      #D4D4D4
```

Avoid warm beige unless it exists only as an intentional future brand variant.

## 7.3 Light/dark symmetry

The same semantic structure must work in both themes.

Do not create two unrelated visual systems.

Do not solve dark mode by simply inverting the light palette.

The surface hierarchy must be deliberate in each theme.

---

# 8. COLOR SEMANTICS

## Primary

Black and white.

## Gray

Use for:

- secondary metadata;
- inactive states;
- subtle separators;
- hierarchy;
- disabled states.

## Red

Use only for:

- destructive action;
- critical error;
- dangerous permission state;
- security-related warning.

Red should feel semantically meaningful.

## Other semantic states

Green/yellow/info colors may exist where genuinely required by the product model, but should never compete with black/white for dominance.

## Spectral

The spectral gradient is a runtime-defined AI/state accent.

Use it for:

- Odin working;
- AI generation;
- artifact construction;
- progress/milestone animation;
- meaningful AI completion transitions;
- selected AI states;
- onboarding moments where the product is demonstrating its AI capability.

Do not use it:

- behind normal text;
- around every card;
- as permanent button backgrounds;
- in every loading state;
- in normal static chat messages.

---

# 9. TYPOGRAPHY — REBUILD THE VISUAL HIERARCHY

The current typography should be treated as a refinement target, not preserved blindly.

Select one excellent UI typeface family for ClanMind.

Recommended candidates:

- Inter;
- Geist;
- another equally legible modern professional UI family already supported by the repo.

Select one, not five.

For technical/code content use:

- Geist Mono;
- JetBrains Mono;
- or another equally strong monospace.

## Typography principles

Body text:

- highly readable;
- comfortable in long conversations;
- not too dense;
- not excessively light.

Headings:

- clear hierarchy;
- confident but not oversized;
- avoid excessive boldness.

Metadata:

- compact;
- readable;
- never so faint that it becomes unusable.

Buttons:

- crisp;
- medium weight;
- no unnecessary all-caps.

Code:

- stable monospace;
- appropriate line-height;
- clear distinction from prose.

Create semantic tokens such as:

```text
font.xs
font.sm
font.md
font.lg
font.xl
font.display
lineHeight.tight
lineHeight.normal
lineHeight.relaxed
fontWeight.regular
fontWeight.medium
fontWeight.semibold
fontWeight.bold
```

Do not allow individual components to invent typography values without justification.

---

# 10. SPACING SYSTEM

Use the existing semantic spacing architecture from the Frontend Master Specification and strengthen it if needed.

No random one-off values across components.

Establish consistent relationships for:

- page padding;
- panel padding;
- card/row gaps;
- icon/text gaps;
- section spacing;
- heading/content spacing;
- composer spacing;
- toolbar spacing.

Whitespace is a primary visual tool.

Do not fill empty space just because there is space.

Do not compress content merely to make the screen look “dense.”

The target is **high information clarity per pixel**, not maximum information density.

---

# 11. GEOMETRY / CORNERS

Use the user's requested hybrid approach.

“Sharp” means:

- precise;
- structured;
- crisp;
- restrained.

It does NOT mean:

- every component has radius 0;
- every input is a square box;
- every card has sharp corners.

Recommended direction:

```text
Structural shell        0–6px
Navigation surfaces     0–6px
Inputs                  4–8px
Buttons                 4–8px
Small cards             6–10px
Large work surfaces     6–10px
```

Treat these as visual guidance and route all values through semantic tokens.

Avoid excessive pills.

Use full pill shapes mainly for compact tags, filters, role/status indicators, or intentionally compact controls.

---

# 12. BORDERS

The current UI uses too many visually competing borders.

Reduce border noise.

Prefer:

- surface contrast;
- spacing;
- selective dividers;
- low-contrast borders.

Use stronger borders only for:

- focus;
- active selection;
- dialogs requiring strong separation;
- important diff states;
- conflict states.

The interface should not look like a collection of bordered rectangles.

---

# 13. SHADOWS / ELEVATION

Keep elevation subtle.

This is not a material-design-heavy UI.

Use shadows primarily for:

- popovers;
- dialogs;
- dropdowns;
- command palette;
- elevated work surfaces;
- drag states where needed.

Avoid heavy floating-card shadows on ordinary content.

Dark mode should rely primarily on surface separation and border contrast rather than giant glows.

---

# 14. ICON SYSTEM

Standardize the entire frontend around a single sharp line-icon system.

Lucide or an equally consistent library is acceptable if compatible with the current stack.

Recommended sizes:

```text
16px → inline / metadata
18px → navigation / normal control
20px → primary control
24px → major feature control
```

Use a consistent stroke weight around 1.7–2px.

Do not mix icon families.

Do not use emoji as core UI icons.

Do not randomly substitute filled icons for line icons.

All icon-only buttons must have:

- tooltip;
- accessible label;
- keyboard focus;
- correct disabled state.

---

# 15. COMPONENT SYSTEM — MAKE THE PRODUCT FEEL LIKE ONE PRODUCT

Refine or create a shared component layer for at least:

- Button;
- IconButton;
- Input;
- Textarea;
- Select;
- Checkbox;
- Switch;
- Badge;
- Avatar;
- Tooltip;
- Popover;
- Dropdown;
- Dialog;
- Sheet;
- Tabs;
- Toast;
- Progress;
- Skeleton;
- EmptyState;
- ErrorState;
- CommandPalette;
- Divider;
- Card/Surface;
- ListRow;
- ContextChip;
- StatusIndicator;
- AIActivityIndicator;
- PresenceIndicator;
- AttachmentChip;
- MessageActions;
- ArtifactToolbar.

Do not allow every feature to reinvent these primitives.

If an existing primitive is structurally sound, improve and reuse it rather than creating a duplicate.

---

# 16. TOP-LEVEL DESKTOP SHELL

Preserve the three-region model:

```text
┌───────────────────────────────────────────────────────────┐
│ Top bar                                                    │
├──────────────┬─────────────────────────┬─────────────────┤
│ Left rail    │ Main workspace           │ Work surface    │
│              │                         │                 │
│ Navigation   │ Chat / Team / Project    │ Artifact /      │
│ Projects     │ feature                  │ thread /        │
│ Garage       │                         │ research / diff │
│ Activity     │                         │                 │
│ Settings     │                         │                 │
└──────────────┴─────────────────────────┴─────────────────┘
```

The Frontend Master Specification defines the right panel as contextual and says it should not consume half the screen when empty.

Preserve that principle.

---

# 17. RESPONSIVE DESKTOP BEHAVIOR

The desktop application is desktop-first, not desktop-rigid.

Verify at:

- 1280px;
- 1440px;
- 1600px;
- 1920px;
- 2560px+;
- narrower windows.

At larger widths:

- use three panes;
- keep main reading area comfortable;
- allow right work surface to breathe without consuming unnecessary central width.

At medium widths:

- compress carefully;
- collapse or sheet the right surface when appropriate.

At narrow widths:

- left rail collapses;
- right work surface becomes a sheet/full-screen context;
- composer remains anchored to the bottom;
- critical controls remain accessible.

No clipped labels.

No overlapping toolbars.

No content that becomes unusably narrow.

---

# 18. TOP BAR REFINEMENT

The top bar should answer:

> **Where am I?**

Recommended hierarchy:

```text
[ClanMind]  /  [Group]  /  [Project]        [Search] [Sync] [Notifications] [Profile]
```

Only show high-value information.

Do not overload the header with feature controls that belong to the current context.

Start Meeting remains available according to the current screen and permissions.

The top bar must align cleanly with the main shell grid.

---

# 19. LEFT NAVIGATION REFINEMENT

Preserve the existing product information architecture.

The left rail should communicate:

```text
Chat

Projects
  Active project
  Other projects

Overview
Tasks
Decisions
Memory
Team
Garage
Activity

Settings
```

Do not create a giant hierarchical navigation tree.

Selected state should be **monochrome-first**:

- strong contrast;
- subtle surface change;
- clear icon/text weight;
- no persistent bright blue block.

Use spectral color only when the selected state is explicitly an AI activity state.

---

# 20. GROUP / PROJECT CONTEXT

The current Project must be unmistakable.

The header should clearly show:

```text
ClanMind / Robotics Core Team / Flight Controller Firmware
```

The project context chip in chat must clearly distinguish:

```text
Group chat
```

from:

```text
Project: Flight Controller Firmware
```

Do not create separate backend chats.

Project context is context, not a new conversation architecture.

---

# 21. TEAM SCREEN — SPECIFIC REWORK

The current screenshot shows oversized member cards with a large amount of empty vertical space.

Correct this.

Create a more disciplined Team presentation.

Possible direction:

```text
Team
────────────────────────────────────────────────────────

Avatar  Name / Role       Presence      Current project   Actions

Avatar  Arun Kumar        Online        Flight Controller  Private
Avatar  Priya Sharma      Online        Flight Controller  Private
Avatar  Marcus             Away          Ground Station     Private
```

A grid may remain where appropriate, but the result must not waste most of the viewport with empty card interiors.

Preserve:

- avatar;
- display name;
- Group role;
- professional presence;
- project context where useful;
- Private Chat;
- mention;
- nickname action;
- invite controls according to role.

Do not overuse colored presence dots.

---

# 22. CHAT — CORE PRODUCT SURFACE

The Main Chat must become one of the most refined screens in the application.

Do not make it resemble Slack by copying its exact visual language.

Use the existing proven interaction model but create a distinct ClanMind visual identity.

## Normal message

The normal message should be readable first, with metadata secondary.

Suggested anatomy:

```text
[Avatar]  Arun Kumar      03:54
          message content...

          attachments / reactions / reply / actions
```

Do not use giant colored chat bubbles.

## Human message grouping

Consecutive messages may group under one identity header while still preserving author context.

## AI message

Odin should have:

- avatar;
- AI name;
- subtle AI identity accent;
- message content;
- provenance/source/tool metadata;
- action row.

Do not make Odin's message a giant colored card.

---

# 23. MESSAGE ACTIONS

Primary actions:

```text
Reply
React
Copy
More
```

Secondary actions can include:

```text
Edit
Delete
Pin
Quote
Create task
Save decision
Use as context
Mark unread
```

Only expose actions that are actually permitted.

Do not expose disabled admin-only actions to ordinary users unless the screen's UX meaningfully requires explanation.

Do not hide critical actions exclusively behind hover if they are important to accessibility or discoverability.

---

# 24. MESSAGE COPY

Copy interaction must be nearly invisible until used.

On click:

```text
Copy icon → checkmark
Tooltip → Copied
Reset after short interval
```

Do not use a large generic toast for ordinary copy.

For code blocks:

```text
language                        Copy
```

Copy must preserve code exactly.

---

# 25. REACTIONS

Quick reactions can remain:

```text
👍 ❤️ 😂 🔥
```

But the picker and visual system must match ClanMind.

Use a tiny scale/fade response.

Do not bounce reactions or repeatedly animate them.

---

# 26. THREADS

Threads open into the contextual right work surface when appropriate.

The thread view must preserve:

- original message;
- replies;
- reactions;
- attachments;
- composer.

Closing should restore focus appropriately.

Never create a stack of unrelated floating panels.

---

# 27. MAIN COMPOSER — HIGH PRIORITY

The composer must feel like a **professional writing surface**, not a generic chat input.

Target structure:

```text
┌────────────────────────────────────────────────────┐
│ Message…                                           │
│                                                    │
│ [Attach] [/ Command] [@ Mention] [Project Context] │
│                                             [Send] │
└────────────────────────────────────────────────────┘
```

It must support:

- auto-grow;
- multiline;
- attachment;
- drag/drop;
- paste;
- slash commands;
- mentions;
- project context;
- privacy scope;
- send;
- keyboard shortcuts;
- drafts;
- retry;
- offline state.

---

# 28. COMPOSER VISUAL BEHAVIOR

Empty composer:

- restrained;
- quiet;
- obvious target.

Focused composer:

- stronger border/focus ring;
- no giant glow;
- no dramatic scale.

Sending:

- small sending indication;
- prevent duplicate submit;
- remain responsive.

Failed message:

- preserve content;
- show clear retry;
- never discard text.

The composer must remain available for new input even when Odin is processing another operation unless the specific state logically prevents it.

---

# 29. PRIVATE MODE — VISUAL PRIVACY

Private mode must be unmistakable.

The interface must visibly show:

```text
🔒 Private with Arun
```

or:

```text
🔒 Private with Odin
```

Do not rely on color alone.

Do not allow stale private/public selection to cause an accidental send to the wrong scope.

Private content must never leak into public UI through local state or cached data.

---

# 30. ATTACHMENTS

Attachment UI must remain compact.

Selected file:

```text
[file icon] filename.pdf   1.2 MB   ×
```

States:

```text
selected
uploading
uploaded
failed
cancelled
```

During upload:

```text
requirements.pdf · 64%
```

If indexing:

```text
Uploaded · Preparing for Odin…
```

Failure:

```text
Couldn't upload this file.
Retry    Remove
```

Never silently drop an attachment.

---

# 31. SEARCH / COMMAND PALETTE

`Ctrl/Cmd + K` is the main discovery surface.

It should feel fast, premium and uncluttered.

Sections:

```text
Messages
Files
Artifacts
Tasks
Decisions
People
Projects
Commands
```

Search results should clearly communicate:

- type;
- title/snippet;
- author;
- date;
- Project.

Private content is visible only to authorized users.

Search navigation should deep-link, load, scroll, and temporarily highlight the target.

Debounce searches and cancel stale requests.

---

# 32. TOOLTIPS / TOASTS / DIALOGS

## Tooltips

All icon-only actions need concise tooltips.

Use:

```text
Copy
Attach files
Open Garage
Close artifact
```

Never write paragraph-length tooltips.

## Toasts

Good uses:

- save;
- reversible deletion;
- invite sent;
- background job completion;
- non-intrusive success feedback.

Do not use toasts for:

- ongoing AI activity;
- destructive confirmation;
- long instructions.

## Dialogs

Use for:

- ownership transfer;
- deletion;
- permission changes;
- GitHub approval;
- BYOK setup.

Use accessible focus trapping/restoration.

---

# 33. LOGIN / FIRST LAUNCH

The current login screen is intentionally sparse, but it should feel like an intentional product entry point rather than an empty form floating on a black canvas.

Use the ClanMind mark as the primary brand anchor.

The design should remain extremely clean.

Suggested hierarchy:

```text
ClanMind mark

Welcome back

[Email]
[Password]

[Sign in]

Forgot password?                 Create account →
```

Do not add decorative illustrations merely to occupy empty space.

---

# 34. ONBOARDING

The onboarding must explain ClanMind's core loop visually rather than with long paragraphs.

Required sequence remains short:

1. Group name;
2. optional description;
3. invite teammates;
4. meet Odin;
5. optional AI setup;
6. optional Project;
7. enter Group.

Use the ClanMind brand mark and Odin avatar reference appropriately.

The first-run AI demo should visually communicate:

```text
Human message
    ↓
@Odin
    ↓
Research
    ↓
Sources
    ↓
Project impact
    ↓
Artifact
    ↓
Decision
    ↓
Task
    ↓
Approval
```

Do not turn it into a giant animated marketing sequence.

---

# 35. GARAGE

The Garage is a library for useful project knowledge.

It should feel more like a premium engineering archive than a generic dashboard.

Support:

- Artifacts;
- Files;
- Research;
- Pinned;
- filters;
- metadata;
- versions;
- relationships.

Use grid/list views where specified.

Do not let every Garage item become a giant bordered card.

Make title, type, version, author, date, pin, and AI relationship legible at a glance.

---

# 36. PROJECT OVERVIEW / PROJECT PULSE

Project Overview should answer:

- what is this Project;
- where is it now;
- what matters next.

Project Pulse should communicate:

- goal;
- progress;
- blockers;
- next milestone;
- relevant AI insight.

Do not create a cluttered dashboard of dozens of widgets.

Project Pulse must feel like a compact project state summary.

---

# 37. ARTIFACT WORK SURFACE — HIGHEST PRIORITY

The right work surface is one of ClanMind's most important differentiators.

It must feel like a **professional AI workbench**, not a dark empty panel with a tiny diagram floating in the middle.

## 37.1 Panel behavior

Open automatically only when:

- a substantial output was requested; or
- backend identifies a primary artifact/work surface.

Remain closed/minimized when nothing meaningful is happening.

## 37.2 Panel layout

Header should align cleanly:

```text
Artifact title                  expand  pin  more  close
TYPE · version
```

Toolbar should be positioned consistently within the work surface.

Content should occupy available space intelligently.

Do not center tiny content inside a huge empty panel without an explicit reason.

---

# 38. ARTIFACT ALIGNMENT — NON-NEGOTIABLE QA AREA

This section is a hard requirement.

You must **fully verify and correct artifact alignment and geometry in the running application**.

Do not trust that a node graph is aligned because its CSS looks reasonable.

## 38.1 Canvas

Verify:

- content centering;
- viewport calculations;
- scaling;
- zoom;
- pan;
- scroll;
- resize;
- fullscreen;
- min/max bounds;
- clipping.

## 38.2 Node geometry

Every node must have predictable:

- width;
- height;
- padding;
- typography;
- line-height;
- connector anchors;
- internal alignment.

Nodes that are meant to align in a row or column must align exactly.

## 38.3 Edge geometry

Verify:

- correct attachment points;
- no drift after zoom;
- no drift after resize;
- no label overlap;
- no accidental crossing where the renderer can avoid it;
- no stale coordinates.

## 38.4 Header and controls

Verify:

- artifact title alignment;
- metadata baseline;
- icon alignment;
- toolbar spacing;
- zoom control grouping;
- fullscreen control;
- close control.

## 38.5 Artifact state transitions

Verify:

```text
loading
→ building
→ partial
→ complete
```

Every intermediate geometry state must remain stable and readable.

Do not use arbitrary CSS nudges to compensate for a flawed geometry model.

Fix the underlying measurement/layout/coordinate system.

---

# 39. ARTIFACT RENDERING PRINCIPLES

Large AI outputs should become Live Artifacts in the right-side work surface.

Artifact visuals should be:

- highly legible;
- spacious;
- precise;
- interactive where supported;
- version-aware;
- contextual;
- visually impressive without becoming flashy.

A completed artifact should settle into a stable professional state.

Spectral animation should stop or become minimal after completion.

---

# 40. ARTIFACT TYPES

Ensure the visual system works across whatever artifact types are actually supported by the current implementation/specification, including when relevant:

- diagram;
- document;
- table;
- code/source;
- structured technical output;
- research output;
- diff;
- image/visual content;
- other backend-declared artifact types.

Do not create one renderer/layout assumption for every type.

But all types must share the same ClanMind visual system.

---

# 41. ARTIFACT VERSIONING / COMPARE / RESTORE

Versioning remains first-class.

The UI must make it obvious when the user is viewing:

- current version;
- prior version;
- comparison;
- restored version;
- generated version.

Do not make version controls visually dominant unless the user is actively using them.

Avoid accidental destructive replacement.

Artifact versions are immutable according to the backend model.

---

# 42. ARTIFACT INTERACTION PRIORITY

When multiple right-surface contexts compete:

```text
primary context
    ↓
secondary tabs / controlled stack
```

Do not open multiple unrelated panels on top of one another.

The single work surface should feel like a coherent workspace.

---

# 43. ARTIFACT FOCUS RULE

Never steal keyboard focus from the composer while the user is actively typing.

If an artifact was explicitly requested from the composer, focus may move to the artifact after submission.

Respect existing specification behavior.

---

# 44. AI IDENTITY + ODIN AVATAR

The uploaded Viking/warrior avatar is a temporary visual identity reference.

Odin should appear as:

```text
[avatar] Odin       [subtle active state]
```

The identity should be readable without requiring colorful UI.

AI state can supply the expressive layer:

```text
Available
Working
Researching
Building
Waiting for approval
Limited
Offline
```

Do not use “thinking” as a generic representation of hidden chain-of-thought.

---

# 45. AI STATE — MAP TO BACKEND TRUTH

The UI must use the backend's canonical AI run states:

```text
QUEUED
RUNNING
WAITING_TOOL
STREAMING
COMPLETED
FAILED
CANCELLED
```

Recommended user-facing mapping:

```text
QUEUED        → Odin is starting…
RUNNING       → Odin is working…
WAITING_TOOL  → show actual active tool/provenance
STREAMING     → incremental response
COMPLETED     → final response + sources/artifacts/actions
FAILED        → AI error card + recovery
CANCELLED     → Stopped + preserve available partial content
```

Do not invent frontend states that contradict backend truth.

---

# 46. AI TOOL TIMELINE

Long-running AI jobs can expose high-level activity such as:

```text
✓ 6 sources found
✓ 3 relevant
• Synthesizing…
```

This is provenance/activity, not hidden reasoning.

Collapse automatically after completion where appropriate.

---

# 47. AI STREAMING

On start:

- create AI message shell immediately.

During stream:

- incrementally render Markdown;
- maintain stable height where possible;
- preserve scroll behavior;
- keep the composer usable.

After completion:

- final message;
- sources;
- artifacts;
- actions;
- metadata.

If user scrolls upward during a stream:

- stop auto-follow;
- keep accumulating content;
- show Jump to latest;
- resume when user returns.

---

# 48. AI COLOR / SPECTRAL BEHAVIOR

Do not place rainbow around every AI message.

The spectral language should appear around **activity**.

Examples:

### Researching

Subtle spectral indicator + source activity.

### Building artifact

Spectral edge / controlled pulse + drawing/build motion.

### Waiting for approval

Semantic approval state; do not keep animated rainbow running indefinitely.

### Completed

Animation settles; UI returns toward monochrome.

This creates the desired rhythm:

```text
monochrome calm
→ AI activity
→ spectral emergence
→ work surface activation
→ artifact construction
→ completion
→ monochrome calm
```

---

# 49. RESEARCH UX

Research should visually communicate:

- current research state;
- progress;
- sources;
- citations;
- impact on current Project;
- artifact/result if produced.

Use clean source cards or source rows, not giant colorful search panels.

Citation UI must clearly expose provenance without revealing hidden chain-of-thought.

---

# 50. MEMORY UI

Memory must visually communicate scope.

Users should understand whether something is:

- Group memory;
- Project memory;
- user-private memory;
- memory candidate;
- explicit memory.

Privacy indicators should be clear and preferably icon + text rather than color-only.

Do not make memory feel like a generic database table unless that is the appropriate current view.

---

# 51. TASKS / DECISIONS

Tasks and Decisions are first-class product objects.

Their UI should feel like part of the same work environment, not external project-management software embedded inside ClanMind.

Maintain:

- ownership;
- state;
- dates;
- references;
- project context;
- chat linkage;
- decision/task relationships.

Use restrained statuses and semantic colors.

---

# 52. MEETING MODE

Meeting Mode is a first-class state.

Do not make it feel like a separate application.

The visual transition should show:

- meeting active;
- Odin facilitating;
- candidate decisions;
- candidate tasks;
- summary;
- optional artifact creation.

Candidate cards must map clearly to backend candidate lifecycle.

Unresolved candidates should remain visible rather than silently disappearing.

---

# 53. GITHUB / APPROVAL UX

GitHub changes are approval-controlled.

Generalized AI approvals are broader than GitHub.

The client must render pending action data, status, risk, scope, and meaningful proposed effect.

Do not let the client send a simplistic `approved: true` flag.

The UI should make approval feel deliberate:

```text
Action proposed
↓
Risk / scope visible
↓
What will change
↓
Approve / Reject
↓
Result
```

Critical actions should have stronger confirmation than low-risk actions.

Do not use giant red approval buttons for every action.

---

# 54. SETTINGS

Settings should preserve the Master Specification's boundaries:

- AI identity;
- provider;
- models;
- fallback;
- research;
- skills;
- permissions;
- members;
- notifications;
- GitHub;
- usage;
- security;
- danger zone.

Use clear sections rather than one huge form.

Keep privileged controls visible only where appropriate.

Never expose raw BYOK secrets.

---

# 55. NOTIFICATIONS

Use the backend category model exactly.

Frontend labels remain clear and human-friendly.

Notification categories include:

```text
Mentions
Private
AI
Approvals
Tasks
Decisions
Artifacts
GitHub
Meeting
Odin suggestions
System
```

Do not create an unrelated category taxonomy.

Do not notify users about ordinary chat activity by default.

---

# 56. ACTIVITY

Activity should be attention-oriented.

Include things such as:

- mentions;
- replies;
- reactions;
- approvals;
- assignments;
- key AI events.

Do not dump every presence event into Activity.

---

# 57. OFFLINE EXPERIENCE

Offline is a first-class desktop state.

The UI must clearly communicate:

- Offline;
- Reconnecting;
- Queued;
- Syncing;
- Synced;
- Conflict;
- Failed;
- Recovered.

The user must understand that local work is still available where the specification allows it.

For AI/GitHub where network is required, communicate the limitation without making local work look broken.

---

# 58. FILE SYNC STATES

The frontend must represent all nine backend-authoritative file sync states:

```text
LOCAL_ONLY
QUEUED
UPLOADING
SYNCED
REMOTE_CHANGED
LOCAL_CHANGED
CONFLICT
DELETED
RESTORABLE
```

Do not collapse these into a five-state approximation.

Provide meaningful tooltips/plain-language explanations.

---

# 59. SYNC CONFLICT UX

Different conflict types have different meanings.

### version_mismatch

Explain that the object changed remotely while the client was offline.

### concurrent_edit

Explain that both local and remote versions changed.

### deleted_upstream

Explain that the upstream object was deleted.

Do not use one generic conflict message for all three.

Resolution controls must map to backend-supported resolution strategies.

---

# 60. SEARCH / PRIVATE DATA BOUNDARIES

Search results must inherit source authorization.

Never allow:

- private messages to appear in public search;
- private memory to appear in Group search;
- inaccessible artifacts to appear through cached results;
- old Group state to appear after switching Groups.

Group changes must reset/scope relevant local search and state caches correctly.

---

# 61. STATE SEPARATION

Keep the Master Specification's state separation:

```text
UI state
Server state
Realtime state
Local persistent state
Draft state
Sync state
```

Do not collapse everything into one giant global store.

Particularly:

- composer text → draft/local;
- project metadata → server state;
- typing → realtime;
- panel width → UI preference;
- pending offline message → sync state.

---

# 62. NAVIGATION / DEEP LINKS

Navigation should feel immediate and stable.

Deep links should:

1. resolve Group;
2. resolve Project where relevant;
3. load target;
4. scroll to target;
5. highlight briefly.

Do not create jarring transitions.

---

# 63. EMPTY STATES

Every major surface needs intentional empty states.

Examples:

### Group

```text
Your team is ready.
Start talking, create a Project or ask Odin something.
```

### Project

```text
Nothing is built yet.
Discuss the problem →
Ask Odin to research →
Add references →
Create a plan →
Connect GitHub →
```

Empty states should invite action without feeling like marketing.

---

# 64. LOADING / ERROR / RECOVERY

Avoid a universal spinner.

Use context-specific loading:

- skeletons for content;
- inline progress for uploads;
- AI activity for AI work;
- draw/build motion for artifacts;
- compact progress for research;
- reconnect indicators for network state.

Every error must provide:

- what happened;
- what remains safe;
- next action.

Do not show technical exception strings to ordinary users unless the current diagnostics surface requires them.

---

# 65. ACCESSIBILITY

Target WCAG 2.2 AA behavior.

Build accessibility into primitives rather than adding it at the end.

Verify:

- keyboard navigation;
- visible focus;
- accessible labels;
- status announcements;
- dialog trapping/restoration;
- usable pointer targets;
- contrast;
- reduced motion;
- non-drag alternatives;
- screen-reader-friendly AI state changes;
- focus restoration after closing threads/popovers/artifacts.

Do not rely on color alone for:

- private state;
- conflict;
- approval;
- errors;
- AI activity;
- sync state.

---

# 66. POINTER / TARGET SIZES

Interactive targets must remain usable.

Do not create microscopic icon buttons simply to make the design feel minimal.

The UI can look minimal while still respecting target-size requirements.

---

# 67. MOTION SYSTEM

Use the Master Specification motion vocabulary:

```text
Fade
Slide
Scale
Draw
Morph (rare)
```

Approximate duration hierarchy:

```text
micro       80–120ms
small       120–180ms
standard    180–280ms
large       280–420ms
```

Avoid long routine transitions.

Never make motion the primary source of meaning when text/icon state can communicate the same information.

---

# 68. REDUCED MOTION

When `prefers-reduced-motion` is enabled:

- remove moving spectral lines;
- reduce large panel transitions;
- replace artifact construction animation with immediate state transitions + textual state;
- preserve critical status information;
- do not make the app feel broken.

---

# 69. RESPONSIVE ARTIFACT VERIFICATION

Artifact/work surface behavior must be tested at multiple widths.

Verify:

- narrow right panel;
- normal desktop;
- wide desktop;
- ultrawide;
- panel resize;
- zoom;
- pan;
- fullscreen;
- close/reopen.

No content should become too small to read.

No toolbar should overlap artifact content.

No canvas should silently clip important content.

---

# 70. FILE / PDF / IMAGE VIEWERS

The visual language must carry through to:

- file viewer;
- PDF viewer;
- image viewer;
- previews;
- downloads/exports.

Viewer controls should use the same icon/typography/button system as the rest of ClanMind.

Do not create a visually unrelated third-party-looking interface.

---

# 71. PROJECT SNAPSHOTS / CONTEXT INSPECTOR

Snapshots and context inspector surfaces must remain consistent with the product's project-centric model.

The UI should clearly communicate:

- what scope is being inspected;
- what data is being used as AI context;
- where the user is in the Group/Project hierarchy.

Privacy scope must always be obvious.

---

# 72. AI CHAIN-OF-THOUGHT BOUNDARY

Do not expose hidden chain-of-thought.

Expose instead:

- high-level AI status;
- active tool;
- tool provenance;
- sources;
- outputs;
- artifacts;
- actions;
- progress.

This is mandatory.

---

# 73. AI SOCIAL BEHAVIOR

Odin should feel like a useful team member, but not like a noisy chatbot mascot.

Use restrained phrasing.

Do not overuse:

- exclamation marks;
- decorative emoji;
- huge “AI” badges;
- constant suggestions.

When proactive, Odin should be useful and relevant.

When idle, Odin should be visually quiet.

---

# 74. PERFORMANCE

The UI must feel fast even when backend/AI work is slow.

Priorities:

- stable layout;
- optimistic UI where safe;
- progressive rendering;
- streaming;
- local drafts;
- low-cost animations;
- minimal unnecessary re-renders;
- virtualization where appropriate;
- artifact renderer isolation.

Do not sacrifice visual quality for unnecessary animation complexity.

---

# 75. CHAT VIRTUALIZATION

If virtualization is used, verify:

- no scroll jumps;
- correct unread divider placement;
- stable streaming message placement;
- thread navigation remains accurate;
- deep-link scroll still works.

Do not optimize with virtualization if it causes a visibly broken conversation experience.

---

# 76. ARTIFACT PERFORMANCE

Large or animated artifacts must not freeze chat.

Isolate artifact rendering where appropriate.

A broken artifact must not crash the entire frontend.

The right work surface should fail independently where possible.

---

# 77. ERROR BOUNDARIES / FAILURE ISOLATION

A failure in:

- artifact renderer;
- research view;
- file preview;
- AI stream;
- notification panel;
- GitHub panel

must not crash the entire application.

Provide localized failure UI with recovery.

---

# 78. DO NOT BREAK BACKEND CONTRACTS

The frontend must remain compatible with the exact backend models.

Important backend/frontend contract areas include:

- REST response schemas;
- WebSocket event schemas;
- protocol version;
- server sequence;
- client operation ID;
- sync tables;
- canonical AI run states;
- tool-call states;
- artifact events;
- generalized `ai_actions` / `ai_action_approvals` lifecycle;
- meeting candidate lifecycle;
- memory states;
- notification category/delivery state;
- server-controlled feature flags;
- nine-value file sync state;
- AI quota error contract;
- notification deep links;
- permissions.

If the frontend currently deviates from these, fix the frontend mapping rather than inventing substitute states.

---

# 79. UI PERMISSIONS

The frontend may hide/show affordances based on known permission state for UX, but it must never treat this as security.

The backend remains the authority.

Handle denied responses gracefully.

Do not assume:

```text
button visible = action permitted
```

or:

```text
button hidden = user cannot perform action
```

unless this is merely UX gating on top of backend truth.

---

# 80. OPEN CODE AGENT STRATEGY

Atom may delegate implementation to OpenCode agents.

Use agents by bounded scope.

Recommended decomposition:

```text
Agent A
Design system / tokens / typography / icons / theme

Agent B
Desktop shell / sidebar / top bar / responsive layout

Agent C
Chat / messages / composer / reactions / threads / mentions

Agent D
Odin / AI states / streaming / research UI

Agent E
Artifacts / work surface / canvas alignment / viewers

Agent F
Garage / Team / Tasks / Decisions / Memory / Project Pulse

Agent G
Meetings / GitHub / approvals / notifications / settings

Agent H
Offline / sync / conflict / accessibility / QA
```

Do not let multiple agents independently redesign the same shared component system.

Atom owns integration.

Before delegating a task, give the agent:

- exact scope;
- relevant Master Specification sections;
- this directive's relevant requirements;
- existing files/components to inspect;
- acceptance criteria;
- visual verification requirement.

---

# 81. OPENCODE AGENT WORK RULES

Every delegated agent must:

1. inspect before editing;
2. understand existing abstractions;
3. reuse primitives where possible;
4. avoid introducing duplicate state systems;
5. avoid arbitrary hard-coded style values;
6. avoid unrelated refactors;
7. preserve backend contracts;
8. test the affected behavior;
9. report any contract mismatch clearly;
10. leave the codebase in a coherent state.

Do not accept “looks better” as the only completion criterion.

---

# 82. VISUAL QA MUST HAPPEN ON THE RUNNING APP

This is a hard requirement.

After implementation, run the actual application.

Inspect every major screen at representative window sizes.

Do not declare success solely from:

- TypeScript compilation;
- lint;
- unit tests;
- snapshots;
- code review.

Rendered UI must be inspected.

---

# 83. REQUIRED VISUAL QA LOOP

For each major screen:

```text
Run application
   ↓
Open screen
   ↓
Inspect rendered layout
   ↓
Identify misalignment / inconsistency
   ↓
Fix implementation
   ↓
Run again
   ↓
Inspect again
```

Repeat until stable.

---

# 84. REQUIRED SCREEN QA MATRIX

At minimum inspect:

```text
[ ] Login
[ ] Signup
[ ] Password recovery
[ ] First launch
[ ] Create Group
[ ] Invite
[ ] Odin introduction
[ ] Project creation
[ ] Group chat
[ ] Project chat context
[ ] Main composer
[ ] Thread
[ ] Private human chat
[ ] Private AI chat
[ ] Team
[ ] Project Overview
[ ] Project Pulse
[ ] Tasks
[ ] Decisions
[ ] Memory
[ ] Garage grid
[ ] Garage list
[ ] File viewer
[ ] PDF viewer
[ ] Image viewer
[ ] Live Artifact
[ ] Artifact fullscreen
[ ] Artifact compare
[ ] Artifact restore
[ ] Meeting Mode
[ ] Research
[ ] AI streaming
[ ] Approval UI
[ ] GitHub
[ ] Notifications
[ ] Search / command palette
[ ] Settings
[ ] Offline state
[ ] Sync banner
[ ] Sync conflict
[ ] Error boundary
```

---

# 85. REQUIRED ARTIFACT QA MATRIX

For every supported artifact type, test:

```text
[ ] panel opens
[ ] panel closes
[ ] panel resizes
[ ] artifact centers correctly
[ ] header aligns
[ ] toolbar aligns
[ ] zoom works
[ ] pan works
[ ] nodes align
[ ] edges align
[ ] labels align
[ ] content does not clip
[ ] loading is stable
[ ] streaming is stable
[ ] completion is stable
[ ] spectral activity is restrained
[ ] fullscreen works
[ ] versions work
[ ] compare works where supported
[ ] restore works
[ ] pin works
[ ] export works where supported
[ ] permission gating works
[ ] reduced motion works
[ ] artifact failure does not crash chat
```

---

# 86. ARTIFACT ALIGNMENT TECHNICAL STANDARD

Do not “fix” alignment by repeatedly adding arbitrary margins/translate offsets.

Prefer:

- measured container dimensions;
- deterministic layout rules;
- flex/grid where appropriate;
- stable node coordinate systems;
- consistent anchor definitions;
- viewport transforms;
- responsive calculations;
- shared geometry utilities.

If connectors visually drift after resizing or zooming, inspect the underlying coordinate/transform system.

If nodes are centered incorrectly, inspect the viewport/content origin before changing padding blindly.

If text appears vertically misaligned inside nodes, inspect line-height, internal padding, font metrics, and flex alignment.

The goal is **correct geometry**, not “good enough at one screenshot size.”

---

# 87. DESIGN CONSISTENCY TEST

Across the entire product ask:

- Is this the same button language?
- Is this the same icon language?
- Is this the same typography language?
- Is this the same spacing language?
- Is this the same surface language?
- Is this the same interaction language?
- Is this the same motion language?

If a screen looks like it belongs to another product, refactor it.

---

# 88. DO NOT USE THESE VISUAL SHORTCUTS

Do not use:

- permanent blue primary accents;
- rainbow everywhere;
- giant gradients;
- giant glassmorphism panels;
- excessive blur;
- excessive shadows;
- huge card borders;
- ultra-thin low-contrast text;
- tiny unreadable metadata;
- emoji as primary interaction icons;
- oversized AI chat bubbles;
- constant pulsing UI;
- infinite shimmer loading;
- decorative motion on every component;
- fake dashboard charts that do not come from product state;
- random icon libraries;
- one-off font families per page;
- arbitrary pixel offsets to patch layout problems.

---

# 89. DO NOT USE THESE UX SHORTCUTS

Do not:

- hide important controls only on hover;
- move user scroll position while reading;
- discard failed messages;
- lose composer drafts;
- collapse private/public state into one visual state;
- expose hidden chain-of-thought;
- make right panel permanent when empty;
- create overlapping context panels;
- let one broken artifact crash chat;
- trust client permission state;
- store BYOK secrets in the frontend;
- use drag as the only interaction path;
- force a giant onboarding wizard;
- create feature-specific mini design systems.

---

# 90. QUALITY BAR FOR “PREMIUM”

Premium does not mean:

- more animation;
- more gradients;
- more shadows;
- more rounded cards;
- more effects.

Premium means:

- fewer inconsistencies;
- better spacing;
- stronger type hierarchy;
- better alignment;
- clearer focus;
- stable layout;
- thoughtful motion;
- appropriate visual density;
- excellent micro-interactions;
- predictable behavior.

---

# 91. QUALITY BAR FOR “TECHNICAL”

Technical does not mean:

- terminal green;
- sci-fi fonts;
- hacker graphics;
- dense code-like dashboards.

Technical means:

- precision;
- hierarchy;
- exact state feedback;
- reliable interactions;
- informative metadata;
- excellent artifacts;
- predictable keyboard behavior;
- clear system state.

---

# 92. QUALITY BAR FOR “AI-NATIVE”

AI-native does not mean:

- giant AI logo;
- neon gradient everywhere;
- “thinking…” spinner;
- every response in a colored bubble.

AI-native means:

- Odin understands context;
- research is visible through provenance;
- outputs become artifacts;
- AI activity is visible through meaningful state;
- artifacts can evolve;
- decisions/tasks emerge naturally;
- approvals are explicit;
- the interface visibly changes when useful AI work is happening.

---

# 93. STATE COMMUNICATION PRINCIPLE

Every async state should answer:

> **What is happening?**

> **What is the system waiting for?**

> **Can I do anything?**

> **Is my work safe?**

> **What happens next?**

Avoid ambiguous states such as a generic spinner with no context.

---

# 94. FOCUS MANAGEMENT

Pay special attention to keyboard focus.

After:

- sending a message;
- closing thread;
- closing popover;
- closing dialog;
- closing artifact;
- opening command palette;
- selecting a mention;
- submitting settings

restore focus appropriately.

Do not steal focus from the composer while the user is actively typing.

---

# 95. KEYBOARD-FIRST DETAILS

Preserve and refine:

```text
Ctrl/Cmd + K       Search / commands
Ctrl/Cmd + /       Shortcut help
Ctrl/Cmd + Shift+P Project switcher
Enter              Send
Shift+Enter        Newline
Esc                Close overlays
```

Add additional shortcuts only if they are clearly useful and discoverable.

---

# 96. MICRO-INTERACTION QUALITY

Micro-interactions should feel almost invisible until needed.

Examples:

### Copy

Icon → check.

### Reaction

Tiny scale/fade.

### Selection

Subtle surface/weight change.

### AI activity

Small spectral motion.

### Artifact open

Measured panel expansion.

### Approval

Clear state transition.

Never make every interaction “pop”.

---

# 97. DESKTOP WINDOW STATE

Refine window startup and resizing behavior.

Preserve local window preferences where specified:

- panel widths;
- window dimensions;
- relevant UI preferences.

Startup should feel stable rather than visually jumping between layout states.

---

# 98. SESSION / CRASH RECOVERY

When sessions expire or the application crashes:

- preserve drafts where possible;
- communicate state clearly;
- avoid visually resetting the application without explanation;
- recover local work safely;
- avoid duplicating queued operations.

---

# 99. DATA PRIVACY IN UI STATE

When switching Groups:

- reset/scope private state;
- invalidate inappropriate caches;
- do not leak private conversation previews;
- do not leak memory results;
- do not leak notifications from another Group.

The frontend must be explicitly hostile to privacy leakage caused by stale local state.

---

# 100. VISUAL DIFFERENTIATION FROM OTHER PRODUCTS

ClanMind may borrow proven interaction patterns but must develop a distinct identity.

The distinctive combination should be:

```text
white / black foundation
+
sharp line icons
+
excellent typography
+
quiet workspace shell
+
contextual work surface
+
restrained spectral AI activity
+
artifacts as visible project work
+
strong local-first behavior
```

Do not copy another company's spacing, logo treatment, typography combination, or exact layouts.

---

# 101. FINAL VISUAL REFINEMENT PASS

After functional implementation, perform a deliberate visual-polish pass.

Inspect:

### Horizontal alignment

Do labels, icons, buttons, panels, and content edges line up?

### Vertical alignment

Do controls sit on the same baseline?

### Density

Are important screens too empty or too crowded?

### Contrast

Can every important state be read immediately?

### Consistency

Do the same component patterns behave the same everywhere?

### Motion

Does motion communicate something useful?

### Typography

Do hierarchy and readability feel intentional?

### Artifacts

Are geometry and alignment actually correct?

### Responsive behavior

Does resizing expose hidden flaws?

---

# 102. FINAL ACCEPTANCE CHECKLIST

The refinement is **not complete** until the following are verified:

```text
[ ] Backend Master Specification was read and followed
[ ] Frontend Master Specification was read and followed
[ ] Product model remains Account → Group → Projects
[ ] No Workspace abstraction was introduced
[ ] Odin remains one Group-level shared AI
[ ] Private scopes remain isolated
[ ] Backend permissions remain authoritative

[ ] Dark theme is true black-based
[ ] Light theme is white/off-white
[ ] Black and white dominate
[ ] Persistent blue accent is removed/reduced
[ ] Red is semantic
[ ] Spectral color is restrained and state-driven

[ ] Typography system is unified
[ ] Icon system is unified
[ ] Radius system is unified
[ ] Border system is unified
[ ] Shadow system is restrained
[ ] Spacing system is unified

[ ] Sidebar is polished
[ ] Top bar is polished
[ ] Group switcher is polished
[ ] Project switcher is polished
[ ] Main chat is polished
[ ] Composer is polished
[ ] Messages are polished
[ ] Threads are polished
[ ] Reactions are polished
[ ] Mentions are polished
[ ] Search is polished
[ ] Notifications are polished
[ ] Team is polished
[ ] Garage is polished
[ ] Tasks are polished
[ ] Decisions are polished
[ ] Memory is polished
[ ] Project Pulse is polished
[ ] Meeting Mode is polished
[ ] Research UX is polished
[ ] GitHub/approval UX is polished
[ ] Settings are polished
[ ] Auth is polished
[ ] Onboarding is polished

[ ] Odin avatar reference is integrated appropriately
[ ] ClanMind mark is integrated appropriately
[ ] Odin active state is visually distinct but restrained
[ ] AI status maps to canonical backend states
[ ] AI streaming is visually stable
[ ] AI tool timeline is useful and provenance-oriented

[ ] Right work surface is contextual
[ ] Right panel opens smoothly
[ ] Right panel resizes correctly
[ ] Right panel closes naturally
[ ] Artifact focus rules are respected

[ ] Artifact header is aligned
[ ] Artifact toolbar is aligned
[ ] Artifact canvas is aligned
[ ] Artifact nodes are aligned
[ ] Artifact edges are aligned
[ ] Artifact labels are aligned
[ ] Artifact zoom is correct
[ ] Artifact pan is correct
[ ] Artifact resize is correct
[ ] Artifact fullscreen is correct
[ ] Artifact streaming is correct
[ ] Artifact versioning works
[ ] Artifact compare works where supported
[ ] Artifact restore works
[ ] Artifact export works where supported
[ ] Artifact failure is isolated from chat

[ ] Offline state is polished
[ ] Sync state is polished
[ ] All nine file sync states are represented
[ ] Conflict states are distinct
[ ] Recovery flows are understandable

[ ] Responsive desktop behavior verified
[ ] Narrow window behavior verified
[ ] Keyboard navigation verified
[ ] Focus restoration verified
[ ] Reduced motion verified
[ ] Screen-reader/status semantics verified
[ ] Target sizes verified
[ ] Contrast verified

[ ] Build passes
[ ] Tests pass
[ ] Type checks pass
[ ] Lint passes where configured
[ ] Actual application was rendered and inspected
[ ] Visual QA was repeated after corrections
```

---

# 103. FINAL QUALITY GATE

Do not stop when the implementation is merely functional.

Do not stop when the code compiles.

Do not stop when screenshots “look better.”

Stop only when the product feels internally coherent.

Ask:

> **Does every screen feel like the same ClanMind product?**

> **Does the UI communicate state without unnecessary decoration?**

> **Does Odin feel like a shared teammate rather than a chatbot overlay?**

> **Do artifacts feel like first-class project work rather than side-panel decorations?**

> **Does the product remain calm when nothing important is happening?**

> **Does meaningful AI activity make the interface feel alive without becoming noisy?**

> **Can a user immediately understand where they are, what matters, and what they can do next?**

If the answer to any of these is “not quite,” continue refining.

---

# 104. FINAL PRINCIPLE

The desired ClanMind rhythm is:

```text
BLACK / WHITE CALM
       ↓
TEAM COLLABORATION
       ↓
ODIN ACTIVATES
       ↓
RESEARCH / TOOL ACTIVITY
       ↓
SPECTRAL SIGNAL
       ↓
RIGHT WORK SURFACE OPENS
       ↓
ARTIFACT FORMS
       ↓
TEAM DECIDES
       ↓
TASK / APPROVAL / EXECUTION
       ↓
MEMORY / PROJECT KNOWLEDGE
       ↓
CALM AGAIN
```

The UI should communicate:

> **We're working together, and Odin helps us move.**

Not:

> **Look at all the AI features.**

That is the standard for this refinement.

---

# 105. MASTER-SPECIFICATION CROSS-REFERENCE MAP

Use the following as the primary cross-reference during implementation.

## Frontend Master Specification

- §1–§3 → product mission and design direction
- §4–§8 → tokens, typography, motion, accessibility
- §9–§11 → frontend architecture/state separation
- §12–§20 → desktop shell/navigation/team/presence
- §21–§66 → chat/composer/interactions
- §67–§76 → auth/onboarding/project creation/demo
- §77–§84 → Project/Overview/Pulse/Team
- §87–§94 → Garage/files/artifacts
- §95–§111 → Live Artifact behavior
- §112–§116 → project context/memory
- §119–§128 → tasks/decisions/meetings
- §129–§155 → Odin/AI/research/proactivity/skills
- §156–§165 → BYOK/GitHub/approvals/feature flags
- §166–§180 → settings/search/empty/loading/error
- §181–§186A → offline/sync/conflicts
- §187–§206 → local folders/notifications/performance/state matrices
- §207–§223 → accessibility and motion
- §224–§296 → copy/error/confirmation/details/security boundaries
- §297+ → artifact/AI/project/sync/acceptance detail
- especially §321–§328 → artifact/onboarding/settings/backend contract/final product feeling

## Backend Master Specification

Pay special attention to:

- §1–§3 → product mission + architecture
- §4 → authoritative state
- §11–§18 → messages + realtime
- §19–§21 / §20A → idempotency + sync/conflict
- §30–§37 → AI/provider/memory configuration
- §39–§50A → message/file/artifact/task/meeting data
- §51–§61 → AI modes/run/context/router
- §66–§75 → research/artifact
- §76–§90 → GitHub/approvals/security
- §95–§102 → notifications/observability/error contract
- §103–§114 → API/WebSocket contracts
- §115–§141 → AI lifecycle/security/quotas/permissions
- §147–§153 → privacy/API/testing
- §164–§179 → feature flags/desktop/front-end contracts
- §180+ → production/security/backend agent rules/acceptance

---

# 106. CLOSING IMPLEMENTATION COMMAND TO ATOM

**Proceed as a senior product UI/UX engineer, not as a CSS decorator.**

Inspect first.

Plan second.

Refactor shared foundations before polishing isolated screens.

Use OpenCode agents in bounded scopes.

Integrate deliberately.

Run the actual application.

Inspect the actual rendered UI.

Correct alignment/layout problems.

Verify artifacts specifically.

Verify responsive behavior.

Verify accessibility.

Verify state correctness against backend contracts.

Do not declare success because the code looks plausible.

Declare success only after the running application demonstrates that the product has become:

> **cleaner, sharper, calmer, more professional, more coherent, more legible, more responsive, and unmistakably ClanMind.**
