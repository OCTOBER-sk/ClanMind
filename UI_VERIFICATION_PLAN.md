# ClanMind — Complete UI/UX Verification Plan
## Every Feature, Every Screen, Real Proof

> **Goal**: Screenshot and verify EVERY working feature in the ClanMind frontend with real data.

---

## Screens to Verify (20+ screens)

### Chat System (8 verifications)
1. **Message list** — All 13 messages visible with proper formatting
2. **Message actions** — Copy, Reply, React, Forward, Pin, Delete buttons under each msg
3. **Reaction emojis** — WhatsApp-style emoji picker, reaction display under messages
4. **@mention autocomplete** — Type @ → see team members + AI
5. **Slash commands** — Type / → see command list (Ask AI, Private, Research, etc.)
6. **Composer** — Multi-line input, attachments, send button
7. **Thread panel** — Reply thread view
8. **Private mode** — 🔒 Private with AI/user indicator

### Artifacts (8+ types)
9. **Artifact side panel** — Right panel showing artifact content
10. **Document viewer** — Markdown rendering with proper typography
11. **Diagram viewer** — SVG/Mermaid diagram with zoom/pan
12. **Table viewer** — Sortable columns, sticky headers
13. **Chart viewer** — Chart rendering with legends
14. **Code viewer** — Syntax highlighting, line numbers, copy
15. **Artifact comparison** — Side-by-side diff view
16. **Spectral flow animation** — Rainbow gradient during artifact construction
17. **Artifact export** — Export as PNG/SVG/PDF/MD

### Garage (3 verifications)
18. **Garage view** — Grid/list toggle, tabs (All, Artifacts, Files, Research, Pinned, Recent)
19. **File tree** — Hierarchical file browser
20. **Connect folder** — Folder connection UI

### Tasks (2 verifications)
21. **Tasks view** — Task list with status filters
22. **Task card** — Title, status badge, assignee, priority, due date

### Decisions (1 verification)
23. **Decisions view** — Decision log with options, rationale

### Memory (1 verification)
24. **Memory view** — AI memory management

### Notifications (2 verifications)
25. **Notification center** — Notification list with read/unread
26. **Activity view** — Full activity feed with filters

### Settings (3 verifications)
27. **Account settings** — Profile management
28. **AI settings** — BYOK configuration, model selection, provider keys
29. **Appearance settings** — Theme, display preferences

### Project (2 verifications)
30. **Project overview** — Members, AI identity, quick actions
31. **Project empty state** — "Nothing is built yet" with CTAs

### Team (1 verification)
32. **Team view** — Members list with roles

### Meetings (1 verification)
33. **Meeting panel** — Start/stop/join meeting

### Sync (1 verification)
34. **Sync banner** — Connection status indicator

---

## Execution Strategy

1. Login as Santhosh
2. Navigate to group chat with real messages
3. Screenshot every screen with real data
4. For features that need interaction (reactions, mentions, etc.), perform the action and screenshot
5. Generate one comprehensive PDF with all screenshots

---

## Success Criteria

- [ ] All 34 screenshots captured
- [ ] Every screenshot shows real data (not empty states where data exists)
- [ ] Message actions visible (copy, reply, react, forward)
- [ ] Reaction emojis working
- [ ] @mention autocomplete working
- [ ] Slash commands working
- [ ] Artifact viewer showing content
- [ ] Garage showing tabs and controls
- [ ] Tasks showing task cards
- [ ] Settings showing AI configuration
- [ ] Notifications showing items
