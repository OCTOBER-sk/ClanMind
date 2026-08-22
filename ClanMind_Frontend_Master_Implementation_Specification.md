# ClanMind Frontend — Master Implementation Specification

> **Purpose**
>
> This is the frontend authority for ClanMind. It is written for an AI engineering agent that must build the desktop UI against `ClanMind Backend — Master Implementation Specification.md` without inventing conflicting concepts.
>
> **Revision note:** This version patches the prior draft against the authoritative backend's exact contracts — the generalized approval engine (`ai_actions`/`ai_action_approvals`, §78A), canonical AI run/tool state enums (§52/§57A), the concrete sync tables (`sync_checkpoints`/`sync_operations`/`sync_conflicts`, §20A), the exact notification category/delivery-state model (§95A), the meeting candidate lifecycle (`meeting_candidates`, §50A), server-controlled feature flags (§166), the full nine-value file sync state enum (§4.3), client/protocol version mismatch handling (§165), and the exact AI-quota error contract (§94). New sections are numbered with a letter suffix (e.g. §164A) immediately after the section they extend, so the numbering of all prior sections is preserved and existing cross-references remain valid.
>
> **Product:** ClanMind  
> **Default AI:** Odin  
> **Primary client:** Tauri 2 desktop app + React + TypeScript  
> **Experience:** clean white/black/gray foundation, restrained animated spectral/rainbow accents, premium and calm at rest, visually alive during meaningful AI/artifact activity.
>
> ClanMind is a general-purpose team project environment for software, IoT, college, school, research, startups and other projects. The product model is:
>
> `Account → Group → Projects`
>
> There is no Workspace abstraction.

# 1. Frontend Mission

The frontend must make one idea obvious:

> **A team can sit together, think together, work with Odin, turn conversation into project knowledge, and safely move work forward.**

The core loop is:

`Conversation → AI → Research → Decision → Artifact → Task → Approval → Execution → Memory`

The UI should feel like a quiet professional workspace until something meaningful happens. When Odin researches or creates an artifact, the interface becomes visibly alive for a short period and then settles back into a calm state.

The frontend is therefore not merely presentation. It is responsible for:
- information architecture;
- interaction state;
- realtime collaboration;
- perceived latency;
- local/offline experience;
- artifact presentation;
- command and keyboard workflows;
- accessibility;
- visual hierarchy;
- permission-aware affordances;
- failure recovery.

# 2. Product Rules That Must Never Drift

1. A Group is the top-level team container.
2. A user can belong to many Groups.
3. A member can have a personal nickname mapping for teammates inside each Group.
4. A Group has Owner, Admin, Member and Guest roles.
5. Only Owner/Admin can invite; only Owner controls Admin promotion/removal.
6. Ownership can be transferred.
7. A Group can contain multiple Projects.
8. The main team conversation remains shared.
9. The selected Project gives the AI and project tooling its working context.
10. Private human and private AI conversations use the same conversational surface but have strict privacy indicators.
11. Each Group has one shared AI identity; default name is Odin.
12. Group admins may rename Odin and change its avatar for the Group.
13. Admins control AI provider/model/fallback/search/skill configuration.
14. Application AI is platform controlled; BYOK is admin configured.
15. Odin has Assist, Facilitate and Act behavior modes.
16. Meeting Mode is a first-class product mode.
17. Odin may proactively help, but must not become noisy.
18. Memory is scoped and privacy-aware.
19. Large AI outputs become Live Artifacts in the right-side work surface.
20. Everything useful should eventually be discoverable in the Project Garage.
21. Artifact versions are preserved.
22. Tasks and Decisions are first-class objects.
23. GitHub changes are approval-controlled.
24. The desktop app is local-first and must behave sensibly offline.
25. The UI must never assume backend permission state is authoritative; it must ask the backend.
26. Private content must never appear in shared UI through cache/store leakage.
27. Rainbow/spectral styling is an accent, not the theme.
28. Motion communicates state; it is not decoration for its own sake.

# 3. Design Direction

## 3.1 Visual personality

ClanMind should feel like:

- disciplined enough for serious work;
- expressive enough for creativity;
- technical without looking like an IDE;
- collaborative without looking like social media;
- AI-native without looking like a generic chatbot.

Do not clone Slack, Notion, Linear or Claude. Borrow interaction patterns where proven and keep ClanMind's identity distinct.

## 3.2 Base palette

Use semantic tokens, not hard-coded color values scattered through components.

Primary surfaces:
- white;
- near-white;
- near-black;
- neutral gray.

Semantic states:
- success;
- warning;
- danger;
- info.

Spectral accent:
- a runtime-defined animated gradient.

The base interface should remain readable in grayscale.

## 3.3 Spectral rule

Use the spectral gradient only for:
- Odin active state;
- AI generation status;
- artifact construction;
- progress/milestone animation;
- selected visual state;
- a few onboarding moments.

Never use rainbow:
- behind body text;
- around every card;
- as permanent button fills;
- as the default message background;
- in every loading state.

# 4. Design Tokens

Define semantic variables:

```text
color.background
color.surface
color.surfaceRaised
color.surfaceHover
color.surfacePressed
color.border
color.borderStrong
color.text
color.textSecondary
color.textTertiary
color.textDisabled
color.primary
color.success
color.warning
color.danger
color.info
color.spectral

space.1 ... space.12
radius.sm ... radius.xl
shadow.sm ... shadow.lg
font.xs ... font.display
motion.micro
motion.small
motion.standard
motion.large
focus.ring
```

No feature component should invent its own spacing scale.

# 5. Typography

Use one highly legible UI family and one optional code family.

Rules:
- body text must be comfortable to read for long conversations;
- AI responses should have clear heading hierarchy;
- metadata is smaller but still accessible;
- code uses a readable monospace;
- do not use ultra-light weights for critical text;
- preserve user-selected OS/browser text scaling where possible.

# 6. Motion System

Motion vocabulary:

```text
Fade       → secondary appearance/disappearance
Slide      → panel/drawer movement
Scale      → dialogs, reaction feedback, node creation
Draw       → diagram connections/progress
Morph      → rare, reserved for meaningful transformations
```

Suggested durations:

```text
micro      80–120ms
small      120–180ms
standard   180–280ms
large      280–420ms
```

Avoid long routine transitions.

Respect `prefers-reduced-motion`. In reduced motion:
- remove moving spectral lines;
- remove large panel motion;
- replace artifact construction animation with immediate state changes + textual status;
- never remove critical information.

# 7. Accessibility Baseline

Target WCAG 2.2 AA behavior.

Requirements:
- keyboard access;
- visible focus;
- accessible names;
- status announcements;
- usable target sizes;
- readable contrast;
- no essential drag-only operation;
- accessible dialogs/popovers;
- safe focus restoration;
- screen-reader meaningful status updates.

WCAG 2.2 explicitly covers focus visibility/not-obscured, minimum target size, dragging alternatives and contrast. The frontend must build these constraints into primitives rather than add them at the end. citeturn935456search0turn935456search3turn935456search5

# 8. Accessible UI Primitives

Use a mature accessible primitive layer for:
- dialog;
- popover;
- tooltip;
- dropdown;
- context menu;
- tabs;
- toast;
- scroll area;
- menu/command palette.

Radix Primitives is an appropriate implementation reference because its Dialog and Popover manage focus and keyboard interaction and its Tooltip/Toast primitives cover common accessibility behavior. citeturn105547search0turn105547search1turn105547search2turn105547search3turn105547search4

# 9. Frontend Architecture

Recommended boundaries:

```text
UI
 ├─ Design system
 ├─ Feature components
 └─ Page composition

State
 ├─ UI state
 ├─ server cache
 ├─ realtime normalized state
 ├─ local persistent state
 └─ sync queue

Integration
 ├─ typed REST client
 ├─ WebSocket client
 ├─ Tauri bridge
 └─ local persistence
```

Do not allow a random component to call `fetch()` directly or manipulate the raw WebSocket.

# 10. Repository Structure

```text
src/
  app/
  design-system/
    tokens/
    primitives/
    components/
    icons/
    motion/
  features/
    auth/
    groups/
    projects/
    chat/
    ai/
    artifacts/
    garage/
    tasks/
    decisions/
    meetings/
    github/
    settings/
    search/
    notifications/
  realtime/
  sync/
  local/
  api/
  state/
  hooks/
  types/

src-tauri/
  src/
  capabilities/
```

# 11. State Separation

Keep separate:

```textUI state
Server state
Realtime state
Local persistent state
Draft state
Sync state
```

Do not put every object in one global store.

Examples:
- composer text → local/draft state;
- Project metadata → server state;
- typing → realtime state;
- panel width → UI preference;
- pending offline message → sync state.

# 12. Main Desktop Shell

Default wide-screen experience:

```text┌─────────────────────────────────────────────────────────────┐
│ Group / Project     Search     Sync     Notifications  User │
├─────────────┬─────────────────────────────┬────────────────┤
│ LEFT        │ CENTER                      │ RIGHT          │
│             │                             │                │
│ Projects    │ Main conversation           │ Live work      │
│ Team        │                             │ surface        │
│ Garage      │                             │ artifact       │
│ Activity    │                             │ research       │
│ Settings    │                             │ file / diff    │
└─────────────┴─────────────────────────────┴────────────────┘
```

The right surface is contextual. It does not need to occupy half the screen when empty.

# 13. Responsive Desktop Layout

Suggested behavior:

```text≥ 1440       three-pane
1200–1439      compressed three-pane
900–1199       two-pane / collapsible right panel
< 900          single main pane with sheets
```

When narrow:
- right artifact surface becomes a sheet/full-screen view;
- left rail becomes collapsible;
- composer remains anchored to bottom.

# 14. Top Bar

Only show high-value context:

```textClanMind
Group
Project
Search
Sync status
Notifications
Profile
```

The top bar should answer:

> Where am I?

Example:

`ClanMind / Robotics Team / Flight Controller`

# 15. Group Switcher

Clicking Group identity opens:
- current Group;
- recent Groups;
- unread state;
- search;
- Create Group;
- Join Group.

No “Workspace” terminology.

# 16. Project Switcher

Show:
- Project name;
- active status;
- unread indicator;
- archive state only when relevant.

The current Project should be visually obvious.

# 17. Left Navigation

Default:

```textProjects
  Active project
  Other projects

Team
Garage
Activity

Settings
```

Do not create a huge hierarchical tree.

# 18. Team View

Team page:
- avatars;
- names;
- role;
- professional presence;
- current project where useful;
- start private chat;
- mention;
- local nickname action.

Do not overuse colored status dots.

# 19. Presence

Use subtle states:

```textOnline
Away
Offline
```

Optional text:
`3 teammates here`

Tauri/native notifications can support background attention events; the official notification plugin supports permission handling and native notifications. citeturn935456search2turn935456search4

# 20. Group Roles in UI

Display:
- Owner;
- Admin;
- Member;
- Guest.

Badges are compact and neutral.

Do not show disabled admin controls to normal members unless there is a clear reason.

# 21. Main Chat

The main team conversation is the center of ClanMind.

