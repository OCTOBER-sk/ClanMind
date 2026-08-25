# ClanMind Frontend — Master TODO (Quality Bar)

> **Provenance:** Derived exclusively from `ClanMind_Frontend_Master_Implementation_Specification.md` (§1–§329) BEFORE reading any application code. Every item is a claim about how the app must actually behave for a real user at a real desk. Section references (`§n`) point into the spec and are the standard of truth.
>
> **How to read this file:** Each `- [ ]` item is verifiable: a behavior to demonstrate, a state to render, or a rule the code must structurally enforce. Grades used in the audit: PASS / PARTIAL / FAIL / NOT-IMPLEMENTED. A PASS requires observed evidence (file:line), never intention.

---

## 0. Product rules that must never drift (§1–§2)

- [ ] **0.1** Information model is exactly `Account → Group → Projects`. "Workspace" appears nowhere in UI copy, routes, types, or labels (§2.1, §15, §328.3).
- [ ] **0.2** A user can belong to many Groups; switching Groups preserves per-Group state (drafts, last Project) (§2.2, §191, §305).
- [ ] **0.3** Per-teammate personal nicknames are supported inside each Group, editable from Team page/profile (§2.3, §18, §86).
- [ ] **0.4** Roles are Owner/Admin/Member/Guest; only Owner controls Admin promotion/removal; ownership transfer has its own confirmation dialog (§2.4–2.6, §229).
- [ ] **0.5** One shared AI identity per Group, default "Odin"; admin can rename/change avatar; the configured name renders everywhere AI appears (§2.11–2.12, §129, §275).
- [ ] **0.6** Meeting Mode is a first-class in-app mode, not a separate application or buried command (§2.16, §123, §325.14).
- [ ] **0.7** Large AI outputs become Live Artifacts in the right-side work surface; artifact versions preserved (§2.19, §2.21, §102).
- [ ] **0.8** Tasks and Decisions are first-class objects with their own cards/surfaces (§2.22, §119–120).
- [ ] **0.9** GitHub changes are approval-controlled end-to-end (§2.23, §161–164, §164A).
- [ ] **0.10** Local-first offline behavior: cached projects/conversations/artifacts/files/drafts usable offline; cloud AI, web research, GitHub network ops clearly unavailable without making the app look broken (§2.24, §182).
- [ ] **0.11** Frontend permission state is never treated as security authority; permission-gated affordances derive from backend data; unavailable actions hidden rather than shown as disabled decoration (§2.25, §111, §302–303).
- [ ] **0.12** Private content (private human chat, private AI chat, private memory, drafts) never reaches shared UI through cache/store leakage — verified structurally (scoped stores/keys), not just visually (§2.26, §56–58, §190, §284).
- [ ] **0.13** Core loop surfaces connected end-to-end: Conversation → AI → Research → Decision → Artifact → Task → Approval → Execution → Memory (§1).

---

## 1. Design law: tokens, spectral rule, typography, motion

### Tokens (§4)
- [ ] **1.1** Semantic token set exists and is the only color source for feature components: `color.background / surface / surfaceRaised / surfaceHover / surfacePressed / border / borderStrong / text / textSecondary / textTertiary / textDisabled / primary / success / warning / danger / info / spectral`.
- [ ] **1.2** Spacing scale `space.1…space.12` defined; no feature component invents its own spacing values.
- [ ] **1.3** Radius (`radius.sm…xl`), shadows (`shadow.sm…lg`), font sizes (`font.xs…display`), motion durations (`motion.micro/small/standard/large`), and `focus.ring` all exist as tokens.
- [ ] **1.4** Base palette white/near-white/near-black/neutral gray + semantic states; interface readable in grayscale (§3.2).
- [ ] **1.5** No hard-coded color literals scattered through feature components (design-system definitions only).

### Spectral restraint (§3.3)
- [ ] **1.6** Spectral gradient used ONLY for: Odin active state, AI generation status, artifact construction, progress/milestone animation, selected visual state, onboarding moments.
- [ ] **1.7** Rainbow NEVER appears: behind body text, around every card, as permanent button fills, as default message background, or in every loading state — each prohibition checked against real components.
- [ ] **1.8** At rest the app is calm; spectral activity only while Odin works/an artifact builds, then settles (§223, §1).

### Typography (§5)
- [ ] **1.9** One legible UI family (+ optional code family); comfortable long-form body; clear heading hierarchy in AI responses; accessible metadata sizes; readable monospace for code; no ultra-light weights on critical text; OS/browser text scaling preserved.
- [ ] **1.10** Message width rhythm: normal messages at comfortable max width; wider content mode for AI research/tables/code/structured artifacts (§22).

### Motion system (§6)
- [ ] **1.11** Motion vocabulary semantics correct: Fade=secondary appear/disappear, Slide=panel/drawer movement, Scale=dialogs/reactions/node creation, Draw=diagram connections/progress, Morph=rare/reserved.
- [ ] **1.12** Durations within budget: micro 80–120ms, small 120–180ms, standard 180–280ms, large 280–420ms; no long routine transitions.
- [ ] **1.13** Reaction animation is a single tiny scale/fade 0.85→1; no bounce, no repeat (§29).
- [ ] **1.14** Project Pulse change animates ONCE: marker moves, one spectral travel, number updates, settles; pulse line never continuously animated (§85).
- [ ] **1.15** Diagram node arrival = fade + slight scale + settle; edge gradient draws along edge ONCE then stops; never pulses indefinitely (§98–99).
- [ ] **1.16** Artifact completion = status Ready + toolbar activates + ONE subtle glow, no confetti (§100).
- [ ] **1.17** `prefers-reduced-motion`: moving spectral lines removed, large panel motion removed, artifact construction replaced by immediate state change + textual status ("Odin is building the architecture." → "Architecture ready."), no critical info removed (§6, §219, §314).

---

## 2. Accessibility baseline

### Primitives & focus (§7–8)
- [ ] **2.1** WCAG 2.2 AA behaviors built into primitives: keyboard access, visible focus (`focus.ring`), accessible names, status announcements, usable target sizes, readable contrast, no essential drag-only operation, accessible dialogs/popovers, safe focus restoration, meaningful screen-reader status updates.
- [ ] **2.2** Accessible primitive layer backs dialog / popover / tooltip / dropdown / context menu / tabs / toast / scroll area / command palette (Radix-class: focus management, Esc, restoration).
- [ ] **2.3** Dialogs trap focus, close on Escape when safe, restore focus to trigger, have clear title and explicit actions (§66).
- [ ] **2.4** All icon-only actions carry tooltips AND accessible labels; tooltips are short labels, never paragraphs (§64).
- [ ] **2.5** Pointer targets ≥24×24 CSS px floor; core controls closer to 32–40px (§221).

### Realtime & streaming a11y (§217–218)
- [ ] **2.6** New messages while user reads older content: no focus steal, no auto-scroll; aggregate announcement only ("3 new messages").
- [ ] **2.7** AI streaming announces started/completed/failed only — never per-token announcements.

### Contrast & alternatives
- [ ] **2.8** Normal text ≥4.5:1, large text ≥3:1; spectral effects never the sole contrast/signifier (§222).
- [ ] **2.9** Panel resize has a non-drag keyboard-accessible mechanism; attachment drag-drop has an equivalent button path (§52, §220).

---

## 3. Architecture & state separation

