You are Midas continuing ClanMind frontend P4 (uploads/attachments). Authority: "ClanMind_Frontend_Master_Implementation_Specification.md" at repo root. Read every cited section before coding.

STATE HANDOFF: P0-P3 committed green (81 tests). Live mode wired; demo mode behind compile gate.

P4 SCOPE - FE spec sections 47-53 + backend attachment contract (BE spec sections 43, 81-84 for shapes only):
1. Attachment button (47): tooltip "Attach files", native picker, multi-select.
2. Attachment chips (48): icon/filename/size/remove; states selected/uploading/uploaded/failed/cancelled.
3. Image preview (49): small thumbnail + filename, no huge cards.
4. Upload progress (50): "requirements.pdf . 64%", Cancel allowed, then Uploaded / "Uploaded . Preparing for Odin..." indexing state per BE 127.
5. Failure (51): "Couldn't upload this file." + Retry/Remove, never silently drop.
6. Drag & drop (52): composer overlay "Drop files to attach", never drag-only (keyboard alternative).
7. Paste behavior (53): text->text, image->attachment, URL->text, never auto-send.
Wire to the real REST path where the backend defines it (POST attachment upload -> attach to message); demo transportRoutes get equivalent demo handlers. Respect BE section 178 limits (25MB/file, 10/message) surfaced from config/errors not hardcoded.

VERIFY LOOP until green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep. Self-review diff vs sections 47-53 + 236 + 3316-era copy rules; fix findings. Report sections covered, files changed, verification verbatim, checklist items passing, SPEC-SILENT / NOT VERIFIED honestly.
Do NOT start P5. Do NOT touch clanmind-backend/.