It must support:
- realtime messages;
- AI responses;
- reactions;
- threads;
- mentions;
- attachments;
- search;
- pinning;
- edits/deletes;
- private conversation mode;
- project context;
- streaming;
- activity states.

Slack's current composer and conversation patterns validate combining attachments, mentions, formatting and shortcuts directly around the message field. citeturn435211search4turn435211search3

# 22. Message Width and Rhythm

Messages should remain readable rather than stretching full width.

Use wider content for:
- AI research;
- tables;
- code;
- structured artifacts.

Normal messages can use a comfortable maximum width.

# 23. Message Anatomy

A normal message can contain:

```textavatar
author
timestamp
body
attachments
reactions
reply/thread indicator
action row
```

Only show secondary metadata when useful.

# 24. Message Grouping

Consecutive messages from the same person can visually group:
- one avatar/name at the start;
- subsequent message bodies aligned beneath.

Do not hide author identity for long periods.

# 25. Message Hover/Focus Actions

Primary:
```textReply
React
Copy
More
```

More:
```textEdit
Delete
Pin
Quote
Create task
Save decision
Use as context
Mark unread
```

Only display actions the backend role permits.

# 26. Copy Message

A small copy icon should appear in the action row.

On click:
- copy;
- icon becomes check;
- tooltip becomes “Copied”;
- reset after roughly 1.5–2 seconds.

Do not show a large toast for ordinary copy.

Accessible label:
`Copy message`.

# 27. Code Copy

Code block toolbar:
```textlanguage
Copy
```

Copy must preserve code exactly.

After click:
`✓ Copied`

Optional advanced:
`Copy Markdown`.

# 28. Reactions

Use quick reactions on hover:
```text👍 ❤️ 😂 🔥
```

Plus opens full picker.

Clicking an existing reaction toggles the current user's reaction.

Slack's current reaction interaction uses quick reactions and a picker, which is a proven pattern worth adapting. citeturn435211search8

# 29. Reaction Animation

Use a tiny scale/fade:
```text0.85 → 1
```

No bouncing and no repeated animation.

# 30. Threads

Reply opens the thread in the right work surface when available.

Thread contains:
- original message;
- replies;
- reactions;
- attachments;
- composer.

Escape closes and restores focus.

# 31. Message Editing

Edit inline.

Controls:
```textSave
Cancel
```

Keyboard:
```textEnter → save
Shift+Enter → newline
Esc → cancel
```

Show `edited` subtly.

# 32. Message Deletion

Use soft delete.

Rendered state:
`This message was deleted.`

Do not leave empty vertical space.

# 33. Pinning

Pinned message:
- small pin indicator;
- discoverable from a pinned-items surface.

# 34. Mention Picker

Typing `@` opens a popover.

Show:
- avatar;
- display name;
- role if helpful;
- Odin as a distinct AI entry.

Keyboard:
```text↑ ↓
Enter
Esc
```

Only current Group members appear.

Slack's mention pattern of typing `@`, selecting a member and then notifying that member is a good model for the ClanMind picker. citeturn435211search3

# 35. Mention Rendering

Mentions render as stable tokens, not ordinary text.

They are:
- clickable;
- visually subtle;
- accessible;
- backed by stable IDs.

# 36. Mention Notification

For a mention:
- message is subtly highlighted;
- Activity gets an unread item;
- OS notification according to user preference;
- no full-screen interruption.

# 37. Typing Indicators

One:
`Arun is typing…`

Two:
`Arun and Priya are typing…`

Three+:
`Several teammates are typing…`

Typing state is ephemeral.

# 38. Viewing Presence

Artifact/project header can say:
`3 teammates here`

Click shows small list.

Do not persist viewing history.

# 39. Unread Divider

Use:
`──────── New messages ────────`

Only mark messages read when appropriate.

# 40. New Message Button

When user is reading older messages:
`↓ 3 new messages`

Click returns them to the latest unread/new item.

# 41. Chat Auto-Scroll

During streaming:
- auto-follow only when user is near bottom;
- if user scrolls upward, stop following;
- continue accumulating new content;
- show Jump to latest;
- resume auto-follow when user returns.

This is mandatory for a good chat experience.

# 42. Main Composer

The composer is a critical component.

Structure:

```text┌───────────────────────────────────────────────┐
│ Type a message…                                │
│                                                │
│ + attachment   / command   @ mention   [Send] │
└───────────────────────────────────────────────┘
```

It must feel more like a professional writing surface than a generic chat input.

# 43. Composer Auto-Grow

Use a multiline textarea.

Initial:
- approximately 1–2 lines.

Growth:
- expand with content;
- cap at a sensible height;
- after cap, internal scroll.

Suggested design budget:
```textmin-height: ~44–52px
max-height: ~220–280px
```

Do not allow it to consume most of the conversation.

# 44. Composer Keyboard Behavior

Default:
```textEnter → send
Shift+Enter → newline
```

Optional user preference:
```textEnter → newline
Ctrl/Cmd+Enter → send
```

Preserve native undo/redo.

# 45. Send Button

Empty:
- visually subdued;
- disabled.

With content:
- enabled;
- clear hover/focus/pressed states.

During send:
- prevent duplicate submission;
- show a brief sending state;
- keep the UI responsive.

# 46. Composer Focus

After sending:
- focus remains in composer;
- caret ready for next message.

After a failed message:
- draft content remains;
- Retry is available.

# 47. Attachment Button

Tooltip:
`Attach files`

Click:
- open native picker;
- support multi-select.

Also support:
- drag/drop;
- paste where supported.

# 48. Attachment Chips

Each selected file:
```texticon
filename
size
remove
```

Upload states:
```textselected
uploading
uploaded
failed
cancelled
```

# 49. Image Attachment Preview

Show small thumbnail + filename.

Do not create huge attachment cards inside the composer.

# 50. Upload Progress

Example:
`requirements.pdf · 64%`

Allow Cancel.

After upload:
`Uploaded`

If indexing:
`Uploaded · Preparing for Odin…`

# 51. Attachment Failure

Show:
`Couldn't upload this file.`

Actions:
```textRetry
Remove
```

Never silently drop a file.

# 52. Drag and Drop

While dragging:
- show subtle composer overlay;
- message: `Drop files to attach`.

Do not make drag-and-drop the only path. WCAG 2.2 requires alternatives for dragging-based functionality in applicable cases. citeturn935456search3

# 53. Paste Behavior

Paste:
- text → text;
- image → attachment;
- copied file → attachment where platform permits;
- URL → text.

Never auto-send pasted content.

# 54. Slash Command Picker

Typing `/` at the beginning of the composer opens:

```textAsk Odin
Private
Meeting
Research
Memory
Project
```

Each command:
- icon;
- short description;
- keyboard filtering.

# 55. `/private`

After `/private`:

```textChoose recipient
Arun
Priya
Odin
...
```

Composer header changes to:

`🔒 Private with Odin`

or:

`🔒 Private with Arun`

This privacy state must be unmistakable.

# 56. Private Human Chat

Same message system, separate scoped view.

Only participants see it.

Never visually make it look public.

# 57. Private AI Chat

Only requester + Odin.

Private AI messages never automatically appear in public project memory/activity.

# 58. Composer Privacy Protection

When in private mode:
- show privacy scope;
- keep the selected recipient visible;
- prevent accidental public send caused by stale selection.

# 59. Reply Composer

When replying:

```textReplying to Arun
“quoted preview…”
×
```

Focus returns to composer.

# 60. Mention Picker Position

Picker must:
- track the caret;
- stay within viewport;
- avoid covering composer;
- reposition on resize.

# 61. Search Command Palette

Use `Ctrl/Cmd + K` as the main search/command entry.

Sections:
```textMessages
Files
Artifacts
Tasks
Decisions
People
Projects
Commands
```

# 62. Contextual Commands

Command menus should prioritize actions relevant to the current view. Linear's command menu is a useful reference for grouping and contextual prioritization rather than exposing an unordered list of actions. citeturn435211search10

# 63. Keyboard Shortcuts

Recommended:
```textCtrl/Cmd + K      search/commands
Ctrl/Cmd + /        shortcut help
Ctrl/Cmd + Shift + P project switcher
Enter               send
Shift + Enter       newline
Esc                 close overlays
```

Add more only when they are clearly useful.

# 64. Tooltips

All icon-only actions require tooltips and accessible labels.

Good:
`Copy`
`Attach files`
`Open Garage`
`Close artifact`

Bad:
tooltips that are paragraphs.

# 65. Toasts

Use for:
- copy;
- save;
- invite sent;
- reversible deletion;
- background job completion.

Do not use toasts for:
- destructive confirmation;
- long instructions;
- ongoing AI activity.

# 66. Dialogs

Use dialogs for:
- ownership transfer;
- deletion;
- GitHub approval;
- BYOK setup;
- permission changes.

Dialogs must:
- trap focus;
- close on Escape when safe;
- restore focus;
- have a clear title;
- have explicit actions.

# 67. Authentication Screens

Login:
```textClanMind
Email
Password
Sign in
Forgot password?
```

Signup:
```textName
Email
Password
Confirm password
Create account
```

Keep first launch extremely clean.

# 68. Password Recovery

Use managed auth flow.

Do not reveal whether an email exists.

# 69. First Launch

Hero:

> **A shared project room for people + AI.**

Actions:
```textCreate a group
Join a group
```

Minimal motion:
- logo;
- spectral line;
- soft fade.

# 70. Create Group Onboarding

Step sequence should be short:

1. Group name;
2. description optional;
3. invite teammates;
4. meet Odin;
5. optional AI setup;
6. optional first Project;
7. enter Group.

Everything not essential can be skipped.

# 71. Group Name Screen

Copy:
> What’s your team called?

Optional:
> Give it a little context.

# 72. Invite Screen

```textBring your team in

email inputs
Send invites

or

Copy invite link

Skip for now
```

Only Owner/Admin invitations are allowed.

# 73. AI Introduction

Copy:

> **Meet Odin.**
>
> Your shared AI teammate for research, planning, artifacts and project work.

Show:
```textOdin
Change name
Change avatar
```

# 74. AI Potential Demo

The onboarding should visibly demonstrate:

```textHuman message
   ↓
@Odin
   ↓
Web research
   ↓
Source cards
   ↓
Project impact
   ↓
Live artifact
   ↓
Decision
   ↓
Task
   ↓
GitHub approval
```

Do not explain all of this in paragraphs.

Make it a small animated story.

# 75. First-Run Demo Animation

Animation sequence:
1. chat bubble appears;
2. `@Odin` token activates;
3. Odin status starts;
4. source cards arrive;
5. research summary appears;
6. right panel expands;
7. diagram nodes form;
8. decision card appears;
9. task cards appear;
10. GitHub approval card appears.

Then everything settles.

# 76. Demo Copy

Keep copy direct:

> Ask Odin to research.

> Turn findings into a plan.

> Turn the plan into project work.

> Approve real changes when you're ready.

# 77. Project Creation

Fields:
```textProject name*
Goal
Description
Project type
```

Optional:
```textReference files
GitHub repository
Custom instructions
```

