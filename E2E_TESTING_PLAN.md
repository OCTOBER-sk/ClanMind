# ClanMind — Full Backend E2E Testing Plan
## "Real Team Planning for SIH Hackathon"

> **Goal**: Verify every backend function works end-to-end with real users, real AI, real-time messaging, real artifacts — like an actual team using ClanMind to plan for Smart India Hackathon.

---

## 1. AI Model Selection

**Primary**: `deepseek/deepseek-chat-v3-0324:free`
- Best free model for chat + tool use (verified by community)
- Good at structured responses, research synthesis, artifact generation
- 50 req/day free tier (enough for E2E testing)

**Fallback**: `meta-llama/llama-4-maverick:free`
- Good general-purpose fallback
- Fast response times

**Config to set via API**:
```json
{
  "ai_model_primary": "deepseek/deepseek-chat-v3-0324:free",
  "ai_model_fallback": "meta-llama/llama-4-maverick:free",
  "ai_name": "Odin",
  "ai_tone": "helpful, technical, concise"
}
```

---

## 2. Test Scenario: "SIH 2026 — Team Innovators"

### Team Members (4 real Supabase users)

| User | Email | Role | Display Name |
|------|-------|------|--------------|
| Santhosh (Owner) | atom-test@clanmind.test | OWNER | Santhosh |
| Arun | arun-test@clanmind.test | MEMBER | Arun |
| Priya | priya-test@clanmind.test | MEMBER | Priya |
| Kavitha | kavitha-test@clanmind.test | ADMIN | Kavitha |

### Project
- **Name**: SIH 2026 — Smart Water Management
- **Goal**: Build an IoT-based real-time water quality monitoring system
- **Type**: software/iot
- **Description**: "AI-powered water quality monitoring using IoT sensors, real-time data pipeline, and predictive analytics for early contamination detection."

---

## 3. Test Phases (10 Phases, ~50 Test Cases)

### Phase 1: Health & Infrastructure (5 tests)

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 1.1 | Health check | `GET /health` | `{"status":"ok"}` |
| 1.2 | Liveness | `GET /health/live` | `{"status":"live"}` |
| 1.3 | Readiness | `GET /health/ready` | `{"status":"ready","checks":{"database":"ok","config":"ok"}}` |
| 1.4 | Client versions | `GET /api/v1/client-versions` | Returns min/recommended versions |
| 1.5 | Unauthenticated access | `GET /api/v1/groups` | `401 UNAUTHENTICATED` |

### Phase 2: User Registration & Profiles (4 tests)

| # | Test | Action | Expected |
|---|------|--------|----------|
| 2.1 | Create 4 users | Supabase Auth admin API | 4 users created |
| 2.2 | Create 4 profiles | `POST /rest/v1/profiles` | 4 profiles in DB |
| 2.3 | Get my profile | `GET /api/v1/me` | Returns display_name, email |
| 2.4 | Update profile | `PATCH /api/v1/me` | Updated display_name |

### Phase 3: Group Creation & Membership (8 tests)

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 3.1 | Santhosh creates group | `POST /api/v1/groups` | Group created, Santhosh = OWNER |
| 3.2 | List groups | `GET /api/v1/groups` | Returns 1 group |
| 3.3 | Get group details | `GET /api/v1/groups/:id` | Full group object |
| 3.4 | Create invite link | `POST /api/v1/groups/:id/invites` | Invite token returned |
| 3.5 | Arun joins via invite | `POST /api/v1/groups/:id/invites/:id/accept` | Arun = MEMBER |
| 3.6 | Priya joins via invite | Same | Priya = MEMBER |
| 3.7 | Promote Kavitha to ADMIN | `PATCH /api/v1/groups/:id/members/:userId` | Kavitha = ADMIN |
| 3.8 | List members | `GET /api/v1/groups/:id/members` | 4 members with roles |

### Phase 4: Project Creation (3 tests)

| # | Test | Endpoint | Expected |
|---|------|----------|----------|
| 4.1 | Santhosh creates project | `POST /api/v1/groups/:id/projects` | Project created |
| 4.2 | List projects | `GET /api/v1/groups/:id/projects` | Returns 1 project |
| 4.3 | Get project details | `GET /api/v1/projects/:id` | Full project object |

### Phase 5: Real-Time Messaging (10 tests)

| # | Test | Action | Expected |
|---|------|--------|----------|
| 5.1 | Santhosh sends message | `POST /api/v1/groups/:id/messages` | 201, message_id returned |
| 5.2 | Arun sends message | Same | 201 |
| 5.3 | Priya sends message | Same | 201 |
| 5.4 | Real-time delivery | WebSocket | All 3 users see all messages in real-time |
| 5.5 | Edit message | `PATCH /api/v1/messages/:id` | edited_at updated |
| 5.6 | Reply to message | `POST /api/v1/groups/:id/messages` with reply_to | Thread created |
| 5.7 | Add reaction | `POST /api/v1/messages/:id/reactions` | Reaction added |
| 5.8 | Remove reaction | `DELETE /api/v1/messages/:id/reactions` | Reaction removed |
| 5.9 | Pin message | `POST /api/v1/messages/:id/pin` | Message pinned |
| 5.10 | Search messages | `GET /api/v1/groups/:id/messages/search?q=water` | Returns matching messages |

