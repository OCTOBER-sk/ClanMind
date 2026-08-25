You are Midas continuing ClanMind frontend P13 (accessibility pass). Authority files - BOTH are binding: "ClanMind_Frontend_Master_Implementation_Specification.md" AND "ClanMind Backend — Master Implementation Specification.md" at repo root.

STATE HANDOFF: P0-P12 committed green (400 tests). The app has focus-ring utilities, aria labels on most interactive elements, reduced-motion CSS (s314), skip-target patterns partially. INTEGRATION_NOTES.md ledger D1-D26; append D27.

P13 SCOPE - grep FE spec for accessibility sections (s311-315 area: keyboard navigation, focus management, ARIA, screen reader, contrast, reduced motion) and read fully. Then audit-and-fix the WHOLE app:
1. Keyboard navigation: full tab order through every surface (composer, chat list, artifact panel, dialogs, settings), no traps, Escape closes overlays per spec.
2. Focus management: dialog open/close focus restore, route-change focus target.
3. ARIA: roles/labels on all interactive elements, aria-live regions for toasts/streaming status (s219), expanded/collapsed states.
4. Contrast: verify text tokens meet WCAG AA in both themes.
5. Reduced motion: spectral/animations fully disabled under prefers-reduced-motion everywhere.
6. Tests: add a11y assertions for key surfaces (roles, labels, live regions, escape behavior).
RULES (hard): no skipped/weakened tests; fix real issues only - do not restyle working UI; spec is authority. VERIFY LOOP until green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep clean. Report findings fixed per category, verification verbatim, anything SPEC-SILENT honestly. Do NOT start P14. Do NOT touch clanmind-backend/.