Project type examples:
```textSoftware
IoT
Startup
Research
College
School
Personal
Other
```

# 78. Group Empty State

Show:

> **Your team is ready.**
>
> Start talking, create a Project or ask Odin something.

Actions:
```textCreate Project
Invite teammates
Ask Odin
```

# 79. Project Empty State

Show:
```textProject name
Goal
Nothing is built yet.
```

Suggestions:
```textDiscuss the problem
Ask Odin to research
Add references
Create a plan
Connect GitHub
```

# 80. Group Main Chat Header

Show:
```textGroup Chat
Project context chip
Search
Meeting
Presence
```

The project context chip must say whether current conversation is:
`Group chat`
or:
`Project: Flight Controller`

# 81. Group Chat + Project Context

Do not create separate backend chat systems.

Frontend can filter/group messages by Project context while the underlying backend message model remains unified.

# 82. Project Navigation

Within a Project:
```textOverview
Conversation
Artifacts
Tasks
Decisions
Context
GitHub
```

Do not force users into a 6-level hierarchy.

# 83. Project Overview

Show:
```textGoal
Project Pulse
Current focus
Open decisions
Active tasks
Recent artifacts
Recent activity
GitHub status
```

This is a concise operating view, not a giant dashboard.

# 84. Project Pulse

Example:

```textPROJECT PULSE

Goal
────────────●────
68%

Current focus
Authentication

Blocked
GitHub OAuth decision

Next
Finalize API contract

Odin
2 unresolved decisions need attention.
```

# 85. Pulse Animation

When progress changes:
- move marker;
- travel a spectral gradient once;
- update number;
- settle.

Do not animate the line continuously.

# 86. Team Page

Professional:
```textAvatar
Name
Role
Status
Project
```

Actions:
```textPrivate chat
Mention
Profile
Nickname for me
```

# 87. Garage

Garage should feel like a project library, not a generic uploads folder.

Sections:
```textAll
Artifacts
Files
Research
Pinned
Recent
```

# 88. Garage Cards

Show:
```textpreview
title
type
creator
updated
version
pin
```

Hover/actions:
```textOpen
Pin
More
```

# 89. Garage List View

Support list mode for technical files.

Columns:
```textName
Type
Updated
Creator
Version
```

# 90. Garage Grid View

Preferred for visual artifacts.

Remember the user's preferred view locally.

# 91. File Viewer

Header:
```textfilename
type
size
sharing
```

Actions:
```textUse as context
Send to chat
Download/Open locally
More
```

# 92. PDF Viewer

Support:
- page navigation;
- zoom;
- search;
- fit width;
- page-linked AI references.

# 93. Image Viewer

Support:
- fit;
- zoom;
- pan;
- copy;
- open locally.

# 94. Artifact Work Surface

Claude's current Artifacts experience validates a separate right-side work surface for substantial reusable content, including documents, SVGs, diagrams, code and interactive React content, plus version switching. ClanMind should adapt the interaction model to a shared Group/Project surface. citeturn435211search0turn435211search6

# 95. Artifact Panel Open

When a substantial artifact is created:
- expand the right panel;
- preserve chat scroll;
- animate panel width;
- show artifact.

When closed:
- restore chat width;
- return focus appropriately.

# 96. Artifact Header

```textArtifact name
Type · v4

Pin
Version
More
```

Optional:
`3 teammates here`

# 97. Live Artifact Creation

This is a major ClanMind signature.

As backend artifact events arrive:
- create node/card/section progressively;
- show creation status;
- animate only changed items;
- stream the artifact into the shared surface.

# 98. Diagram Build Animation

For a flow:

```text[User]
   |
   | animated spectral edge
   v
[API]
   |
   v
[Database]
```

When a node arrives:
- fade;
- slight scale;
- settle.

When edge arrives:
- draw along the edge once;
- stop after completion.

# 99. Rainbow Edge Rules

Spectral gradient:
- moves only while an edge is being created/updated;
- becomes static or nearly static after;
- does not pulse indefinitely.

# 100. Artifact Completion

On completion:
- status becomes Ready;
- toolbar activates;
- one subtle completion glow;
- no confetti.

# 101. Artifact Types

Support:
```textDocument
Markdown
Diagram
Flowchart
Architecture
Graph
Chart
Timeline
Mind map
Table
Research
Image
Interactive
Code
HTML
Git diff
```

# 102. Artifact Versions

Version selector:
```textv4
v3
v2
v1
```

Each version shows:
- creator;
- timestamp;
- source AI run if applicable.

Actions:
```textView
Compare
Restore
```

# 103. Artifact Compare

Documents:
- diff.

Diagrams:
- structural/visual diff.

Tables:
- changed rows/values.

Tasks:
- changed cards.

Do not expose raw JSON by default.

# 104. Artifact Fullscreen

Complex diagrams can expand to fullscreen.

Esc exits.

# 105. Artifact Zoom

Diagram:
```text+
-
Fit
Reset
```

Keyboard equivalents can be provided.

# 106. Artifact Selection

Selected node:
- strong outline;
- details panel;
- Ask Odin action.

# 107. Artifact Follow-up

When a node/text region is selected:

```textAsk Odin about this
```

The selected object ID/context is attached to the AI request.

# 108. Artifact Comments

For supported artifacts:
- comment;
- reply;
- resolve.

Comments should remain linked to an artifact version/region where possible.

Slack Canvas demonstrates a useful model for comments/threads attached to shared content. citeturn435211search1

# 109. Artifact Presence

Show:
```text3 viewers
```

If editing:
```textArun is editing
```

This must use realtime presence and never be inferred from stale data.

# 110. Artifact Context

Actions:
```textUse as Project Context
Send to Chat
Create Task
Create Decision
Pin
Export
```

# 111. Artifact Permission UI

Creator:
- edit own artifact.

Admin/Owner:
- edit/delete/restore.

Member:
- view/comment/context according to backend permissions.

Guest:
- allowed viewing only.

The frontend hides unavailable actions but the backend remains the security authority.

# 112. Project Context

Context page should contain:
```textGoal
Instructions
References
Files
Artifacts
Decisions
Memory summary
GitHub
Skills
```

Distinguish:
- shared context;
- local-only files;
- AI-eligible context.

# 113. “Use as Context”

Clicking:
`Use as Project Context`

shows:
> Odin may reference this item when working on this Project.

Save through backend.

# 114. Context Indicator

On file/artifact:
`✓ Used by Odin`

Tooltip:
> Available to Odin as approved Project context.

# 115. AI Context Inspector

Advanced UI can show:
```textOdin used:
Architecture v3
Decision #14
requirements.pdf
6 recent messages
Web research
```

Never show secret system instructions or hidden chain-of-thought.

# 116. Memory UI

Sections:
```textGroup Memory
Project Memory
Your Private Memory
```

Memory card types:
```textDecision
Constraint
Convention
Preference
Finding
Lesson
```

Show:
- source;
- created;
- updated;
- scope.

# 117. Memory Candidate

Uncertain candidate:
```textOdin noticed a possible project memory

“We will use PostgreSQL.”

[Save]
[Dismiss]
```

# 118. Explicit Memory

User can type:
`Remember this`

UI:
```textRemember in:
Project
Group
Private
```

Default Project when inside a Project.

# 119. Tasks

Task card:
```texttitle
owner
status
priority
due
related decision
```

Task interactions should feel compact.

# 120. Decisions

Decision card:
```textDecision #14
Use PostgreSQL
Status: Approved
Reason
Sources
Approved by
```

# 121. Chat → Task

From message More:
`Create task`

Open prefilled form:
```textTitle
Description
Assignee
Priority
Due
Project
```

Keep source message link.

# 122. Chat → Decision

Prefill:
```textTitle
Context
Options
Source
```

Default:
`Proposed`.

# 123. Meeting Mode

Meeting Mode is a first-class UI mode, not just another message command.

Header:
```text● Meeting
00:42:13
Pause
End
```

# 124. Meeting Panel

Sections:
```textLive notes
Potential decisions
Action items
Open questions
Odin suggestions
```

Candidate actions:
```textAccept
Edit
Dismiss
```

# 124A. Meeting Candidate Lifecycle (binds to backend `meeting_candidates`, §50A)

Each item under "Potential decisions," "Action items," "Open questions," etc. in the Meeting Panel is a rendering of one `meeting_candidates` row. The frontend must track and reflect the real lifecycle rather than treating candidates as ephemeral client-side suggestions that disappear on accept/dismiss.

## 124A.1 Candidate type → panel section mapping

```text
DECISION            → "Potential decisions"
TASK                 → "Action items"
OPEN_QUESTION         → "Open questions"
CONTRADICTION         → surfaced inline as a distinct visual treatment (see §125's contradiction detection), not folded into "Open questions" — a contradiction is Odin flagging that two things said conflict, which reads differently than an unresolved question
RESEARCH_NEED          → "Odin suggestions" alongside a `/research` shortcut pre-filled with the detected topic
MILESTONE_CHANGE        → surfaced as a Project Pulse-style inline note, since it affects §84/§85 (Project Pulse) rather than being an actionable card
```

## 124A.2 Candidate status → card state

```text
PENDING     → active card with Accept / Edit / Dismiss
ACCEPTED    → card collapses to a compact confirmed row; `promoted_to_type`/`promoted_to_id` (§50A) now points at the real `decisions` or `tasks` row created — clicking the row navigates to that object, not back to the transient candidate
REJECTED    → removed from the active panel; recoverable from a "Dismissed" sub-list within the same meeting session, not permanently hidden (a facilitator may want to reconsider before the meeting ends)
MERGED      → hidden from the active panel with a subtle note that it was merged into another candidate (avoids showing near-duplicate decisions/tasks separately when Odin detects the same item restated)
EXPIRED     → removed silently; this occurs only for candidates left unresolved past meeting end (see §124A.3)
```

Accepting a `DECISION` or `TASK` candidate calls the same creation flow as §121/§122 (Chat → Task / Chat → Decision), prefilled from `meeting_candidates.content`, and on success the backend sets `promoted_to_type`/`promoted_to_id` — the client must wait for this confirmation before showing the card as `ACCEPTED` rather than optimistically collapsing it, since a prefilled-form submission can still fail validation.

## 124A.3 Unresolved candidates at meeting end

When the meeting ends (§127), any candidate still `PENDING` is included in the end-of-meeting summary review (§127/§128) rather than silently expiring. Only candidates the user explicitly skips during that review transition to `EXPIRED`. This ensures nothing detected during the meeting is lost without an explicit human decision, matching the "preserves control" principle stated in backend §50.

# 125. Odin Facilitation

During Meeting Mode, Odin can:
- identify decisions;
- identify tasks;
- identify contradictions;
- suggest research;
- ask focused clarifying questions.

It must not interrupt continuously.

# 126. Meeting Start

Dialog:
> Start Meeting Mode?
>
> Odin will actively facilitate decisions, tasks, questions and contradictions.

Actions:
`Start meeting`
`Cancel`

# 127. Meeting End

Show:
```textMeeting summary
Decisions 4
Tasks 7
Questions 3
Research 2
```