- [ ] **3.1** No random component calls raw `fetch()` or manipulates the raw WebSocket — traffic flows only through typed REST client / WebSocket client / Tauri bridge layers (§9).
- [ ] **3.2** Repository structure follows spec layout: `app/ design-system/{tokens,primitives,components,icons,motion}/ features/{auth,groups,projects,chat,ai,artifacts,garage,tasks,decisions,meetings,github,settings,search,notifications}/ realtime/ sync/ local/ api/ state/ hooks/ types/` + `src-tauri/capabilities/` (§10).
- [ ] **3.3** Six state domains kept separate: UI state, server cache, realtime normalized state, local persistent state, draft state, sync state (composer text=draft; project metadata=server cache; typing=realtime; panel width=UI pref; pending offline message=sync queue) (§11).
- [ ] **3.4** Local cache keys namespaced by account and Group; no generic global keys (§283).
- [ ] **3.5** Account switch clears/re-keys cached scope; private drafts cannot cross accounts (§284).
- [ ] **3.6** No singleton/single-tab assumptions in local sync state (multi-window readiness) (§307).
- [ ] **3.7** Every component: typed props, defined states, accessibility support, no unrelated domain logic, no raw API calls, tests for its critical interaction (§311).

---

## 4. App shell, navigation, window lifecycle

### Layout (§12–13)
- [ ] **4.1** Wide-screen three-pane shell: LEFT rail (Projects/Team/Garage/Activity/Settings), CENTER main conversation, RIGHT contextual work surface; right surface does not occupy half the screen when empty.
- [ ] **4.2** Responsive breakpoints: ≥1440 three-pane; 1200–1439 compressed three-pane; 900–1199 two-pane/collapsible right panel; <900 single pane with sheets; artifact surface becomes sheet/fullscreen narrow; left rail collapsible; composer anchored bottom.

### Top bar & switchers (§14–16)
- [ ] **4.3** Top bar answers "Where am I?": Group/Project breadcrumb (`ClanMind / Robotics Team / Flight Controller`), Search, Sync status, Notifications, Profile — high-value context only.
- [ ] **4.4** Group switcher opens current Group, recent Groups, unread state, search, Create Group, Join Group; no "Workspace" terminology anywhere.
- [ ] **4.5** Project switcher shows name/active status/unread indicator/archive state only when relevant; current Project visually obvious.

### Left nav (§17)
- [ ] **4.6** Left nav default: Projects (active + others), Team, Garage, Activity, Settings; flat structure, no huge hierarchy tree.

### Window/startup/session lifecycle (§195–198, §308–309A)
- [ ] **4.7** Window state persisted: size, position, maximized, sidebar width, artifact panel width, last Group, last Project.
- [ ] **4.8** Startup order boot→restore local store→restore session→render cached shell→connect realtime→sync→update UI; remote sync never blocks visible frames.
- [ ] **4.9** Session expiration screen "Your session expired. / Local work is safe." + `Sign in again`; queued local work not discarded.
- [ ] **4.10** Crash recovery restores drafts, pending sync operations, selected Group/Project, shows unresolved conflicts.
- [ ] **4.11** Recommended-update prompt: non-blocking, dismissible `[Update now]/[Later]`, at most once per session, checked on every connection attempt (not just cold start).
- [ ] **4.12** Required update (`CLIENT_UPDATE_REQUIRED`): full-screen blocking "ClanMind needs an update to continue… Local drafts and cached data are safe" + `[Update now]`; stops realtime retry loop but preserves offline-equivalent read access to local state.
- [ ] **4.13** Client never guesses protocol compatibility from version numbers alone; server connect response/error is authoritative.

### Deep links & updates (§193, §309)
- [ ] **4.14** Deep-link routes resolve: `/group/:groupId`, `/group/:groupId/project/:projectId`, `/message/:messageId`, `/artifact/:artifactId`, `/task/:taskId`, `/decision/:decisionId`, `/meeting/:meetingId`.
- [ ] **4.15** Update flow downloads securely, notifies, avoids interrupting active meetings, restarts cleanly preserving local state.

---

## 5. Team, presence, roles

- [ ] **5.1** Team page lists avatar/name/role/status/current project where useful; per-member actions: Private chat, Mention, Profile, Nickname-for-me.
- [ ] **5.2** Presence is subtle: Online/Away/Offline; optional "N teammates here"; colored status dots not overused (§19, §18).
- [ ] **5.3** Role badges compact and neutral; disabled admin controls NOT shown to members without clear reason (§20).
- [ ] **5.4** "N teammates here" clickable → small list; viewing history never persisted; artifact presence from realtime presence, never inferred from stale data (§38, §109).
- [ ] **5.5** User profile separates global (name/email/avatar) from Group-scoped (nicknames, role, presentation) (§272).
- [ ] **5.6** AI profile shows name / "AI teammate" / skills / current configuration where allowed; no fake-human labeling of AI social tone (§262–263, §273).

---

## 6. Main chat

### Message anatomy & grouping (§23–24)
- [ ] **6.1** Message renders avatar/author/timestamp/body/attachments/reactions/thread indicator/action row; secondary metadata only when useful.
- [ ] **6.2** Consecutive same-author messages group under one avatar/name; author identity never hidden for long periods.

### Actions & permission gating (§25)
- [ ] **6.3** Primary action row Reply/React/Copy/More; More menu: Edit, Delete, Pin, Quote, Create task, Save decision, Use as context, Mark unread — each rendered ONLY if backend role permits.
- [ ] **6.4** Message actions reachable by keyboard focus; important controls never hover-only (§325.8).

### Copy behaviors (§26–27, §240)
- [ ] **6.5** Copy message: icon in action row → copies → icon becomes check → tooltip "Copied" → resets ~1.5–2s; NO large toast; accessible label "Copy message"; works with selection; preserves Markdown/code; doesn't steal composer focus; announces success accessibly.
- [ ] **6.6** Code block toolbar shows language + Copy; copy preserves code exactly; post-click "✓ Copied"; optional Copy Markdown.

### Reactions (§28–29, §243)
- [ ] **6.7** Quick reactions 👍❤️😂🔥 on hover + full picker via "+"; clicking an existing reaction toggles current user's reaction.
- [ ] **6.8** Optimistic reaction: instant local visual → server confirm → rollback if rejected.

### Threads (§30)
- [ ] **6.9** Reply opens thread in right work surface with original message/replies/reactions/attachments/composer; Escape closes and restores focus.

### Edit / delete / pin (§31–33)
- [ ] **6.10** Inline edit with Save/Cancel; Enter=save, Shift+Enter=newline, Esc=cancel; subtle `edited` marker.
- [ ] **6.11** Soft delete renders "This message was deleted."; no leftover empty vertical space.
- [ ] **6.12** Pinned messages show pin indicator and surface in a pinned-items view.

### Mentions (§34–36, §60, §234)
- [ ] **6.13** Typing `@` opens picker popover: avatar, display name, optional role, Odin as distinct entry; ↑↓ Enter Esc keys; current Group members only; empty state "No teammate found."
- [ ] **6.14** Mentions render as stable ID-backed clickable tokens — visually subtle, accessible, not plain text.
- [ ] **6.15** Mention effects: subtle highlight, Activity unread item, OS notification per preference, never full-screen interruption.
- [ ] **6.16** Picker tracks caret, stays in viewport, avoids covering composer, repositions on resize.

### Typing & unread flow (§37, §39–41)
- [ ] **6.17** Typing indicators: one/two/three+ variants ("Arun is typing…" / "Arun and Priya are typing…" / "Several teammates are typing…"); ephemeral.
- [ ] **6.18** Unread divider `──────── New messages ────────`; read-marking happens only when appropriate.
- [ ] **6.19** "↓ N new messages" pill while reading older content; click jumps to latest new item.
- [ ] **6.20** Auto-scroll follows only near bottom; upward scroll stops following while content accumulates; Jump-to-latest appears; auto-follow resumes at bottom. Mandatory.
- [ ] **6.21** Notification/deep-link to a message loads it, scrolls to it, highlights briefly; search-result highlight subtle and readable (§246–247).

