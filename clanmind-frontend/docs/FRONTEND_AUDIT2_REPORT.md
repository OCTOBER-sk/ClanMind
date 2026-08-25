# ClanMind Frontend — Audit Report #2

> **Method:** Single-session sequential audit per FRONTEND_TODO.md §0–§30. Every grade backed by observed file:line evidence. High-stakes traces (private scoping 0.12, permission gating 0.11, streaming state machine, approvals payload_hash, outbox replay, WCAG tokens) traced by hand in this session. Build/test/typecheck run at the end.
> **Grades:** PASS / PARTIAL / FAIL / NOT-IMPLEMENTED.

---

## §0 Product rules that must never drift

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 0.1 | Account → Group → Projects only; "Workspace" nowhere | **PARTIAL** | Model is correct everywhere (`useGroupStore` groups/projects; routes `/group/:id/project/:id`). BUT AppShell.tsx:930 renders literal UI copy `Loading workspace…`; also internal names `bootstrapLiveWorkspace` (live/liveRuntime.ts:99) and comments (App.tsx:56). UI-copy breach is real; terminology otherwise clean. |
| 0.2 | Many Groups; switching preserves per-Group state | **PASS** | Drafts/read-markers keyed `user:group:project` (AppShell.tsx:528); last-read per scope (useChatStore.markScopeRead:177); history query key `[messages, groupId]` isolates caches (useChatMessages.ts:36–38). |
| 0.3 | Per-teammate personal nicknames | **PASS** | `setMemberNickname` (useGroupStore.ts:69), applied at render via mapMessageRow nickname resolution and Team page (`m.nickname || m.user.name`, AppShell.tsx:1537,1668). |
| 0.4 | Owner/Admin/Member/Guest; owner-only promotion; transfer dialog | **PASS** | GroupRole union drives LeftNav (LeftNav.tsx:106–109); SettingsView ownership transfer with "You will become Admin." copy verified at §22 grading below. |
| 0.5 | One shared AI identity per Group, default Odin | **PASS** | `group.ai_name` read at every AI surface (useChatController.ts:68, dispatch.ts:301, Composer aiName prop); admin rename via SettingsView AI section. |
| 0.6 | Meeting Mode first-class | **PASS** | In-app right-surface mode + top-bar entry (`isMeetingActive`, TopBar.meeting.test.tsx, MeetingActiveHeader) — no separate app/window. |
| 0.7 | Live Artifacts in right surface; versions preserved | **PASS** | artifact.created/node./edge./completed events → constructionStore (dispatch.ts:482–554); mergeArtifactVersion appends versions, never overwrites (dispatch.ts:460). |
| 0.8 | Tasks/Decisions first-class cards | **PASS** | TaskCard.tsx / DecisionCard.tsx / TasksView / DecisionsView surfaces wired into workbench nav. |
| 0.9 | GitHub approval-controlled end-to-end | **PASS** | github.action.proposed envelope requires full hash+version before a card exists (dispatch.ts:689–710); ApprovalCard submits payload_hash (see §20 trace). |
| 0.10 | Local-first offline behavior | **PASS** | Offline queue path (useChatController.ts:247–277), SyncBanner states, offline composer status (Composer.tsx:663–671); cloud-AI/GitHub unavailability messaging graded under §24. |
| 0.11 | Permission-gated affordances derive from backend data; hidden not disabled | **PASS** | Role derived from backend member row (AppShell.tsx:938–939); LeftNav hides create-project for Member/Guest and omits Settings for Guest (LeftNav.tsx:106,122); MessageActions hides edit/delete unless owner/moderator (MessageActions.tsx:64–86). |
| 0.12 | Private content structurally scoped; no cache/store leakage | **FAIL** | Two compounding holes proven by executable probe this session: (a) dispatch.ts:250 `recipientId === 'ai'` admits ANY user's PRIVATE_AI event into any device's cache (controller sends `private_to:'ai'`, useChatController.ts:296; demo hub broadcasts private rows room-wide, transportRoutes.ts:402 + wsHub.broadcast:298); (b) chatSelectors.ts:49 PRIVATE_AI case returns true for every PRIVATE_AI message without verifying the local user participates — comment claims isolation the code does not implement. Probe test (run then deleted): foreign user's private AI body cached AND rendered in current user's PRIVATE_AI view. PRIVATE_PAIR paths are correctly gated+filtered; GROUP view is safe (belt-and-braces holds there). Draft scope keys omit privacy component (AppShell.tsx:528) — secondary risk, see §7.19. |
| 0.13 | Core loop connected end-to-end | **PASS** | Conversation→AI (@odin trigger, useChatController.ts:24–42)→Research (ResearchDrawer/sources in run payload)→Decision/Task creation (AppShell decision modal, More menu)→Artifact (artifact events)→Approval (ai_actions) all reachable through real stores/routes. |

---

## §1 Design law: tokens, spectral rule, typography, motion

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 1.1 | Semantic token set as only color source | **PASS** | Full semantic set defined in index.css:65–113 (+dark 117–147); design-system/tokens/index.ts maps every name incl. `spectral`. |
| 1.2 | Spacing scale space.1…12 | **PARTIAL** | tokens/index.ts spacing map stops at 12 but skips 7/9/11 (named 1–6,8,10,12). Feature components mostly use Tailwind spacing utilities consistent with the scale; no invented ad-hoc px values found beyond icon paddings. |
| 1.3 | Radius/shadow/font/motion/focus tokens exist | **PASS** | index.css:39–61 (durations 100/150/220/350ms within §6 budgets), radius sm–2xl, shadows sm–xl; fonts.xs…display + code family (tokens/index.ts:56–66); `--focus-ring` index.css:101,146. |
| 1.4 | Base palette neutral + semantic states; grayscale readable | **PASS** | White/near-white/near-black + gray ramp + 4 semantic hues; no color-only signifier observed (badges pair text+color). |
| 1.5 | No hard-coded color literals in feature components | **PARTIAL** | Overwhelmingly token-driven, but literals remain: ProjectPulse.tsx:61–76 amber/blue Tailwind palette classes for Blocked/Next tiles (bypasses warning/info tokens); LeftNav.tsx:370,409 `#fff`; AppShell.tsx:1129 `bg-black/80 … text-white` catastrophic screen; MemoryView.tsx:149,244 gray/white classes. Cosmetic drift, not contrast failures. |
| 1.6 | Spectral ONLY for allowed moments | **PASS** | Usages found exactly in allowed categories: Odin active (AiStatusIndicator.tsx:90–111 mapping, Avatar.tsx:94), AI generation/construction, artifact edges (DiagramViewer spectral edge draw-once), progress milestone (ProjectPulse sweep, runs once 1.2s, ProjectPulse.tsx:22–29), selection/owner accent badges, onboarding moments (CreateGroupOnboarding). |
| 1.7 | Rainbow never behind body text / every card / permanent fills / default backgrounds / every loader | **PASS** | Grep of `spectral` shows no card-border or message-background or generic-loading usage; loaders are Skeleton/spinners. |
| 1.8 | Calm at rest; spectral settles | **PASS** | spectral-glow-once keyframe (index.css:236–240); ProjectPulse overlay self-removes after 1200ms; DiagramViewer draws each edge once then static. |

### Typography
| # | Item | Grade | Evidence |
|---|---|---|---|
| 1.9 | Legible UI family + code family; hierarchy; no ultra-light; OS scaling preserved | **PASS** | System stack (index.css:165–172) + mono stack (195–211); rem-based sizes throughout; no font-weight <400 on critical text observed. |
| 1.10 | Message width rhythm; wider mode for research/code | **PARTIAL** | Messages render at comfortable max width via chat column; explicit dual-width "wider content mode" toggle for research/table artifacts not found as a distinct control (research renders in right surface instead). Functional equivalent present; literal feature absent. |

### Motion system
| # | Item | Grade | Evidence |
|---|---|---|---|
| 1.11 | Vocabulary semantics correct | **PASS** | Fade/scale used for appear/dialog/reaction (reaction-pop scale .85→1, index.css:256–260); slide for panels/sheets (.sheet-panel-*); draw for diagram edges (.cm-edge-draw); morph absent (reserved). |
| 1.12 | Durations within budget | **PASS** | Tokens 100/150/220/350ms sit inside micro/small/standard/large budgets; no routine multi-second transitions found (spectral-shift 3s loop is an ambient status texture, not a transition). |
| 1.13 | Reaction = single tiny scale/fade 0.85→1, no repeat | **PASS** | reaction-pop keyframes 0.85→1.08→1 once (index.css:256–260); hover-scale on picker chips only. |
| 1.14 | Project Pulse animates once, settles | **PASS** | useEffect timers animate 10ms→1200ms on pulse_progress change only (ProjectPulse.tsx:22–29); overlay unmounts; line itself not continuously animated (minor: `animate-pulse` opacity wobble inside that same 1.2s window). |
| 1.15 | Node arrival fade+scale+settle; edge draws once, never pulses | **PASS** | node-arrive + cm-edge-draw single-run keyframes; DiagramViewer reduced-motion removes dash artifact (index.css:477–480). |
| 1.16 | Artifact completion = Ready + one subtle glow | **PASS** | completion-glow uses spectral-glow-once; constructionStore.completeConstruction flips status (dispatch.ts:541–554); no confetti anywhere. |
| 1.17 | prefers-reduced-motion honored; construction replaced by text status | **PASS** | Global reduce block kills spectral/panel/node/streaming animations and freezes spectral-text to solid AA text (index.css:439–491); MessageList/DiagramViewer/Onboarding match media in JS (e.g., MessageList.tsx:154); construction store exposes textual render-state strings ("Odin is building…" pattern) shown when animation off. |

---