Then:
`Review & Save`

# 128. Meeting Summary

Saved summary should become a Garage artifact if chosen.

# 129. AI Identity

Default:
```textOdin
AI teammate
```

Admin can rename.

UI should use the configured Group AI name everywhere.

# 130. AI Status

Use:
```textAvailable
Working
Researching
Building
Waiting for approval
Limited
Offline
```

Avoid using “thinking” to imply hidden chain-of-thought.

# 131. AI Message

Visual identity:
- AI avatar;
- AI name;
- subtle accent;
- response content;
- source/tool metadata;
- actions.

Do not use huge AI chat bubbles.

# 132. AI Working Indicator

Before text:
```textOdin is researching…
```

Examples:
```text🌐 Searching current sources…
📄 Reading project references…
✦ Building architecture…
```

These are high-level activity states, not private reasoning.

# 133. AI Tool Timeline

Long jobs can show:
```text✓ 6 sources found
✓ 3 relevant
• Synthesizing…
```

Collapse automatically after completion.

# 134. AI Streaming

Lifecycle:

```textqueued
working
streaming
completed
failed
cancelled
```

On start:
- create AI message shell immediately.

During stream:
- incremental Markdown.

After completion:
- final message;
- sources;
- artifacts/actions;
- metadata.

# 134A. Canonical AI Run/Tool State Mapping (binds to backend `ai_runs.status` and `ai_tool_calls.status`, §52/§57A)

§134's lifecycle (`queued / working / streaming / completed / failed / cancelled`) is a UI-friendly simplification. The backend's actual `ai_runs.status` enum is:

```text
QUEUED
RUNNING
WAITING_TOOL
STREAMING
COMPLETED
FAILED
CANCELLED
```

Map these directly — do not invent intermediate UI-only states that don't correspond to a real backend value, since that makes accessibility announcements (§218) and reconnect-state recovery diverge from truth:

```text
QUEUED        → "Odin is starting…" (AI avatar + subdued pulse, no content yet)
RUNNING       → "Odin is working…" (pre-tool planning, before any tool call or token)
WAITING_TOOL  → tool activity card visible (§133 AI Tool Timeline), main response area still empty or partial
STREAMING     → incremental Markdown rendering (§135)
COMPLETED     → final message, sources, artifacts, metadata (§134)
FAILED        → AI Error card (§140)
CANCELLED     → "Stopped" state, partial content preserved if backend sent any
```