### Virtualization (§202, §289)
- [ ] **6.22** Long histories virtualized: stable keys, cursor-loading older pages, preserved scroll anchors, no scroll-jump, thread navigation support.

---

## 7. Composer

### Core & keyboard (§42–46)
- [ ] **7.1** Composer structure: writing surface + attachment + `/` command + `@` mention + Send; professional writing-surface feel, not cramped (§42, §325.18).
- [ ] **7.2** Auto-grow: initial ~1–2 lines; grows then caps ~220–280px with internal scroll; min-height ~44–52px; never consumes conversation.
- [ ] **7.3** Keyboard: Enter=send, Shift+Enter=newline; optional preference swaps to Enter=newline + Ctrl/Cmd+Enter=send; native undo/redo preserved.
- [ ] **7.4** Send button subdued+disabled when empty; enabled with clear hover/focus/pressed states; during send prevents duplicate submission with brief sending state; dedupe applies only to the individual pending op — composer never locks wholesale during backend/AI delays (§45, §242).
- [ ] **7.5** Focus remains in composer after send; failed send retains draft text + Retry (§46).
- [ ] **7.6** Send pipeline: create `client_message_id` → optimistic insert → queue operation → send over API/realtime → reconcile server ID/sequence → mark delivered (§241).

### Attachments (§47–53)
- [ ] **7.7** Attachment button tooltip "Attach files"; opens native picker with multi-select; drag/drop AND paste supported as alternate paths (never drag-only).
- [ ] **7.8** Attachment chips: icon/filename/size/remove; upload states selected/uploading/uploaded/failed/cancelled all rendered distinctly.
- [ ] **7.9** Image attachments show small thumbnail + filename; no huge attachment cards inside the composer.
- [ ] **7.10** Upload progress `filename · N%` with Cancel; on completion "Uploaded"; if indexing "Uploaded · Preparing for Odin…".
- [ ] **7.11** Upload failure "Couldn't upload this file." + Retry/Remove; files never silently dropped.
- [ ] **7.12** Drag-over overlay "Drop files to attach" on composer; paste behavior routes text→text, image→attachment, copied file→attachment where platform permits, URL→text; pasted content never auto-sends.

### Slash commands & privacy modes (§54–59)
- [ ] **7.13** `/` at composer start opens command picker: Ask Odin / Private / Meeting / Research / Memory / Project — each with icon, short description, keyboard filtering.
- [ ] **7.14** `/private` opens recipient chooser (teammates + Odin); composer header becomes unmistakable `🔒 Private with X`; privacy state visible for the whole composition.
- [ ] **7.15** Private human chat = same message system, separately scoped view, participants-only, never visually resembling public chat.
- [ ] **7.16** Private AI chat visible only to requester + Odin; private AI messages never leak into public memory/activity surfaces.
- [ ] **7.17** Composer privacy protection: scope shown, recipient stays visible, stale-selection cannot cause accidental public send.
- [ ] **7.18** Reply mode shows "Replying to X" + quoted preview + × dismiss; focus returns to composer.
- [ ] **7.19** Drafts persist locally per Group + project context + private scope; drafts never public until sent (§190).

---

## 8. Search & command palette

- [ ] **8.1** `Ctrl/Cmd+K` opens the search/command palette with sections Messages / Files / Artifacts / Tasks / Decisions / People / Projects / Commands (§61).
- [ ] **8.2** Commands prioritize contextually relevant actions for the current view (Linear-style grouping, not an unordered dump) (§62).
- [ ] **8.3** Keyboard shortcuts: `Ctrl/Cmd+K` search, `Ctrl/Cmd+/` shortcut help, `Ctrl/Cmd+Shift+P` project switcher, Enter send, Shift+Enter newline, Esc closes overlays; extras only when clearly useful (§63).
- [ ] **8.4** Search results show type/title-snippet/author/date/Project; modes match §175 list.
- [ ] **8.5** Search privacy: private results appear only to authorized participants (§176).
- [ ] **8.6** Opening a result switches Group → Project if needed → loads target → scrolls → highlights briefly (§177, §247).
- [ ] **8.7** Search debounces 200–250ms, cancels stale requests, old responses never overwrite current results (§178, §205).
- [ ] **8.8** Search scope respects view: current Project → project search; Group view → Group scope; global per product policy (§304).
- [ ] **8.9** Empty states: "No matches. / Try a shorter phrase or another filter." (§233); command palette "No commands found." (§235).

---

## 9. UI patterns: toasts, dialogs, empty/loading/error

- [ ] **9.1** Toasts used for copy/save/invite sent/reversible deletion/background job completion only — never destructive confirmation, long instructions, or ongoing AI activity (§65).
- [ ] **9.2** Dialogs reserved for ownership transfer, deletion, GitHub approval, BYOK setup, permission changes (§66).
- [ ] **9.3** Every empty state answers: what is empty / why it matters / what to do next (e.g., "No artifacts yet. Ask Odin to create your first architecture or plan.") (§179).
- [ ] **9.4** Loading strategy: skeletons for content, progress bars for measurable work, status indicators for AI, spinners for short actions only — no universal full-screen spinner (§180, §325.15).
- [ ] **9.5** Error states always give: what happened / whether work is safe / recovery action ("Couldn't load this Project. Your local work is safe. [Retry]") (§181).
- [ ] **9.6** Error copy format `what happened → what is safe → next action` (§225); success copy short ("Copied.", "Saved.", "Connected.", "Invite sent.") (§226).
- [ ] **9.7** Confirmation policy: confirm destructive/external-impact/security-sensitive/ownership changes; never confirm copy/reactions/opening panels (§227).
- [ ] **9.8** Feature-level error boundaries exist for Chat/Garage/Artifact/GitHub/Settings; a broken artifact renderer must not break chat; global catastrophic screen "ClanMind encountered an unexpected problem. Local drafts are preserved." + Restart/Copy diagnostics (§199, §286).
- [ ] **9.9** Diagnostics copy excludes API keys, raw private conversations, secrets (§287).
- [ ] **9.10** Unsupported artifact shows "This artifact was created by a newer ClanMind version. Update to view it." without crashing (§200); unrenderable artifact offers View raw/export/update while app continues working (§291).

---

## 10. Auth & onboarding

- [ ] **10.1** Login screen fields ClanMind/Email/Password/Sign in/Forgot password?; Signup: Name/Email/Password/Confirm password/Create account; first launch extremely clean (§67).
- [ ] **10.2** Password recovery uses managed flow and never reveals whether an email exists (§68).
- [ ] **10.3** First-launch hero "A shared project room for people + AI." + Create a group / Join a group; minimal motion (logo, spectral line, soft fade) (§69).
- [ ] **10.4** Create-Group onboarding is short (~7 steps): name → optional description → invite teammates → meet Odin → optional AI setup → optional first Project → enter; everything nonessential skippable (§70).
- [ ] **10.5** Invite screen: email inputs + Send invites, Copy invite link, Skip for now; invitations restricted to Owner/Admin (§72).
- [ ] **10.6** AI introduction "Meet Odin." with Change name/Change avatar affordances (§73).
- [ ] **10.7** Onboarding demonstrates the value chain as a small animated story: human message → @Odin → web research → source cards → project impact → live artifact → decision → task → GitHub approval (§74); animation sequence follows §75's 10 steps then settles; demo copy direct (§76).
- [ ] **10.8** Project creation fields: name*, Goal, Description, Project type (Software/IoT/Startup/Research/College/School/Personal/Other); optional reference files, GitHub repo, custom instructions (§77).
- [ ] **10.9** Group empty state: "Your team is ready." + Create Project / Invite teammates / Ask Odin (§78).
- [ ] **10.10** Project empty state shows name/goal/"Nothing is built yet." with suggestions Discuss the problem / Ask Odin to research / Add references / Create a plan / Connect GitHub (§79).
- [ ] **10.11** No forced long configuration before first conversation; no twenty-step onboarding (§325.12–13).

