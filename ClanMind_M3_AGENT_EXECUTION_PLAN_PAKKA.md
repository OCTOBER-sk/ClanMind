# ClanMind — M3 / M3 Expressive Migration
# PAKKA AI AGENT EXECUTION PLAN

**Document type:** Autonomous frontend migration execution protocol  
**Primary reader:** Hermes / opencode / AI coding agents  
**Human reviewer:** Product/engineering owner  
**Status:** Ready for controlled execution

---

# 0. READ THIS FIRST — ABSOLUTE AGENT RULES

This document is an execution playbook for migrating the existing ClanMind frontend to the approved Material 3 / M3 Expressive design system.

It is **not** a new product specification.

The two ClanMind master specifications remain the authority for product truth:

```text
1. ClanMind Backend — Master Implementation Specification.md
2. ClanMind_Frontend_Master_Implementation_Specification.md
```

This file is authoritative only for:

```text
migration order
migration mechanics
visual implementation rules
agent safety rules
verification rules
phase gates
regression controls
completion certification
```

## RULE 0.1 — READ EVERYTHING BEFORE EDITING

Before changing any source file, the agent MUST:

```text
[ ] read this entire document
[ ] read the complete Backend Master
[ ] read the complete Frontend Master
[ ] inspect the actual frontend repository
[ ] establish the current working baseline
```

Do not begin coding after reading only the first pages or snippets.

## RULE 0.2 — DO NOT INVENT PRODUCT ARCHITECTURE

Never invent:

```textWorkspace hierarchy
Organization hierarchy
multiple AI agents per Group
independent Project chat infrastructure
new privacy scopes
new memory scopes
new approval model
new sync semantics
new authorization model
new GitHub permission model
new artifact persistence model
```

The product remains:

```text
Account
  ↓
Group
  ↓
Projects
```

One shared AI identity per Group remains the current model.

## RULE 0.3 — THIS IS A FRONTEND MIGRATION

The default assumption is:

```textbehavior = frozen
contracts = frozen
backend = frozen
data model = frozen
security semantics = frozen
```

The migration may change:

```textpresentation
visual hierarchy
layout implementation
component composition
accessibility presentation
motion
tokens
icons
visual state handling
presentation-layer humanization
visual regression infrastructure
```

The migration must not casually change:

```textAPI semantics
WebSocket semantics
state-machine semantics
database schema
authorization
privacy
sync semantics
AI orchestration
business rules
```

## RULE 0.4 — NEVER “FIX” BACKEND BEHAVIOR DURING VISUAL WORK

If the UI appears to require a backend change:

```textSTOP
record the issue
mark task BLOCKED_BY_CONTRACT
inspect both master specifications
do not silently alter backend behavior
```

A coding agent must not use “while I am here” reasoning.

## RULE 0.5 — NEVER TRUST CLIENT AUTHORIZATION

The backend is always the authorization authority.

The frontend may:

```texthide irrelevant controls
show understandable permission explanations
render server-provided permission state
```

The frontend may never:

```textgrant permission
assume a role is valid because a local store says so
execute privileged action because a button was enabled
```

## RULE 0.6 — PRIVATE DATA IS A HARD SECURITY BOUNDARY

Never allow private data to cross into shared UI or shared state.

Protected boundaries include:

```textprivate human conversation
private AI conversation
user-private memory
private drafts
private notifications
private search results
```

A visual refactor that leaks private state is a release blocker.

## RULE 0.7 — NEVER EXPOSE CHAIN-OF-THOUGHT

The UI may show:

```texttool activity
source activity
context references
approvals
outputs
high-level status
```

The UI must not show hidden model reasoning.

## RULE 0.8 — DO NOT DECLARE SUCCESS FROM SCREENSHOTS ALONE

A beautiful screenshot proves only visual appearance.

It does NOT prove:

```textrealtime correctness
sync correctness
authorization
privacy
AI lifecycle correctness
artifact isolation
approval integrity
offline recovery
```

Every phase requires functional and visual verification.

## RULE 0.9 — NEVER ADVANCE THROUGH A RED GATE

If a required phase gate fails:

```textdo not begin the next phase
do not hide the failure
do not weaken the test
do not modify expected behavior merely to make a test green
```

Allowed recovery loop:

```textFAIL
↓
diagnose
↓
fix
↓
rerun
↓
PASS
↓
advance
```

## RULE 0.10 — PRESERVE USER DATA

Never reset, clear, or migrate away:

```textdrafts
offline queue
pending operations
server sequence
selected Group
selected Project
artifact history
private conversations
local files
local state
```

unless the master specifications explicitly require it.

---

# 1. SOURCE-OF-TRUTH HIERARCHY

When interpreting requirements, use this exact hierarchy.

## 1.1 Security / privacy / backend authority

Source:

```textBackend Master Specification
```

Controls:

```textauthorization
privacy
database semantics
API contracts
WebSocket contracts
AI execution
approval integrity
sync semantics
server feature flags
secrets
GitHub authorization
```

## 1.2 Product UX authority

Source:

```textFrontend Master Specification
```

Controls:

```textscreen behavior
interaction behavior
keyboard behavior
loading states
error states
offline UX
responsive UX
artifact UX
meeting UX
content humanization
accessibility
product feeling
```

## 1.3 Migration authority

Source:

```textThis document
```

Controls:

```textphase sequence
implementation mechanics
token rollout
visual migration
visual QA
migration ledger
agent gates
anti-drift checks
final certification
```

## 1.4 Conflict rule

When sources appear inconsistent:

```textDO NOT GUESS
```

Classify:

```textCLEAR
AMBIGUOUS
CONFLICTING
MISSING
```

For `CLEAR`:

```textimplement
```

For `AMBIGUOUS`:

```textpreserve current behavior
document ambiguity
do not widen scope
```

For `CONFLICTING`:

```textfollow higher authority
record conflict
avoid unrelated changes
```

For `MISSING`:

```textimplement only what is necessary
use existing architecture
do not invent a new product concept
```

---

# 2. TARGET PRODUCT MODEL — DO NOT DRIFT

The migration must preserve the product model:

```textAccount
  ↓
Group
  ├── Members
  ├── One shared Odin identity
  ├── Main Group chat
  ├── Projects
  ├── Files / artifacts
  ├── Memory
  ├── Tasks
  ├── Decisions
  ├── Activity
  ├── Notifications
  ├── GitHub
  ├── AI configuration / usage
  └── Meetings
        ↓
      Project
        ├── context
        ├── instructions
        ├── files
        ├── research
        ├── artifacts
        ├── tasks
        ├── decisions
        ├── memory
        ├── GitHub metadata
        └── pulse / snapshots
```

Private scopes remain:

```textPRIVATE_PAIR
PRIVATE_AI
USER_PRIVATE memory
```

Do not merge them into Group or Project shared scope.

---

# 3. TARGET EXPERIENCE

ClanMind should feel:

```textserious
calm
expressive
technical
collaborative
AI-native
```

but not:

```textgeneric chatbot
Slack clone
social media
IDE clone
rainbow dashboard
childish AI toy
```

The intended visual state transition:

```textREST
↓
Odin becomes active
↓
subtle spectral activity
↓
research/tool activity
↓
artifact construction
↓
meaningful work completes
↓
spectral activity stops
↓
REST
```

At rest, the product should be calm.

During real AI work, it should become visibly alive.

After work, it must settle again.

---

# 4. PHASE MODEL

The migration uses these phases:

```textPHASE 0  Discovery + Baseline + Foundation
PHASE 1  M3 Primitives
PHASE 2  App Shell
PHASE 3  Chat + Composer
PHASE 4  AI + Research + Approvals
PHASE 5  Artifacts + Garage + Files
PHASE 6  Projects + Tasks + Decisions + Memory + Meetings + Team
PHASE 7  Search + Activity + Notifications + Settings + Auth + Onboarding
PHASE 8  Global QA + Certification
```

Dependency graph:

```textPHASE 0
   ↓
PHASE 1
   ↓
PHASE 2
   ↓
PHASE 3
   ↓
PHASE 4
   ↓
PHASE 5
   ↓
PHASE 6
   ↓
PHASE 7
   ↓
PHASE 8
```

Do not parallelize phases unless the agent can prove that the work has zero dependency on unfinished phase output.

Default behavior:

```textONE PHASE AT A TIME
```

---

# 5. REQUIRED MIGRATION FILES

Create:

```textdocs/migration/M3_MIGRATION_LEDGER.md
docs/migration/M3_BASELINE.md
docs/migration/M3_PHASE_REPORT.md
docs/migration/M3_DEVIATIONS.md
```

If the repository already contains equivalent files:

```textreuse them
```

Do not duplicate documentation systems.

---

# 6. MIGRATION LEDGER FORMAT

The migration ledger must contain one row for every meaningful migration unit.

Recommended columns:

| ID | Phase | Surface | Current implementation | Target | Allowed files | Forbidden files | Tests | Visual QA | Status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|

Status values:

```textNOT_STARTED
INVENTORIED
IN_PROGRESS
BLOCKED_BY_SPEC
BLOCKED_BY_TEST
READY_FOR_REVIEW
ACCEPTED
```

Never use:

```textDONE
```

without explicit acceptance criteria.

---

# 7. UNIVERSAL TASK EXECUTION PROTOCOL

Every migration task must follow this sequence.

```textSTEP A — Read task
STEP B — Inspect current implementation
STEP C — Identify dependencies
STEP D — Record existing behavior
STEP E — Record allowed files
STEP F — Record forbidden files
STEP G — Make smallest safe visual change
STEP H — Run focused tests
STEP I — Run relevant broader tests
STEP J — Run typecheck/build/lint as required
STEP K — Run visual QA
STEP L — Run accessibility QA
STEP M — Run reduced-motion QA when relevant
STEP N — Update migration ledger
STEP O — Mark ACCEPTED only after gate passes
```

Never skip directly from B to O.

---

# 8. UNIVERSAL TASK TEMPLATE

For every atomic task, the agent should mentally and in the ledger use:

```textTASK ID:
PHASE:
SURFACE:

GOAL:

CURRENT FILES:

FILES TO INSPECT:

FILES ALLOWED TO MODIFY:

FILES FORBIDDEN TO MODIFY:

DEPENDENCIES:

EXISTING BEHAVIOR TO PRESERVE:

VISUAL CHANGES:

STATE MATRIX:

FUNCTIONAL TESTS:

VISUAL TESTS:

ACCESSIBILITY TESTS:

REDUCED MOTION TESTS:

RESPONSIVE TESTS:

SECURITY TESTS:

EXPECTED RESULT:

FAILURE CONDITIONS:

EXIT GATE:
```

A task is not complete until every relevant field is satisfied.

---

# 9. PHASE 0 — DISCOVERY, BASELINE, FOUNDATION

## PHASE 0 GOAL

Establish ground truth before changing appearance.

---

## TASK 0.1 — Repository Inventory

### Inspect

Find:

```textpackage.json
pnpm-lock.yaml / equivalent lockfile
src/
src-tauri/
routes
app entrypoint
AppShell
design system
components
features
hooks
stores
queries
API client
WebSocket client
local persistence
sync queue
artifact renderer
Tauri bridge
theme logic
icon system
font loading
tests
visual capture scripts
```

### Do not assume paths

The repository may not exactly match the master specification's recommended structure.

Use the actual source tree.

### Record

```textentrypoint
build command
test command
lint command
typecheck command
visual test command
repository structure
```

### Gate

```text[ ] repository map exists
[ ] commands verified
[ ] all major frontend domains located
[ ] no source assumptions remain undocumented
```

---

## TASK 0.2 — Route Inventory

Enumerate all reachable screens/routes.

At minimum search for:

```textauth
onboarding
Group
Project
chat
thread
artifacts
Garage
tasks
decisions
memory
research
meetings
GitHub
settings
notifications
activity
search
```

For every route record:

```textroute
entry component
parent shell
data dependencies
permission dependency
feature flag dependency
offline behavior
right-surface behavior
```

### Gate

No route can remain `UNKNOWN`.

Use:

```textEXISTS
PARTIAL
UNREACHABLE
MISSING
```

---

## TASK 0.3 — Component Inventory

Enumerate:

```textprimitives
composites
pages
dialogs
sheets
drawers
menus
tooltips
toasts
artifact renderers
state indicators
```

Find duplicate implementations.

Record:

```textcanonical component
duplicate components
call sites
public props
refs
state ownership
```

Do not delete duplicates during discovery unless explicitly required.