`WAITING_TOOL` can recur multiple times within one run (the model may call several tools in sequence per §116's tool loop) — do not treat it as a one-time state. Each transition into `WAITING_TOOL` should surface which tool is active via the `ai_tool_calls` row (tool_name, started_at), not a generic "thinking" label.

## 134A.1 Tool call states

Each individual tool card (§133) reflects `ai_tool_calls.status`:

```text
PENDING      → tool call proposed but not yet started (usually instantaneous, may not render)
APPROVED     → only for HIGH/CRITICAL tools; see §164A — the tool call is blocked here until a human approves
EXECUTING    → active spinner/progress within the tool card
SUCCEEDED    → checkmark, collapsed summary (§133's "✓ 6 sources found" pattern)
FAILED       → tool card shows a distinct failed state, but does not necessarily fail the whole run — the model may retry with a different approach or explain the limitation in its final response
DENIED       → human rejected the required approval; tool card shows "Not approved," run continues or fails depending on whether the tool was essential
```

A tool call sitting in `APPROVED`-gated `PENDING` state is the concrete backend mechanism behind §300's "Approval UX" — a tool card can itself become an `ApprovalCard` (§164A) mid-stream when the model requests a HIGH-risk tool.

# 135. Streaming Rendering

Do not update every token with a full app rerender.

Batch deltas at a render-friendly cadence.

Only the active AI message should change continuously.

# 136. Auto-Scroll During AI

If user is near bottom:
- follow.

If not:
- never move viewport.

Show:
`Jump to latest`.

# 137. AI Cancel

While active:
`Stop`

After cancel:
- preserve partial state if backend sends it;
- mark cancelled;
- offer retry.

# 138. AI Retry

Retry creates a new run.

Do not overwrite old response.

# 139. AI Regenerate

Regenerate:
- new run;
- preserve previous response;
- if an artifact is produced, create new version rather than overwrite.

# 140. AI Error

Example:
> Odin couldn't complete this response.
>
> Provider temporarily unavailable.

Buttons:
`Retry`
`Try fallback`

# 141. AI Quota

The backend's exact error contract (§94) is:

```json
{
  "code": "APPLICATION_AI_QUOTA_EXHAUSTED",
  "can_continue_with_byok": true
}
```

The frontend must branch on `can_continue_with_byok` rather than always showing the same message:

**`can_continue_with_byok: true`** (a BYOK provider is already configured and can pick up the slack):
> Application AI quota reached for this Group.
>
> Continuing with your configured provider.

This case should ideally be near-invisible to non-admins — the run continues via BYOK per backend behavior (§94: "existing BYOK may continue if configured"), with only a subtle `Odin · BYOK` indicator (parallel to the Fallback Indicator in §142), not a blocking message.

**`can_continue_with_byok: false`** (no BYOK configured, nothing to fall back to):
> Application AI quota reached.
>
> An administrator can configure BYOK to continue.

Button: `Open AI settings` for admins only; Members/Guests see the message without the action, per the existing "frontend hides unavailable actions but backend remains the security authority" principle (§111).

Never show a generic "AI unavailable" message for this specific error code — the distinction between "quota exhausted, nothing to do" and "quota exhausted, but working via BYOK" is the difference between an outage and a non-event, and collapsing them either alarms users unnecessarily or hides an admin action they need to take.

# 142. Fallback Indicator

Subtle:
`Odin · fallback model`

No alarming notification for ordinary fallback.

# 143. Research Indicator

When web was used:
`Web research · 8 sources`

Do not show “No web” when it was not used.

# 144. Research Sources

Use:
- inline citation;
- source drawer;
- source cards.

Source card:
```texttitle
domain
retrieved
Open ↗
```

# 145. Citation Popover

Hover/focus:
```textSource title
Domain
Retrieved date
Open source
```

# 146. Research Drawer

Right surface may contain:
```textSummary
Findings
Sources
Project impact
Uncertainty
```

The original response remains in chat.

# 147. Project Impact

For current research:
> **Impact on this Project**
>
> This affects the current database decision because…

This is a signature ClanMind experience.

# 148. Deep Research Progress

Example:
```textPlanning research
Searching
Reviewing sources
Cross-checking
Synthesizing
Validating citations
```

# 149. Proactive Odin

Normal mode can receive proactive AI messages only when high-confidence/high-value.

Example:
> Odin noticed two conflicting architecture assumptions.

Button:
`Review`

# 150. Proactivity Setting

Admin:
```textOff
Low
Balanced
High
```

Default:
`Balanced`.

# 151. AI Social Behavior

Odin may address people:
> Arun, can you confirm whether this requirement is still valid?

The visual treatment is normal AI conversation with a standard mention.

# 152. AI Skills

Built-in examples:
```textWeb Research
Deep Research
Brainstorming
Planning
Decision Analysis
Task Decomposition
Diagram
Document
Data Visualization
Meeting Facilitation
GitHub Analysis
```

# 153. Skill Invocation

Users may explicitly call:
`/research`

but Odin can automatically choose skills when policy allows.

Show:
`Skill used: Deep Research`

Keep implementation terminology out of ordinary text.

# 154. Custom Skills

Group/project custom skill cards:
```textName
Description
Scope
Enabled
Required tools
Risk
```

# 155. Skill Risk

If a skill can read files or write GitHub:
show:
`High access`

Explain the consequence.

# 156. BYOK UI

Admin flow:

```textProvider
API key
Test connection
Models
Primary
Fallback 1
Fallback 2
Fallback 3
```

Never reveal saved key.

# 157. Provider Test

States:
```textTesting…
Connected
3 models found
```

Failure:
> Couldn’t authenticate. Check the provider key.

# 158. Search Provider Test

Same pattern:
```textConnecting
Searching
Results received
Ready
```

# 159. GitHub UI

Project panel:
```textConnected
owner/repo
main
last synced
pending actions
pull requests
```

# 160. GitHub Public Repo

A public repo URL can be used for read access.

The UI must never imply that a public URL grants write access.

For write capability:
`Connect GitHub`

# 161. GitHub Action Card

Example:

```textOdin wants to change GitHub

feat/auth-flow

+ auth.ts
+ routes.ts
~ README.md

Risk: High

[Review changes]
```

# 162. GitHub Diff Viewer

Must support:
- file tree;
- diff;
- additions/deletions;
- syntax highlighting;
- hunk collapse;
- copy;
- PR preview.

# 163. GitHub Approval

```textApprove this action?

Create branch
Modify 4 files
Create commit
Open PR

[Approve]
[Reject]
```

# 164. GitHub Merge

High-impact:
```textMerge pull request

This changes the connected repository.

[Cancel]
[Merge]
```

# 164A. Generalized Approval UX (binds to backend `ai_actions` / `ai_action_approvals`, §78A)

The prior draft only modeled approval cards for GitHub actions. The backend now routes **every** HIGH/CRITICAL-risk AI action — GitHub writes, bulk artifact deletion, bulk task reassignment, memory purge, and any future risky action — through one generic engine: `ai_actions` (proposal + payload + hash) and `ai_action_approvals` (the approval binding). The frontend must render a single reusable `ApprovalCard` component driven by this generic shape, with `GitHubActionCard` as one specialization of it, not a parallel implementation.

## 164A.1 What the client must display for any pending action

Every `ApprovalCard`, regardless of `action_kind`, must show:

```text
action_kind          (human-readable label, e.g. "Modify GitHub files", "Delete 12 artifacts")
risk_level           READ_ONLY / LOW / MEDIUM / HIGH / CRITICAL
payload summary       (domain-specific: diff for GitHub, list for bulk delete, etc.)
requested_by          (AI run + which user's request triggered it, if any)
created_at / expires_at
[Reject]  [Approve]
```

## 164A.2 The client never sends `approved: true`

Because approval binds to `ai_actions.payload_hash` and `ai_actions.payload_version` (§78A.1), the client's Approve action must submit the **exact `payload_hash` and `payload_version` it is currently displaying**, not a boolean. If the backend's current hash/version no longer matches what the client is holding — because the action was mutated after the card was rendered — the approval request fails and the client must re-fetch the action before allowing another attempt. Never cache an approve button as "always valid" once rendered; treat it as valid only for the payload snapshot currently on screen.

## 164A.3 Status → UI mapping

Map `ai_actions.status` (shared by every specialization, including `github_actions` via join) directly to card state:

```text
PROPOSED           → "Odin is preparing this action" (rare, usually transient)
WAITING_APPROVAL   → active approval card, Approve/Reject enabled
APPROVED           → "Approved — starting…" (brief, transitions to EXECUTING)
EXECUTING          → progress state, no Approve/Reject, optional Cancel if backend supports
SUCCEEDED          → completed card, collapsed, link to result (PR, deleted items list, etc.)
FAILED             → error card with retry-eligibility per backend response
REJECTED           → collapsed "Rejected by {name}" card, no further action
EXPIRED            → "This approval is no longer valid" — see 164A.4
```

## 164A.4 Expiry / re-approval flow

If a client attempts to approve an action whose payload has changed since the card was rendered (§78A.1's integrity check fails server-side), the backend returns the action in `EXPIRED` status. The UI must:

1. never silently retry with the old hash;
2. replace the card with: *"This action changed since you last saw it. Review the latest version before approving."*
3. offer a single action: `Review latest` — which re-fetches the current `ai_actions` row and payload, and renders a fresh `ApprovalCard` with the new hash/version.

This is the same pattern already specified for GitHub in §301 ("Approval Expiry") — §301 is now understood as one instance of this general rule, not a GitHub-specific behavior.

## 164A.5 Non-GitHub approval examples

Bulk artifact deletion:

```text
Odin wants to delete 12 outdated artifacts

Architecture v1, v2, v3 (superseded)
Old research notes (4 items)
Draft diagrams (5 items)

Risk: Medium

[Review items] [Reject] [Approve]
```

Bulk task reassignment:

```text
Odin wants to reassign 8 tasks

From: Arun (leaving project)
To: Priya

Risk: Medium

[Review tasks] [Reject] [Approve]
```

Memory purge (rare, admin-triggered typically, but AI-proposable):

```text
Odin wants to archive 6 memory entries

Reason: superseded by Decision #14

Risk: Medium

[Review entries] [Reject] [Approve]
```

Every non-GitHub approval type reuses the same `ApprovalCard` shell; only the payload-summary renderer differs per `action_kind`.

# 165. GitHub Status States

```textNot connected
Connecting
Read only
Read/write
Needs reauthorization
Disconnected
```

# 165A. Server-Controlled Feature Flags (binds to backend §166)

The backend gates several risky or evolving features behind server-controlled flags rather than hard-coding them into every client build:

```text
meeting_mode
proactive_ai
github_write
github_merge
custom_skills
deep_research
offline_sync_v2
interactive_artifacts
```

## 165A.1 Frontend responsibility

On session start (and on reconnect), the client fetches current flag state for the active Group and holds it in server-cache state (§11), not local UI preference state — flags are not something the user toggles locally. The client must not assume a flag is enabled just because the relevant UI code path exists in the build.

## 165A.2 Per-flag UI behavior when disabled

```text
meeting_mode            → Meeting Mode entry point (composer command, header button) is hidden entirely, not shown-disabled; Meeting Mode is a large enough surface that a greyed-out button inviting "why can't I click this" is worse than absence
proactive_ai              → Proactivity setting (§150) is hidden from AI Settings; Odin simply never initiates unprompted messages
github_write                → GitHub panel (§159) shows read-only status and repository info as normal, but any write-triggering affordance (approve action, "Odin wants to change GitHub" cards) never appears — reads still work per backend §76.1
github_merge                  → Same as above but narrower: branch/PR/commit actions remain available if github_write is on, but the Merge button (§164) is absent; PRs can be reviewed and left for merge outside ClanMind
custom_skills                    → "Add custom skill" affordance (§154) is hidden from Skills settings; built-in skills remain visible and usable
deep_research                      → `/research` deep-mode option and the Deep Research progress UI (§148) are unavailable; ordinary `@Odin` web search (§143) is unaffected since it is a separate capability
offline_sync_v2                      → client falls back to the baseline sync behavior already specified in §182–§186; do not attempt to use newer sync UI affordances the backend hasn't enabled
interactive_artifacts                  → the Interactive artifact type (§101) is not offered as a renderable/creatable type; any existing interactive artifact a user already has falls back to the Unsupported Artifact state (§200) if the flag is later disabled for the Group
```

## 165A.3 Flags are per-Group, not global

A flag disabled for one Group must not affect another Group the same user belongs to. Re-fetch and re-apply flag state on every Group switch (§191/§305) alongside the other Group-scoped state already specified there.

# 166. Settings Architecture

Use a two-column setting page:

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

Main content on the right.

# 167. AI Settings

Sections:
```textIdentity
Provider
Models
Fallbacks
Research
Skills
Permissions
Proactivity
```

# 168. AI Personality

Simple presets:
```textBalanced
Direct
Creative
Analytical
Custom
```

Detailed custom instructions live in a text area.

# 169. AI Permissions

Explicit controls:
```textRead shared files
Create artifacts
Edit project objects
Use web
Read GitHub
Modify GitHub
Create PR
Merge PR
```

# 170. Members

Admin:
- invite;
- role changes;
- remove;
- ownership transfer where applicable.

Member:
- personal profile;
- personal notification settings;
- own local nicknames.

# 171. Notifications

Display categories map 1:1 to backend `notifications.category` (§95/§95A) — the frontend must use these exact category identifiers when reading/writing `notification_preferences`, not a looser paraphrase:

```text
MENTION              → "Mentions"
PRIVATE_MESSAGE       → "Private"
AI_RESPONSE            → "AI"
AI_ACTION_APPROVAL     → "Approvals"
TASK_ASSIGNMENT        → "Tasks"
DECISION_APPROVAL      → "Decisions"
ARTIFACT_READY         → "Artifacts"
GITHUB_EVENT           → "GitHub"
MEETING_SUMMARY        → "Meeting"
PROACTIVE_AI           → "Odin suggestions" — kept distinct from AI_RESPONSE in settings, since proactivity (§149) is a separately tunable volume control
SYSTEM                 → "System"
```

Channels map to `notification_preferences` columns (`in_app_enabled`, `email_enabled`) plus a client-local desktop-notification toggle that is not itself a backend column — desktop push is derived client-side from `in_app_enabled` + OS permission state, since the backend only tracks in-app and email delivery intent:

```text
In-app
Desktop   (client-derived, see above)
Email
```

## 171A. Delivery state awareness

Each `notifications` row carries `delivery_state` (§95A): `PENDING / DELIVERED_REALTIME / DELIVERED_EMAIL / SUPPRESSED_BY_PREFERENCE / FAILED`. The frontend does not need to render this to ordinary users, but Sync Diagnostics (§285) and any future admin notification-debugging view should expose it verbatim rather than re-deriving a client-side guess — if a notification never arrived, `SUPPRESSED_BY_PREFERENCE` vs `FAILED` is the difference between "check your settings" and "this is a bug," and only the backend knows which.

# 172. Activity

User attention view:
- mentions;
- replies;
- reactions;
- approvals;
- task assignments;
- key AI events.

Do not put every presence event into Activity.

# 173. Notification Batching

If user is away:
combine noisy notifications.

Example:
`12 new messages. Arun, Priya and Odin mentioned you.`

# 174. OS Notifications

Only notify important events:
- mention;
- private message;
- approval request;
- task assignment;
- critical system/security item.

Do not notify every chat message by default.

# 175. Search

Global `Ctrl/Cmd+K`.

Modes:
```textMessages
Files
Artifacts
Tasks
Decisions
People
Projects
```

Results show:
- type;
- title/snippet;
- author;
- date;
- Project.

# 176. Search Privacy

Private results only appear to authorized participants.

# 177. Search Navigation

Opening a result:
1. switch Group;
2. switch Project if needed;
3. load target;
4. scroll;
5. highlight briefly.

# 178. Search Loading

Debounce query.

Cancel stale results.

Do not let old requests overwrite current results.

# 179. Empty State Rules

Every empty state explains:
1. what is empty;
2. why it matters;
3. what to do next.

Example:
> No artifacts yet.
> Ask Odin to create your first architecture or plan.

# 180. Loading Rules

Use:
- skeletons for content;
- progress for measurable work;
- status indicators for AI;
- spinners only for short actions.

Do not use one full-screen spinner for everything.

# 181. Error States

Always provide:
- what happened;
- whether work is safe;
- recovery action.

Example:
> Couldn't load this Project.
> Your local work is safe.
>
> [Retry]

# 182. Offline

The app remains useful offline.

Available:
- cached Projects;
- cached conversation;
- local artifacts;
- local files;
- local Git work;
- drafts;
- queue supported edits.

Unavailable:
- cloud AI;
- web research;
- GitHub network operations.

The UI must state this clearly without making the app look broken.

# 183. Offline Composer

When offline:
- send still works for supported messages;
- local pending bubble appears;
- status: `Queued · Offline`.

When connection returns:
- reconcile;
- mark delivered.

# 184. Pending Message

Pending message:
- normal visual weight;
- small clock/network indicator.

Failure:
`Not sent · Retry`

# 185. Sync Banner

Connected:
usually invisible.

Reconnecting:
`Reconnecting…`

Offline:
`Offline`

Syncing:
`Syncing 4 changes…`

Done:
`✓ Synced`

# 186. Sync Conflict

Show:
```textThis item changed elsewhere.

Your version
Remote version

Compare
Keep mine
Use remote
Create new version
```

Never silently overwrite.

# 186A. Sync UI Bound to Real Tables (`sync_checkpoints` / `sync_operations` / `sync_conflicts`, §20A)

§186's generic conflict card is correct at the interaction level, but the client must drive it from the concrete backend rows, not an abstract "conflict" concept.

## 186A.1 What the client persists locally, mirroring `sync_checkpoints`

Per device, per Group:

```text
last_server_sequence
last_synced_at
```

On reconnect, the client sends this checkpoint; the server returns events after `last_server_sequence` (§20.2's reconnect flow). The Sync Banner (§185) should reflect real progress against this: `Syncing 4 changes…` is derived from the count of local `sync_operations` rows still in `PENDING` status, not a generic guess.

## 186A.2 Local operation states, mirroring `sync_operations.status`

Every offline-capable write (message, task update, artifact version, etc.) the client queues locally must track:

```text
PENDING     → not yet acknowledged by server; shown as "Queued · Offline" or "Sending…" per §184
APPLIED     → server accepted and processed it; UI removes pending indicator
REJECTED    → server explicitly refused it (e.g. permission revoked while offline); show a dismissible error, do not silently drop
CONFLICT    → server detected a conflict; produces a corresponding `sync_conflicts` row — trigger §186's conflict card
```

Each queued operation carries the same `client_operation_id` used for idempotency (§19 backend) — the client must reuse the identical ID on retry, never mint a new one, or the server may (correctly, per its idempotency contract) treat a legitimate retry as a duplicate write with a different identity.

## 186A.3 Conflict types drive different copy, not one generic message

`sync_conflicts.conflict_type` (§20A) determines the specific card shown — do not render the same generic text for all three:

```text
version_mismatch     → "This was updated by someone else while you were offline."
                        (typical for tasks/decisions/settings using optimistic concurrency, §21.2)
concurrent_edit       → "You and someone else both changed this."
                        (typical for artifacts with concurrent edits, §21.3)
deleted_upstream      → "This was deleted by someone else while you were offline."
                        Offer only: [Restore mine as new] [Discard mine] — "Compare" and "Keep mine"
                        as an overwrite are not meaningful when the server-side object no longer exists.
```

For `version_mismatch` and `concurrent_edit`, the existing §186 card (Your version / Remote version / Compare / Keep mine / Use remote / Create new version) applies as written. `deleted_upstream` needs its own narrower action set as shown above.

## 186A.4 Resolution writes back through the same operation, not a new one

When the user resolves a conflict, the client updates the corresponding `sync_conflicts` row (`resolution_strategy`, `resolved_by`, `resolved_at`) rather than creating an entirely new sync flow. `resolution_strategy` values the UI can produce: `server_wins` (Use remote), `client_wins` (Keep mine), `merged` (Compare → manual merge where the artifact type supports it, §21.3), `manual` (any resolution path not covered by the first three, e.g. the `deleted_upstream` "Restore mine as new" action).

# 187. Local Project Folder

First-time:
> Connect a local folder.
>
> ClanMind will only access the folder you choose.

Tauri filesystem capabilities must remain narrowly scoped.

# 188. Local File Tree

Show:
- folder/file names;
- file type;
- modified;
- sync status.

Do not reveal unauthorized absolute paths unnecessarily.

# 189. File Sync States

The backend's authoritative file sync state (§4.3) has nine values; the icon set below must cover all of them rather than the five-state simplification alone, since collapsing states loses information the user needs during recovery:

```text
LOCAL_ONLY        ○ Local            — exists only on this machine, not yet shared
QUEUED            ⏳ Queued           — share/upload requested, not yet started (distinct from actively uploading, matters when offline)
UPLOADING         ↗ Uploading        — actively transferring to cloud
SYNCED            ✓ Synced           — local and cloud copies match
REMOTE_CHANGED    ↓ Update available — cloud version is newer than local; not yet downloaded
LOCAL_CHANGED      ↑ Local changes    — local version is newer than cloud; not yet uploaded
CONFLICT           ! Conflict          — both changed; routes to the conflict card (§186/§186A)
DELETED             ⊘ Deleted          — removed, tombstoned per retention policy
RESTORABLE          ↺ Restorable        — deleted but still within the recovery window; offers a Restore action
```

`QUEUED`, `REMOTE_CHANGED`, and `LOCAL_CHANGED` were missing from the original five-icon set and must not be silently collapsed into `UPLOADING`/`Synced`/`Local` — each represents a materially different thing the user might need to act on (queued work waiting on connectivity, an available update they haven't pulled, or local edits they haven't pushed).

Tooltips explain each state in plain language, e.g. `REMOTE_CHANGED` → "Someone updated this file. Click to get the latest version."

# 190. Drafts

Drafts persist locally per:
```textGroup
Project context
Conversation/private scope
```

Drafts are never public until sent.

# 191. Group Switching

On switch:
- restore Group's last Project;
- restore drafts;
- connect correct realtime room;
- avoid stale notification state.

# 192. Project Switching

Preserve:
- draft;
- scroll position;
- artifact state when appropriate.

Never leak Project A context into Project B visually.

# 193. Deep Links

Stable routes:
```text/group/:groupId
/group/:groupId/project/:projectId
/message/:messageId
/artifact/:artifactId
/task/:taskId
/decision/:decisionId
/meeting/:meetingId
```

# 194. Native Notifications

Request permission only when the reason is clear.

The Tauri notification plugin supports native notifications, permission checks and sending from JavaScript/Rust. citeturn935456search2turn935456search4

# 195. Window State

Remember:
- window size;
- window position;
- maximized state;
- sidebar width;
- artifact panel width;
- last Group;
- last Project.

# 196. Startup

Recommended:

```textboot
→ restore local store
→ restore session
→ render cached shell
→ connect realtime
→ sync
→ update UI
```

Do not make remote synchronization block every visible frame.

# 197. Session Expiration

Show:
> Your session expired.
> Local work is safe.

Action:
`Sign in again`

Do not discard queued local work.

# 198. Crash Recovery

After restart:
- restore drafts;
- recover pending sync operations;
- restore selected Group/Project;
- show unresolved conflicts.

# 199. Error Boundaries

Feature-level boundaries:
```textChat
Garage
Artifact
GitHub
Settings
```

If an artifact renderer fails, chat must continue working.

# 200. Unsupported Artifact

Show:
> This artifact was created by a newer ClanMind version.
>
> Update to view it.

No crash.

# 201. Performance

Targets:
- fast initial shell render;
- lazy load heavy viewers/editors;
- virtualize long message history;
- isolate AI streaming state;
- incremental artifact updates.

# 202. Chat Virtualization

Large histories:
- virtualize;
- cursor-load older messages;
- preserve anchors;
- do not scroll-jump.

# 203. AI Streaming Performance

Only active response component should change on each stream batch.

Do not rerender:
- every message;
- left navigation;
- Project state;
- full artifact tree

for every delta.

# 204. Artifact Performance

For diagrams/graphs:
- render changed nodes only;
- throttle layout;
- avoid expensive full re-layout per token;
- prefer transforms for animation;
- defer noncritical effects.

# 205. Search Performance

Debounce 200–250ms.

Cancel stale requests.

# 206. File Preview Performance

Large documents:
- lazy pages;
- thumbnails;
- visible-region rendering;
- avoid full-file decoding in memory.

# 207. UI State Matrix

Every component must explicitly support where relevant:

```textdefault
hover
focus
pressed
selected
disabled
loading
success
error
offline
permission denied
```

# 208. Composer State Matrix

```textempty
focused
typing
mention picker
command picker
attachments
uploading
ready
sending
offline
queued
failed
AI command
private mode
reply mode
```

# 209. Message State Matrix

```textnormal
hovered
focused
pending
failed
edited
deleted
mentioned
reply target
search highlighted
selected
```

# 210. AI State Matrix

UI-facing simplification (retained for component-state naming):

```textqueued
working
tool active
streaming
completed
failed
cancelled
fallback
approval pending
```

These map onto the canonical backend enums per §134A: `queued→QUEUED`, `working→RUNNING`, `tool active→WAITING_TOOL`, `streaming→STREAMING`, `completed→COMPLETED`, `failed→FAILED`, `cancelled→CANCELLED`. `fallback` and `approval pending` are UI overlays, not separate backend statuses — `fallback` is derived from AI Response Metadata showing a non-primary model was used, and `approval pending` is derived from an associated `ai_actions.status = WAITING_APPROVAL` row (§164A), not from `ai_runs.status` itself.

# 211. Artifact State Matrix

```textloading
generating
updating
ready
version switching
compare
editing
conflict
failed
deleted
restoring
```

# 212. File State Matrix

Sync-transfer states use the full nine-value set in §189 (`LOCAL_ONLY / QUEUED / UPLOADING / SYNCED / REMOTE_CHANGED / LOCAL_CHANGED / CONFLICT / DELETED / RESTORABLE`). Indexing progress (§127 backend, `INDEXING / READY / FAILED / STALE / DELETED`) is a **separate, orthogonal** state — a file can be `SYNCED` (transfer complete) while still `INDEXING` (not yet AI-context-eligible). Render both where relevant rather than collapsing them into one status chip:

```text
sync state:    local-only / queued / uploading / synced / update-available / local-changes / conflict / deleted / restorable
index state:   indexing / ready / failed / stale / deleted
```

A file card's primary icon reflects sync state; a small secondary indicator (e.g. "Preparing for Odin…" per §50) reflects index state. `STALE` (§128 backend — source changed since indexing) must show distinctly from `INDEXING`, since a stale file is usable but the AI is working from outdated content, which is a meaningfully different warning than "not ready yet."

# 213. Meeting State Matrix

```textnot started
starting
active
paused
ending
summary ready
saved
```

# 214. GitHub State Matrix

```textnot connected
connecting
read-only
read/write
action pending
approval required
executing
PR created
failed
disconnected
```

# 215. Button States

Every button:
```textdefault
hover
focus
pressed
loading
disabled
success if temporary
destructive if relevant
```

# 216. Input States

```textdefault
focused
filled
invalid
valid
disabled
read-only
loading
```

# 217. Accessibility of Realtime

When new messages arrive while user reads older content:
- do not steal focus;
- do not auto-scroll;
- announce only meaningful aggregate state.

Example:
`3 new messages`.

# 218. Accessibility of AI Streaming

Announce:
- Odin started;
- Odin completed;
- Odin failed.

Do not announce every token.

# 219. Accessibility of Artifact Animation

Animation is supplemental.

Text state:
`Odin is building the architecture.`

Completion:
`Architecture ready.`

# 220. Accessibility of Drag/Resize

Panel resize must also have a non-drag mechanism or equivalent keyboard-accessible control.

WCAG 2.2 specifically addresses dragging movements. citeturn935456search3

# 221. Minimum Pointer Target

Target at least 24×24 CSS px for pointer controls as a floor, with core controls closer to 32–40px for comfortable desktop use. WCAG 2.2 specifies a 24×24 minimum under its AA target-size criterion with exceptions. citeturn935456search3

# 222. Contrast

Normal text must retain appropriate contrast. WCAG 2.2 AA uses 4.5:1 for normal text and 3:1 for large text. Spectral effects cannot be the only contrast/signifier. citeturn935456search5

# 223. Motion and Brand

The strongest ClanMind brand behavior is:

```textidle
→ calm

Odin starts work
→ subtle spectral activity

Artifact forms
→ visible construction

Work completes
→ calm again
```

This contrast is the visual identity.

# 224. Message Copy Principles

Use concise human copy.

Good:
- `Copied`
- `Saved`
- `Invite sent`
- `Odin is researching…`
- `Architecture ready`
- `3 changes syncing`

Avoid:
- corporate filler;
- AI hype;
- technical errors with no explanation.

# 225. Error Copy

Format:

`What happened → what is safe → next action`

Example:
> Couldn't sync this change.
> Your local version is safe.
> Review the conflict to continue.

# 226. Success Copy

Keep it short:
```textCopied.
Saved.
Connected.
Invite sent.
Artifact pinned.
```

# 227. Confirmation Policy

Confirm:
- destructive;
- external-impact;
- security-sensitive;
- ownership changes.

Do not confirm:
- copy;
- reaction;
- opening panels.

# 228. Group Deletion

Danger zone:
```textDelete Group
```

Explain recovery window and permanent deletion.

# 229. Ownership Transfer

Dialog:
```textTransfer ownership
New owner: Arun

You will become Admin.

[Cancel]
[Transfer]
```

# 230. Member Removal

Dialog:
> Remove Arun from this Group?
>
> They will lose access immediately. Shared contributions remain with the Group.

# 231. GitHub Disconnect

Explain:
> ClanMind will stop repository actions. Existing project history remains.

# 232. BYOK Key Removal

Explain:
> Odin will no longer use this provider configuration.

Never reveal raw key.

# 233. Search No Results

> No matches.
>
> Try a shorter phrase or another filter.

# 234. Mention No Results

> No teammate found.

# 235. Command No Results

> No commands found.

# 236. File Upload Error

> Couldn't add this file.
>
> Try again or choose another file.

# 237. Local Folder Error

> This folder is no longer available.
>
> Choose it again.

# 238. Offline GitHub

> GitHub requires an internet connection. Your local project is still available.

# 239. Offline AI

> Odin isn't available offline. You can continue local work and send requests when connected.

# 240. Message Copy Detail

Copy action must:
- work with selection;
- preserve Markdown/code;
- not steal composer focus;
- announce success accessibly.

# 241. Message Send Detail

Sending should:
1. create `client_message_id`;
2. optimistic insert;
3. queue operation;
4. send over API/realtime channel;
5. reconcile server ID/sequence;
6. mark delivered.

# 242. Duplicate Send Protection

Disable/dedupe only the individual pending operation. Do not lock the entire composer for long AI/backend delays.

# 243. Reaction Optimism

Optimistic reaction:
- instant local visual;
- server confirmation;
- rollback if rejected.

# 244. Edit Optimism

Optimistic text may show immediately with a pending state if backend contract allows.

# 245. Message Failure

Never discard a failed message.

Show:
`Not sent · Retry`

Keep text.

# 246. Search Result Highlight

Highlight matching text subtly and preserve readability.

# 247. Unread Search Jump

When a notification points to a message:
- deep link;
- load;
- scroll;
- highlight.

# 248. Right Panel Transition

Open:
- width expansion;
- subtle content fade/slide.

Close:
- panel contracts;
- chat recovers width.

Do not reflow violently.

# 249. Panel Resizing

User can resize with divider.

Store preference locally.

Do not let width become too small to be useful or so large that chat is unusable.

# 250. Artifact Panel Priority

If both thread and artifact are requested:
- use a single primary right surface;
- support tabs/stacking;
- avoid many overlapping panels.

# 251. Multiple Artifacts

Most recent artifact becomes active.

Previously created artifacts stay available in:
- tabs;
- recent;
- Garage.

# 252. Artifact Auto-Open

Automatically open only when:
- user explicitly requested a substantial output;
- backend identifies a primary artifact.

Do not automatically open for trivial responses.

# 253. Artifact Focus

Do not steal keyboard focus from the composer if the user is actively typing.

If artifact creation was explicitly requested from chat, focus may move to the artifact after submission.

# 254. Artifact Export

Possible:
- Markdown;
- SVG;
- PNG;
- PDF;
- JSON;
- source.

Only show supported exports.

# 255. Artifact Share

Default is within the appropriate Group/Project visibility scope.

Never accidentally make artifacts public on the web.

# 256. Artifact Trash

Delete:
- soft delete;
- undo;
- admin recovery;
- later permanent deletion.

# 257. Pinned Garage

Pinned items appear first.

Pin state is visible in card/list.

# 258. Project Snapshots

Snapshot card:

```textArchitecture finalized
Aug 22 · 11:42

Decisions 4
Tasks 8
Artifacts 5
Git commit abc123

View snapshot
```

# 259. Snapshot Compare

Allow:
```textCurrent vs Snapshot
```

Highlight:
- decisions;
- tasks;
- artifacts;
- summary;
- Git reference.

# 260. Context Inspector

Use human-readable provenance:

```textUsed Project context
Used Decision #14
Used requirements.pdf
Used Architecture v3
Used 8 web sources
```

# 261. AI Chain-of-Thought Boundary

Do not build a UI to reveal hidden chain-of-thought.

The useful transparency is:
- sources;
- tool calls;
- context references;
- approvals;
- outputs.

# 262. AI Social Tone

Odin can call people by name and mention them.

The UI should not artificially label:
`Odin is pretending to be human`.

Instead:
`Odin · AI teammate` can be visible in profile/detail views.

# 263. Meeting Mode Proactivity

Odin may speak unprompted only when:
- meeting is active;
- high-value issue detected;
- confidence is high;
- cooldown allows it.

# 264. Normal Mode Proactivity

Keep lower than Meeting Mode.

Example:
> I noticed these two requirements conflict.

# 265. Project Chat Focus

When Project filter is active:
- show Project context;
- scope task/decision/artifact creation to Project.

# 266. Group Chat

Group-level conversation supports:
- cross-project planning;
- announcements;
- broad discussion.

# 267. Context Chip

Composer:
`Project: Flight Controller`

If none:
`Group chat`

# 268. Context Switch

Switching Project:
- do not destroy drafts;
- preserve local state;
- change default AI scope;
- refresh project-specific side surfaces.

# 269. Project-specific Artifact

Created artifacts default to current Project unless request targets another Project.

# 270. Project-specific Task

Same.

# 271. Project-specific Decision

Same.

# 272. User Profile

Global:
- name;
- email;
- avatar.

Group:
- nickname maps;
- role;
- Group presentation.

# 273. AI Profile

Show:
```textOdin
AI teammate
skills
current configuration where allowed
```

# 274. Group Avatar

Upload or generated initials.

# 275. AI Avatar

Default ClanMind identity; admin-customizable per Group.

# 276. Notification Preferences

Do not require all channels to be enabled globally.

Each category can use:
- in-app;
- desktop;
- email.

# 277. Notification Read State

Unread:
- subtle badge;
- Activity count.

Mark read only when actually viewed if appropriate.

# 278. Desktop Notification Privacy

Allow user to hide message content in OS notification previews.

# 279. Settings Dirty State

Show unsaved indicator only when something meaningful is pending.

# 280. Save Pattern

Prefer section-level save for:
- AI configuration;
- GitHub;
- permissions.

Auto-save for:
- simple preferences where safe.

# 281. Group Settings Appearance

Allow Group avatar and limited visual accent but preserve ClanMind design discipline.

# 282. Danger Zone

Separate visually and structurally from normal settings.

# 283. Local Cache

Namespaced by account and Group.

Never use generic global keys.

# 284. Account Isolation

When switching accounts:
- never reuse cached data;
- clear/re-key account scope;
- ensure private drafts cannot cross accounts.

# 285. Sync Diagnostics

Advanced settings can show:
```textConnection
Protocol version
Last sequence
Last sync
Pending operations
Conflicts
```

# 286. Error Boundary

Global catastrophic screen:
> ClanMind encountered an unexpected problem.
>
> Local drafts are preserved.

Actions:
`Restart`
`Copy diagnostics`

# 287. Diagnostics Privacy

Diagnostics must not include:
- API keys;
- raw private conversations;
- secrets.

# 288. Performance Budget

Core interactions must remain fast.

Priorities:
1. composer typing;
2. scrolling;
3. switching views;
4. message arrival;
5. AI streaming;
6. artifact animation.

No animation is allowed to cause typing lag.

# 289. Chat Virtualization

Long histories use virtualization with:
- stable keys;
- preserved scroll anchors;
- older-message cursor loading;
- thread navigation support.

# 290. Large Artifact Performance

Use renderer appropriate to type:
- DOM for docs;
- SVG/canvas for diagrams;
- specialized editor for code;
- isolated HTML/React renderer for supported interactive artifacts.

# 291. Artifact Renderer Isolation

Unsupported or broken artifact:
> This artifact cannot be rendered in this version.
>
> View raw/export/update.

The rest of ClanMind continues working.

# 292. Security

Frontend must never:
- trust URL parameters as authorization;
- render arbitrary unsanitized AI HTML;
- store BYOK secrets;
- execute arbitrary artifact code with Tauri privileges;
- expose filesystem access broadly.

# 293. Interactive Artifact Isolation

Interactive artifacts must not automatically receive:
- Tauri filesystem permissions;
- auth tokens;
- Group secrets;
- GitHub credentials.

Any data bridge must be explicit and sandboxed.

# 294. Tauri Capabilities

Limit native permissions to:
- selected filesystem;
- notifications;
- required window/update capabilities.

Do not grant broad shell access.

# 295. External Links

Open external URLs through controlled mechanisms.

Do not execute arbitrary shell commands based on URL content.

# 296. Markdown Safety

Use a safe renderer and sanitize untrusted content.

# 297. Web Research Preview Safety

Source previews must not execute arbitrary remote scripts.

# 298. Local Git Safety

Never silently:
- delete local files;
- reset working tree;
- overwrite changes.

Any destructive local Git operation needs explicit user intent.

# 299. GitHub Diff Preview

Before approval:
- show exact files;
- base branch;
- target branch;
- additions/deletions;
- high-level risk.

# 300. Approval UX

Approval card should be visually stronger than ordinary AI prose but not a scary red alert unless destructive.

# 301. Approval Expiry

If backend invalidates approval:
> This approval request is no longer valid. Review the latest version.

# 302. Permission Denied

Use:
> Only Owners and Admins can change Group AI settings.

Do not show internal policy codes.

# 303. Guest UX

Guest sees a clean restricted navigation, not a sea of disabled controls.

# 304. Search Scope

Current Project → Project search.

Group view → Group search.

Global search → Group/account scopes according to product policy.

# 305. Group Switch

Store last active Project per Group locally.

# 306. Project Switch

Store:
- scroll position;
- panel state;
- draft.

# 307. Multi-window Future Readiness

The state architecture should not rely on one browser tab being the only client. Avoid singleton assumptions in local synchronization.

# 308. Startup Sequence

```textboot
local persistence
session restore
cached shell render
Group/Project restore
realtime connect
sync
live updates
```

# 309. Update Flow

Native desktop update should:
- download securely;
- notify;
- avoid interrupting active meetings;
- restart cleanly;
- preserve local state.

# 309A. Protocol Version Mismatch (binds to backend §165)

The backend exposes `minimum_client_version`, `recommended_client_version`, and `protocol_version` on connect. The frontend must check this on every connection attempt, not just at cold start, since a long-running desktop session can become outdated while open.

## 309A.1 Recommended-but-not-required update

If the running client is below `recommended_client_version` but at/above `minimum_client_version`:

```text
A newer version of ClanMind is available.

[Update now]   [Later]
```

Non-blocking. Dismissible. Reappears at most once per session, not on every reconnect.

## 309A.2 Required update (`CLIENT_UPDATE_REQUIRED`)

If the backend rejects the connection with `CLIENT_UPDATE_REQUIRED` (client below `minimum_client_version`, or `protocol_version` no longer supported):

```text
ClanMind needs an update to continue.

Your team has moved to a newer version of ClanMind.
Local drafts and cached data are safe.

[Update now]
```

This is a blocking, full-screen state — realtime features cannot function against an incompatible protocol. The client must **not** silently retry the same connection with the same protocol version in a loop; it should stop attempting realtime connection until the update completes, while still allowing read access to already-cached local state (offline-equivalent behavior per §182) so the user isn't fully locked out of their own local drafts and files.

## 309A.3 Never guess protocol compatibility client-side

Do not attempt to infer "my version is probably fine" from version-number comparison alone as a substitute for the server's explicit response — always let the server's connect response (or explicit `CLIENT_UPDATE_REQUIRED` error) be authoritative, since the server may need to reject a specific version for reasons not visible from version numbers alone (e.g. a security-relevant client bug).

# 310. Design System Components

Foundational:
```textButton
IconButton
Input
Textarea
Select
Checkbox
Switch
Tabs
Badge
Avatar
Tooltip
Popover
Dialog
Dropdown
ContextMenu
Toast
Progress
Skeleton
ScrollArea
CommandPalette
```

Product-specific:
```textAppShell
GroupSwitcher
ProjectSwitcher
MemberList
MessageList
MessageRow
MessageActions
ReactionPicker
ThreadPanel
Composer
AttachmentTray
MentionPicker
CommandMenu
AIMessage
AIStatus
Citation
SourceCard
ArtifactPanel
ArtifactToolbar
ArtifactVersionMenu
GarageCard
TaskCard
DecisionCard
MeetingPanel
GitHubActionCard
SyncIndicator
```

# 311. Component Rule

Every component:
- receives typed props;
- has defined states;
- supports accessibility;
- does not own unrelated domain logic;
- does not call raw APIs;
- has tests for its critical interaction.

# 312. Visual QA

Screens that require visual regression:
- login;
- create Group;
- onboarding demo;
- main chat;
- composer;
- mention picker;
- private chat;
- AI streaming;
- research;
- artifact;
- Garage;
- meeting;
- settings;
- GitHub approval.

# 313. Keyboard QA

Test end-to-end:
- create Group;
- send message;
- mention;
- reply;
- open command palette;
- switch Project;
- open artifact;
- approve GitHub;
- close dialogs.

# 314. Reduced Motion QA

Test:
- onboarding;
- artifact creation;
- panel transitions;
- reactions;
- progress;
- streaming indicators.

# 315. Offline QA

Test:
- open cached Project;
- type draft;
- send message;
- queue;
- disconnect;
- reconnect;
- sync;
- conflict.

# 316. AI QA

Test:
- Assist;
- Facilitate;
- Act;
- public AI;
- private AI;
- fallback;
- web search;
- citations;
- tool status;
- artifact output;
- quota exhaustion.

# 317. Permission QA

Test:
- Owner;
- Admin;
- Member;
- Guest;
- removed user;
- private conversation;
- protected GitHub action.

# 318. Performance QA

Test:
- 10k+ historical messages;
- long AI response;
- large artifact;
- many presence events;
- rapid reactions;
- multiple concurrent uploads.

# 319. Product-specific UX Review

Before declaring a component finished, ask:

```textDoes the user know where they are?
Does the user know what changed?
Can the user undo/recover?
Can the user understand why an action is unavailable?
Can they continue working offline?
Does this work from keyboard?
Does the animation help?
Does the screen remain calm?
```

# 320. Main Chat Acceptance Checklist

```text[ ] Group/project context visible
[ ] Search works
[ ] Presence works
[ ] Typing works
[ ] Message grouping works
[ ] Hover actions work
[ ] Copy works
[ ] Reactions work
[ ] Threads work
[ ] Mentions work
[ ] Attachments work
[ ] Composer auto-grows
[ ] Enter/Shift+Enter correct
[ ] Send remains anchored
[ ] Draft persists
[ ] Offline send queues
[ ] Streaming works
[ ] Scroll-follow is intelligent
[ ] New-message button works
[ ] Errors recover
```

# 321. Artifact Acceptance Checklist

```text[ ] Right panel opens naturally
[ ] Chat does not jump
[ ] Artifact streams
[ ] Node/edge animation works
[ ] Spectral accent is restrained
[ ] Completion settles
[ ] Versions work
[ ] Compare works
[ ] Restore works
[ ] Pin works
[ ] Permissions work
[ ] Comments/selection work where supported
[ ] Export works
[ ] Reduced motion works
```

# 322. Onboarding Acceptance Checklist

```text[ ] Create Group
[ ] Join Group
[ ] Group identity
[ ] Invite
[ ] Odin intro
[ ] AI customization
[ ] Potential demo
[ ] Project creation
[ ] Reference upload
[ ] GitHub optional
[ ] Skip paths
[ ] First chat
```

# 323. Settings Acceptance Checklist

```text[ ] Members
[ ] Roles
[ ] Ownership
[ ] AI identity
[ ] Provider
[ ] BYOK
[ ] Model/fallback
[ ] Research
[ ] Skills
[ ] Permissions
[ ] GitHub
[ ] Notifications
[ ] Usage
[ ] Security
[ ] Danger zone
```

# 324. Backend Contract Checklist

Frontend must understand:

```text[ ] REST response schemas
[ ] WebSocket event schemas
[ ] protocol version + CLIENT_UPDATE_REQUIRED handling (§309A)
[ ] server sequence
[ ] client operation ID (reused verbatim on retry, never re-minted, §186A.2)
[ ] sync_checkpoints / sync_operations / sync_conflicts shapes (§186A)
[ ] AI run states — exact enum QUEUED/RUNNING/WAITING_TOOL/STREAMING/COMPLETED/FAILED/CANCELLED (§134A)
[ ] AI tool call states — exact enum incl. APPROVED gating (§134A.1)
[ ] artifact events
[ ] generic ai_actions/ai_action_approvals lifecycle, not just GitHub (§164A)
[ ] GitHub action states (joined through ai_actions, §78A.2)
[ ] meeting_candidates lifecycle incl. promoted_to_type/id (§124A)
[ ] memory candidate states
[ ] notification category set + delivery_state (§171/§171A)
[ ] server-controlled feature flags per Group (§165A)
[ ] file sync state — full nine-value enum, not the five-icon simplification (§189)
[ ] AI quota error contract incl. can_continue_with_byok (§141)
[ ] notification deep links
[ ] permissions
```

# 325. Do Not Ship These UX Mistakes

1. Do not make ClanMind visually identical to Slack.
2. Do not make every AI response a large colored card.
3. Do not make the rainbow permanent.
4. Do not animate every message.
5. Do not expose chain-of-thought.
6. Do not move scroll position while the user reads.
7. Do not discard failed messages.
8. Do not hide important controls behind hover alone.
9. Do not let one broken artifact break chat.
10. Do not trust frontend permissions.
11. Do not store BYOK secrets locally.
12. Do not require the user to configure everything before the first conversation.
13. Do not show twenty onboarding steps.
14. Do not make Meeting Mode a separate application.
15. Do not use a universal spinner for all asynchronous work.
16. Do not force drag-only interactions.
17. Do not sacrifice contrast for aesthetics.
18. Do not make the composer feel cramped.
19. Do not make the right panel permanent if there is no meaningful content.
20. Do not turn Project Pulse into a cluttered dashboard.

# 326. The ClanMind Feeling

The intended emotional sequence:

```textCalm
  ↓
Team starts talking
  ↓
Odin appears when needed
  ↓
Current research arrives
  ↓
Work surface expands
  ↓
Artifact forms visibly
  ↓
Team reacts and decides
  ↓
Tasks appear
  ↓
Approved work moves toward GitHub
  ↓
Project memory is updated
  ↓
UI becomes calm again
```

The interface should communicate:

> **We're working together, and Odin helps us move.**

Not:

> Look at all the AI features.

# 327. Reference Set

Primary/current references:

## Claude
- Claude Artifacts: https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them
- Claude visual and interactive content: https://support.claude.com/en/articles/13641943-visual-and-interactive-content

Claude validates the dedicated artifact surface, substantial reusable outputs, editing/versioning and visual/interactive content. citeturn435211search0turn435211search6

## Slack
- Messaging: https://slack.com/help/articles/201457107-Send-and-read-messages
- Mentions: https://slack.com/help/articles/205240127-Use-mentions-in-Slack
- Reactions: https://slack.com/help/articles/202931348-Use-emoji-and-reactions
- Canvas: https://slack.com/help/articles/203950418-Use-a-canvas-in-Slack
- Canvas product: https://slack.com/features/canvas
- Canvas accessibility: https://slack.com/help/articles/15680435184531-Canvas-accessibility
- Redesigned Slack: https://slack.com/blog/productivity/a-redesigned-slack-built-for-focus

These inform proven collaboration patterns around message composition, mentions, reactions, activity/attention, shared canvases and keyboard navigation. citeturn435211search1turn435211search2turn435211search3turn435211search4turn435211search5turn435211search8turn435211search11

## Linear
- Command menu: https://linear.app/changelog/2019-12-18-new-command-menu

Use as a reference for contextual command discovery, not as a visual clone. citeturn435211search10

## Accessibility
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Understanding WCAG 2.2: https://www.w3.org/WAI/WCAG22/understanding/

## Accessible React primitives
- Radix: https://www.radix-ui.com/primitives
- Popover: https://www.radix-ui.com/primitives/docs/components/popover
- Dialog: https://www.radix-ui.com/primitives/docs/components/dialog
- Tooltip: https://www.radix-ui.com/primitives/docs/components/tooltip
- Toast: https://www.radix-ui.com/primitives/docs/components/toast

## Tauri
- Tauri: https://v2.tauri.app/
- Notifications: https://v2.tauri.app/plugin/notification/
- Notification reference: https://v2.tauri.app/reference/javascript/notification/
- Filesystem: https://v2.tauri.app/plugin/file-system/

# 328. Frontend Agent Instructions

The implementing AI agent must:

1. Read `ClanMind Backend.md` first.
2. Treat this document as the frontend UX/interaction authority.
3. Preserve `Account → Group → Project` and never invent Workspace hierarchy.
4. Treat Odin as one Group-level shared AI.
5. Use a unified message model with Group/Project context.
6. Preserve private-message isolation in all local state.
7. Use typed REST and WebSocket contracts.
8. Respect server sequence/idempotency.
9. Never trust frontend permission state as security.
10. Keep application AI/BYOK settings out of ordinary member UI.
11. Build the composer as a first-class component.
12. Make copy, attachment, reply, reaction, mention and send behaviors polished.
13. Implement intelligent AI streaming and scroll behavior.
14. Make the right work surface contextual.
15. Make Live Artifacts visually impressive but restrained.
16. Preserve artifact versions.
17. Implement Meeting Mode as a first-class state.
18. Support offline and conflict states.
19. Use the design token system.
20. Use spectral colors sparingly.
21. Respect reduced motion.
22. Build accessibility into primitives.
23. Never expose hidden chain-of-thought.
24. Expose provenance, tools and sources instead.
25. Never embed untrusted arbitrary HTML/scripts without isolation.
26. Never grant artifacts raw Tauri privileges.
27. Never store BYOK keys in the client.
28. Ensure every meaningful async operation has loading/error/recovery behavior.
29. Ensure every screen has empty/loading/error/offline/permission-aware states where relevant.
30. Preserve drafts.
31. Protect local work during session/network failures.
32. Do not allow one feature failure to crash the entire app.
33. Do not create duplicate backend concepts when a frontend view can reuse the existing model.
34. Prefer calm UI over decorative complexity.
35. Make the product feel fast even when AI/network work is slow.
36. Test real keyboard flows.
37. Test real reconnect/offline flows.
38. Test real visual states.
39. Do not call the frontend complete because the happy-path screenshot looks good.
40. The final quality bar is: **the whole product feels coherent when a real team uses it for hours.**

# 329. Final Frontend Goal

The frontend succeeds when a user can open ClanMind and immediately understand:

```textWhere the team is
What project they're working on
What everyone is discussing
What Odin is doing
What the team decided
What artifacts exist
What needs attention
What work is approved
What happens next
```

The interface should not require users to think about the implementation.

It should make them think:

> **We're working.**