---

## 11. Context model: group chat vs project

- [ ] **11.1** Group main chat header shows: Group Chat title, Project context chip, Search, Meeting, Presence (§80).
- [ ] **11.2** Context chip states: `Group chat` when none selected; `Project: <name>` when scoped; composer carries same chip (§267).
- [ ] **11.3** Project filtering happens client-side over one unified message model — no duplicate backend chat system invented (§81, §328.5, §328.33).
- [ ] **11.4** Project navigation tabs: Overview / Conversation / Artifacts / Tasks / Decisions / Context / GitHub — shallow, not a deep hierarchy (§82).
- [ ] **11.5** Project Overview shows: Goal, Project Pulse, Current focus, Open decisions, Active tasks, Recent artifacts, Recent activity, GitHub status — concise operating view, not dashboard sprawl (§83, §325.20).
- [ ] **11.6** Project Pulse renders Goal progress %, Current focus, Blocked, Next, Odin attention note (per §84 example).
- [ ] **11.7** Switching into a Project scopes default AI context and task/decision/artifact creation to that Project (§265, §269–271).
- [ ] **11.8** Group-level chat supports cross-project planning/announcements/broad discussion distinct from project scoping (§266).
- [ ] **11.9** Project switch preserves drafts/local state, changes AI scope, refreshes project-specific side surfaces; Project A context never visually leaks into Project B (§192, §268, §306).

---

## 12. Garage & file viewing

- [ ] **12.1** Garage sections: All / Artifacts / Files / Research / Pinned / Recent; feels like a project library (§87).
- [ ] **12.2** Garage cards show preview/title/type/creator/updated/version/pin; hover/actions Open/Pin/More (§88).
- [ ] **12.3** List view columns Name/Type/Updated/Creator/Version supported for technical files (§89).
- [ ] **12.4** Grid view preferred for visual artifacts; user's preferred view remembered locally (§90).
- [ ] **12.5** Pinned items sort first with visible pin state in card/list (§257).
- [ ] **12.6** File viewer header: filename/type/sharing size info; actions Use as context / Send to chat / Download-Open locally / More (§91).
- [ ] **12.7** PDF viewer supports page navigation, zoom, search, fit width, page-linked AI references (§92).
- [ ] **12.8** Image viewer supports fit/zoom/pan/copy/open locally (§93).
- [ ] **12.9** Large documents lazy-load pages/thumbnails/visible-region rendering; no full-file decode in memory (§206).
- [ ] **12.10** File cards render BOTH sync state (nine-value enum) AND index state (indexing/ready/failed/stale/deleted) as orthogonal indicators; STALE shown distinctly from INDEXING; plain-language tooltips per state (§189, §212, §50).

---

## 13. Artifacts / right work surface

### Panel behavior (§94–96, §248–253)
- [ ] **13.1** Substantial artifact creation expands the right panel, preserves chat scroll, animates panel width; closing restores chat width and focus returns appropriately.
- [ ] **13.2** Artifact header: name, `Type · v4`, Pin, Version, More; optional "3 teammates here".
- [ ] **13.3** Panel open/close animates width with subtle content fade/slide; chat never violently reflows (§248).
- [ ] **13.4** Divider resize stores preference locally; width bounded to stay useful without making chat unusable (§249).
- [ ] **13.5** Thread + artifact share ONE primary right surface via tabs/stacking — no overlapping panel pile-up (§250).
- [ ] **13.6** Most recent artifact becomes active; older ones remain reachable in tabs/recent/Garage (§251).
- [ ] **13.7** Auto-open only when user explicitly requested substantial output or backend flags a primary artifact; never for trivial responses (§252).
- [ ] **13.8** Artifact never steals keyboard focus while user types; may take focus after explicit request-from-chat submission (§253).

### Live creation & diagrams (§97–100)
- [ ] **13.9** Backend artifact events render progressively: nodes/cards/sections appear incrementally, creation status visible, only changed items animate, artifact streams into shared surface.
- [ ] **13.10** Diagram build: node arrival fade+scale+settle; edge draws ONCE along its path then stops; spectral gradient static after completion (§98–99).
- [ ] **13.11** Completion: status Ready, toolbar activates, single subtle glow, no confetti (§100).

### Types, versions, compare (§101–103)
- [ ] **13.12** Supported artifact types: Document, Markdown, Diagram, Flowchart, Architecture, Graph, Chart, Timeline, Mind map, Table, Research, Image, Interactive, Code, HTML, Git diff.
- [ ] **13.13** Version selector lists versions descending; each shows creator/timestamp/source AI run; actions View/Compare/Restore.
- [ ] **13.14** Compare renders per type: documents=diff, diagrams=structural/visual diff, tables=changed rows/values, tasks=changed cards; raw JSON not exposed by default.

### Fullscreen, zoom, selection, comments (§104–108)
- [ ] **13.15** Complex diagrams expand fullscreen; Esc exits.
- [ ] **13.16** Zoom controls +/−/Fit/Reset with keyboard equivalents.
- [ ] **13.17** Selected node gets strong outline + details panel + "Ask Odin about this" action attaching selected object ID/context to the AI request.
- [ ] **13.18** Comments: comment/reply/resolve where supported, linked to artifact version/region.

### Presence & context actions (§109–111)
- [ ] **13.19** Artifact presence "N viewers"/"X is editing" from realtime presence only.
- [ ] **13.20** Context menu: Use as Project Context / Send to Chat / Create Task / Create Decision / Pin / Export.
- [ ] **13.21** Permission-aware artifact UI: Creator edits own; Admin/Owner edit/delete/restore; Member view/comment per backend permissions; Guest viewing only; unavailable actions hidden; backend remains authority.

### Export/share/trash/snapshots (§254–259)
- [ ] **13.22** Export offers only supported formats per type (Markdown/SVG/PNG/PDF/JSON/source).
- [ ] **13.23** Share defaults to Group/Project scope; never accidentally public-web.
- [ ] **13.24** Delete = soft delete with undo, admin recovery, later permanent deletion (trash model).
- [ ] **13.25** Project snapshot cards show label/timestamp/counts (Decisions/Tasks/Artifacts)/Git ref + View snapshot; Snapshot vs Current compare highlights decisions/tasks/artifacts/summary/Git reference.
- [ ] **13.26** Large artifacts use type-appropriate renderers (DOM docs / SVG-canvas diagrams / code editor / sandboxed interactive) with incremental updates, changed-nodes-only rendering, throttled layout, transform-based animation (§204, §290).

---

## 14. Project context page & AI context

- [ ] **14.1** Context page contains Goal / Instructions / References / Files / Artifacts / Decisions / Memory summary / GitHub / Skills; visually distinguishes shared context vs local-only files vs AI-eligible context (§112).
- [ ] **14.2** "Use as Project Context" confirms with copy "Odin may reference this item when working on this Project." and persists through backend (§113).
- [ ] **14.3** Contexted items show `✓ Used by Odin` with tooltip "Available to Odin as approved Project context." (§114).
- [ ] **14.4** AI Context Inspector can show human-readable provenance ("Odin used: Architecture v3, Decision #14, requirements.pdf, 6 recent messages, Web research"); NEVER secret system instructions or hidden chain-of-thought (§115, §260–261).