---

## TASK 0.4 — State and Store Inventory

Identify separately:

```textUI state
server state
realtime state
local persistent state
draft state
sync state
```

Map examples:

```textcomposer draft
selected Group
selected Project
panel width
window state
message cache
typing state
presence
pending sync operation
artifact active version
```

### Gate

Agent can explain where each state class lives.

If everything appears in one store:

```textdo not redesign it automatically
record architectural risk
preserve behavior during migration
```

---

## TASK 0.5 — Integration Inventory

Locate:

```textREST clients
WebSocket connection
event dispatcher
query cache
optimistic mutation logic
Tauri bridge
filesystem access
notifications
local database/cache
offline queue
sync checkpoint
```

For each record:

```textowner
inputs
outputs
state touched
critical invariants
```

---

## TASK 0.6 — Baseline Functional Tests

Run repository-native:

```bash
pnpm build
pnpm lint
pnpm test
```

Use actual repository commands if different.

Record exact outputs in:

```textdocs/migration/M3_BASELINE.md
```

### Gate

If baseline is already red:

```textdo not claim migration caused it
record PRE_EXISTING_FAILURE
```

Do not automatically “fix” unrelated failures.

---

## TASK 0.7 — Baseline Screenshots

Capture:

```textlogin
create Group
onboarding
main shell
main chat
composer
private chat
AI streaming
research
artifact
Garage
meeting
settings
GitHub approval
sync conflict
```

Both:

```textlight
dark
```

All responsive modes:

```text<600
600–1023
1024–1439
≥1440
```

If a screen does not exist in the current implementation:

```textrecord MISSING
do not fabricate a baseline
```

---

## TASK 0.8 — Build the Migration Ledger

Populate the ledger from actual repository discovery.

Do not use the source specifications as proof that a component already exists.

---

# 10. PHASE 0 DESIGN FOUNDATION

## TASK 0.9 — Create Token Architecture

Target semantic layers:

```textcolor
typography
shape
elevation
spacing
motion
focus
state
iconography
```

Primary token source:

```textsrc/design-system/tokens/
```

CSS publication:

```textsrc/index.css
```

Tailwind v4:

```text@theme
```

Reuse existing token files when possible.

---

## TASK 0.10 — Implement Dark Theme

Required:

```textbackground = #000000
```

Required tonal depth:

```text#000000
#0D0E12
#131316
#1F1F22
#292A2D
```

Never substitute a different base dark color.

---

## TASK 0.11 — Implement Light Theme

Use the approved light semantic role mapping.

Do not create a separate component visual language.

---

## TASK 0.12 — Theme Controller

Support:

```textlight
dark
system
```

Preserve:

```textexisting persistence
```

Behavior:

```textsystem → prefers-color-scheme
light → light
dark → dark
```

Do not reset:

```textGroup
Project
draft
panel state
```

when theme changes.

---

## TASK 0.13 — Typography Tokens

Implement approved type roles.

Minimum:

```textDisplay L
Headline M
Title L
Title M
Title S
Body L
Body M
Body S
Label L
Label M
Label S
```

Never use below 11px.

---

## TASK 0.14 — Shape Tokens

```textnone 0
xs 4px
sm 8px
md 12px
lg 16px
xl 28px
full 9999px
```

---

## TASK 0.15 — Motion Tokens

Implement:

```textexpressive-fast
expressive-default
expressive-slow
emphasized
emphasized-decel
emphasized-accel
standard
```

Also implement reduced-motion handling.

---

## TASK 0.16 — State-Layer Utility

Centralize:

```texthover 8%
focus 10% + ring
pressed 10%
dragged 16%
selected 10–12%
disabled 38% content / 12% container
```

Do not hand-code state layers independently in every component.

---

## TASK 0.17 — Icon System

Implement one Material Symbols wrapper.

Search all source for:

```textlucide-react
```

Create a migration inventory.

Do not globally delete icons before every call site is safely migrated.

---

## TASK 0.18 — Humanization Registry

Create centralized mappers for:

```textAI run states
tool states
sync states
index states
notification categories
artifact types
permission errors
GitHub states
approval states
meeting candidate states
```

Unknown values need safe human fallback.

---

## PHASE 0 GATE

Must pass:

```text[ ] build
[ ] lint
[ ] tests
[ ] token checks
[ ] theme checks
[ ] dark = #000000
[ ] no feature raw hex values
[ ] no arbitrary feature radius values
[ ] no arbitrary feature durations
[ ] Material Symbols infrastructure works
[ ] reduced-motion infrastructure works
[ ] humanization infrastructure works
[ ] baseline documented
[ ] ledger populated
```

---

# 11. PHASE 1 — M3 PRIMITIVES

Migrate primitives before screens.

Order:

```text1 Button
2 IconButton
3 Input
4 Textarea
5 Select
6 Checkbox
7 Switch
8 Radio
9 Tabs
10 Chip
11 Badge
12 Avatar
13 Tooltip
14 Popover
15 Dialog
16 Dropdown
17 ContextMenu
18 Toast/Snackbar
19 Progress
20 Skeleton
21 ScrollArea
22 CommandPalette
23 FAB
```

For every primitive use the universal task protocol.

---

## TASK 1.x — Primitive Rules

Every primitive must preserve:

```textprops
refs
controlled behavior
keyboard behavior
Radix behavior
focus behavior
form behavior
disabled behavior
event semantics
```

Visual changes include:

```textsemantic colors
surface tiers
shape
state layers
M3 type
M3 spacing
focus ring
motion
reduced motion
```

---

## PRIMITIVE STATE MATRIX

At minimum:

```textdefault
hover
focus
pressed
selected where relevant
disabled
loading where relevant
success where relevant
error where relevant
offline where relevant
permission denied where relevant
```

---

## BUTTON

Kinds:

```textfilled
tonal
outlined
text
elevated
FAB
```

Rules:

```text48dp hit area
M3 state layers
clear disabled state
focus ring
loading without layout jump
```

Never use rainbow as permanent button fill.

---

## INPUT / TEXTAREA

Must support:

```textdefault
focused
filled
invalid
valid
disabled
read-only
loading
```

Error presentation must use:

```textwhat happened
→
recovery guidance
```

---

## DIALOG / SHEET

Must:

```texttrap focus
restore focus
Esc when safe
have accessible title
have explicit actions
use level-5 surface
```

