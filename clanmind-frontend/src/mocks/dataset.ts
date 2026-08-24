/**
 * Deterministic demo dataset — the ONLY home for fixture content.
 * Loaded exclusively through `src/mocks/index.ts` when VITE_DEMO_MODE=1;
 * never imported from runtime paths (verified by build-output grep).
 */

import type {
  User,
  Group,
  GroupMember,
  Project,
  Message,
  Task,
  Decision,
  MemoryEntry,
  MemoryCandidate,
  AiAction,
  Artifact,
  ServerFeatureFlags,
  GithubConnection,
  GithubActionItem,
  AiProviderConfig,
  AiModelRoute,
  MeetingSession,
  MeetingCandidate,
} from '@/types';
import type { z } from 'zod';
import type { ActivityEventSchema, NotificationSchema } from '@/api/schemas';

/** BE §95A wire row — the dataset stores notifications in WIRE shape so the
 * demo REST surface returns byte-identical rows to handlers/search.ts and
 * hydration maps them through the same mapper as live responses. */
export type DemoNotificationRow = z.infer<typeof NotificationSchema>;

/** BE §98A activity_events wire row (GET /groups/:groupId/activity). */
export type DemoActivityRow = z.infer<typeof ActivityEventSchema>;

/** BE §20A sync_conflicts wire row (demo sync surface, see D25). */
export interface DemoSyncConflictRow {
  id: string;
  group_id: string;
  entity_type: string;
  entity_id: string;
  conflict_type: 'version_mismatch' | 'concurrent_edit' | 'deleted_upstream';
  local_payload: Record<string, unknown>;
  server_payload: Record<string, unknown>;
  resolution_strategy: 'server_wins' | 'client_wins' | 'merged' | 'manual' | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface DemoDataset {
  currentUser: User;
  groups: Group[];
  projects: Project[];
  members: GroupMember[];
  messages: Message[];
  /** §48 contract rows. */
  tasks: Task[];
  /** §47 contract rows. */
  decisions: Decision[];
  /** §35 typed memory rows. */
  memories: MemoryEntry[];
  /** §36 PENDING candidate rows. */
  memoryCandidates: MemoryCandidate[];
  /** §50 meeting_sessions rows (BE §112 surface). */
  meetingSessions: MeetingSession[];
  /** §50A meeting_candidates rows. */
  meetingCandidates: MeetingCandidate[];
  /** §95A wire rows (recipient-scoped on read). */
  notifications: DemoNotificationRow[];
  /** §98A attention feed rows served by GET /groups/:groupId/activity. */
  activityEvents: DemoActivityRow[];
  /** §20A sync_conflicts rows created by the demo sync surface (P11). */
  syncConflicts: DemoSyncConflictRow[];
  aiActions: AiAction[];
  artifacts: Artifact[];
  featureFlags: ServerFeatureFlags;
  /** §77 — one Group = one connected repository (BE initial constraint). */
  githubConnections: GithubConnection[];
  /** §78 github_actions rows, joined to aiActions by ai_action_id. */
  githubActions: GithubActionItem[];
  /** §63/§64 BYOK provider configs (sanitized shape only). */
  aiProviderConfigs: AiProviderConfig[];
  /** §32 model routes (PRIMARY + fallback slots). */
  aiModelRoutes: AiModelRoute[];
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export function createDemoDataset(): DemoDataset {
  const now = Date.now();

  const currentUser: User = {
    id: 'user_arun_1',
    email: 'arun@clanmind.io',
    name: 'Arun Kumar',
    created_at: new Date(now - 30 * DAY).toISOString(),
    updated_at: new Date(now - DAY).toISOString(),
  };

  const groups: Group[] = [
    {
      id: 'grp_robotics_1',
      name: 'Robotics Core Team',
      description: 'Autonomous drones, flight control hardware & real-time telemetry systems.',
      status: 'ACTIVE',
      ai_name: 'Odin',
      ai_proactivity: 'balanced',
      created_at: new Date(now - 60 * DAY).toISOString(),
      updated_at: new Date(now - DAY).toISOString(),
    },
    {
      id: 'grp_biotech_2',
      name: 'BioTech Research Labs',
      description: 'Genomic sequence analysis and computational biology pipelines.',
      status: 'ACTIVE',
      ai_name: 'Odin',
      ai_proactivity: 'high',
      created_at: new Date(now - 45 * DAY).toISOString(),
      updated_at: new Date(now - 2 * DAY).toISOString(),
    },
  ];

  const mkUser = (id: string, email: string, name: string): User => ({
    id,
    email,
    name,
    created_at: new Date(now - 40 * DAY).toISOString(),
    updated_at: new Date(now - DAY).toISOString(),
  });

  const members: GroupMember[] = [
    {
      user_id: currentUser.id,
      group_id: groups[0]!.id,
      role: 'OWNER',
      nickname: 'Arun',
      user: currentUser,
      joined_at: groups[0]!.created_at,
      created_at: groups[0]!.created_at,
      updated_at: groups[0]!.updated_at,
    },
    {
      user_id: 'user_priya_2',
      group_id: groups[0]!.id,
      role: 'ADMIN',
      nickname: 'Priya',
      user: mkUser('user_priya_2', 'priya@clanmind.io', 'Priya Sharma'),
      joined_at: new Date(now - 55 * DAY).toISOString(),
      created_at: new Date(now - 55 * DAY).toISOString(),
      updated_at: new Date(now - DAY).toISOString(),
    },
    {
      user_id: 'user_marcus_3',
      group_id: groups[0]!.id,
      role: 'MEMBER',
      nickname: 'Marcus',
      user: mkUser('user_marcus_3', 'marcus@clanmind.io', 'Marcus Vance'),
      joined_at: new Date(now - 50 * DAY).toISOString(),
      created_at: new Date(now - 50 * DAY).toISOString(),
      updated_at: new Date(now - DAY).toISOString(),
    },
  ];

  const projects: Project[] = [
    {
      id: 'proj_flight_ctrl',
      group_id: groups[0]!.id,
      name: 'Flight Controller Firmware',
      description: 'STM32H7 sensor fusion, IMU telemetry, and attitude PID control loop.',
      goal: 'Achieve stable 1 kHz attitude telemetry with zero dropped DMA packets.',
      project_type: 'firmware',
      status: 'active',
      pulse_progress: 78,
      current_focus: 'ICM-42688P SPI DMA Driver',
      blocked_reason: 'Waiting on team decision for SPI clock polarity (CPOL)',
      next_step: 'Merge PR #4 and run hardware telemetry bench test',
      created_at: new Date(now - 40 * DAY).toISOString(),
      updated_at: new Date(now - 6 * HOUR).toISOString(),
    },
    {
      id: 'proj_telemetry_ground',
      group_id: groups[0]!.id,
      name: 'Ground Station Dashboard',
      description: 'Real-time WebSocket telemetry viewer and 3D flight visualizer.',
      goal: 'Low-latency 60 FPS attitude visualization.',
      project_type: 'software',
      status: 'active',
      pulse_progress: 45,
      current_focus: 'WebGPU 3D Model Rendering',
      created_at: new Date(now - 35 * DAY).toISOString(),
      updated_at: new Date(now - 2 * DAY).toISOString(),
    },
    {
      id: 'proj_power_mgmt',
      group_id: groups[0]!.id,
      name: 'Battery & Power Management',
      description: 'Smart BMS with CAN bus current and cell voltage monitoring.',
      goal: 'Calibrate cell balancing algorithm.',
      project_type: 'hardware',
      status: 'active',
      pulse_progress: 90,
      current_focus: 'Over-temperature cutoff testing',
      created_at: new Date(now - 30 * DAY).toISOString(),
      updated_at: new Date(now - DAY).toISOString(),
    },
  ];

  const messages: Message[] = [
    {
      id: 'msg_1',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      sender_type: 'USER',
      sender_id: currentUser.id,
      sender_name: currentUser.name,
      body: '@Odin Can you evaluate whether we should use SPI with DMA vs I2C for the ICM-42688P IMU on our STM32H7 board? We need minimum jitter on the 1 kHz attitude loop.',
      visibility: 'GROUP',
      pinned: true,
      edited: false,
      deleted: false,
      attachments: [],
      reactions: [{ emoji: '🚀', count: 2, user_ids: ['user_priya_2', 'user_marcus_3'] }],
      created_at: new Date(now - 2 * HOUR).toISOString(),
      updated_at: new Date(now - 2 * HOUR).toISOString(),
    },
    {
      id: 'msg_2',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      sender_type: 'USER',
      sender_id: 'user_priya_2',
      sender_name: 'Priya Sharma',
      body: 'I agree. With I2C, bus arbitration was locking our attitude thread for almost 150 microseconds every cycle.',
      visibility: 'GROUP',
      reply_to_message_id: 'msg_1',
      reply_to_preview: '@Odin Can you evaluate whether we should use SPI with DMA vs I2C...',
      pinned: false,
      edited: false,
      deleted: false,
      attachments: [],
      reactions: [{ emoji: '👍', count: 1, user_ids: [currentUser.id] }],
      created_at: new Date(now - 1.8 * HOUR).toISOString(),
      updated_at: new Date(now - 1.8 * HOUR).toISOString(),
    },
    {
      id: 'msg_3',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      sender_type: 'AI',
      sender_id: 'odin_ai',
      sender_name: 'Odin',
      body: `### Technical Evaluation: SPI DMA vs I2C for ICM-42688P\n\nI have completed a web research and hardware datasheet verification for the STM32H743 + ICM-42688P combination.\n\n**Key Findings:**\n1. **Transfer Latency:** At 24 MHz SPI clock with DMA1 Stream 0 circular buffers, packet read latency drops from **160 µs (I2C 400kHz)** to **6.5 µs (SPI DMA)**.\n2. **CPU Overhead:** SPI DMA operates with zero CPU blocking, triggering EXTI Line 1 only when a complete 14-byte sensor packet is transferred to SRAM1.\n3. **Attitude Loop Guarantee:** Enables rock-solid 1 kHz PID execution without missed attitude deadlines.\n\nI have generated the interactive system blueprint in your right work surface and proposed architectural Decision #1.`,
      visibility: 'GROUP',
      pinned: false,
      edited: false,
      deleted: false,
      attachments: [],
      reactions: [{ emoji: '🔥', count: 3, user_ids: [currentUser.id, 'user_priya_2', 'user_marcus_3'] }],
      created_at: new Date(now - 1.5 * HOUR).toISOString(),
      updated_at: new Date(now - 1.5 * HOUR).toISOString(),
    },
  ];

  // ─── §48 tasks — exact BE column set (owner_user_id, due_at, version) ────
  const tasks: Task[] = [
    {
      id: 'task_1',
      project_id: projects[0]!.id,
      title: 'Configure DMA1 Stream 0 circular ring buffer for SPI1 RX',
      description:
        'Implement double-buffered circular DMA reception into SRAM1 memory space with EXTI line 1 interrupt handler.',
      owner_user_id: 'user_priya_2',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      due_at: new Date(now + 2 * DAY).toISOString(),
      version: 2,
      created_by_user_id: currentUser.id,
      created_by_ai_id: null,
      created_at: new Date(now - DAY).toISOString(),
      updated_at: new Date(now - DAY).toISOString(),
      completed_at: null,
    },
    {
      id: 'task_2',
      project_id: projects[0]!.id,
      title: 'Bench test 1 kHz sensor telemetry loop under vibration load',
      description:
        'Verify zero packet drops and consistent attitude timestamping on the hardware shaker table.',
      owner_user_id: 'user_marcus_3',
      status: 'TODO',
      priority: 'MEDIUM',
      due_at: new Date(now + 5 * DAY).toISOString(),
      version: 1,
      created_by_user_id: currentUser.id,
      created_by_ai_id: null,
      created_at: new Date(now - 2 * DAY).toISOString(),
      updated_at: new Date(now - 2 * DAY).toISOString(),
      completed_at: null,
    },
    {
      id: 'task_3',
      project_id: projects[0]!.id,
      title: 'Approve & Merge GitHub PR #4 (feat/spi-dma-driver)',
      description: 'Review firmware diff and approve hardware merge into main branch.',
      owner_user_id: currentUser.id,
      status: 'TODO',
      priority: 'HIGH',
      due_at: null,
      version: 1,
      created_by_user_id: currentUser.id,
      created_by_ai_id: null,
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
      completed_at: null,
      // §119 "related decision" — demo-only extension (no §48 column; D22).
      related_decision_id: 'dec_1',
    },
    {
      id: 'task_4',
      project_id: projects[0]!.id,
      title: 'Initial SPI clock polarity (CPOL) and phase (CPHA) validation',
      description: 'Verified with logic analyzer: SPI Mode 3 (CPOL=1, CPHA=1) active.',
      owner_user_id: currentUser.id,
      status: 'DONE',
      priority: 'MEDIUM',
      due_at: null,
      version: 2,
      created_by_user_id: currentUser.id,
      created_by_ai_id: null,
      created_at: new Date(now - 4 * DAY).toISOString(),
      updated_at: new Date(now - 3 * DAY).toISOString(),
      completed_at: new Date(now - 3 * DAY).toISOString(),
    },
  ];

  // ─── §47 decisions — exact BE column set (rationale, CAS version) ────────
  const decisions: Decision[] = [
    {
      id: 'dec_1',
      project_id: projects[0]!.id,
      title: 'Adopt SPI DMA over I2C for IMU Sensor Telemetry',
      context:
        'I2C bus arbitration introduced 150 µs jitter per cycle, violating the 1 kHz attitude control deadline.',
      options: [
        { label: 'SPI + DMA', note: '24 MHz, circular buffer into SRAM1' },
        { label: 'I2C Fast Mode', note: '400 kHz, shared bus' },
      ],
      selected_option: { label: 'SPI + DMA' },
      rationale:
        'SPI DMA at 24 MHz with circular buffering reduces latency to 6.5 µs with zero CPU blocking.',
      status: 'APPROVED',
      version: 2,
      proposed_by: 'odin_ai',
      approved_by: currentUser.id,
      approved_at: new Date(now - 2 * DAY).toISOString(),
      // §120 "Sources" — tolerated extension, not a §47 column (D22).
      sources: ['ICM-42688P Datasheet Rev 1.2', 'STM32H7 Reference Manual RM0433'],
      created_at: new Date(now - 2 * DAY).toISOString(),
      updated_at: new Date(now - 2 * DAY).toISOString(),
    },
    {
      id: 'dec_2',
      project_id: projects[0]!.id,
      title: 'Allocate SRAM1 for Real-Time Telemetry Ring Buffers',
      context:
        'AXI SRAM contention between Cortex-M7 D-Cache and DMA caused intermittent cache coherency stalls.',
      options: [{ label: 'SRAM1 placement' }, { label: 'MPU non-cacheable AXI region' }],
      selected_option: { label: 'SRAM1 placement' },
      rationale:
        'Placing DMA buffers in dedicated SRAM1 (D2 domain) eliminates cache invalidation requirements.',
      status: 'APPROVED',
      version: 2,
      proposed_by: 'user_priya_2',
      approved_by: 'user_priya_2',
      approved_at: new Date(now - 3 * DAY).toISOString(),
      sources: ['AN5280: STM32H7 DMA Coherency Guidelines'],
      created_at: new Date(now - 3 * DAY).toISOString(),
      updated_at: new Date(now - 3 * DAY).toISOString(),
    },
    {
      id: 'dec_3',
      project_id: projects[0]!.id,
      title: 'Route flash logging over a dedicated SPI bus (SPI4)',
      context:
        'Sharing SPI1 with the IMU risks stalling the 1 kHz telemetry ring during page writes.',
      rationale: null,
      status: 'PROPOSED',
      version: 1,
      proposed_by: currentUser.id,
      approved_by: null,
      approved_at: null,
      created_at: new Date(now - 6 * HOUR).toISOString(),
      updated_at: new Date(now - 6 * HOUR).toISOString(),
    },
  ];

  // ─── §35 memories — typed rows with scope/provenance/confidence ──────────
  const memories: MemoryEntry[] = [
    {
      id: 'mem_1',
      scope_type: 'PROJECT',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      user_id: null,
      memory_type: 'CONVENTION',
      content:
        'All high-speed SPI peripherals on APB2 must maintain clock division <= /2 to preserve signal integrity.',
      normalized_content: null,
      confidence: 0.92,
      importance: 0.8,
      source_type: 'conversation',
      source_id: 'msg_2',
      status: 'ACTIVE',
      created_at: new Date(now - 5 * DAY).toISOString(),
      updated_at: new Date(now - 5 * DAY).toISOString(),
      last_used_at: null,
      archived_at: null,
    },
    {
      id: 'mem_2',
      scope_type: 'PROJECT',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      user_id: null,
      memory_type: 'CONSTRAINT',
      content:
        'Attitude PID loop is strictly hard-coded to 1,000 Hz. Filter delays must remain below 3 ms.',
      normalized_content: null,
      confidence: 0.99,
      importance: 0.95,
      source_type: 'ai_research',
      source_id: null,
      status: 'ACTIVE',
      created_at: new Date(now - 4 * DAY).toISOString(),
      updated_at: new Date(now - 4 * DAY).toISOString(),
      last_used_at: null,
      archived_at: null,
    },
    {
      id: 'mem_3',
      scope_type: 'GROUP',
      group_id: groups[0]!.id,
      project_id: null,
      user_id: null,
      memory_type: 'FACT',
      content: 'Current prototype boards are Hardware Rev B with STM32H743VIT6 480 MHz chip.',
      normalized_content: null,
      confidence: 0.85,
      importance: 0.6,
      source_type: 'conversation',
      source_id: null,
      status: 'ACTIVE',
      created_at: new Date(now - 7 * DAY).toISOString(),
      updated_at: new Date(now - 7 * DAY).toISOString(),
      last_used_at: null,
      archived_at: null,
    },
    {
      id: 'mem_4_private',
      scope_type: 'USER_PRIVATE',
      group_id: groups[0]!.id,
      project_id: null,
      user_id: currentUser.id,
      memory_type: 'PREFERENCE',
      content:
        'Prefers datasheet-first reviews; cite register names when proposing peripheral configs.',
      normalized_content: null,
      confidence: 0.75,
      importance: 0.5,
      source_type: 'explicit',
      source_id: null,
      status: 'ACTIVE',
      created_at: new Date(now - 6 * DAY).toISOString(),
      updated_at: new Date(now - 6 * DAY).toISOString(),
      last_used_at: null,
      archived_at: null,
    },
  ];

  // ─── §36 candidates — PENDING rows Odin proposed for confirmation ────────
  const memoryCandidates: MemoryCandidate[] = [
    {
      id: 'cand_1',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      user_id: null,
      source_message_id: 'msg_2',
      candidate_type: 'CONSTRAINT',
      content:
        'Always disable the SPI peripheral before reconfiguring DMA stream registers to avoid bus locking.',
      confidence: 0.71,
      recommended_scope: 'PROJECT',
      status: 'PENDING',
      created_at: new Date(now - HOUR).toISOString(),
    },
  ];

  // ─── §95A notification rows — WIRE shape, exactly what handlers/search.ts
  // returns from GET /notifications (one row per recipient per semantic
  // event, §143). Seeded across the §95 category set so the center, badge
  // counts, and §171A diagnostics all exercise real shapes. `notif_priya_*`
  // rows belong to ANOTHER recipient and must never reach this user's list.
  const notifications: DemoNotificationRow[] = [
    {
      id: 'notif_1',
      recipient_user_id: currentUser.id,
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      category: 'AI_ACTION_APPROVAL',
      subject_type: 'ai_action',
      subject_id: 'act_github_1',
      title: 'GitHub write needs approval',
      body: 'Odin prepared feat/spi-dma-driver for review.',
      delivery_state: 'DELIVERED_REALTIME',
      read_at: null,
      created_at: new Date(now - 30 * 60_000).toISOString(),
    },
    {
      id: 'notif_2',
      recipient_user_id: currentUser.id,
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      category: 'MENTION',
      subject_type: 'message',
      subject_id: 'msg_2',
      title: 'You were mentioned',
      body: 'Priya Sharma mentioned you in Flight Controller.',
      delivery_state: 'DELIVERED_REALTIME',
      read_at: null,
      created_at: new Date(now - 45 * 60_000).toISOString(),
    },
    {
      id: 'notif_3',
      recipient_user_id: currentUser.id,
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      category: 'TASK_ASSIGNMENT',
      subject_type: 'task',
      subject_id: 'task_1',
      title: 'You were assigned a task',
      body: 'Configure DMA1 Stream 0 circular ring buffer for SPI1 RX.',
      delivery_state: 'PENDING',
      read_at: null,
      created_at: new Date(now - 2 * HOUR).toISOString(),
    },
    {
      id: 'notif_4',
      recipient_user_id: currentUser.id,
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      category: 'DECISION_APPROVAL',
      subject_type: 'decision',
      subject_id: 'dec_1',
      title: 'Decision approved',
      body: 'Adopt SPI DMA over I2C for IMU Sensor Telemetry has been approved.',
      delivery_state: 'SUPPRESSED_BY_PREFERENCE',
      read_at: null,
      created_at: new Date(now - 3 * HOUR).toISOString(),
    },
    {
      id: 'notif_5',
      recipient_user_id: currentUser.id,
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      category: 'ARTIFACT_READY',
      subject_type: 'artifact',
      subject_id: 'art_diagram_1',
      title: 'Artifact ready',
      body: 'System Architecture Diagram v3 completed.',
      delivery_state: 'FAILED',
      read_at: new Date(now - 4 * HOUR).toISOString(),
      created_at: new Date(now - 5 * HOUR).toISOString(),
    },
    {
      id: 'notif_6',
      recipient_user_id: currentUser.id,
      group_id: groups[0]!.id,
      project_id: null,
      category: 'MEETING_SUMMARY',
      subject_type: 'meeting_session',
      subject_id: 'meet_seed_1',
      title: 'Meeting summary ready',
      body: 'Tuesday sync — 4 decisions captured.',
      delivery_state: 'DELIVERED_EMAIL',
      read_at: new Date(now - 26 * HOUR).toISOString(),
      created_at: new Date(now - 27 * HOUR).toISOString(),
    },
    {
      id: 'notif_7',
      recipient_user_id: currentUser.id,
      group_id: groups[1]!.id,
      project_id: null,
      category: 'SYSTEM',
      subject_type: 'group_invite',
      subject_id: 'inv_seed_1',
      title: 'Invite sent',
      body: null,
      delivery_state: 'DELIVERED_REALTIME',
      read_at: new Date(now - 20 * HOUR).toISOString(),
      created_at: new Date(now - 20 * HOUR).toISOString(),
    },
    {
      // Another recipient's row — must be filtered out of every list.
      id: 'notif_priya_1',
      recipient_user_id: 'user_priya_2',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      category: 'MENTION',
      subject_type: 'message',
      subject_id: 'msg_3',
      title: 'You were mentioned',
      body: 'Arun Kumar mentioned you in Flight Controller.',
      delivery_state: 'DELIVERED_REALTIME',
      read_at: null,
      created_at: new Date(now - 10 * 60_000).toISOString(),
    },
  ];

  // ─── §98A activity_events — pre-rendered summaries, GROUP/PROJECT scoped,
  // private events never present (BE §98A). Feeds the Activity surface's
  // "what's happening" stream (FE §172).
  const activityEvents: DemoActivityRow[] = [
    {
      id: 'act_evt_1',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      actor_type: 'USER',
      actor_user_id: 'user_priya_2',
      actor_ai_id: null,
      activity_type: 'message.created',
      summary: 'New message',
      subject_type: 'message',
      subject_id: 'msg_2',
      visibility: 'PROJECT',
      occurred_at: new Date(now - 50 * 60_000).toISOString(),
    },
    {
      id: 'act_evt_2',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      actor_type: 'AI',
      actor_user_id: null,
      actor_ai_id: 'odin_ai',
      activity_type: 'artifact.created',
      summary: 'Artifact created',
      subject_type: 'artifact',
      subject_id: 'art_diagram_1',
      visibility: 'PROJECT',
      occurred_at: new Date(now - 5 * HOUR).toISOString(),
    },
    {
      id: 'act_evt_3',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      actor_type: 'USER',
      actor_user_id: currentUser.id,
      actor_ai_id: null,
      activity_type: 'task.created',
      summary: 'Task created',
      subject_type: 'task',
      subject_id: 'task_1',
      visibility: 'PROJECT',
      occurred_at: new Date(now - DAY).toISOString(),
    },
  ];

  const aiActions: AiAction[] = [
    {
      id: 'act_github_1',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      action_kind: 'github.apply_patch',
      risk_level: 'HIGH',
      status: 'WAITING_APPROVAL',
      // BE §140 buildDiffPreview shape — the approval payload shows the EXACT
      // diff. `file_diffs` is a demo-only inline extension (the real backend
      // ships per-file stats; line hunks have no endpoint yet — see
      // INTEGRATION_NOTES P7 gap list).
      payload: {
        branch: 'feat/spi-dma-driver',
        base_sha: '3f9c2ab91d7e40c1b5a2f8e60d34c7a19b2d5e88',
        target_sha: 'c71de4f20a98b3d64e17f2c805a9b4d23e6f1a52',
        changed_files: [
          { path: 'Drivers/SPI/spi_dma.c', additions: 142, deletions: 0 },
          { path: 'Drivers/SPI/spi_dma.h', additions: 64, deletions: 0 },
          { path: 'Core/Src/main.c', additions: 12, deletions: 4 },
        ],
        additions: 218,
        deletions: 4,
        file_diffs: {
          'Drivers/SPI/spi_dma.c': [
            '+ #include "spi_dma.h"',
            '+ static DMA_HandleTypeDef hdma_spi1_rx;',
            '+ void SPI1_DMA_RX_Callback(DMA_HandleTypeDef *hdma) {',
            '+   HAL_DMA_IRQHandler(&hdma_spi1_rx);',
            '+ }',
            '+ HAL_StatusTypeDef SPI1_StartDmaRx(SPI_HandleTypeDef *hspi, uint8_t *buf, uint16_t len) {',
            '+   return HAL_SPI_Receive_DMA(hspi, buf, len);',
            '+ }',
          ],
          'Core/Src/main.c': [
            '~ void main() {',
            '~   MX_SPI1_Init();',
            '~   MX_DMA_Init();',
            '~   HAL_SPI_Receive_DMA(&hspi1, rxBuf, 14);',
            '-   HAL_SPI_Receive(&hspi1, rxBuf, 14, 100);',
            '+   osDelay(1); // 1 kHz attitude loop tick',
          ],
        },
      },
      payload_hash: '9f2c1ab4de7f8a01b3c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b',
      payload_version: 1,
      requested_by_run_id: 'run_github_1',
      requested_by_user_id: currentUser.id,
      created_at: new Date(now - 30 * 60_000).toISOString(),
      expires_at: new Date(now + DAY).toISOString(),
    },
    {
      id: 'act_bulk_delete_1',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      action_kind: 'artifact.bulk_delete',
      risk_level: 'MEDIUM',
      status: 'WAITING_APPROVAL',
      payload: {
        count: 12,
        items: [
          'Architecture v1, v2, v3 (superseded)',
          'Old research notes (4 items)',
          'Draft diagrams (5 items)',
        ],
        reason: 'Superseded by Decision #1 (Use SPI DMA)',
      },
      payload_hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
      payload_version: 1,
      requested_by_run_id: 'run_cleanup_1',
      requested_by_user_id: currentUser.id,
      created_at: new Date(now - 15 * 60_000).toISOString(),
      expires_at: new Date(now + DAY).toISOString(),
    },
  ];

  // ─── §77 github_connections — one Group = one repo; mutable via routes ────
  const githubConnections: GithubConnection[] = [
    {
      id: 'ghconn_1',
      group_id: groups[0]!.id,
      installation_id: 4821934,
      owner_login: 'robotics-core',
      repo_name: 'flight-controller',
      repo_full_name: 'robotics-core/flight-controller',
      default_branch: 'main',
      permission_mode: 'READ_WRITE',
      connected_at: new Date(now - 6 * DAY).toISOString(),
      disconnected_at: null,
    },
  ];

  // ─── §78 github_actions rows joined to ai_actions by ai_action_id ─────────
  const githubActions: GithubActionItem[] = [
    {
      id: 'gha_1',
      ai_action_id: 'act_github_1',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      action_type: 'apply_patch',
      branch_name: 'feat/spi-dma-driver',
      target_sha: 'c71de4f20a98b3d64e17f2c805a9b4d23e6f1a52',
      pr_number: null,
      preview_json: null,
      created_at: new Date(now - 30 * 60_000).toISOString(),
      completed_at: null,
      status: 'WAITING_APPROVAL',
      risk_level: 'HIGH',
    },
  ];

  // ─── §63/§64 BYOK configs — sanitized metadata ONLY (never a raw key) ─────
  const aiProviderConfigs: AiProviderConfig[] = [
    {
      id: 'apc_anthropic_1',
      group_id: groups[0]!.id,
      kind: 'BYOK',
      provider: 'anthropic',
      credential_ref: 'secret:enc_demo_anthropic_ref',
      key_last4: '9F2A',
      enabled: true,
      created_by: currentUser.id,
      created_at: new Date(now - 10 * DAY).toISOString(),
      updated_at: new Date(now - 2 * DAY).toISOString(),
    },
  ];

  const aiModelRoutes: AiModelRoute[] = [
    {
      id: 'amr_primary_1',
      group_id: groups[0]!.id,
      provider_config_id: 'apc_anthropic_1',
      role: 'PRIMARY',
      model_id: 'claude-sonnet-4-5',
      priority: 0,
      enabled: true,
      created_at: new Date(now - 2 * DAY).toISOString(),
    },
  ];

  const artifacts: Artifact[] = [
    {
      id: 'art_diagram_1',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      title: 'STM32 SPI DMA Telemetry Pipeline',
      artifact_type: 'ARCHITECTURE',
      current_version: 2,
      pinned: true,
      used_as_context: true,
      created_at: new Date(now - DAY).toISOString(),
      updated_at: new Date(now - 2 * HOUR).toISOString(),
      // BE §74 — stable domain schema ({nodes[], edges[]}), never markup.
      versions: [
        {
          id: 'v_1',
          artifact_id: 'art_diagram_1',
          version_number: 1,
          content: JSON.stringify({
            nodes: [
              { id: 'imu', label: 'ICM-42688P IMU Sensor', kind: 'sensor' },
              { id: 'dma', label: 'STM32 DMA1 Stream 0', kind: 'processing' },
              { id: 'sram', label: 'SRAM1 Ring Buffer', kind: 'buffer' },
              { id: 'pid', label: 'Attitude PID Controller', kind: 'processing' },
            ],
            edges: [
              { source: 'imu', target: 'dma', label: 'SPI 24 MHz' },
              { source: 'dma', target: 'sram', label: 'Circular buffer' },
              { source: 'sram', target: 'pid', label: '1 kHz IRQ' },
            ],
          }),
          created_by_name: 'Odin',
          created_at: new Date(now - DAY).toISOString(),
        },
        {
          id: 'v_2',
          artifact_id: 'art_diagram_1',
          version_number: 2,
          content: JSON.stringify({
            nodes: [
              { id: 'imu', label: 'ICM-42688P IMU Sensor', kind: 'sensor' },
              { id: 'dma', label: 'STM32 DMA1 Stream 0', kind: 'processing' },
              { id: 'sram', label: 'SRAM1 Ring Buffer', kind: 'buffer' },
              { id: 'pid', label: 'Attitude PID Controller', kind: 'processing' },
              { id: 'esc', label: 'Electronic Speed Controllers', kind: 'actuator' },
              { id: 'radio', label: 'Ground 915 MHz Radio', kind: 'hardware' },
            ],
            edges: [
              { source: 'imu', target: 'dma', label: 'SPI 24 MHz' },
              { source: 'dma', target: 'sram', label: 'Circular buffer' },
              { source: 'sram', target: 'pid', label: '1 kHz IRQ' },
              { source: 'pid', target: 'esc', label: 'PWM signals' },
              { source: 'pid', target: 'radio', label: 'Telemetry stream' },
            ],
          }),
          change_summary: 'Added ESC actuation and Ground Radio telemetry output stages.',
          created_by_name: 'Odin',
          created_at: new Date(now - 2 * HOUR).toISOString(),
        },
      ],
    },
    {
      id: 'art_doc_2',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      title: 'ICM-42688P Hardware Integration Spec',
      artifact_type: 'DOCUMENT',
      current_version: 1,
      pinned: true,
      used_as_context: true,
      created_at: new Date(now - 12 * HOUR).toISOString(),
      updated_at: new Date(now - 12 * HOUR).toISOString(),
      versions: [
        {
          id: 'v_doc_1',
          artifact_id: 'art_doc_2',
          version_number: 1,
          content:
            '# ICM-42688P Hardware Integration Specification\n\n## 1. Pin Configuration\n- **SCK**: PA5 (AF5)\n- **MISO**: PA6 (AF5)\n- **MOSI**: PB5 (AF5)\n- **CS**: PC4 (GPIO Output High)\n- **INT1**: PB1 (EXTI Falling Edge)\n\n## 2. DMA Stream Allocation\nWe configure DMA1 Stream 0 Channel 3 for continuous circular reception into SRAM1 memory space.',
          created_by_name: currentUser.name,
          created_at: new Date(now - 12 * HOUR).toISOString(),
        },
      ],
    },
    {
      id: 'art_table_3',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      title: 'Pinout & DMA Stream Allocation Matrix',
      artifact_type: 'TABLE',
      current_version: 1,
      pinned: false,
      used_as_context: true,
      created_at: new Date(now - 8 * HOUR).toISOString(),
      updated_at: new Date(now - 8 * HOUR).toISOString(),
      versions: [
        {
          id: 'v_tbl_1',
          artifact_id: 'art_table_3',
          version_number: 1,
          content: JSON.stringify({
            headers: ['Signal', 'Pin', 'Mode', 'Clock / Max Frequency'],
            rows: [
              ['SPI1_SCK', 'PA5', 'Alternate Function 5', '24 MHz'],
              ['SPI1_MISO', 'PA6', 'Alternate Function 5', '24 MHz'],
              ['SPI1_MOSI', 'PB5', 'Alternate Function 5', '24 MHz'],
              ['IMU_CS', 'PC4', 'GPIO Output Push-Pull', 'High-Speed'],
              ['IMU_INT', 'PB1', 'EXTI Line 1 (Falling Edge)', 'Realtime IRQ'],
            ],
          }),
          created_by_name: 'Priya Sharma',
          created_at: new Date(now - 8 * HOUR).toISOString(),
        },
      ],
    },
  ];

  return {
    currentUser,
    groups,
    projects,
    members,
    messages,
    tasks,
    decisions,
    memories,
    memoryCandidates,
    // §50/§50A — meetings start empty; sessions/candidates are created at
    // runtime through the §112 demo routes (no fixture meetings).
    meetingSessions: [],
    meetingCandidates: [],
    notifications,
    activityEvents,
    // §20A — conflicts appear only through real replay attempts against the
    // demo sync surface; no fixtures.
    syncConflicts: [],
    aiActions,
    artifacts,
    featureFlags: {
      meeting_mode: true,
      proactive_ai: true,
      github_write: true,
      github_merge: true,
      custom_skills: true,
      deep_research: true,
      offline_sync_v2: true,
      interactive_artifacts: true,
    },
    githubConnections,
    githubActions,
    aiProviderConfigs,
    aiModelRoutes,
  };
}