### Phase 6: Mentions & AI Interaction (8 tests)

| # | Test | Action | Expected |
|---|------|--------|----------|
| 6.1 | @mention Arun | Send message with `@Arun` | Mention recorded, notification sent |
| 6.2 | @Odin (AI trigger) | Send `@Odin What sensors should we use for water quality?` | AI run triggered |
| 6.3 | AI response streaming | WebSocket | Progressive text reveal |
| 6.4 | AI tool usage | Check ai_runs/ai_tool_calls | Tool calls recorded |
| 6.5 | /research command | Send `/research water quality IoT sensors` | Research job triggered |
| 6.6 | Research results | WebSocket | Sources, citations returned |
| 6.7 | /ask command | Send `/ask What's the best database for time-series sensor data?` | AI responds |
| 6.8 | AI memory extraction | Check memories table | New memory candidates |

### Phase 7: Artifacts (6 tests)

| # | Test | Action | Expected |
|---|------|--------|----------|
| 7.1 | AI creates document artifact | Ask Odin to create a system architecture doc | Artifact created, spectral flow animation |
| 7.2 | AI creates diagram artifact | Ask Odin to create a data flow diagram | Diagram artifact with nodes/edges |
| 7.3 | View artifact | `GET /api/v1/artifacts/:id` | Full artifact content |
| 7.4 | Artifact versioning | Ask Odin to update the artifact | New version created |
| 7.5 | List project artifacts | `GET /api/v1/projects/:id/artifacts` | All artifacts listed |
| 7.6 | Artifact in side panel | Frontend verification | Artifact renders in right panel |

### Phase 8: Tasks & Decisions (6 tests)

| # | Test | Action | Expected |
|---|------|--------|----------|
| 8.1 | Create task | Via AI or manual | Task created with status TODO |
| 8.2 | Assign task | Assign to Arun | Task assigned |
| 8.3 | Update task status | Mark IN_PROGRESS | Status updated |
| 8.4 | Create decision | "Which cloud provider?" | Decision created |
| 8.5 | Add options | AWS vs GCP vs Azure | Options recorded |
| 8.6 | Approve decision | Choose option with rationale | Decision resolved |

### Phase 9: Private Conversations (4 tests)

| # | Test | Action | Expected |
|---|------|--------|----------|
| 9.1 | Private AI chat | `/private @Odin` + message | PRIVATE_AI visibility |
| 9.2 | Private human chat | `/private @Arun` + message | PRIVATE_PAIR visibility |
| 9.3 | Privacy isolation | Priya can't see private messages | Confirmed |
| 9.4 | Private doesn't enter memory | Check memories table | No private content |

### Phase 10: Notifications & Activity (4 tests)

| # | Test | Action | Expected |
|---|------|--------|----------|
| 10.1 | Notification on mention | Arun @mentions Priya | Priya gets notification |
| 10.2 | Notification on AI response | AI responds to @Odin | Requester notified |
| 10.3 | Activity feed | `GET /api/v1/groups/:id/activity` | All events listed |
| 10.4 | Mark notification read | `POST /api/v1/notifications/:id/read` | Marked as read |

---

## 4. Execution Strategy

### Step 1: Create Test Users (Supabase Admin API)
```bash
# Create 4 users via Supabase Auth admin
# Create profiles in profiles table
# Get access tokens for each user
```

### Step 2: Run API Test Suite
```bash# Sequential API calls with curl/httpie
# Capture all request/response JSON
# Verify database state after each operation
```

### Step 3: WebSocket Real-Time Test
```bash
# 4 concurrent WebSocket connections
# Send messages from each user
# Verify all users receive all messages
# Verify AI streaming works
```

### Step 4: AI Integration Test
```bash
# Configure AI with deepseek-chat-v3-0324:free
# Send @Odin messages
# Verify AI responses, tool usage, artifact creation
# Verify memory extraction
```

### Step 5: Frontend E2E Verification
```bash
# Playwright: login as each user
# Verify messages appear in real-time
# Verify artifacts render in side panel
# Verify all pages (chat, garage, tasks, settings)
```

---

## 5. Success Criteria

- [ ] All 50+ test cases pass
- [ ] Real-time messaging works between 4 concurrent users
- [ ] AI responds with real content (not mock)
- [ ] Artifacts are created and render properly
- [ ] Private conversations are isolated
- [ ] Notifications work for mentions and AI responses
- [ ] Activity feed shows all events
- [ ] No console errors in frontend
- [ ] All screenshots captured for PDF report

---

## 6. Deliverable

**One PDF**: `ClanMind_Backend_E2E_Report.pdf`
- Verbatim curl output for every API call
- WebSocket message logs
- Screenshots of every frontend state
- Database verification queries
- AI response samples
- Artifact screenshots