---

## TOAST / SNACKBAR

Allowed for:

```textcopy
save
invite
reversible deletion
background completion
```

Not for:

```textdestructive confirmation
long instructions
ongoing AI activity
```

---

## PHASE 1 GATE

For every primitive:

```text[ ] visual state matrix
[ ] keyboard test
[ ] focus test
[ ] a11y name
[ ] reduced motion
[ ] existing tests
[ ] no prop/ref regression
[ ] screenshots accepted
```

---

# 12. PHASE 2 — APP SHELL

## TASK 2.1 — Inventory Current Shell

Before changing it, record:

```textnavigation logic
Group selection
Project selection
route transitions
panel state
responsive logic
window persistence
notifications
sync banner
error boundaries
```

---

## TASK 2.2 — Presentation Decomposition

Target presentation boundaries:

```textAppShell
TopBar
GroupSwitcher
ProjectSwitcher
LeftNav
NavigationDrawer
RightSurfaceHost
PanelResizer
SyncBanner
NotificationCenter
GlobalCommandSurface
```

Do not duplicate state ownership.

---

## TASK 2.3 — Responsive Modes

Implement:

```textCOMPACT <600
single pane
drawer
full-screen right sheet
anchored composer

MEDIUM 600–1023
two panes
navigation rail
right overlay sheet

EXPANDED 1024–1439
three panes
docked right surface
resizable divider

LARGE ≥1440
three panes
comfortable center measure
```

---

## TASK 2.4 — Right Surface

Rules:

```textempty → collapse
artifact → dock/overlay according to breakpoint
thread → right surface
research → right surface
diff → right surface
meeting artifact → right surface
```

Never stack chaotic independent panels.

---

## TASK 2.5 — Resizer

Support:

```textdrag
Arrow keys
Home
End
```

Persist width locally.

Set minimum and maximum usable widths.

---

## TASK 2.6 — Shell Error Boundaries

Ensure feature isolation:

```textChat error ≠ shell crash
Garage error ≠ shell crash
Artifact error ≠ chat crash
GitHub error ≠ shell crash
Settings error ≠ shell crash
```

---

## TASK 2.7 — Feature Flag Layout Validation

Check:

```textmeeting off
proactive_ai off
github_write off
github_merge off
custom_skills off
deep_research off
offline_sync_v2 off
interactive_artifacts off
```

No broken navigation.

---

## PHASE 2 GATE

Manually verify at all breakpoints:

```text[ ] shell
[ ] left navigation
[ ] center chat
[ ] right surface
[ ] composer
[ ] Group switch
[ ] Project switch
[ ] empty right surface
[ ] resize
[ ] keyboard resize
[ ] feature flags
[ ] theme
[ ] error boundaries
```

---

# 13. PHASE 3 — CHAT + COMPOSER

Do not move to AI/artifacts until the core chat surface is stable.

Order:

```textMessageRow
MessageList
MessageActions
ReactionPicker
ThreadPanel
Composer
AttachmentTray
MentionPicker
SlashCommandPicker
PrivateRecipientChooser
```

---

## TASK 3.1 — MessageRow

Preserve:

```textsender
timestamp
body
attachments
reactions
thread
mentions
edit/delete
pin
visibility
```

Visual target:

```textgrouped by author
single sensible avatar
Body L
secondary metadata below
compact actions
```

Do not make each line a giant bubble.

---

## TASK 3.2 — Message Actions

Required:

```textreply
react
copy
more
```

More may contain:

```textedit
delete
pin
quote
create task
save decision
use as context
mark unread
```

Only backend-authorized actions may appear.

Important actions cannot be hover-only.

---

## TASK 3.3 — Copy

Test:

```textcopy plain text
copy Markdown
copy code
selection
keyboard
focus remains in composer when appropriate
accessible success
```

---

## TASK 3.4 — Reactions

Optimistic behavior:

```textinstant local state
server confirmation
rollback on rejection
```

No bouncing animation.

---

## TASK 3.5 — Threads

Required:

```textopen thread
original message
replies
reactions
attachments
composer
Esc close
focus restore
```

---

## TASK 3.6 — Message Virtualization

Preserve:

```textTanStack Virtual
stable keys
scroll anchors
cursor loading
thread navigation
```

Test:

```text10k+ messages
long message
rapid inserts
AI streaming
```

---

## TASK 3.7 — Chat Scroll

Rules:

```textnear bottom → follow
reading older content → do not move
new content → show Jump to latest
return bottom → resume follow
```

This applies during AI streaming too.

---

## TASK 3.8 — Composer

Structure:

```texttextarea
attachment
slash command
mention
private mode
reply mode
send
```

Auto-grow:

```text~44–52px min
~220–280px max
internal scroll after cap
```

---

## TASK 3.9 — Composer Keyboard

Default:

```textEnter → send
Shift+Enter → newline
```

Optional preference:

```textEnter → newline
Ctrl/Cmd+Enter → send
```

Do not break native undo/redo.

---

## TASK 3.10 — Attachment Tray

States:

```textselected
uploading
uploaded
failed
cancelled
```

Failure:

```textpreserve item
Retry
Remove
```

Never silently drop files.

---

## TASK 3.11 — Mention Picker

Trigger:

```text@
```

Supports:

```textArrow Up
Arrow Down
Enter
Esc
```

Only current Group members.

Odin appears as distinct AI identity.

---

## TASK 3.12 — Slash Commands

Support current product commands where available:

```textAsk Odin
Private
Meeting
Research
Memory
Project
```

Feature flags can suppress commands.

---

## TASK 3.13 — Private Recipient Chooser

Private mode must visibly switch scope:

```text🔒 Private with X
```

Persist recipient indication.

Do not allow accidental return to public send due to stale selection.

---

## PHASE 3 SECURITY GATE

Test:

```text[ ] User A private chat invisible to User B
[ ] private draft remains private
[ ] private message absent from shared activity
[ ] private message absent from public notifications
[ ] private memory not exposed
[ ] Group switch does not leak private state
[ ] Project switch does not leak private state
```

---

# 14. PHASE 4 — AI + RESEARCH + APPROVALS

## CANONICAL AI RUN STATES

```textQUEUED
RUNNING
WAITING_TOOL
STREAMING
COMPLETED
FAILED
CANCELLED
```

