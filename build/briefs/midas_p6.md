You are Midas continuing ClanMind frontend P6 (artifacts/Garage). Authority: "ClanMind_Frontend_Master_Implementation_Specification.md" at repo root. Read every cited section before coding.

STATE HANDOFF: P0-P5 committed green (120 tests). Right work surface + sheet/docked modes exist from P2; dispatch.ts carries artifact.event flow; useArtifactStore exists.

P6 SCOPE - FE spec sections 87-111 + 250-257 + BE contract sections 44-46/74-75:
1. Artifact panel open/close behavior (95): expand right surface, preserve chat scroll, animate width, restore focus.
2. Live artifact creation (97-99): progressive node/section arrival per artifact.created/node/edge events, spectral edge draws once then settles (99), completion glow once (100).
3. Diagram rendering with @xyflow/react from {nodes,edges} content (BE 74 schema), zoom controls (105), selection -> Ask Odin about this (106-107), fullscreen Esc exit (104).
4. Document/Markdown artifacts renderer + code blocks with copy (27).
5. Chart artifacts via recharts.
6. Versions (102): vN selector, creator/timestamp/run info, View/Compare/Restore actions; compare per type (103); restore wired to POST restore endpoint shape.
7. Header (96): name, Type . vN, Pin, Version menu, More; presence line optional.
8. Garage page (87-90): All/Artifacts/Files/Research/Pinned/Recent sections; grid+list views with local preference; cards show preview/title/type/creator/updated/version/pin.
9. Unsupported artifact state (200): update-to-view message, no crash; renderer isolation (291) so broken renderers never take down chat.
10. Export menu (254): Markdown/SVG/PNG/PDF/JSON only where supported.
Wire to REAL endpoints via api client where defined (GET/POST /projects/:id/artifacts etc per integration report D-notes); demo transportRoutes get parity handlers.

VERIFY LOOP until green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep clean. Lazy-load heavy viewers/deps (201). Self-review diff vs all cited sections + 325 list; fix findings. Report sections covered, files changed, verification verbatim, checklist items passing, SPEC-SILENT / NOT VERIFIED honestly.
Do NOT start P7. Do NOT touch clanmind-backend/.
