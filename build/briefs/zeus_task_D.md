Agent: zeus - Backend remediation Task D of H (handoff HANDOFF_BACKEND.md section 3.D)
Repo workdir: clanmind-backend/. Sources: HANDOFF_BACKEND.md section 3.D; spec sections 114 (WebSocket protocol), 12 (message features).

CONTEXT: Tasks A, B1-B3, C done. group-room.ts is the Durable Object room (apps/worker/src/realtime/). MessageService lives in packages/domain messages/message.service.ts. utils.ts test harness already exposes outboxEvents array for assertions.

DELIVERABLES:
1. packages/domain messages/message.service.ts: inject optional EventOutbox into MessageService constructor; edit() publishes message.edited event, softDelete() publishes message.deleted; payload per handoff: {message_id, visibility, private_conversation_id, project_id, group_id}. Update apps/worker/test/utils.ts construction arg accordingly (keep old tests green - outbox is optional).
2. apps/worker/src/realtime/group-room.ts DO handles remaining spec-114 client types by building its own repos from env following the handleConnect db-client pattern already in the file:
   - message.send -> SupabaseMessageRepository(env db).createWithMentions + reply frame with persisted message (outbox event flows through broadcaster)
   - message.edit / message.delete -> service edit/softDelete with revision record
   - message.react -> engagement repos upsert/delete + broadcast reaction.updated envelope (spec name reaction.updated exactly)
   - sync.ack -> ack frame only
   - meeting.start / meeting.end -> build SupabaseMeetingRepository + MeetingService, persist session, broadcast meeting.started / meeting.ended
   - artifact.interaction -> echo as artifact.event broadcast
   - ai.run / ai.cancel over WS: choose ONE - either wire buildAiRuntime inside the DO or respond error frame code NOT_AVAILABLE_ON_WS pointing clients to REST. Document your choice in a comment AND in your final report. REST is spec-canonical persistence path per spec 105.
3. Tests: worker test covering message.send via DO produces persisted message + outbox message.created; edit/delete produce revisions + outbox events; react emits reaction.updated; ai.run over WS behaves per your documented choice.

RULES: no new deps; keep gateProtocolVersion and presence logic untouched (already fixed); follow existing envelope shapes from room-core. pnpm --filter @clanmind/worker typecheck && pnpm --filter @clanmind/domain test && pnpm -r test until green.

FINAL SELF-REVIEW: git diff review, scope check, commands green, report files changed + test count + which WS ai.run choice you made and why.