Map directly.

Never invent fake backend state.

---

## TASK 4.1 — AI Status

Mappings:

```textQUEUED
→ Odin is starting…

RUNNING
→ Odin is working…

WAITING_TOOL
→ tool activity

STREAMING
→ incremental answer

COMPLETED
→ final answer

FAILED
→ error card

CANCELLED
→ Stopped
```

---

## TASK 4.2 — Tool Timeline

Show:

```textSearching the web
Reading project references
Building architecture
```

or progress:

```text✓ 6 sources found
✓ 3 relevant
• Synthesizing…
```

Do not expose hidden reasoning.

---

## TASK 4.3 — Streaming

Do not render the whole application on every token.

Use:

```textbatched deltas
isolated active AI state
```

Accessibility:

```textOdin started
Odin completed
Odin failed
```

Never announce every token.

---

## TASK 4.4 — AI Cancel

On cancel:

```textpreserve partial content
mark cancelled
offer retry
```

---

## TASK 4.5 — AI Retry / Regenerate

Retry:

```textnew run
old response preserved
```

Regenerate:

```textnew run
old response preserved
new artifact version when appropriate
```

---

## TASK 4.6 — Quota

Exact backend branch:

```textAPPLICATION_AI_QUOTA_EXHAUSTED
```

If:

```textcan_continue_with_byok = true
```

render subtle continuity:

```textOdin · BYOK
```

If:

```textfalse
```

render:

```textApplication AI quota reached.

An administrator can configure BYOK to continue.
```

Admin action:

```textOpen AI settings
```

Never use generic “AI unavailable” for this error.

---

## TASK 4.7 — Research

Show only when actual web research occurred:

```textWeb research · 8 sources
```

Sources:

```texttitle
domain
retrieved time
Open
citation
```

Never invent citations on the client.

---

## TASK 4.8 — Research Drawer

Sections:

```textSummary
Findings
Sources
Project impact
Uncertainty
```

Original chat answer remains available.

---

## TASK 4.9 — ApprovalCard

Every high-risk approval uses generalized action data.

Display:

```textaction kind
risk
payload summary
requesting run
triggering user if available
created
expires
Reject
Approve
```

---

## TASK 4.10 — Approval Integrity

The client MUST NOT send:

```textapproved: true
```

Approval request must bind to:

```textpayload_hash
payload_version
```

currently displayed.

---

## TASK 4.11 — Approval Expiry

If stale:

```textThis action changed since you last saw it.
Review the latest version before approving.
```

Only:

```textReview latest
```

Never retry stale payload.

---

## TASK 4.12 — GitHub Action Card

GitHub is a specialization of generic approval.

Do not build a second approval system.

Display:

```textaction
repo
branch
files
diff
risk
state
result
```

---

## PHASE 4 GATE

Test:

```text[ ] all AI run states
[ ] tool states
[ ] streaming
[ ] cancel
[ ] retry
[ ] regenerate
[ ] fallback
[ ] quota true branch
[ ] quota false branch
[ ] research
[ ] citations
[ ] approval hash/version
[ ] stale approval
[ ] unauthorized approval
[ ] no chain-of-thought
```

---

# 15. PHASE 5 — ARTIFACTS + GARAGE + FILES

## TASK 5.1 — Artifact Work Surface

Right-side work surface contains:

```texttitle
type
version
pin
copy
export
open in context
more
```

---

## TASK 5.2 — Auto-Open Rules

Open automatically only when:

```textsubstantial user request
AND
backend identifies primary artifact
```

Do not auto-open trivial responses.

---

## TASK 5.3 — Live Artifact

While building:

```text2–3px spectral edge
progress/status
incremental content
changed-region animation
```

On completion:

```textremove spectral edge
status Ready
one subtle completion glow
no confetti
```

---

## TASK 5.4 — Artifact Renderer Isolation

Each renderer must fail independently.

Example:

```textArtifact rendering error
→ error card inside artifact area
→ chat remains usable
```

---

## TASK 5.5 — Diagram Renderer

Requirements:

```textfit to width
legible node labels
hide attribution
changed-node updates
throttled layout
keyboard zoom controls
fullscreen
selection
```

No endless edge animation.

---

## TASK 5.6 — Chart Renderer

Use semantic token palette.

Never use spectral gradient as chart series palette.

---

## TASK 5.7 — Table Renderer

Use:

```textcompact density
sticky header
tonal zebra
readable columns
```

---

## TASK 5.8 — Document / Markdown

Use:

```textreading measure
M3 typography
safe Markdown renderer
safe links
```

---

## TASK 5.9 — Artifact Versions

Render:

```textv1
v2
v3
v4
```

Each with:

```textcreator
timestamp
source AI run where available
```

Actions:

```textView
Compare
Restore
```

---

## TASK 5.10 — Compare

Do not show raw JSON by default.

Use semantic comparison:

```textdocuments → text diff
diagrams → structural/visual diff
tables → changed rows/values
```

---

## TASK 5.11 — Garage

Filters:

```textAll
Artifacts
Files
Research
Pinned
Recent
```

Modes:

```textgrid
list
```

Persist preference locally.

---

## TASK 5.12 — File Sync

Primary sync state:

```textLOCAL_ONLY
QUEUED
UPLOADING
SYNCED
REMOTE_CHANGED
LOCAL_CHANGED
CONFLICT
DELETED
RESTORABLE
```

Index state:

```textINDEXING
READY
FAILED
STALE
DELETED
```

Render both independently.

---

## TASK 5.13 — Sync Conflict

`version_mismatch`:

```textThis was updated by someone else while you were offline.
```

`concurrent_edit`:

```textYou and someone else both changed this.
```

`deleted_upstream`:

```textThis was deleted by someone else while you were offline.
```

Deleted upstream only:

```textRestore mine as new
Discard mine
```

---

## PHASE 5 GATE

Test:

```text[ ] artifact open
[ ] no chat jump
[ ] live construction
[ ] reduced motion
[ ] versions
[ ] compare
[ ] restore
[ ] pin
[ ] export
[ ] renderer isolation
[ ] large artifact
[ ] diagram
[ ] chart
[ ] table
[ ] Garage
[ ] 9 sync states
[ ] 5 index states
[ ] conflict types
```

---

# 16. PHASE 6 — PROJECT INTELLIGENCE