---

## 15. Memory UI

- [ ] **15.1** Memory UI sections: Group Memory / Project Memory / Your Private Memory (§116).
- [ ] **15.2** Memory card types Decision/Constraint/Convention/Preference/Finding/Lesson each showing source/created/updated/scope.
- [ ] **15.3** Uncertain memory candidate surfaces "Odin noticed a possible project memory … [Save][Dismiss]" (§117).
- [ ] **15.4** Explicit memory ("Remember this") offers scope picker Project/Group/Private, defaulting to Project inside a Project (§118).
- [ ] **15.5** Private memory items never surface in group/project memory views or shared UI (structural isolation check).

---

## 16. Tasks & decisions

- [ ] **16.1** Task card fields: title/owner/status/priority/due/related decision; interactions compact (§119).
- [ ] **16.2** Decision card fields: decision number/title/status (e.g., Approved)/reason/sources/approved-by (§120).
- [ ] **16.3** Message More → Create task opens prefilled form Title/Description/Assignee/Priority/Due/Project keeping source-message link (§121).
- [ ] **16.4** Message More → Save decision prefills Title/Context/Options/Source with status defaulting `Proposed` (§122).
- [ ] **16.5** Creation scoped to current Project by default unless request targets another (§269–271).

---

## 17. Meeting Mode

- [ ] **17.1** Meeting Mode is a first-class UI mode with header: `● Meeting`, elapsed timer (e.g., 00:42:13), Pause, End (§123).
- [ ] **17.2** Meeting panel sections: Live notes / Potential decisions / Action items / Open questions / Odin suggestions; candidate actions Accept/Edit/Dismiss (§124).
- [ ] **17.3** Candidate type → section mapping enforced: DECISION→Potential decisions; TASK→Action items; OPEN_QUESTION→Open questions; CONTRADICTION→distinct inline treatment (not folded into questions); RESEARCH_NEED→Odin suggestions with `/research` shortcut prefilled with topic; MILESTONE_CHANGE→Project-Pulse-style inline note (§124A.1).
- [ ] **17.4** Candidate status → card state: PENDING=active card with Accept/Edit/Dismiss; ACCEPTED=collapses to compact confirmed row linking `promoted_to_type/id` (navigates to the real object); REJECTED=moved to recoverable "Dismissed" sub-list within session; MERGED=hidden with subtle merge note; EXPIRED=silent only post-review-skip (§124A.2).
- [ ] **17.5** Accepting a DECISION/TASK runs the same creation flow as §121/§122 and WAITS for backend promotion confirmation before showing ACCEPTED — no optimistic collapse (§124A.2).
- [ ] **17.6** At meeting end, PENDING candidates flow into the end-of-meeting summary review; only explicit skip transitions them to EXPIRED — nothing lost without a human decision (§124A.3, §127).
- [ ] **17.7** Odin facilitation can identify decisions/tasks/contradictions/suggest research/ask clarifying questions without continuous interruption (§125, §263 cooldown/confidence gating).
- [ ] **17.8** Start dialog: "Start Meeting Mode? / Odin will actively facilitate…" + Start meeting/Cancel (§126).
- [ ] **17.9** End summary shows counts (Decisions/Tasks/Questions/Research) then Review & Save (§127–128); saved summary optionally becomes a Garage artifact.
- [ ] **17.10** Meeting state matrix covered: not started/starting/active/paused/ending/summary ready/saved (§213).

---

## 18. AI surface

### Identity & status (§129–132)
- [ ] **18.1** Configured Group AI name + avatar used everywhere; admin rename reflected globally.
- [ ] **18.2** Status vocabulary exactly: Available / Working / Researching / Building / Waiting for approval / Limited / Offline — never "thinking" as hidden-reasoning implication.
- [ ] **18.3** Working indicator before text uses high-level activity states ("🌐 Searching current sources…", "📄 Reading project references…", "✦ Building architecture…") — not private reasoning.

### Message anatomy & tool timeline (§131, §133)
- [ ] **18.4** AI message: avatar/name/subtle accent/content/source+tool metadata/actions; no huge colored AI chat bubbles (§325.2).
- [ ] **18.5** Long-job tool timeline ("✓ 6 sources found / ✓ 3 relevant / • Synthesizing…") collapses automatically after completion; each tool card reflects `ai_tool_calls.status` incl. distinct FAILED state that doesn't necessarily fail the run, DENIED "Not approved" state, EXECUTING spinner, SUCCEEDED collapsed summary (§134A.1).
- [ ] **18.6** WAITING_TOOL recurs correctly within one run; active tool surfaced by name/timestamp via `ai_tool_calls`, never generic "thinking"; an APPROVED-gated HIGH/CRITICAL tool renders as an ApprovalCard mid-stream (§134A, §164A).

### Streaming lifecycle & canonical mapping (§134–137, §210)
- [ ] **18.7** On start an AI message shell appears immediately; incremental Markdown during stream; completion renders final message + sources + artifacts/actions + metadata.
- [ ] **18.8** Backend enum mapping exact: QUEUED→"Odin is starting…", RUNNING→"Odin is working…", WAITING_TOOL→tool activity visible, STREAMING→incremental Markdown, COMPLETED→final message, FAILED→AI Error card, CANCELLED→"Stopped" preserving partial content; no invented intermediate UI-only states diverging from backend truth.
- [ ] **18.9** Streaming rendering batches deltas at render-friendly cadence; ONLY the active AI message changes continuously — other messages/left nav/project state/full artifact tree do NOT rerender per delta (§135, §203).
- [ ] **18.10** Auto-scroll during streaming follows §41/§136 near-bottom rule with Jump-to-latest.
- [ ] **18.11** Stop control while active; after cancel partial state preserved if backend sent it, marked cancelled, retry offered; retry creates a NEW run without overwriting old response; regenerate preserves previous response and versions artifacts rather than overwriting (§137–139).

### Errors, quota, fallback (§140–142)
- [ ] **18.12** AI error card copy pattern ("Odin couldn't complete this response." + reason) with Retry / Try fallback buttons.
- [ ] **18.13** Quota handling branches on exact contract `APPLICATION_AI_QUOTA_EXHAUSTED` + `can_continue_with_byok`: true → subtle continuation via BYOK (`Odin · BYOK` indicator, non-blocking, near-invisible to non-admins); false → "Application AI quota reached. An administrator can configure BYOK to continue." with `Open AI settings` button for ADMINS ONLY (members see message without action); generic "AI unavailable" never used for this code (§141).
- [ ] **18.14** Ordinary fallback shows subtle `Odin · fallback model` indicator — no alarming notification (§142).

### Research surface (§143–148)
- [ ] **18.15** Web research indicator "Web research · N sources" when used; "No web" never shown when unused.
- [ ] **18.16** Sources rendered as inline citations + source drawer + source cards (title/domain/retrieved/Open ↗); citation popover on hover/focus shows title/domain/retrieved date/open link.
- [ ] **18.17** Research drawer contains Summary/Findings/Sources/Project impact/Uncertainty while the original response remains in chat.
- [ ] **18.18** Project Impact section present for research affecting the project (signature experience).
- [ ] **18.19** Deep research progress stages: Planning research → Searching → Reviewing sources → Cross-checking → Synthesizing → Validating citations (gated by `deep_research` flag).