## §2 Accessibility baseline

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 2.1 | WCAG 2.2 AA behaviors in primitives | **PASS** | Radix primitive layer under design-system/components (Dialog/Popover/Tooltip/Dropdown/Tabs/Toast/ScrollArea/Switch/Checkbox); `.focus-ring` token class (index.css:515–519) applied via focus-visible utilities throughout; tokens.a11y.test.ts COMPUTES real WCAG ratios from index.css for both themes and asserts ≥4.5:1 (lines 56–85) — palette drift fails CI. |
| 2.2 | Accessible primitive layer backs dialog/popover/tooltip/dropdown/tabs/toast/scroll/palette | **PASS** | All listed primitives wrap Radix packages (@radix-ui/* in package.json) except CommandPalette which wraps cmdk (also Radix-class). |
| 2.3 | Dialogs trap focus / Esc / restore / title | **PASS** | Dialog.tsx:17 comment verified against implementation — Radix Root/Portal/Content with Title + Description + Close (sr-only label), Esc/focus-trap/restore provided by the primitive. |
| 2.4 | Icon-only actions carry tooltips AND labels; short tooltips | **PASS** | Composer.tsx:588–627 (Attach files/Commands/Mention), LeftNav rail buttons, MessageActions all pair Tooltip content with aria-label; no paragraph tooltips found. |
| 2.5 | Pointer targets ≥24px floor; core 32–40px | **PASS** | IconButton sizes xs=24px floor → lg=44px (IconButton.tsx:27–30); Button min-heights 32/38/46px (Button.tsx:41–43). |
| 2.6 | New-message aggregate announcement; no focus steal/auto-scroll | **PASS** | MessageList.tsx:489–492 sr-only `{n} new messages` role=status; jump pill at 509; scroll-follow gated by near-bottom rule. |
| 2.7 | AI streaming announces started/completed/failed only | **PASS** | AiStreamAnnouncer.tsx maps RUNNING/WAITING_TOOL/STREAMING→started, COMPLETED→completed, FAILED→failed, CANCELLED→stopped; dedupe set prevents re-fire; streamed body renders with no aria-live near it. |
| 2.8 | Text ≥4.5:1 / large ≥3:1; spectral never sole signifier | **PASS** | Enforced by computed tests (tokens.a11y.test.ts) incl. semantic-on-tint pairs; reduced-motion freezes spectral text to solid --color-text (index.css:452–460). |
| 2.9 | Non-drag alternatives: panel resize keyboard path; attachment button path | **PASS** | PanelResizer.tsx:73–78 ArrowLeft/ArrowRight resize; attachments enter via native-picker button (Composer.tsx:589–597) + paste + drag. |

**§2 verdict: PASS (9/9).** Strongest area of the codebase; the WCAG contract is machine-checked, not aspirational.

---

## §3 Architecture & state separation

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 3.1 | No raw fetch/WebSocket outside transport layers | **PASS** | Only `refetch()` (TanStack Query) hits in features; raw sockets exist solely in realtime/connection.ts + mocks/wsHub.ts; api/client.ts is the typed gateway with idempotency keys, envelope-mapped ApiError, transient retry w/ jitter + RATE_LIMITED hint (client.ts:55–59,118–134). |
| 3.2 | Repository structure follows spec layout | **PASS** | features/{ai,approvals,artifacts,auth,chat,decisions,garage,github,groups,meetings,memory,notifications,onboarding,projects,settings,shell,sync,tasks,team}, design-system/{tokens,components}, realtime/, sync/, local/, api/, state/, hooks/, types/, src-tauri/capabilities/default.json all present. |
| 3.3 | Six state domains kept separate | **PASS** | UI prefs → useUiStore (panel widths persist partialized), server cache → TanStack Query, realtime normalized → dispatch→stores, drafts → chat store partialize (draftsByScope only, useChatStore.ts:206–214), sync queue → useSyncStore + outbox IndexedDB, streaming → dedicated aiStreamStore (90ms coalescing). |
| 3.4 | Cache keys namespaced by account & Group | **PASS** | Draft/read keys embed user id (`${user.id}:${group}:${project}`, AppShell.tsx:528); IndexedDB per account `cm_<userId>` (local/db.ts:27); history query keyed [messages, groupId]. Note: zustand persist bucket name itself (`cm_chat`) is global but payload keys are account-scoped — acceptable. |
| 3.5 | Account switch clears/re-keys cached scope; private drafts can't cross accounts | **PASS** | accountState.ts clearDomainStores wipes messages/drafts/visibility/recipient + all domain stores; wipeAccountDb deletes `cm_<userId>`; session-expiry deliberately bypasses wipe (local work survives). |
| 3.6 | No singleton/single-tab assumption in local sync state | **PARTIAL** | outbox.ts replayInFlight is a module-local boolean (outbox.ts:142,349); no BroadcastChannel or navigator.locks anywhere in src. A second app window would run its own replay loop against the same IndexedDB mirror — idempotent server-side thanks to client_operation_id, but double-flight replays and split banner state are possible. Spec's "multi-window readiness" not structurally met yet. |
| 3.7 | Components typed props/states/a11y/no domain logic/no raw API/tests | **PARTIAL** | Props are typed everywhere inspected; controllers extract domain logic (useChatController, useTasksController, etc.). Test coverage is broad (30+ test files) but not literally per-component. |

**§3 verdict: PASS with two PARTIALs (3.6 multi-window readiness, 3.7 literal per-component test coverage).**

---

## §4 App shell, navigation, window lifecycle

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 4.1 | Wide-screen three-pane shell | **PASS** | AppShell renders LeftNav / center conversation / right work surface; right surface only when content exists (`hasRightSurfaceContent`, AppShell.tsx:962–969) — empty surface doesn't consume half the screen. |
| 4.2 | Responsive breakpoints | **PASS** | useLayoutMode hook + tests; docked right panel ≥1200, sheet below; left rail collapsible (LeftNav collapsed prop); composer anchored bottom (AppShell layout). |
| 4.3 | Top bar answers "Where am I?" | **PASS** | TopBar: breadcrumb/group+project context, search trigger, sync status, notifications w/ unread badge, profile (TopBar.tsx:263–291). |
| 4.4 | Group switcher contents; no "Workspace" | **PARTIAL** | Switcher: current + recent groups, unread state, Create Group, Join Group (TopBar.tsx:81–98). But the loading screen copy breach of 0.1 ("Loading workspace…") belongs to this section too — fixed only when 0.1 is fixed. |
| 4.5 | Project switcher shows name/status/archive; current obvious | **PASS** | TopBar.tsx:104 project switcher; LeftNav marks active project with border+accent (LeftNav.tsx:212–238), archived tag rendered when relevant. |
| 4.6 | Left nav default flat structure | **PASS** | LeftNav.tsx:68–83 flat clusters; workbench cluster only while a Project is active (line 121). |
| 4.7 | Window state persisted | **PASS** | captureWindowState/restoreWindowState/applyWindowState wired in AppShell.tsx:546–575 via Tauri store; sidebar/artifact widths from useUiStore partialize. |
| 4.8 | Startup order; remote never blocks frames | **PASS** | main.tsx boot comment verified: env → demo runtime (demo only) → API config → session gateway → render router; realtime connect happens post-mount (App.tsx). Fatal path preserves drafts copy (main.tsx:61). |
| 4.9 | Session expiration screen | **PASS** | SessionExpiredGate.tsx:32–49 exact copy pattern "Your session expired." + safety line + `Sign in again`; domain stores deliberately untouched. |
| 4.10 | Crash recovery restores drafts/pending/conflicts | **PARTIAL** | Drafts + outbox survive restart (zustand persist partialize + IndexedDB sync_ops mirror, hydrateOutbox outbox.ts:124–138); selected Group/Project restore via last-route persistence not found as an explicit mechanism — cold start lands on RootRedirect (first group/chat), not last position. Conflict surfacing on boot exists via hydrate→store. |
| 4.11 | Recommended update prompt non-blocking, once/session, every attempt | **PARTIAL** | Non-blocking banner with [Update now]/[Later] + dismiss (AppShell.tsx:1144–1157); check runs once at mount (AppShell.tsx:578–589) — not re-checked per connection attempt; "once per session" satisfied trivially by single check. |
| 4.12 | Required update full-screen block + stop retry loop | **PASS** | AppShell.tsx:1129–1142 blocking screen "ClanMind needs an update to continue." + [Update now]; connection.ts:308/372 protocolStop halts retry loop on CLIENT_UPDATE_REQUIRED; local read access preserved (no store wipe on this path). |
| 4.13 | Server connect response authoritative on compatibility | **PASS** | wsHub compares semver and answers error frame (wsHub.ts:182–191); client never guesses from version numbers alone — it reacts to server code (connection.ts). |
| 4.14 | Deep-link routes resolve | **PARTIAL** | All seven route shapes exist (router.tsx:200–217). BUT object resolution works only against already-cached rows (resolveObjectLocation reads local stores, lines 129–162); a cold-start `/message/:id` for uncached data falls back to `/` instead of fetching then scrolling/highlighting (§246–247 chain incomplete). |
| 4.15 | Update flow secure/non-interrupting/clean restart | **NOT-IMPLEMENTED** | Tauri updater plugin is a dependency, but no download/install flow honoring "avoid interrupting active meetings" was found; buttons exist without a verified pipeline behind them beyond `checkForUpdate`. |

---

## §5 Team, presence, roles

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 5.1 | Team page lists avatar/name/role/status/project; per-member actions Private chat/Mention/Profile/Nickname | **PARTIAL** | TeamView.tsx has avatar/name/email/role badge/nickname edit/Private Chat (lines 60–131). Missing: current-project column, Mention and Profile actions. |
| 5.2 | Presence subtle Online/Away/Offline; "N teammates here" | **PARTIAL** | ChatHeader implements clickable "N teammates here" (ChatHeader.tsx:59–68); BUT TeamView hardcodes `presence="ONLINE"` for every member (TeamView.tsx:71) — decorative, not derived from realtime presence. Violates "never inferred from stale data" spirit. |
| 5.3 | Role badges compact; disabled admin controls not shown to members | **PASS** | Badge sm variants neutral/spectral OWNER (TeamView.tsx:107–118); admin affordances hidden per §0.11 evidence. |
| 5.4 | "N teammates here" clickable list; history not persisted; artifact presence realtime-only | **PARTIAL** | Clickable count present (ChatHeader); viewer count projected from live presence envelope (dispatch.ts:672–681 `viewers_online`). No evidence of a persisted-viewing violation, but no dropdown member list implementation found either. |
| 5.5 | Profile separates global vs Group-scoped | **PARTIAL** | Nicknames are Group-scoped in group store; global profile fields editable in Settings general; a dedicated unified profile surface separating the two explicitly wasn't found. |
| 5.6 | AI profile shows name/"AI teammate"/skills/config; no fake-human labeling | **PASS** | Odin rendered as AI identity everywhere (sender_name = ai_name); Settings AI section exposes name/avatar/config; no human-tone claims observed. |

---

## §6 Main chat

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 6.1 | Message anatomy complete | **PASS** | MessageRow renders avatar/name/timestamp/body/attachments/reactions/thread indicator/action row; AI rows add tool timeline/sources/fallback metadata. |
| 6.2 | Consecutive grouping under one avatar | **PASS** | isConsecutive computed by sender+5min window (MessageList.tsx:311–318); identity returns via hover timestamp + full header on first row of group. |
| 6.3 | Action row gated per role; More menu items | **PARTIAL** | Reply/React/Copy/More present; More = Edit/Delete/Pin/Create task/Save decision/Use as context (MessageActions.tsx:68–111). Missing vs §25 list: Quote, Mark unread. Gating correct (hidden unless owner/moderator). |
| 6.4 | Actions keyboard reachable | **PASS** | Row tabIndex=0 + group-focus-within toolbar reveal (MessageRow.tsx:132–138); explicit fix documented in code comment. |
| 6.5 | Copy message icon→check→reset ~1.8s; no toast; a11y label | **PASS** | MessageActions.tsx:56–62,158–170 (1800ms reset, "Copied"/"Copy message" labels, no toast). |
| 6.6 | Code block toolbar language+Copy; exact preservation; post-click Copied | **PASS** | MessageRow.tsx:328–384 (stable key from node offset, ✓Copied state, aria-label). |
| 6.7 | Quick reactions 👍❤️😂🔥 + picker via popover; toggle own reaction | **PASS** | QUICK_EMOJIS incl. all four spec emoji (plus 🚀👀); toggle logic in useChatStore.addReaction + server reconcile via reaction.updated. |
| 6.8 | Optimistic reaction w/ rollback | **PASS** | Local addReaction immediate; server reaction.updated replaces local state (dispatch.ts:633–654); failure path leaves next reconcile to correct. |
| 6.9 | Thread opens in right surface; Esc closes + restores focus | **PASS** | ThreadPanel.tsx:44–69 (focus restore to prior trigger, Escape handler); rendered in right work surface (AppShell rightSurfaceTitle 'Thread'). |
| 6.10 | Inline edit Save/Cancel; Enter=save Shift+Enter newline Esc=cancel; edited marker | **PASS** | MessageRow.tsx:253–287 + (edited) marker at 226–230. |
| 6.11 | Soft delete tombstone, no empty space | **PASS** | MessageRow.tsx:111–121 compact italic tombstone "This message was deleted." |
| 6.12 | Pin indicator + pinned-items surface | **PARTIAL** | Pin chip on message header (MessageRow 217–225) + Garage Pinned section for artifacts/files (GarageView.tsx:44–66,124–125). No chat-level pinned-messages view. |
| 6.13 | `@` opens picker; members only; Odin distinct entry; keys; "No teammate found." | **PASS** | MentionPicker.tsx caret-anchored, keyboard nav, empty state line 101; Odin injected as distinct item (Composer passes aiName). |
| 6.14 | Mentions as stable ID-backed tokens | **PARTIAL** | Insertion writes display-name text `@Name ` (Composer.tsx:308–318) — resolution happens server-side from body tokens (transportRoutes.ts:371–389); render side has no special mention-token styling in MessageRow (plain markdown text). Functional but not visually token-styled per §34. |
| 6.15 | Mention effects: highlight/activity/notification, never fullscreen | **PASS** | MENTION notification row created per token (mock route mirrors BE handlers), OS pipeline gates inside osNotify; no interruptive UI. |
| 6.16 | Picker tracks caret/in-viewport/resize | **PASS** | caretGeometry computePickerPosition + resize & scroll listeners (Composer.tsx:163–174). |
| 6.17 | Typing 1/2/3+ variants; ephemeral | **PASS** | MessageList.renderTypingText exact variants; TYPING_TTL_MS=6000 pruned on 1s tick (chatSelectors.ts:132–139, AppShell.tsx:480–489). |
| 6.18 | Unread divider; read-marking only when appropriate | **PASS** | Divider drawn after lastReadMessageId (MessageList.tsx:303–335); markScopeRead only when near bottom or jump clicked (140–188). |
| 6.19 | ↓ N new messages pill; click jumps | **PASS** | Jump pill with count (MessageList.tsx:496–511) → scrollToBottom clears count. |
| 6.20 | Auto-scroll near-bottom rule; stop following; resume at bottom | **PASS** | §41 effect 191–205 + streaming rAF follower that re-checks live proximity every frame (272–293). |
| 6.21 | Notification/deep-link loads+scrolls+highlights | **PARTIAL** | Routes resolve into context when cached (see 4.14 gap); highlight-on-arrival styling not found in MessageRow. |
| 6.22 | Virtualization: stable keys/cursor loading/preserved anchors/thread support | **PASS** | @tanstack/react-virtual with id keys, dynamic measurement, height-delta anchor compensation (216–253), top-trigger cursor loading (177–187), VIRTUALIZATION_THRESHOLD=80; virtualization test file exists. |

---

## §7 Composer

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 7.1 | Structure writing surface + attach + `/` + `@` + Send | **PASS** | Composer.tsx layout; professional spacing (px-3.5 py-3, auto-grow). |
| 7.2 | Auto-grow 46→240px cap w/ internal scroll; min 46px | **PASS** | Composer.tsx:141–148 (within §43's 44–52 min / 220–280 cap budget). |
| 7.3 | Enter send / Shift+Enter newline | **PASS** | handleKeyDown 265–272; native undo preserved (uncontrolled history via textarea). Preference swap not implemented (optional). |
| 7.4 | Send disabled when empty; sending dedupe only per-op; composer never wholesale-locks during AI delays | **PASS** | canSend gating (190–195); isAiResponding swaps Send→Stop instead of locking (682–696). |
| 7.5 | Focus remains after send; failed send keeps draft + Retry | **PASS** | §46 focus retention via store-driven clear (text cleared, textarea retains focus — no remount); failed path keeps body + Retry (useChatController.retryMessage, MessageRow 523–533). |
| 7.6 | Send pipeline client_message_id → optimistic → queue → send → reconcile | **PASS** | useChatController.sendMessage lines 192–308 exactly mirror §241. |
| 7.7 | Attach button tooltip + native multi-select; drag AND paste paths | **PASS** | Composer.tsx:361–401 (picker/drop/paste). |
| 7.8 | Chips: icon/name/size/remove; states selected/uploading/uploaded/failed/cancelled | **PASS** | AttachmentTray + useAttachmentUploads lifecycle (tests exist); chips render state distinctly. |
| 7.9 | Image thumbnails small, no huge cards | **PASS** | h-6 w-6 thumbnails in chips (MessageRow 407–413) and tray. |
| 7.10 | Upload progress filename · N% / Cancel / Uploaded / Preparing | **PASS** | updateComposerAttachment patches progress/index_state; AttachmentTray renders per-state copy (test-covered). |
| 7.11 | Failure "Couldn't upload this file." + Retry/Remove; never silently dropped | **PASS** | failed chip state blocks Send until resolved (hasFailedUpload gate, Composer.tsx:189–195) with hint copy 651–660. |
| 7.12 | Drag overlay copy; paste routing; never auto-send | **PASS** | Overlay "Drop files to attach" (430–438); paste files→attachment else text (396–401); nothing auto-sends. |
| 7.13 | `/` command picker w/ flags gating | **PASS** | SlashCommandPicker w/ descriptions + keyboard filter; featureFlags gate meeting/research entries. |
| 7.14 | `/private` recipient chooser; 🔒 header unmistakable | **PASS** | handleSelectCommand clears text then opens chooser (320–327); privacy header w/ lock + recipient + info ring (501–531, 424–428). |
| 7.15 | Private human chat separately scoped view | **PASS** | PRIVATE_PAIR scope filter (chatSelectors 50–62) + TeamView/PrivateRecipientChooser entry points setting scope. |
| 7.16 | Private AI visible only to requester; never leaks to shared surfaces | **FAIL** | Same finding as 0.12: gate admits foreign PRIVATE_AI (`recipientId==='ai'`, dispatch.ts:250) and PRIVATE_AI selector lacks requester check (chatSelectors.ts:49). Probe proved cross-user rendering. |
| 7.17 | Scope shown; recipient visible; stale selection can't cause public send | **PASS** | Header always shows recipient; stale/cleared recipient BLOCKS send entirely (Composer 129–138; controller 182–190) — can never fall through to GROUP. |
| 7.18 | Reply mode header + quoted preview + × dismiss | **PASS** | Composer.tsx:474–497. |
| 7.19 | Drafts persist locally per Group+project+private scope; never public until sent | **PARTIAL** | Drafts persist per `user:group:project` (AppShell.tsx:528) but the key omits the privacy component: text typed in private mode stays in the composer if the user clicks "Switch to Public Group" (visibility change does not re-key or clear text; loadDraft runs only on scopeKey change, 530–537). The §58 stale-recipient gate prevents an *accidental* send while still private, but after switching to GROUP the previously-private text becomes sendable to the channel with one Enter. Spec requires drafts keyed by private scope too. |

**§7 verdict: strong overall; two FAIL/PARTIAL items trace back to the same privacy-scoping theme (7.16 structural leak, 7.19 draft key omission).**

---

## §8 Search & command palette

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 8.1 | Ctrl/Cmd+K palette with 8 sections | **PASS** | CommandPalette.tsx:19 comment verified — Messages/People/Projects/Artifacts/Files(hidden empty)/Tasks/Decisions/Commands groups at 177–313; useGlobalShortcuts mod+k. |
| 8.2 | Commands contextual for current view | **PARTIAL** | Command group includes start_meeting/create_task/review_approvals etc. (AppShell.tsx:1671–1678); grouping is static rather than view-ranked (no Linear-style per-view reordering found). |
| 8.3 | Shortcut set incl. Ctrl/Cmd+/ help, Ctrl/Cmd+Shift+P project switcher | **PASS** | useGlobalShortcuts.ts mod+k + shift+p; Esc overlay closing via Radix; KeyboardShortcutsDialog mounted (AppShell.tsx:1689). |
| 8.4 | Results show type/snippet/author/date/project; §175 modes | **PARTIAL** | Palette rows show names/snippets within current Group data only; no server full-text modes (§175) — client-side corpus only. |
| 8.5 | Search privacy: private results only to participants | **PASS** | Corpus = `scopedMessages` (rule-26 filtered, AppShell.tsx:1654) — PRIVATE_* rows cannot enter shared search by construction (GROUP scope). |
| 8.6 | Opening result switches context → loads → scrolls → highlights | **PARTIAL** | In-context navigation works (select project/artifact/message handlers); cross-Group switching and scroll+highlight chain not implemented (same gap as 4.14). |
| 8.7 | Debounce 200–250ms / stale-response cancellation | **NOT-IMPLEMENTED** | No debounce/AbortController on search — moot for the current synchronous local corpus, but the spec'd server-search behavior is absent. |
| 8.8 | Scope respects view (project vs group vs global) | **PASS** | Messages corpus already filtered to active chat scope; artifacts/tasks/decisions lists are project-scoped stores. |
| 8.9 | Empty states exact copy | **PASS** | "No matches. Try a shorter phrase or another filter." (CommandPalette:173); "No commands found." (SlashCommandPicker:136). |

---

## §9 UI patterns

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 9.1 | Toasts only for reversible/small confirmations | **PASS** | Toasts observed for decision proposed/save-type events (AppShell.tsx:897); destructive flows use dialogs; AI activity never toasted. |
| 9.2 | Dialogs reserved for destructive/security/ownership | **PASS** | Dialog usage: create task, propose decision, GitHub approval (ApprovalCard flow), ownership transfer (SettingsView), Delete Group danger zone. |
| 9.3 | Empty states answer what/why/next | **PASS** | "Your team is ready." + Create Project / Invite teammates / Ask {aiName} actions (MessageList.tsx:392–422); UnsupportedArtifactCard explains update path. |
| 9.4 | Loading strategy split (skeleton/progress/status/spinner) | **PASS** | Skeleton component, Progress bar, AiStatusIndicator for AI, small spinners for short actions; no universal fullscreen spinner (boot fatal screen excepted). |
| 9.5/9.6 | Error copy what→safe→next; success short | **PASS** | SessionExpiredGate + main.tsx fatal ("Local drafts are preserved…") + AiErrorCard pattern; success toasts one-liners. |
| 9.7 | Confirmation policy | **PASS** | Confirmations on delete/approval/transfer observed; copy/react/open-panel never confirmed. |
| 9.8 | Feature error boundaries; broken artifact ≠ broken chat; global catastrophic screen | **PASS** | ErrorBoundary variant feature/global used around Chat/Project Overview/Garage (AppShell.tsx:1324–1433+) and artifact renderers; global screen copy present in ErrorBoundary + boot fatal. |
| 9.9 | Diagnostics exclude keys/private content | **PARTIAL** | Copy diagnostics exists on global boundary; explicit redaction review of its payload not found (message bodies could ride state dumps depending on implementation — needs confirmation; no evidence of inclusion either). |
| 9.10 | Unsupported artifact card; unrenderable offers raw/export/update | **PASS** | UnsupportedArtifactCard.tsx + exporters; app continues running (feature boundary isolates). |

---

## §10 Auth & onboarding

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 10.1 | Login/signup fields exact | **PASS** | AuthScreen Email/Password/Sign in/Forgot password? (+ signup confirm per views); first-launch clean layout. |
| 10.2 | Recovery never reveals email existence | **PASS** | ForgotPasswordView neutral flow (AuthScreen.tsx:39); no existence hints in copy. |
| 10.3 | First-launch hero + Create/Join group; minimal motion | **PASS** | Hero copy present in onboarding entry; logo spectral variant used once, fades minimal. |
| 10.4 | ~7-step onboarding, skippable | **PASS** | STEP_LABELS 7 steps documented (CreateGroupOnboarding.tsx:24–38); skip paths on optional steps. |
| 10.5 | Invite step Owner/Admin-gated; email inputs/copy link/skip | **PARTIAL** | Invite UI present; gating enforced at settings level; the onboarding invite step itself doesn't re-verify role (creator is owner by construction — acceptable but unguarded component API). |
| 10.6 | "Meet Odin." intro w/ rename/avatar affordances | **PASS** | Step includes AI naming (ai_name captured in router completion handler, router.tsx:65–99). |
| 10.7 | Value-chain demo animation 10 steps then settles | **PASS** | demoStep timer 1..10 gated to step 5 (lines 74–83); settles by design; reduced-motion honored (matchMedia line 58). |
| 10.8 | Project creation fields incl. type enum | **PASS** | Project type union in types/index.ts ('software' etc. seen in router); CreateProjectDialog fields name/goal/description/type. |
| 10.9 | Group empty state | **PASS** | MessageList empty state (see 9.3). |
| 10.10 | Project empty state "Nothing is built yet." + suggestions | **PASS** | ProjectOverview renders goal/pulse + empty suggestions (verified during §11 pass). |
| 10.11 | No forced config wall / 20-step onboarding | **PASS** | 7 steps with skips; first chat reachable immediately post-complete (router navigates straight to chat). |

---

## §11 Context model

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 11.1 | Group chat header contents | **PASS** | ChatHeader: title/context chip/search/meeting/prescence count (ChatHeader.tsx:8–68). |
| 11.2 | Chip states `Group chat` / `Project: <name>` in header AND composer | **PASS** | ChatHeader.tsx:54 + Composer.tsx:635 exact strings. |
| 11.3 | Client-side project filtering over ONE message model | **PASS** | Single messages store + projectFilterId filter (useChatStore.setProjectFilterId); no second backend chat system. |
| 11.4 | Project tabs Overview/Conversation/Artifacts/Tasks/Decisions/Context/GitHub | **PARTIAL** | LeftNav workbench = Overview/Tasks/Decisions/Memory; Conversation is the chat itself; Artifacts live in Garage/right surface; GitHub panel flag-gated; a dedicated Context page exists (ContextInspector). Tab set differs in shape from §82 but all surfaces exist. |
| 11.5 | Overview concise operating view | **PASS** | ProjectOverview composes Goal/Pulse/focus/decisions/tasks/artifacts/activity/GitHub status compactly. |
| 11.6 | Pulse fields per §84 | **PASS** | ProjectPulse.tsx: % complete, Current focus, Blocked, Next, Odin attention note from real unresolved-decision count (80–98). |
| 11.7 | Switching into Project scopes AI context + creation defaults | **PASS** | activeProject drives send payload project_id (controller 222), task/decision controllers take project scope. |
| 11.8 | Group-level chat distinct from project scoping | **PASS** | projectFilterId undefined = group-wide conversation; composer chip reflects it. |
| 11.9 | Project switch preserves drafts/local state; A never leaks into B | **PASS** | Draft key changes with project → loadDraft restores; scoped selectors prevent cross-project rendering (messages carry project_id and are filtered per route). |

---

## §12 Garage & file viewing

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 12.1 | Sections All/Artifacts/Files/Research/Pinned/Recent | **PASS** | GarageView.tsx:44–51 exact section set. |
| 12.2 | Cards show preview/title/type/creator/updated/version/pin + actions | **PASS** | Card grid renders metadata row + Open/Pin/More menu (154, 408 area). |
| 12.3 | List view columns Name/Type/Updated/Creator/Version | **PASS** | List mode implemented alongside grid (view toggle). |
| 12.4 | Grid preferred; preference remembered | **PASS** | View choice persisted via useUiStore local pref. |
| 12.5 | Pinned first w/ visible pin state | **PASS** | pinned-first comparator (GarageView.tsx:66) + pin glyph. |
| 12.6 | Viewer header filename/type/sharing/size + Use as context/Send to chat/Download/More | **PASS** | File viewer header wired through artifact panel actions (exportAs/toggleContext/send-to-chat handlers). |
| 12.7 | PDF page nav/zoom/search/fit | **PARTIAL** | DocumentViewer covers text/markdown rendering; a dedicated PDF page-navigation viewer was not found (PDFs fall back to download/open-locally). |
| 12.8 | Image fit/zoom/pan/copy/open locally | **PASS** | Image viewer supports zoom controls + open locally via bridge. |
| 12.9 | Large docs lazy-load | **PASS** | Virtualized lists + lazy image loading (`loading="lazy"`); no full-file decode path observed. |
| 12.10 | Nine sync states AND orthogonal index states, STALE ≠ INDEXING, plain tooltips | **PASS** | FileSyncIcon.tsx implements all nine (LOCAL_ONLY…RESTORABLE) each with icon+label+tooltip incl. exact REMOTE_CHANGED copy "Someone updated this file. Click to get the latest version."; FileIndexChip separates index state with STALE distinct tooltip (lines 87–126). |

---

## §13 Artifacts / right work surface

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 13.1–13.3 | Panel expands preserving chat scroll; width animation; close restores | **PASS** | Right surface docked/sheet split (AppShell:941–969+); PanelResizer animated width; chat column flexes without remount. |
| 13.4 | Divider resize stored locally; bounded | **PASS** | artifactPanelWidth in useUiStore partialize; resizer clamps min/max. |
| 13.5 | Thread + artifact share ONE primary right surface | **PASS** | Single `rightPanelMode` union ('thread'|'research'|'context'|'diff'|'approval'|'artifact'|'closed') — modes replace each other, never stack (AppShell:945–969). |
| 13.6 | Most recent becomes active; older reachable | **PASS** | autoOpenArtifact opens newest (dispatch.ts:468,502); Garage + version list reach older ones. |
| 13.7 | Auto-open only for substantial/requested output | **PASS** | Auto-open bound to run-created artifacts & fully-described creations only (dispatch.ts:466–468 comment §252; stub events don't auto-open, 499–503). |
| 13.8 | Never steals focus while typing | **PASS** | Panel open path contains no .focus() call; construction trace opens silently. |
| 13.9–13.11 | Progressive render; node fade+scale; edge draw once; completion one glow | **PASS** | constructionStore consumes node./edge./render_state/completed events; CSS enforces draw-once + glow-once + reduced-motion fallbacks (index.css:229–253,439–491). |
| 13.12 | Supported types list | **PASS** | ArtifactType union + per-type viewers (Document/Diagram/Chart/Table/GitHub diff via GitHubDiffViewer/Image etc.). |
| 13.13 | Version selector descending w/ creator/time/source; View/Compare/Restore | **PASS** | ArtifactPanel version menu + restoreVersion/onSetCompareVersion (ArtifactPanel.tsx:54–113). |
| 13.14 | Compare per type; raw JSON not default | **PASS** | ArtifactCompare + diffUtils (document diff, table changed rows; diagram structural diff) — tests exist. |
| 13.15–13.16 | Fullscreen Esc; zoom +/-/Fit/Reset keyboard equivalents | **PASS** | isFullscreen state w/ Esc handling (ArtifactPanel:104); DiagramViewer zoom controls + keys. |
| 13.17 | Selected node outline + details + Ask-Odin-with-context | **PARTIAL** | Node selection styling present in DiagramViewer; "Ask Odin about this" attaching selected object ID found as context inspector action but not verified end-to-end from node click → AI request payload. |
| 13.18 | Comments/reply/resolve linked to version/region | **NOT-IMPLEMENTED** | No artifact commenting system found in code or routes. |
| 13.19 | Presence from realtime only | **PASS** | presenceOnlineCount set exclusively by presence.updated envelopes (dispatch.ts:672–681); no stale-derived count. |
| 13.20 | Context menu Use as Context/Send to Chat/Create Task/Create Decision/Pin/Export | **PASS** | More-menu actions on artifact panel + Garage card menus expose these (GarageView 154+). |
| 13.21 | Permission-aware artifact UI; unavailable actions hidden | **PARTIAL** | Pin/context/export available broadly; edit/delete/restore gating by role not explicitly rendered differently per role in ArtifactPanel (backend enforces; client shows actions optimistically). |
| 13.22 | Export offers only supported formats per type | **PASS** | exporters.ts builds option list per type and drops unproducible formats (74–106). |
| 13.23 | Share defaults Group/Project scope | **PASS** | No public-web share path exists at all. |
| 13.24 | Soft delete + undo + admin recovery | **PARTIAL** | Trash/restorable window modeled for files (RESTORABLE); artifact delete→undo flow not observed as UI. |
| 13.25 | Snapshot cards + compare vs current | **NOT-IMPLEMENTED** | No project snapshot feature found. |
| 13.26 | Type-appropriate renderers, incremental updates, changed-nodes-only | **PASS** | DiagramViewer applies per-node memoized updates via constructionStore; DOM docs; sandboxed interactive flagged unsupported (UnsupportedArtifactCard) pending flag. |

---

## §14–16 Context page, Memory, Tasks & Decisions

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 14.1 | Context page sections; shared vs local vs AI-eligible distinguished | **PARTIAL** | ContextInspector shows provenance + context items; explicit three-way visual distinction (shared/local-only/AI-eligible) partially expressed via used_as_context flag only. |
| 14.2 | "Use as Project Context" confirm + persists via backend | **PASS** | GarageView label toggle (154) routes through useArtifactController.toggleContext → API POST; confirmation copy present in dialog. |
| 14.3 | `✓ Used by Odin` + tooltip | **PASS** | GarageView.tsx:408 badge; tooltip text present in component. |
| 14.4 | Inspector human-readable provenance; never secret instructions | **PASS** | ContextInspector formats "Odin used: …" style summaries from run sources/tools; no chain-of-thought fields exist in AiRun type. |
| 15.1 | Memory sections Group/Project/Private | **PASS** | MemoryView SECTIONS exactly PROJECT/GROUP/USER_PRIVATE (MemoryView.tsx:31–34). |
| 15.2 | Card types w/ source/created/updated/scope | **PASS** | Typed memory cards render metadata (component doc lines 3–5). |
| 15.3 | Candidate banner Save/Dismiss | **PASS** | §117 banner implemented (memoryCandidates store + view). |
| 15.4 | Explicit memory scope picker defaulting Project inside Project | **PASS** | defaultScope logic commented at MemoryView.tsx:19. |
| 15.5 | Private memory structurally excluded from shared views | **PASS** | Scope partitions are separate arrays filtered by scope; private rows live under USER_PRIVATE key and shared views query GROUP/PROJECT scopes only. |
| 16.1 | Task card fields | **PASS** | TaskCard doc line 4 enumerates title·owner·status·priority·due·related decision. |
| 16.2 | Decision card fields | **PASS** | DecisionCard shows number/title/status/reason/sources/approved-by (decisionOrdinal shared numbering). |
| 16.3 | Message More → Create task prefilled form keeping source link | **PASS** | AppShell task modal prefills from message + keeps source preview visible (1695–1701 comment). |
| 16.4 | Save decision prefill; status Proposed default | **PASS** | Decision modal prefills Title/Context/Options/Source (AppShell:880–901); propose() defaults status Proposed server-side mapping. |
| 16.5 | Creation scoped to current Project by default | **PASS** | Controllers pass activeProject id (§11.7 evidence). |

---

## §17 Meeting Mode

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 17.1 | First-class mode w/ header `● Meeting`/timer/Pause/End | **PASS** | MeetingActiveHeader + AppShell timer tick (AppShell.tsx:598–603); top-bar meeting entry flag-gated. |
| 17.2 | Panel sections Live notes/Potential decisions/Action items/Open questions/Odin suggestions; Accept/Edit/Dismiss | **PASS** | MeetingPanel sections derived by candidate_type (93–98); candidate actions wired. |
| 17.3 | Type→section mapping incl. CONTRADICTION distinct, RESEARCH_NEED→suggestions w/ /research prefill | **PASS** | Mapping table MeetingPanel.tsx:58–63; onResearchShortcut prefills `/research ${topic}` (AppShell.tsx:985–988); contradiction rendered as its own inline class. |
| 17.4 | Status→card state matrix | **PASS** | PENDING active / ACCEPTED compact row linking promoted_to (207–219) / REJECTED recoverable Dismissed sub-list (90) / MERGED hidden with note (89) / EXPIRED silent-only (91). |
| 17.5 | Accept runs real creation flow and WAITS for backend before ACCEPTED | **PASS** | handleAcceptMeetingCandidate promotes through the real endpoint and flips only after confirmation (AppShell.tsx:607–640 comment + implementation); panel doc line 39 reiterates. |
| 17.6 | End-of-meeting review; only explicit skip → EXPIRED | **PASS** | meeting.ended re-fetches server truth (dispatch.ts:888–903); leftovers expire at end server-side (§50A) with summary review dialog before save. |
| 17.7 | Facilitation without continuous interruption | **PASS** | Candidates arrive as events; no auto-modal interruption observed; cooldown/confidence left to backend. |
| 17.8 | Start dialog copy + Start meeting/Cancel | **PASS** | MeetingStartDialog (AppShell.tsx:1682) with §126 copy. |
| 17.9 | End summary counts + Review & Save; optional Garage artifact | **PASS** | MeetingEndSummaryDialog posts human-confirmed summary_text (774+); Garage artifact option present. |
| 17.10 | State matrix not started/starting/active/paused/ending/summary ready/saved | **PARTIAL** | Server enum is ACTIVE|ENDED (useMeetingStore.ts:13); UI derives paused (timer gate) + ending + summary states locally; explicit `starting` phase not modeled. |

---

## §18 AI surface

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 18.1 | Configured AI name everywhere; rename global | **PASS** | ai_name read at every render site (controller:68, dispatch:301, MessageRow default 'Odin' overridable). |
| 18.2 | Status vocabulary exact seven | **PASS** | AiStatusIndicator STATUS_CONFIG labels exactly Available/Working…/Researching…/Building…/Waiting for approval/Limited/Offline (79–129). |
| 18.3 | High-level activity states, not private reasoning | **PASS** | Activity labels are surface-level (🌐/📄/✦ equivalents via icons + labels); no chain-of-thought fields anywhere. |
| 18.4 | AI message anatomy; no huge colored bubbles | **PASS** | MessageRow renders standard row + metadata chips; no card bubble. |
| 18.5 | Tool timeline statuses incl. FAILED/DENIED/EXECUTING/SUCCEEDED; collapses after completion | **PASS** | AiToolTimeline renders per ai_tool_calls.status (MessageRow:444–446); collapse-after-complete behavior in component. |
| 18.6 | WAITING_TOOL recurs; active tool surfaced; APPROVED-gated HIGH tool → ApprovalCard mid-stream | **PASS** | ai.tool events upsert tool_calls during run (dispatch.ts:414–433); approval cards surface via ai_actions store independent of run stream (§20). |
| 18.7 | Shell appears immediately; incremental Markdown; completion renders final + sources | **PASS** | spawnAiRun inserts QUEUED shell synchronously (useChatController:61–103); streamed body renders incrementally; completion commits once. |
| 18.8 | Backend enum mapping exact; no invented UI-only states | **PASS** | dispatch handles QUEUED/RUNNING/WAITING_TOOL(via tools)/STREAMING/COMPLETED/FAILED/CANCELLED only; CANCELLED preserves partial (383–396). Minor copy drift: literal strings "Odin is starting…" / "Odin is working…" not used verbatim (generic "Working…" label instead) — semantics correct. |
| 18.9 | Batched deltas; ONLY active message rerenders | **PASS** | 90ms coalescing to dedicated store (dispatch.ts:120–144) + memo comparator (MessageRow:584–607) + test assertions that chat store untouched mid-stream. |
| 18.10 | Streaming autoscroll near-bottom rule | **PASS** | rAF follower re-checks live proximity each frame (MessageList:272–293). |
| 18.11 | Stop control; cancel preserves partial; retry = NEW run; regenerate preserves old | **PASS** | Send→Stop swap; cancelRunLocally keeps partials; retry/regenerate spawn new runs via spawnAiRun (never overwrite); artifact versions merge (§139). |
| 18.12 | Error card pattern + Retry/Try fallback | **PASS** | AiErrorCard with code→reason mapping (tests at aiStreamingUi.test.tsx:83–108). |
| 18.13 | Quota contract branches on can_continue_with_byok; admin-only Open settings | **PASS** | AiQuotaCard implements both branches verbatim; members see message without action (lines 49–64); error code matched exactly APPLICATION_AI_QUOTA_EXHAUSTED (MessageRow:449). |
| 18.14 | Fallback indicator subtle | **PASS** | `{aiName} · fallback model` tertiary-color chip (MessageRow:501–509). |
| 18.15 | Research indicator only when used | **PASS** | `Web research · N sources` chip rendered only when sources exist (489–497). |
| 18.16 | Inline citations + source drawer + cards | **PARTIAL** | Sources chip + drawer exist; per-citation inline popover (hover/focus title/domain/retrieved/open) not fully verified in message body rendering. |
| 18.17 | Drawer Summary/Findings/Sources/Project impact/Uncertainty | **PARTIAL** | ResearchDrawer has Summary/Findings/Sources/ProjectImpact; Uncertainty section absent; AND the mounted instance uses hardcoded demo content (AppShell.tsx:1002–1031) in a branch that is currently unreachable ('research' mode is never set — dead demo remnant that still ships strings). |
| 18.18 | Project Impact section | **PASS** | projectImpact prop rendered prominently. |
| 18.19 | Deep research stages gated by flag | **NOT-IMPLEMENTED** | No Planning→Searching→Reviewing→Cross-checking→Synthesizing→Validating stage UI found; /deepresearch triggers a normal run. |
| 18.20 | Proactivity settings Off/Low/Balanced/High default Balanced; review button | **PARTIAL** | ai_proactivity field exists default 'balanced' (router.tsx:79); proactive-message Review affordance not found (proactive generation itself is backend-driven). |
| 18.21 | Explicit /research; automatic skill surfaces "Skill used:" | **PARTIAL** | /research works; "Skill used: Deep Research" labeling not found in run metadata rendering. |
| 18.22 | Built-in skills listed; custom skill cards fields | **NOT-IMPLEMENTED** | No skills catalog UI found in SettingsView (Skills section stub). |
| 18.23 | High-access skill labeling | **NOT-IMPLEMENTED** | Depends on 18.22. |

---

## §19 AI settings & BYOK

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 19.1 | Provider/key/test/models/primary/fallbacks; saved key never revealed | **PASS** | SettingsView provider section: `type="password"` key input (1304), Test connection button (1321), models count readback (1332); no path echoes the stored key (byok tests assert this). |
| 19.2 | Test states Testing…→Connected · N models / failure copy | **PASS** | States implemented around 1321–1340 ("Couldn't authenticate. Check the provider key." failure branch). |
| 19.3 | Search provider test states | **PARTIAL** | Search-provider config present; Connecting→Searching→Results received→Ready sequence partially covered. |
| 19.4 | AI settings sections + personality presets | **PASS** | Sections Identity/Provider/Models/Fallbacks/Research/Skills/Permissions/Proactivity present; presets Balanced/Direct/Creative/Analytical/Custom + instructions textarea. |
| 19.5 | Permission toggles eight | **PASS** | Toggle set rendered in Permissions section (read files/create artifacts/edit objects/web/read gh/modify gh/create pr/merge pr). |
| 19.6 | App-AI vs BYOK out of member UI | **PASS** | Settings AI sections role-gated; members get restricted view (§22 evidence). |

---

## §20 GitHub integration & approvals — payload_hash trace (high-stakes)

**Trace performed:** github.action.proposed envelope requires action_id + payload_hash + integer payload_version ≥1 or NO CARD IS CREATED (dispatch.ts:689–710). ApprovalCard submits `(action.id, action.payload_hash, action.payload_version)` — never a boolean (ApprovalCard.tsx:214–220). Controller re-checks the on-screen snapshot against the held row BEFORE submitting; mismatch flips EXPIRED without hitting the API (AppShell.tsx:685–689). Server ACTION_EXPIRED → EXPIRED + re-review toast; never silently retries old hash (714–718). Review latest re-fetches rows and reconciles (750–763).

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 20.1 | Panel Connected state/repo/branch/synced/pending/PRs | **PASS** | GitHubPanel renders connection matrix + pending actions + PR list. |
| 20.2 | Public URL read-only expectation; write needs Connect | **PASS** | Read-only vs connected states drive write affordance suppression. |
| 20.3 | Six status states rendered | **PASS** | useGithubConnection status union covers Not connected/Connecting/Read only/Read-write/Needs reauth/Disconnected. |
| 20.4 | Action card pattern "Odin wants to change GitHub": branch/files/risk/review | **PASS** | ApprovalCard ACTION_LABELS + PayloadSummary repo/branch/files ±/+ (110–143); GitHubActionCard specialization delegates approve to generic binding (GitHubActionCard.tsx:19–25,106–137). |
| 20.5 | Diff viewer tree/diff/additions/hunks/copy/PR preview | **PASS** | GitHubDiffViewer + tests; merge confirmation lives in viewer. |
| 20.6 | Pre-approval preview exact files/branches/risk | **PASS** | Diff preview from BE §140 buildDiffPreview shape (changed_files). |
| 20.7 | Consequence enumeration + merge warning "This changes the connected repository." | **PASS** | Merge dialog copy present in diff viewer flow (test-verified). |
| 20.8 | ONE reusable ApprovalCard; GitHub a specialization | **PASS** | Generic card drives all kinds incl. bulk delete/reassign/memory purge (145–180). |
| 20.9 | Card shows kind label/risk level/payload/requested_by/timestamps/Reject+Approve | **PASS** | All present incl. expires_at (370–389). |
| 20.10 | Approve submits exact hash+version; mismatch → re-fetch; never cached-valid | **PASS** | Full trace above; busy-state resets on failure; snapshot check both client-side and server-enforced. |
| 20.11 | Status→UI mapping complete | **PASS** | PROPOSED preparing / WAITING_APPROVAL active / APPROVED brief starting / EXECUTING progress no buttons / SUCCEEDED collapsed hash / FAILED retry note / REJECTED collapsed name / EXPIRED invalid-state flow (229–341). |
| 20.12 | Expiry never silently retries; single Review latest | **PASS** | EXPIRED card replaces actions with one Review latest button (243–251). |
| 20.13 | Non-GitHub approvals reuse shell w/ kind-specific summaries | **PASS** | delete/purge/reassign renderers share the card (145–180); destructive gets danger accent only when appropriate. |
| 20.14 | Approvals surface as notifications + Activity | **PASS** | approval.requested fan-out + AI_ACTION_APPROVAL category in notifications pipeline. |

---

## §21 Feature flags

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 21.1 | Flags fetched at session start AND reconnect into server-cache | **PASS** | ServerFeatureFlags type carries the full eight-flag set; fetched into useGroupStore (server-cache-shaped), DEFAULT_FLAGS reset on account clear. |
| 21.2 | Disabled-flag behaviors exact | **PASS** | meeting_mode hides entry points (TopBar/ChatHeader gated, not disabled); github_write suppresses write affordances while keeping panel (githubWriteAllowed prop); github_merge removes only Merge (mergeEnabled); deep_research gates deep option (SlashCommandPicker flags); interactive_artifacts unsupported-fallback via UnsupportedArtifactCard. |
| 21.3 | Flags per-Group; re-fetched on every Group switch | **PASS** | AppShell.tsx:591–596 refetchFeatureFlags(activeGroup.id) on switch. |

---

## §22 Settings architecture

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 22.1 | Two-column settings with 10 sections | **PASS** | SettingsView nav rail General/Members/AI/Skills/Research/GitHub/Notifications/Usage/Security/Danger Zone; main content right. |
| 22.2 | Members settings incl. nicknames | **PASS** | Admin invite/role changes/remove/transfer + member personal/notification/nickname sections. |
| 22.3 | Danger Zone separated; recovery window explained | **PASS** | "The Group enters a {GROUP_RECOVERY_DAYS}-day recovery window, then permanent deletion." (SettingsView.tsx:1744); structurally separate zone. |
| 22.4 | Ownership transfer dialog states new owner + "You will become Admin." | **PASS** | Exact copy at SettingsView.tsx:1723 with Cancel/Transfer. |
| 22.5 | Member removal warns access loss; contributions remain | **PASS** | Removal dialog copy present (§230 pattern). |
| 22.6 | Avatar upload or generated initials | **PARTIAL** | Initials generation present (Avatar component); upload path not verified end-to-end. |
| 22.7 | Dirty indicator meaningful; section-level save for AI/GitHub/permissions | **PASS** | Section-level save buttons on AI config/GitHub; auto-save only on safe toggles. |
| 22.8 | Permission-denied copy human, no policy codes | **PASS** | "Only Owners and Admins can change Group AI settings." (1115,1136); approval denial copy likewise human (AppShell.tsx:720). |
| 22.9 | Guest clean restricted navigation | **PASS** | Guests omit Settings entirely from nav (LeftNav.tsx:109,122) + Guest badge explains why (301–306). |

---

## §23 Notifications & Activity

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 23.1 | Category set uses EXACT backend identifiers | **PASS** | notificationPrefs.ts:31–40 enumerates MENTION, PRIVATE_MESSAGE, AI_RESPONSE, AI_ACTION_APPROVAL, TASK_ASSIGNMENT, DECISION_APPROVAL, ARTIFACT_READY, GITHUB_EVENT, MEETING_SUMMARY, PROACTIVE_AI (+SYSTEM) — no paraphrase drift; PROACTIVE_AI distinct from AI_RESPONSE. |
| 23.2 | Channels In-app/Desktop/Email; desktop client-derived | **PASS** | Prefs model three channels; desktop toggle derived from in_app + OS permission state, not a backend column. |
| 23.3 | Per-category independence | **PASS** | Per-category rows each carry their own channel toggles. |
| 23.4 | delivery_state verbatim in Sync Diagnostics | **PASS** | SyncDiagnosticsView renders n.delivery_state verbatim incl. SUPPRESSED_BY_PREFERENCE vs FAILED distinction (194–229). |
| 23.5 | Activity aggregates key events; presence excluded | **PASS** | ActivityView lists mention/reply/approval/assignment/AI events; presence events never create activity rows. |
| 23.6 | Away-time batching copy | **PARTIAL** | Aggregate announcement exists in chat ("N new messages"); the full away-batch sentence ("Arun, Priya and Odin mentioned you.") not found as a distinct surface. |
| 23.7 | OS notifications limited to important categories | **PASS** | osNotify gates category ∈ {MENTION, PRIVATE_MESSAGE, AI_ACTION_APPROVAL, TASK_ASSIGNMENT, SYSTEM} (osNotify.ts:6–14). |
| 23.8 | Native permission asked with reason; content-hidden previews | **PASS** | Permission requested at first important notification w/ explanatory copy; preview suppression gate (osNotify Gate 3). |
| 23.9 | Unread badge subtle; marked read when viewed | **PASS** | TopBar dot badge + Activity count; markRead wired to actual views (AppShell:1549). |

---

## §24 Offline, sync & local

**Outbox replay trace (high-stakes):** queue rows are durable mirrors of BE §20A sync_operations in account-scoped IndexedDB (`cm_<userId>→sync_ops`, outbox.ts:64–93). Replay is strictly FIFO by created_at; a transient failure HALTS the cycle so later ops never overtake (144–149, 323–341). Retries reuse the identical `client_operation_id` verbatim — message.create posts it as both `client_message_id` and Idempotency-Key (252–281). Outcomes: APPLIED removes row + reconciles bubble; REJECTED stays visible/dismissible, never silent (187–200); CONFLICT creates the sync_conflicts row and parks (202–226). Resolution writes back through the SAME row with resolution_strategy ∈ server_wins/client_wins/merged/manual; client_wins re-queues the op UNCHANGED after refreshing expected_version for task CAS (405–461). Replay triggers ONLY on genuine offline→connected transition (connectivity.ts:57–59) — no fake confirmations anywhere (AppShell comment 539–544).

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 24.1 | Offline-available set honored; cloud ops clearly unavailable | **PASS** | Cached projects/conversation/artifacts render offline; AI/GitHub actions gated with explanatory states (AiErrorCard/offline hints). |
| 24.2 | Offline send queues → `Queued · Offline` bubble → reconcile on reconnect | **PASS** | Controller queues w/ pending bubble (247–277); composer chip shows "Queued · Offline" (Composer:663–671); outbox replays + confirms. |
| 24.3 | Pending normal weight + clock; failures "Not sent · Retry", text kept | **PASS** | MessageRow chips (232–248) + Retry block keeping body (523–533). |
| 24.4 | Banner states invisible/Reconnecting…/Offline/Syncing N…/✓ Synced from real counts | **PASS** | deriveSyncStatus pure truth table (connectivity.ts:19–35); N = real pendingOperations count (outboxPendingCount). |
| 24.5 | Per-device per-Group checkpoint sent on reconnect | **PASS** | checkpoint {last_server_sequence,last_synced_at} in useSyncStore; hello frame carries last_server_sequence + device_id (wsHub.ts:196–203); sync.client.connected/reconciled stamp last_synced_at (dispatch.ts:908–915). |
| 24.6 | PENDING→APPLIED / REJECTED dismissible / CONFLICT card lifecycle | **PASS** | outbox.ts markApplied/markRejected/markConflicted exactly per spec. |
| 24.7 | Retries reuse identical client_operation_id | **PASS** | Trace above; also retryMessage reuses stored client_message_id (useChatController:358–370). |
| 24.8 | Conflict cards per type; deleted_upstream narrower actions | **PASS** | SyncConflictCard variants incl. [Restore mine as new][Discard mine] only for deleted_upstream (test-covered). |
| 24.9 | Generic conflict card Your version/Remote/Compare/Keep mine/Use remote/Create new version | **PASS** | Card actions implemented; never silently overwrites. |
| 24.10 | Resolution writes back through same sync row w/ strategy+resolved_by/at | **PASS** | resolveConflictThroughSync + resolveConflict(strategy, resolvedBy) records on the held row. |
| 24.11 | Folder connect copy; Tauri fs narrowly scoped | **PASS** | Copy present; capabilities/default.json grants fs:default + dialog/store/notification/updater/shell-open only — no broad shell exec. |
| 24.12 | File tree shows names/type/modified/sync; no unauthorized absolute paths | **PASS** | LocalFileTreeView renders chosen-subtree only via dialog-selected handle. |
| 24.13 | Nine file-sync states rendered distinctly w/ tooltips | **PASS** | FileSyncIcon (see 12.10). |
| 24.14 | Group switch restores last Project/drafts/room; clears stale notifications | **PARTIAL** | Drafts restore per scope key; realtime room re-subscribes on group change; last-active Project stored per Group was NOT found as an explicit persisted map (cold switch lands on chat section, projectFilterId resets). |
| 24.15 | Project switch preserves draft/scroll/artifact panel state where appropriate | **PASS** | Draft keys per project; artifact panel mode persists across in-group navigation. |
| 24.16 | Sync Diagnostics shows Connection/Protocol/Last sequence/Last sync/Pending/Conflicts | **PASS** | SyncDiagnosticsView renders all six fields. |

---

## §25 Security

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 25.1 | URL params never trusted as authorization | **PASS** | Routes derive context from URL but every data surface filters by backend member rows/roles; no client-side authz from query params found. |
| 25.2 | AI HTML through safe renderer; research previews sandboxed | **PASS** | react-markdown (no raw HTML) with SafeMarkdownLink override; markdownSecurity tests assert script/iframe stripping. |
| 25.3 | BYOK secrets never stored client-side | **PASS** | Key input password-typed; store persists only provider config sans key (byok.test asserts absence); secrets live server-side. |
| 25.4 | Interactive artifacts isolated | **PASS** | interactive type falls back to UnsupportedArtifactCard unless flag on; no Tauri fs/auth bridge reachable from artifact content (sandboxed iframe w/o allow attributes in InteractiveViewer path). |
| 25.5 | Tauri capabilities minimal | **PASS** | default.json: core/dialog/fs:default/notification/shell:allow-open/store/updater only — shell restricted to `allow-open` (URL opening), no exec. |
| 25.6 | External URLs controlled; no shell execution | **PASS** | externalLinkPolicy routes through opener allow-list; SafeMarkdownLink wraps markdown anchors. |
| 25.7 | Local Git safety: no silent destructive ops | **PASS** | localFiles operations are read/copy-only; no reset/clean/delete calls exist in bridge. |
| 25.8 | Private content structurally prevented from shared-surface leakage | **FAIL** | Same structural finding as 0.12/7.16: cache gate admits foreign PRIVATE_AI (`recipientId==='ai'`) and PRIVATE_AI selector lacks requester check — probe-verified cross-user leak chain in demo broadcast topology; live-mode risk depends on backend fan-out discipline (spec forbids relying on that alone, §11.2). |

---

## §26 Performance

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 26.1 | Fast shell; heavy viewers lazy-loaded | **PASS** | DiagramViewer/ChartViewer React.lazy in ArtifactPanel.tsx:44–45; main.tsx code-splits react/react-dom/App; mocks chunk eliminated at build time via __DEMO_MODE__. |
| 26.2 | Streaming isolated to active response component | **PASS** | aiStreamStore subscription per message id + memo comparator + messageRenderIsolation test. |
| 26.3 | Artifact rendering incremental/changed-nodes-only/throttled | **PASS** | constructionStore applies node-level events; DiagramViewer memoized nodes; transform-based animation only. |
| 26.4 | Priority order respected; no animation-induced typing lag | **PASS** | Composer auto-grow is style-only; stream work is batched at 90ms; no rAF loops touch composer. |
| 26.5 | Virtualization 10k+ w/ cursor loading + stable anchors | **PASS** | §6.22 evidence + maxPages 40 cursor paging; virtualization test file. |

---

## §27 State matrices

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 27.1 | Component state coverage default…permission-denied | **PARTIAL** | Hover/focus/pressed/disabled/loading/success/error widely present (Button/IconButton/inputs); offline + permission-denied states present on composer/messages/settings but not uniformly on every primitive (e.g., Tabs lack explicit loading). |
| 27.2 | Composer states complete | **PASS** | empty/focused/typing/mention picker/command picker/attachments/uploading/ready/sending/offline-queued/failed/AI command/private mode/reply mode — all observed in Composer.tsx + controller. |
| 27.3 | Message states complete | **PASS** | normal/hover/focus(toolbar)/pending/failed/edited/deleted/pinned/mentioned(via notification)/reply target/search-highlight(partial); selected-state n/a. |
| 27.4 | AI matrix incl. overlay fallback + approval pending derived from metadata/ai_actions.status | **PASS** | fallback from is_fallback metadata; approval pending from action status — never invented as run statuses (dispatch keeps run enum pure). |
| 27.5 | Artifact states | **PARTIAL** | loading/generating/updating/ready/version switching/compare/editing/failed/deleted covered via construction store + panel; conflict/restoring states not surfaced for artifacts (files have RESTORABLE). |
| 27.6 | Meeting states | **PARTIAL** | active/paused/ending/summary/saved/not-started covered; `starting` phase missing (see 17.10). |
| 27.7 | GitHub states | **PASS** | Ten-state matrix mapped incl. action pending/approval required/executing/PR created/failed/disconnected. |
| 27.8 | Button/input state coverage | **PASS** | Buttons: hover/focus-visible ring/pressed scale/loading spinner/disabled/temporary success (Copied)/destructive variants. Inputs: default/focused/filled/invalid(readout)/disabled/read-only patterns in use. |

---

## §28 Acceptance checklists

### UX gate
28.G1 PASS · G2 PASS · G3 PARTIAL (undo strongest on sync/artifacts; some destructive flows lack undo) · G4 PASS (hidden affordances + human denial copy) · G5 PASS (offline set + queue) · G6 PASS (keyboard paths + a11y tests) · G7 PASS · G8 PASS (calm-at-rest rules enforced).

### Main chat C1–C20
C1 ✔ C2 ✔(local corpus) C3 partial(hardcoded ONLINE in TeamView) C4 ✔ C5 ✔ C6 ✔ C7 ✔ C8 ✔ C9 ✔ C10 partial(mention token styling) C11 ✔ C12 ✔ C13 ✔(+pref swap absent) C14 ✔ C15 partial(draft persists across nav; reload persistence via zustand persist ✔) C16 ✔ C17 ✔ C18 ✔ C19 ✔ C20 ✔.
**Chat acceptance: 18/20 full pass.**

### Artifact A1–A13
A1 ✔ A2 ✔ A3 ✔ A4 ✔ A5 ✔ A6 ✔ A7 ✔ A8 ✔ A9 ✔ A10 partial(role-gated artifact actions optimistic) A11 partial(comments absent → 13.18) A12 ✔ A13 ✔.

### Onboarding O1–O12
O1–O9 ✔ O10 partial(GitHub optional connect present in settings; onboarding step light) O11 ✔ O12 ✔.

### Settings S1–S15
All sections functional with role-gated affordances ✔; S5/S6 BYOK verified by dedicated tests.

### Backend contract literacy B1–B17
B1 ✔ (zod schemas + typed endpoints) B2 ✔ B3 ✔ B4 ✔ B5 ✔ B6 ✔ B7 ✔ (APPROVED gating in tool enum) B8 ✔ B9 ✔ B10 ✔ B11 ✔ B12 ✔ B13 ✔ B14 ✔ B15 ✔ B16 partial(cold-cache deep links) B17 ✔.

---

## §29 Do-not-ship negative checks

29.1 PASS · 29.2 PASS · 29.3 PASS · 29.4 PASS · 29.5 PASS · 29.6 PASS (scroll-follow gated) · 29.7 PASS · 29.8 PASS · 29.9 PASS · **29.10 FAIL (frontend permission *rendering* is honest, but private-content scoping — rule 26 family — is structurally breached; see 0.12)** · 29.11 PASS · 29.12 PASS · 29.13 PASS · 29.14 PASS · 29.15 PASS · 29.16 PASS · 29.17 PASS (computed AA tests) · 29.18 PASS · 29.19 PASS · 29.20 PASS.

---

## §30 QA coverage expectations

| # | Item | Grade | Evidence |
|---|------|-------|----------|
| 30.1 | Visual regression coverage or assessment | **NOT-IMPLEMENTED** | No screenshot/visual-diff tooling present; coverage is DOM/behavioral only (55 test files enumerated above). |
| 30.2 | Keyboard e2e flows | **PARTIAL** | Keyboard behavior unit-tested (pickers/dialogs/shortcuts); no scripted end-to-end keyboard journeys. |
| 30.3 | Reduced-motion variants | **PASS** | MessageList.reducedMotion.test + tokens.a11y reduced-motion contract assertions + CSS kill-switches. |
| 30.4 | Offline flow open→draft→send→queue→reconnect→sync→conflict | **PASS** | p11Routes + useSyncStore + SyncConflictCard + outbox tests cover the chain; connectivity transition triggers replay. |
| 30.5 | AI modes exercised | **PARTIAL** | Assist/streaming/quota/fallback/citations tested; Facilitate/Act modes only via meeting candidate flows; private-AI mode tested but leaky (see 0.12). |
| 30.6 | Permission matrix exercised | **PARTIAL** | Role gating unit-tested in settings/nav/approvals; Guest journey + removed-user realtime behavior not scripted. |
| 30.7 | Performance scenarios defined | **NOT-IMPLEMENTED** | Virtualization threshold exists and is tested functionally; no defined perf scenarios/budgets harness. |

---

## Verification gauntlet (run in this session)

| Check | Result |
|---|---|
| `pnpm exec tsc -b` | ✅ exit 0 — zero type errors |
| `pnpm test` | ✅ 55 files / **459 tests passed**, 0 failed, 0 skipped |
| `pnpm run build` | ✅ built in 828ms; ⚠️ main chunk 925KB (gzip 256KB) — code-split warning, non-blocking |
| Console errors on load | none observed during dev-boot traces (boot fatal path only on hard failure) |
| dist exists | ✅ dist/assets/* generated from this build |

### dist purity grep
| Marker | Files in dist/assets | Assessment |
|---|---|---|
| `__DEMO_MODE__` / `installDemoMode` / `mocks/dataset` | 0 | ✅ mock runtime fully eliminated at compile time as designed |
| `demo-token` | 0 | ✅ no fake bearer token ships |
| `SECRET-` test markers | 0 | ✅ no test fixtures leak |
| `Priya` / `robotics-team` dataset names | 0 | ✅ demo people/groups absent |
| `STM32H743` / `ICM-42688P` / `invensense` | **1** (App-*.js) | ⚠️ the unreachable-but-shipped hardcoded ResearchDrawer fixture (AppShell.tsx:1002–1031) rides in the prod bundle. Runtime-unreachable ('research' mode is never set) but violates dist-purity hygiene. |
| Onboarding demo copy (`Flight Controller Firmware`, dated source cards) | 1 | ✅ intentional per §74–76 (onboarding demo story), not leakage. |

Correction logged against §18.17: the ResearchDrawer component itself DOES accept an `uncertainty` prop (present in bundle); the AppShell's (dead) mount simply doesn't pass one. Component-level gap smaller than graded; wiring gap stands.

---

## FINAL VERDICT

# ❌ NOT-READY

(Not staging-ready. One product-rule blocker with an executable proof; everything else is shippable-quality.)

### Blocking list (ordered)

**B1 — Private-AI conversation leakage across users (§0.12 / §7.16 / §25.8 / §29.10). PROVEN by executable probe this session (test written, run, observed failing-correctly, deleted).**
Two compounding defects:
1. **Cache gate hole** — `src/realtime/dispatch.ts:250`: `privateEventIncludesMe()` returns true when `recipientId === 'ai'`, so ANY member's PRIVATE_AI realtime event is admitted into EVERY device's cache. The controller really sends `private_to:'ai'` (useChatController.ts:296) and the demo hub really broadcasts private rows room-wide (transportRoutes.ts:402 → wsHub broadcast:298–303). The existing leakage test misses it only because its synthetic foreign payload omits `private_to`.
2. **Selector gap** — `src/features/chat/chatSelectors.ts:46-49`: the PRIVATE_AI case returns every message with that visibility without verifying the local user is the requester, despite its comment claiming isolation. Foreign private threads therefore RENDER inside another user's /private AI view.
*Required fix (small):* (a) drop the bare `recipientId === 'ai'` acceptance unless the payload also proves the local user authored it or the server addressed the run to them (e.g., require `sender_id === me || recipient_id === me` for PRIVATE_AI, treating `'ai'` as valid ONLY when combined with an explicit per-requester run binding from the server); (b) in `filterMessagesForScope`, filter PRIVATE_AI to rows where `sender_id === currentUserId || recipient_id === currentUserId`; (c) add the missing regression test with a `private_to:'ai'` foreign payload.

**B2 — "Loading workspace…" UI copy (§0.1/§4.4).** AppShell.tsx:930 renders the forbidden term verbatim. One-line copy fix + internal renames (`bootstrapLiveWorkspace`) optional.

**B3 — Draft scope omits privacy (§7.19).** AppShell.tsx:528 keys drafts `user:group:project` without visibility; text composed under 🔒 mode survives "Switch to Public Group" and becomes sendable to the channel with one Enter. Fix: include visibility+recipient in scopeKey, or clear composer on any visibility transition.

### Non-blocking follow-ups (ship-blockers for GA, not staging)
1. Dead demo ResearchDrawer mount shipping fixture strings (AppShell.tsx:1002–1031) — delete or wire to real run data.
2. Multi-window readiness (§3.6): add BroadcastChannel/navigator.locks around outbox replay.
3. Deep-link cold-start fetch-then-scroll chain (§4.14/§6.21/28.B16).
4. Update pipeline behind [Update now] buttons incl. meeting-aware restart (§4.15).
5. Skills catalog UI + deep-research stages (§18.19/18.22/18.23); proactivity Review affordance (§18.20).
6. Artifact comments (§13.18) & project snapshots (§13.25): NOT-IMPLEMENTED.
7. TeamView hardcoded `presence="ONLINE"` (TeamView.tsx:71) — wire to realtime presence or omit.
8. Chunk-size warning: split the 925KB App chunk.
9. Visual-regression tooling + scripted keyboard/offline e2e journeys (§30.1/30.2).

### What is genuinely excellent (verified, not vibes)
- Streaming state machine: canonical enum mapping with zero invented states, 90ms coalesced deltas, single-commit terminal writes, orphan-delta replay, idempotent CANCELLED, partial-preserving FAILED — machine-tested end to end.
- Approvals engine: hash-bound snapshot approval (exact payload_hash+payload_version, never boolean), pre-submit snapshot re-check, ACTION_EXPIRED→re-fetch flow, full status matrix, generic card reused for non-GitHub kinds.
- Outbox/sync: durable account-scoped queue, verbatim client_operation_id reuse, FIFO halt-on-transient, visible REJECTED, same-row conflict resolution with CAS refresh.
- Accessibility: WCAG AA ratios COMPUTED in CI for both themes; Radix primitive layer; 24px target floors; lifecycle-only stream announcements; reduced-motion contract asserted in tests.
- Account lifecycle: complete domain-store wipe + per-account IndexedDB deletion on switch; session-expiry deliberately preserves local work.

**Bottom line:** fix B1 (≈ two functions + one test), B2 (one string), B3 (one key shape) and this codebase is staging-ready immediately; B1 alone is what stands between it and real users.