Order:

```textProject Overview
Project Pulse
Tasks
Decisions
Memory
Meeting Mode
Team
```

---

## TASK 6.1 — Project Overview

Show:

```textgoal
pulse
current focus
open decisions
active tasks
recent artifacts
recent activity
GitHub
```

Keep it concise.

---

## TASK 6.2 — Pulse

Pulse is a calm digest.

Show:

```textwhat happened
decisions
artifacts
needs attention
```

Animation:

```textone run
then settle
```

No perpetual animation.

---

## TASK 6.3 — Tasks

Task:

```texttitle
owner
status
priority
due
related decision
```

States:

```textempty
loading
error
offline
```

Drag is optional enhancement.

Always provide non-drag alternatives.

---

## TASK 6.4 — Decisions

Decision:

```texttitle
context
rationale
sources
approved by
status
```

Contradiction gets distinct treatment.

Do not rely only on color.

---

## TASK 6.5 — Memory

Scopes:

```textGroup Memory
Project Memory
Your Private Memory
```

Memory candidate:

```textOdin noticed a possible project memory
Save
Dismiss
```

Never expose secrets.

---

## TASK 6.6 — Meeting Mode

Meeting is a mode of the same shell.

Not a second application.

Header:

```textMeeting
elapsed
participants
End
```

Right surface:

```textmeeting artifacts
```

---

## TASK 6.7 — Meeting Candidates

Backend lifecycle:

```textPENDING
ACCEPTED
REJECTED
MERGED
EXPIRED
```

Do not optimistically convert a candidate to real persisted task/decision before backend confirmation.

---

## TASK 6.8 — Meeting End

Pending candidates must appear in review.

Never silently disappear.

---

## TASK 6.9 — Team

Show:

```textavatar
name
role
presence
project
```

Actions:

```textprivate chat
mention
profile
nickname
```

Keep presence subtle.

---

## PHASE 6 GATE

Test:

```text[ ] Project orientation
[ ] Pulse
[ ] Tasks
[ ] Decisions
[ ] contradiction
[ ] memory scopes
[ ] meeting active
[ ] candidate lifecycle
[ ] meeting end summary
[ ] team
[ ] Group/Project switching
[ ] no stale context
```

---

# 17. PHASE 7 — SEARCH / ACTIVITY / SETTINGS / AUTH / ONBOARDING

Order:

```textSearch
Activity
Notifications
Settings
BYOK
GitHub settings
Auth
Onboarding
AI-potential demo
Protocol update
```

---

## TASK 7.1 — Search

Entry:

```textCtrl/Cmd + K
```

Domains:

```textMessages
Files
Artifacts
Tasks
Decisions
People
Projects
Commands
```

Behavior:

```textdebounce
cancel stale query
ACL filter
deep link
switch Group
switch Project
load
scroll
highlight
```

---

## TASK 7.2 — Search Privacy

Test:

```textprivate result exists
unauthorized user searches same term
result does not appear
```

Do not “hide” a backend-leaked result visually.

Backend must not return it.

---

## TASK 7.3 — Activity

Show:

```textmentions
replies
reactions
approvals
assignments
important AI events
```

Do not include every presence heartbeat.

---

## TASK 7.4 — Notifications

Exact categories:

```textMENTION
PRIVATE_MESSAGE
AI_RESPONSE
AI_ACTION_APPROVAL
TASK_ASSIGNMENT
DECISION_APPROVAL
ARTIFACT_READY
GITHUB_EVENT
MEETING_SUMMARY
PROACTIVE_AI
SYSTEM
```

User-facing labels must be humanized.

---

## TASK 7.5 — Settings

Sections:

```textGeneral
Members
AI
Skills
Research
GitHub
Notifications
Usage
Security
Danger Zone
```

---

## TASK 7.6 — BYOK

Never:

```textstore key in browser/client persistence
return raw key
log raw key
```

Show:

```textmasked connected state
provider
last4 if supported
status
```

---

## TASK 7.7 — Danger Zone

Destructive actions:

```textconfirm
explain consequences
preserve recovery where specified
```

Irreversible deletion uses required confirmation.

---

## TASK 7.8 — Auth

Keep first launch extremely clean.

Recovery must not reveal whether an email exists.

---

## TASK 7.9 — Onboarding

No more than seven major steps.

Target:

```textGroup name
description optional
invites optional
Odin intro
AI setup optional
Project optional
enter Group
```

No configuration wall.

---

## TASK 7.10 — AI Potential Demo

Demonstrate:

```textHuman message
→ @Odin
→ research
→ sources
→ project impact
→ artifact
→ decision
→ task
→ GitHub approval
```

This is a short story, not a documentation page.

Reduced motion must show the same information.

---

## TASK 7.11 — Protocol Update

Recommended update:

```textnew version available
Update now
Later
```

Required update:

```textClanMind needs an update to continue.
Local drafts and cached data are safe.
Update now
```

Do not retry an incompatible protocol forever.

---

## PHASE 7 GATE

Test:

```text[ ] search
[ ] private search boundary
[ ] Activity
[ ] notification categories
[ ] notification deep links
[ ] settings
[ ] role-specific settings
[ ] BYOK secrecy
[ ] danger zone
[ ] auth
[ ] password recovery
[ ] onboarding skip paths
[ ] demo
[ ] reduced-motion demo
[ ] protocol mismatch
```

---

# 18. PHASE 8 — GLOBAL CERTIFICATION

This phase is not another visual pass.

It is the release certification.

---

# 19. GLOBAL FUNCTIONAL TEST MATRIX

Execute:

```text[ ] startup
[ ] authentication
[ ] Group creation
[ ] Group switching
[ ] Project creation
[ ] Project switching
[ ] message send
[ ] message edit
[ ] message delete
[ ] message reaction
[ ] message thread
[ ] mention
[ ] attachment
[ ] private human chat
[ ] private AI chat
[ ] AI Assist
[ ] AI Facilitate
[ ] AI Act
[ ] AI streaming
[ ] AI cancel
[ ] AI retry
[ ] AI fallback
[ ] research
[ ] citation
[ ] artifact
[ ] artifact version
[ ] artifact compare
[ ] artifact restore
[ ] Garage
[ ] task
[ ] decision
[ ] memory
[ ] meeting
[ ] GitHub read
[ ] GitHub write approval
[ ] approval expiry
[ ] notifications
[ ] search
[ ] offline
[ ] reconnect
[ ] sync
[ ] conflict
[ ] crash recovery
[ ] session expiration
[ ] feature flags
```