### Proactivity & skills (§149–155, §263–264)
- [ ] **18.20** Proactive AI messages only high-confidence/high-value with Review button; normal-mode proactivity lower than meeting-mode; admin proactivity setting Off/Low/Balanced/High default Balanced.
- [ ] **18.21** Skill invocation: explicit `/research`; automatic skill choice where policy allows surfaces "Skill used: Deep Research"; implementation terminology kept out of ordinary text.
- [ ] **18.22** Built-in skills listed (Web Research, Deep Research, Brainstorming, Planning, Decision Analysis, Task Decomposition, Diagram, Document, Data Visualization, Meeting Facilitation, GitHub Analysis); custom skill cards show Name/Description/Scope/Enabled/Required tools/Risk.
- [ ] **18.23** High-access skills labeled `High access` with consequence explanation.

---

## 19. AI settings & BYOK

- [ ] **19.1** BYOK admin flow: Provider / API key / Test connection / Models / Primary / Fallback 1–3; saved key NEVER revealed (§156, §232).
- [ ] **19.2** Provider test states: Testing… → Connected · N models found; failure "Couldn't authenticate. Check the provider key." (§157).
- [ ] **19.3** Search provider test states: Connecting → Searching → Results received → Ready (§158).
- [ ] **19.4** AI Settings sections: Identity / Provider / Models / Fallbacks / Research / Skills / Permissions / Proactivity (§167); personality presets Balanced/Direct/Creative/Analytical/Custom + custom instructions textarea (§168).
- [ ] **19.5** AI permission toggles: Read shared files / Create artifacts / Edit project objects / Use web / Read GitHub / Modify GitHub / Create PR / Merge PR (§169).
- [ ] **19.6** Application-AI vs BYOK configuration kept out of ordinary member UI — admin-only surfaces (§328.10).

---

## 20. GitHub integration & approvals

### Panel & status (§159–160, §165)
- [ ] **20.1** Project GitHub panel shows Connected state, owner/repo, branch, last synced, pending actions, pull requests.
- [ ] **20.2** Public repo URL grants read-only UI expectations; never implies write access; write requires explicit `Connect GitHub`.
- [ ] **20.3** GitHub status states rendered: Not connected / Connecting / Read only / Read-write / Needs reauthorization / Disconnected.

### Action cards & diff viewer (§161–162, §299)
- [ ] **20.4** GitHub action card pattern "Odin wants to change GitHub": branch, file list (+/~), Risk level, Review changes.
- [ ] **20.5** Diff viewer supports file tree/diff/additions-deletions/syntax highlighting/hunk collapse/copy/PR preview.
- [ ] **20.6** Pre-approval preview shows exact files, base branch, target branch, additions/deletions, high-level risk (§299).
- [ ] **20.7** Approval dialog enumerates consequences ("Create branch / Modify N files / Create commit / Open PR") with Approve/Reject; merge confirmation warns "This changes the connected repository." with Cancel/Merge (§163–164).

### Generalized ApprovalCard (§164A, §300–301)
- [ ] **20.8** ONE reusable ApprovalCard component driven by the generic `ai_actions` shape; `GitHubActionCard` is a specialization, not a parallel implementation.
- [ ] **20.9** Every card displays action_kind (human label), risk_level (READ_ONLY/LOW/MEDIUM/HIGH/CRITICAL), payload summary per kind (diff/list/etc.), requested_by, created_at/expires_at, Reject+Approve.
- [ ] **20.10** Approve submits the exact displayed `payload_hash` + `payload_version` — never a boolean; on mismatch the client re-fetches before another attempt; approve button never cached as always-valid beyond the on-screen snapshot.
- [ ] **20.11** Status→UI mapping: PROPOSED preparing / WAITING_APPROVAL active card / APPROVED brief "starting…" / EXECUTING progress without Approve-Reject (optional cancel) / SUCCEEDED collapsed with result link / FAILED error with retry-eligibility / REJECTED collapsed "Rejected by {name}" / EXPIRED invalid-state flow.
- [ ] **20.12** Expiry/re-approval: never silently retry old hash; replace card with "This action changed since you last saw it…" + single `Review latest` action that re-fetches and renders fresh card.
- [ ] **20.13** Non-GitHub approvals (bulk artifact delete, bulk task reassignment, memory purge) reuse the same shell with kind-specific payload summaries; approval cards visually stronger than prose but not scary-red unless destructive (§300).
- [ ] **20.14** Approval requests surface as notifications (`AI_ACTION_APPROVAL`) and in Activity.

---

## 21. Feature flags (server-controlled)

- [ ] **21.1** Flags fetched at session start AND reconnect into server-cache state (not local preference): meeting_mode / proactive_ai / github_write / github_merge / custom_skills / deep_research / offline_sync_v2 / interactive_artifacts (§165A.1).
- [ ] **21.2** Disabled-flag behaviors exact: meeting_mode hides entry points entirely (not shown-disabled); proactive_ai hides Proactivity setting and Odin never initiates; github_write keeps read panel but suppresses all write affordances; github_merge removes only Merge button; custom_skills hides "Add custom skill" while built-ins remain; deep_research disables deep-mode option + progress UI while ordinary web search unaffected; offline_sync_v2 falls back to baseline sync behavior; interactive_artifacts not offered as type and existing ones fall back to Unsupported Artifact state (§165A.2).
- [ ] **21.3** Flags are per-Group; re-fetched and re-applied on every Group switch alongside other Group-scoped state (§165A.3).

---

## 22. Settings architecture

- [ ] **22.1** Two-column settings: General/Members/AI/Skills/Research/GitHub/Notifications/Usage/Security/Danger Zone with main content right (§166).
- [ ] **22.2** Members settings: Admin invite/role changes/remove/ownership transfer; Member personal profile/notification settings/local nicknames (§170).
- [ ] **22.3** Danger Zone visually and structurally separated; Delete Group explains recovery window and permanent deletion (§228, §282).
- [ ] **22.4** Ownership transfer dialog states new owner and "You will become Admin." with Cancel/Transfer (§229).
- [ ] **22.5** Member removal dialog warns immediate access loss, contributions remain with Group (§230).
- [ ] **22.6** Group avatar upload or generated initials; limited visual accent preserving design discipline (§274, §281).
- [ ] **22.7** Settings dirty indicator only when meaningful pending changes exist; section-level save for AI config/GitHub/permissions; auto-save only where safe (§279–280).
- [ ] **22.8** Permission-denied copy human ("Only Owners and Admins can change Group AI settings."), no internal policy codes (§302).
- [ ] **22.9** Guest UX shows clean restricted navigation, not a sea of disabled controls (§303).

---

## 23. Notifications & Activity

- [ ] **23.1** Notification categories use EXACT backend identifiers: MENTION/Private/AI (AI_RESPONSE)/Approvals (AI_ACTION_APPROVAL)/Tasks (TASK_ASSIGNMENT)/Decisions (DECISION_APPROVAL)/Artifacts (ARTIFACT_READY)/GitHub (GITHUB_EVENT)/Meeting (MEETING_SUMMARY)/Odin suggestions (PROACTIVE_AI, distinct from AI_RESPONSE)/System — used when reading/writing preferences, no paraphrase drift (§171).
- [ ] **23.2** Channels: In-app / Desktop / Email; desktop toggle is client-derived from in_app + OS permission, not a backend column (§171).
- [ ] **23.3** Per-category channel enablement independent — no global all-channels requirement (§276).
- [ ] **23.4** Delivery state (`PENDING / DELIVERED_REALTIME / DELIVERED_EMAIL / SUPPRESSED_BY_PREFERENCE / FAILED`) exposed verbatim in Sync Diagnostics/admin debugging, never re-derived client-side (§171A).
- [ ] **23.5** Activity view aggregates mentions/replies/reactions/approvals/task assignments/key AI events; presence spam excluded (§172).
- [ ] **23.6** Away-time notification batching ("12 new messages. Arun, Priya and Odin mentioned you.") (§173).
- [ ] **23.7** OS notifications limited to mention/private message/approval request/task assignment/critical security items — not every chat message by default (§174).
- [ ] **23.8** Native permission requested only when reason is clear (§194); user can hide message content in OS previews (§278).
- [ ] **23.9** Unread badge subtle + Activity count; marked read only when actually viewed if appropriate (§277).