---

# 20. SECURITY CERTIFICATION

Execute negative tests:

```textA in Group A → Group B data
A → B private conversation
public AI → private memory
Project A AI → Project B file
Guest → admin action
removed member → stale token
revoked object → old signed URL
unauthorized approval → execution
stale approval hash → execution
artifact → Tauri privilege
web content → policy override
file content → arbitrary execution
diagnostics → secret exposure
```

Every forbidden path must fail.

---

# 21. AI CONTRACT CERTIFICATION

Validate exact states:

```textai_runs.status:
QUEUED
RUNNING
WAITING_TOOL
STREAMING
COMPLETED
FAILED
CANCELLED
```

Validate tool call states and approval gating.

Validate:

```texttools_used
search_used
source_count
context_sources
run_id
artifact_ids
action_ids
usage metadata
```

Never expose sensitive fields.

---

# 22. APPROVAL CERTIFICATION

For every high-risk action:

```textproposal created
payload hash created
payload version created
approval rendered
hash/version submitted
backend validates hash/version
execution allowed only when matching
stale mutation expires action
fresh review required
```

Test both:

```textvalid approval
tampered approval
```

---

# 23. SYNC CERTIFICATION

Test:

```textoffline
draft
message queue
reconnect
checkpoint
missing events
pending operations
acknowledgement
rejected operation
conflict
resolution
```

Verify `client_operation_id` is reused during retry.

Never mint a new operation identity for a retry.

---

# 24. PRIVATE DATA CERTIFICATION

Test end-to-end, not only component tests.

Scenario:

```textUser A
→ private AI conversation
→ private message
→ private memory
→ Group switch
→ global search
→ notification center
→ activity
→ public AI request
```

Expected:

```textno private data appears outside authorized scope
```

---

# 25. VISUAL CERTIFICATION

Screens:

```textLogin
Create Group
Onboarding
AI potential demo
Main shell
Main chat
Composer
Mention picker
Private chat
AI streaming
Research
Artifact
Garage
Meeting
Settings
GitHub approval
Sync conflict
```

Themes:

```textlight
dark
```

Widths:

```text<600
600–1023
1024–1439
≥1440
```

---

# 26. VISUAL REVIEW QUESTIONS

For every screen:

```textWhere am I?
What is active?
What changed?
What can I do?
What cannot I do?
Why is an action unavailable?
Can I recover?
Can I work offline?
Does keyboard navigation work?
Does focus make sense?
Does animation communicate something?
Does the screen remain calm?
```

---

# 27. GRAYSCALE CERTIFICATION

Convert screenshots to grayscale.

The UI must still communicate:

```texthierarchy
state
selected item
errors
success
focus
activity
```

Do not rely on the spectral gradient to carry meaning.

---

# 28. SPECTRAL CERTIFICATION

Search production feature source.

Verify spectral appearance occurs only in approved locations:

```textOdin active identity
live artifact construction
onboarding hero
primary empty-state illustration
real AI streaming/progress
auth brand moment
```

At rest:

```textno perpetual spectral animation
```

---

# 29. REDUCED-MOTION CERTIFICATION

Set:

```textprefers-reduced-motion: reduce
```

Validate:

```textonboarding
artifact construction
panel transitions
reactions
progress
AI streaming
Pulse
navigation
dialogs
```

Requirements:

```textno critical information disappears
no continuous movement
no unnecessary spring motion
no token-by-token animation storm
```

---

# 30. ACCESSIBILITY CERTIFICATION

Run accessibility tooling on critical flows.

Validate:

```textaccessible names
focus visibility
focus restoration
keyboard navigation
dialog semantics
popover semantics
status announcements
contrast
target sizes
drag alternatives
```

Do not stop at automated tooling.

Perform keyboard-only flows.

---

# 31. KEYBOARD-ONLY GOLDEN PATH

Complete without pointer:

```textlogin
create Group
enter Project
send message
mention teammate
reply thread
open command palette
switch Project
open artifact
approve permitted action
close dialog
```

Every step must be possible.

---

# 32. PERFORMANCE CERTIFICATION

Stress:

```text10k+ messages
long AI response
large artifact
large diff
many presence updates
rapid reactions
multiple uploads
```

Protect:

```textcomposer typing
scrolling
view switch
message arrival
AI streaming
artifact animation
```

Required behavioral targets from the product specs:

```textno typing lag
virtualized long-history scrolling remains usable
view switch feels fast
AI delta does not rerender unrelated surfaces
```

---

# 33. CONTENT STRESS TEST

Use:

```textlong Group name
long Project name
long member name
long file name
long artifact title
long task title
long decision rationale
large Markdown
wide table
large code block
large diff
many reactions
many mentions
```

Check:

```textno clipping
no broken layout
no accidental horizontal overflow
no inaccessible controls
```

---

# 34. UNKNOWN-VALUE CERTIFICATION

Inject development fixtures for unknown:

```textAI state
tool state
artifact type
notification category
sync state
index state
approval state
feature flag
permission error
```

Expected:

```textsafe human fallback
no crash
no raw internal enum in ordinary UI
diagnostic information available only to developers
```

---

# 35. ANTI-DRIFT SCANS

Search source for:

```textSCREAMING_SNAKE_CASE rendered copy
bg-[#...
text-[#...
border-[#...
rounded-[...
duration-[...
animate-[...
z-[999999]
lucide-react
raw JSON rendering
approved: true
raw API keys
private content in global stores
```

Every match must be classified:

```textvalid
test fixture
token source
production defect
```

Production defects block release.

---

# 36. DO-NOT-SHIP CERTIFICATION

Verify none of the following exist:

```textSlack clone
giant AI cards
permanent rainbow
message animation storm
chain-of-thought UI
scroll jumping
discarded failed messages
hover-only critical controls
artifact crash breaking chat
frontend-trusted permissions
client-stored BYOK
overlong onboarding
Meeting Mode as separate app
universal spinner
drag-only workflow
contrast sacrificed for aesthetics
cramped composer
permanent empty right panel
cluttered Pulse
raw enums
raw error codes
raw JSON
arbitrary visual values
fake citations
fake permissions
fake AI states
```