---

## 24. Offline, sync & local

### Offline behavior (§182–184)
- [ ] **24.1** Offline-available set honored: cached Projects/conversation/artifacts/files/local Git/drafts + queuable edits; cloud AI/web research/GitHub network ops clearly unavailable with explanatory states ("Odin isn't available offline…" §239; "GitHub requires an internet connection…" §238) without making app look broken.
- [ ] **24.2** Offline composer send still works for supported messages → local pending bubble `Queued · Offline`; on reconnect reconcile and mark delivered.
- [ ] **24.3** Pending messages render normal weight + small clock/network indicator; failures show "Not sent · Retry" and never discard the text.

### Sync banner & operations (§185–186A)
- [ ] **24.4** Sync banner states: invisible when connected; `Reconnecting…`; `Offline`; `Syncing N changes…` derived from real PENDING `sync_operations` count; `✓ Synced` (§185, §186A.1).
- [ ] **24.5** Client persists per-device per-Group checkpoint (`last_server_sequence`, `last_synced_at`) and sends it on reconnect to receive events after the checkpoint (§186A.1).
- [ ] **24.6** Queued operation lifecycle mirrors backend: PENDING→APPLIED (indicator removed) / REJECTED (dismissible error, never silent drop) / CONFLICT (conflict card) (§186A.2).
- [ ] **24.7** Retries reuse the identical `client_operation_id` verbatim — never re-minted (§186A.2, §324).
- [ ] **24.8** Conflict card per type: version_mismatch → "updated by someone else while you were offline"; concurrent_edit → "you and someone else both changed this"; deleted_upstream → narrower actions ONLY [Restore mine as new][Discard mine] (§186A.3).
- [ ] **24.9** Generic conflict card for version_mismatch/concurrent_edit: Your version / Remote version / Compare / Keep mine / Use remote / Create new version; never silently overwrite (§186).
- [ ] **24.10** Resolution writes back through the same sync row (`resolution_strategy` ∈ server_wins/client_wins/merged/manual + resolved_by/at), not a parallel flow (§186A.4).

### Local folder & file tree (§187–189)
- [ ] **24.11** Local folder connect copy: "ClanMind will only access the folder you choose."; Tauri fs capabilities narrowly scoped.
- [ ] **24.12** File tree shows names/type/modified/sync status; unauthorized absolute paths not revealed unnecessarily.
- [ ] **24.13** All nine file-sync states rendered distinctly with icons+labels: LOCAL_ONLY ○ / QUEUED ⏳ / UPLOADING ↗ / SYNCED ✓ / REMOTE_CHANGED ↓ / LOCAL_CHANGED ↑ / CONFLICT ! / DELETED ⊘ / RESTORABLE ↺ (with Restore action in window) — QUEUED/REMOTE_CHANGED/LOCAL_CHANGED not collapsed into other states; plain-language tooltips (e.g., REMOTE_CHANGED "Someone updated this file. Click to get the latest version.").

### Switching & isolation (§190–192, §283–285)
- [ ] **24.14** Group switch restores last Project, drafts, correct realtime room, clears stale notification state; last-active Project stored per Group locally (§191, §305).
- [ ] **24.15** Project switch preserves draft/scroll position/artifact panel state where appropriate (§192, §306).
- [ ] **24.16** Sync Diagnostics advanced view shows Connection / Protocol version / Last sequence / Last sync / Pending operations / Conflicts (§285).

---

## 25. Security

- [ ] **25.1** URL parameters never trusted as authorization (§292).
- [ ] **25.2** AI HTML rendered only through safe renderer + sanitization of untrusted content (§296); web research source previews never execute remote scripts (§297).
- [ ] **25.3** BYOK secrets never stored client-side (§292, §325.11).
- [ ] **25.4** Interactive artifacts run isolated: no automatic Tauri fs permissions/auth tokens/Group secrets/GitHub credentials; any bridge explicit and sandboxed (§293).
- [ ] **25.5** Tauri capabilities limited to selected filesystem/notifications/required window-update permissions; no broad shell access (§294).
- [ ] **25.6** External URLs open through controlled mechanisms; no shell execution from URL content (§295).
- [ ] **25.7** Local Git safety: never silently delete files/reset working tree/overwrite changes; destructive ops require explicit intent (§298).
- [ ] **25.8** Private content structurally prevented from shared-surface leakage (scoped caches/stores keyed by scope) — verified at store level (§2.26).

---

## 26. Performance

- [ ] **26.1** Fast initial shell render; heavy viewers/editors lazy-loaded (§201).
- [ ] **26.2** AI streaming state isolated so per-delta work touches only the active response component (§203).
- [ ] **26.3** Artifact rendering incremental: changed nodes only, throttled layout, transforms over layout thrash, deferred noncritical effects (§204, §290).
- [ ] **26.4** Performance priority order respected: composer typing > scrolling > view switching > message arrival > AI streaming > artifact animation; no animation causes typing lag (§288).
- [ ] **26.5** Chat virtualization handles 10k+ messages with cursor loading and stable anchors (§202, §289, §318).

---

## 27. State matrices (per-surface coverage)

- [ ] **27.1** Every relevant component supports default/hover/focus/pressed/selected/disabled/loading/success/error/offline/permission-denied states (§207).
- [ ] **27.2** Composer states complete: empty/focused/typing/mention picker/command picker/attachments/uploading/ready/sending/offline/queued/failed/AI command/private mode/reply mode (§208).
- [ ] **27.3** Message states complete: normal/hovered/focused/pending/failed/edited/deleted/mentioned/reply target/search highlighted/selected (§209).
- [ ] **27.4** AI state matrix incl. UI overlays `fallback` + `approval pending` derived from response metadata and `ai_actions.status` respectively — never invented as backend run statuses (§210, §134A).
- [ ] **27.5** Artifact states: loading/generating/updating/ready/version switching/compare/editing/conflict/failed/deleted/restoring (§211).
- [ ] **27.6** Meeting states: not started/starting/active/paused/ending/summary ready/saved (§213).
- [ ] **27.7** GitHub states: not connected/connecting/read-only/read-write/action pending/approval required/executing/PR created/failed/disconnected (§214).
- [ ] **27.8** Buttons cover default/hover/focus/pressed/loading/disabled/temporary-success/destructive; inputs cover default/focused/filled/invalid/valid/disabled/read-only/loading (§215–216).

---

## 28. Acceptance checklists expanded (§319–324)

### UX review gate — applies to every finished surface (§319)
- [ ] **28.G1** User knows where they are.
- [ ] **28.G2** User knows what changed.
- [ ] **28.G3** User can undo/recover.
- [ ] **28.G4** User can understand why an action is unavailable.
- [ ] **28.G5** User can continue working offline.
- [ ] **28.G6** Works from keyboard.
- [ ] **28.G7** Animation helps rather than decorates.
- [ ] **28.G8** Screen remains calm.