---

# 37. PHASE REPORT FORMAT

At the end of every phase write:

```text
PHASE:
STATUS:

FILES INSPECTED:
FILES CHANGED:

BEHAVIOR CHANGED:
YES / NO

BACKEND CHANGED:
YES / NO

CONTRACT CHANGED:
YES / NO

SECURITY CHANGED:
YES / NO

BUILD:
PASS / FAIL

LINT:
PASS / FAIL

TESTS:
PASS / FAIL

A11Y:
PASS / FAIL / N/A

VISUAL:
PASS / FAIL

REDUCED MOTION:
PASS / FAIL / N/A

RESPONSIVE:
PASS / FAIL / N/A

SECURITY:
PASS / FAIL / N/A

PERFORMANCE:
PASS / FAIL / N/A

KNOWN DEVIATIONS:

BLOCKERS:

NEXT PHASE:
```

Never leave these fields ambiguous.

---

# 38. FINAL CERTIFICATION REPORT

Before declaring complete, generate:

```textdocs/migration/M3_FINAL_CERTIFICATION.md
```

It must contain:

```text1. baseline result
2. every phase result
3. changed-file summary
4. behavior-preservation confirmation
5. backend-preservation confirmation
6. contract-preservation confirmation
7. privacy/security result
8. accessibility result
9. visual result
10. responsive result
11. reduced-motion result
12. performance result
13. feature-flag result
14. offline/sync result
15. AI result
16. artifact result
17. GitHub/approval result
18. remaining deviations
19. explicit release decision
```

---

# 39. RELEASE DECISION RULE

Possible final statuses:

```textRELEASE_READY
RELEASE_BLOCKED
```

Use:

```textRELEASE_BLOCKED
```

if any release-blocking condition exists.

Never substitute:

```textmostly done
looks good
minor issue
probably safe
```

for a real status.

---

# 40. FINAL RELEASE BLOCKERS

Any one of these blocks release:

```textfailed build
failed critical tests
privacy leak
security regression
broken approval integrity
private data visible in shared UI
broken offline recovery
lost drafts
broken sync conflict handling
broken realtime reconnect
broken AI state mapping
fake citation
raw secret exposure
BYOK stored client-side
artifact crash breaks chat
feature-flag layout failure
protocol update failure
critical keyboard failure
critical accessibility failure
major visual regression
raw internal enum shown to users
raw internal error code shown to users
permanent spectral animation
broken reduced-motion path
broken 10k-message scrolling
composer typing lag
```

---

# 41. FINAL AGENT CHECKLIST

The agent must be able to answer YES to every relevant item.

## Authority

```text[ ] Backend Master read completely
[ ] Frontend Master read completely
[ ] This plan read completely
[ ] no conflicting product model introduced
```

## Repository

```text[ ] real source tree inventoried
[ ] routes inventoried
[ ] components inventoried
[ ] stores inventoried
[ ] integrations inventoried
[ ] baseline captured
```

## Design

```text[ ] M3 tokens
[ ] light
[ ] dark
[ ] pure black dark base
[ ] type
[ ] shape
[ ] elevation
[ ] motion
[ ] reduced motion
[ ] state layers
[ ] Material Symbols
```

## Shell

```text[ ] compact
[ ] medium
[ ] expanded
[ ] large
[ ] drawer
[ ] rail
[ ] right surface
[ ] resizer
[ ] window persistence
```

## Chat

```text[ ] message
[ ] actions
[ ] copy
[ ] reactions
[ ] threads
[ ] mentions
[ ] attachments
[ ] composer
[ ] private
[ ] streaming
[ ] intelligent scroll
[ ] virtualization
```

## AI

```text[ ] all run states
[ ] tool states
[ ] streaming
[ ] cancel
[ ] retry
[ ] fallback
[ ] quota
[ ] research
[ ] citations
[ ] no CoT
```

## Artifacts

```text[ ] live creation
[ ] renderer isolation
[ ] versions
[ ] compare
[ ] restore
[ ] pin
[ ] export
[ ] Garage
[ ] files
[ ] sync state
[ ] index state
[ ] conflict
```

## Project intelligence

```text[ ] overview
[ ] pulse
[ ] tasks
[ ] decisions
[ ] contradiction
[ ] memory
[ ] meetings
[ ] candidates
[ ] team
```

## Control surfaces

```text[ ] search
[ ] activity
[ ] notifications
[ ] settings
[ ] BYOK
[ ] GitHub
[ ] approvals
[ ] auth
[ ] onboarding
[ ] feature flags
[ ] protocol update
```

## Reliability

```text[ ] offline
[ ] reconnect
[ ] sync
[ ] crash recovery
[ ] session expiry
[ ] error boundaries
```

## Accessibility

```text[ ] keyboard
[ ] focus
[ ] names
[ ] announcements
[ ] contrast
[ ] target sizes
[ ] drag alternatives
[ ] reduced motion
```

## Security

```text[ ] Group isolation
[ ] private isolation
[ ] memory isolation
[ ] permission enforcement
[ ] approval integrity
[ ] secret handling
[ ] artifact isolation
[ ] safe Markdown
[ ] safe external content
```

## Performance

```text[ ] typing
[ ] scrolling
[ ] view switching
[ ] message arrival
[ ] streaming
[ ] large artifacts
[ ] large diffs
[ ] large history
```

## Final

```text[ ] visual regression
[ ] stress content
[ ] grayscale
[ ] feature flags
[ ] all golden paths
[ ] anti-drift scan
[ ] final certification
```

---

# 42. FINAL AGENT COMMANDMENT

Do not optimize for:

```textfast implementation
few files changed
pretty screenshot
green superficial test
```

Optimize for:

```texttruth preservation
behavior preservation
privacy preservation
security preservation
contract preservation
visual consistency
accessibility
recoverability
performance
testability
```

The correct mental model is:

```textINSPECT
↓
UNDERSTAND
↓
CHANGE ONLY WHAT IS ALLOWED
↓
VERIFY
↓
PROVE
↓
RECORD
↓
ADVANCE
```

Never:

```textGUESS
↓
REWRITE
↓
HOPE
```

The final product must satisfy the ClanMind masters while looking and behaving as one coherent M3 / M3 Expressive product.

> **Change the appearance. Preserve the truth. Prove every step.**