### Main chat acceptance (§320)
- [ ] **28.C1** Group/project context visible in header + composer chip.
- [ ] **28.C2** Search works from chat context.
- [ ] **28.C3** Presence works (subtle states, teammates-here).
- [ ] **28.C4** Typing indicators work with 1/2/3+ copy variants.
- [ ] **28.C5** Message grouping works without hiding authors.
- [ ] **28.C6** Hover AND focus actions work.
- [ ] **28.C7** Copy message per §26 detail (icon→check→reset, a11y label).
- [ ] **28.C8** Reactions quick-picker + toggle + optimistic rollback.
- [ ] **28.C9** Threads open in right panel; Esc closes and restores focus.
- [ ] **28.C10** Mention picker/rendering/notification chain complete.
- [ ] **28.C11** Attachment full lifecycle (select/upload/progress/fail/retry).
- [ ] **28.C12** Composer auto-grows within height budget.
- [ ] **28.C13** Enter/Shift+Enter correct (+ optional preference swap).
- [ ] **28.C14** Send anchored bottom during composer growth/streaming.
- [ ] **28.C15** Draft persists across navigation and reload.
- [ ] **28.C16** Offline send queues as `Queued · Offline`.
- [ ] **28.C17** Streaming renders incrementally with correct lifecycle mapping.
- [ ] **28.C18** Scroll-follow intelligent (near-bottom rule + jump pill).
- [ ] **28.C19** New-message button jumps to latest new item.
- [ ] **28.C20** Errors recoverable without losing text.

### Artifact acceptance (§321)
- [ ] **28.A1** Right panel opens naturally preserving chat scroll.
- [ ] **28.A2** Chat does not jump on panel open/close.
- [ ] **28.A3** Artifact streams progressively into shared surface.
- [ ] **28.A4** Node/edge animation follows draw-once rules.
- [ ] **28.A5** Spectral accent restrained per §3.3.
- [ ] **28.A6** Completion settles (one glow, calm).
- [ ] **28.A7** Versions list/select/restore work.
- [ ] **28.A8** Compare works per artifact type.
- [ ] **28.A9** Pin consistent across card/header/Garage.
- [ ] **28.A10** Permissions gate actions (creator/admin/member/guest).
- [ ] **28.A11** Comments/selection work where supported.
- [ ] **28.A12** Export offers supported formats only.
- [ ] **28.A13** Reduced-motion path replaces construction animation with text status.

### Onboarding acceptance (§322)
- [ ] **28.O1** Create Group flow complete. **28.O2** Join Group present. **28.O3** Group identity step. **28.O4** Invite step Owner/Admin-gated. **28.O5** Odin intro. **28.O6** Optional AI customization. **28.O7** Potential demo plays and settles. **28.O8** Project creation. **28.O9** Reference upload optional. **28.O10** GitHub optional connect. **28.O11** Skip paths actually skippable. **28.O12** First chat reachable immediately.

### Settings acceptance (§323)
- [ ] **28.S1** Members **28.S2** Roles **28.S3** Ownership transfer **28.S4** AI identity **28.S5** Provider **28.S6** BYOK **28.S7** Model/fallback **28.S8** Research **28.S9** Skills **28.S10** Permissions **28.S11** GitHub **28.S12** Notifications **28.S13** Usage **28.S14** Security **28.S15** Danger zone — each functional with role-gated affordances.

### Backend contract literacy (§324)
- [ ] **28.B1** REST + WebSocket schemas typed client-side.
- [ ] **28.B2** Protocol version + `CLIENT_UPDATE_REQUIRED` handled per §309A.
- [ ] **28.B3** Server sequence tracked for reconnect deltas.
- [ ] **28.B4** `client_operation_id` reused verbatim on retry.
- [ ] **28.B5** sync_checkpoints / sync_operations / sync_conflicts shapes modeled.
- [ ] **28.B6** Exact AI run enum QUEUED/RUNNING/WAITING_TOOL/STREAMING/COMPLETED/FAILED/CANCELLED mapped.
- [ ] **28.B7** Tool call enum incl. APPROVED gating mapped.
- [ ] **28.B8** Artifact events consumed for progressive render.
- [ ] **28.B9** Generic ai_actions / ai_action_approvals lifecycle implemented — not GitHub-only.
- [ ] **28.B10** meeting_candidates lifecycle incl. promoted_to_type/id.
- [ ] **28.B11** Memory candidate states handled.
- [ ] **28.B12** Notification category set + delivery_state used verbatim.
- [ ] **28.B13** Per-Group feature flags fetched and applied.
- [ ] **28.B14** Nine-value file sync enum used.
- [ ] **28.B15** AI quota error contract incl. can_continue_with_byok branch.
- [ ] **28.B16** Notification deep links resolve to targets.
- [ ] **28.B17** Permission model drives affordances everywhere.

---

## 29. Do-not-ship UX mistakes (§325) — negative checks

- [ ] **29.1** Not a Slack clone; ClanMind identity distinct.
- [ ] **29.2** Not every AI response a large colored card.
- [ ] **29.3** Rainbow not permanent anywhere.
- [ ] **29.4** Not every message animated.
- [ ] **29.5** No chain-of-thought exposure.
- [ ] **29.6** Scroll never moves while user reads.
- [ ] **29.7** Failed messages never discarded.
- [ ] **29.8** Important controls not hover-only.
- [ ] **29.9** One broken artifact never breaks chat.
- [ ] **29.10** Frontend permissions never trusted as security.
- [ ] **29.11** BYOK secrets never stored locally.
- [ ] **29.12** No mandatory pre-chat configuration wall.
- [ ] **29.13** No twenty-step onboarding.
- [ ] **29.14** Meeting Mode not a separate application.
- [ ] **29.15** No universal spinner for all async work.
- [ ] **29.16** No drag-only interactions.
- [ ] **29.17** Contrast never sacrificed for aesthetics.
- [ ] **29.18** Composer never cramped.
- [ ] **29.19** Right panel not permanent without meaningful content.
- [ ] **29.20** Project Pulse never a cluttered dashboard.

---

## 30. QA coverage expectations (§312–318)

- [ ] **30.1** Visual regression coverage exists (or is explicitly assessed) for: login, create Group, onboarding demo, main chat, composer, mention picker, private chat, AI streaming, research, artifact, Garage, meeting, settings, GitHub approval (§312).
- [ ] **30.2** Keyboard end-to-end flows testable: create Group, send message, mention, reply, command palette, switch Project, open artifact, approve GitHub action, close dialogs (§313).
- [ ] **30.3** Reduced-motion variants verified for onboarding/artifact creation/panel transitions/reactions/progress/streaming indicators (§314).
- [ ] **30.4** Offline flow: open cached Project → draft → send → queue → disconnect → reconnect → sync → conflict (§315).
- [ ] **30.5** AI modes exercised: Assist/Facilitate/Act; public vs private AI; fallback; web search; citations; tool status; artifact output; quota exhaustion (§316).
- [ ] **30.6** Permission matrix exercised: Owner/Admin/Member/Guest/removed user/private conversation/protected GitHub action (§317).
- [ ] **30.7** Performance scenarios defined: 10k+ history, long AI response, large artifact, many presence events, rapid reactions, concurrent uploads (§318).

---

## Audit verification protocol (how each item gets graded)

For every item above the audit will: (a) locate the implementing component/hook/store; (b) trace actual logic where stakes are high — private-content leakage into shared UI, permission-aware affordances, streaming state machine, virtualization correctness, outbox replay, token/motion compliance; (c) run `pnpm exec tsc -b && pnpm test && pnpm run build`; (d) verify build output exists, dist purity (no demo/mock leakage), no console errors on load; then grade PASS/PARTIAL/FAIL/NOT-IMPLEMENTED with file:line evidence.

**Final verdict options:** staging-ready / production-ready / not-ready + blocking list.

