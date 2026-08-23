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
  NotificationItem,
  AiAction,
  Artifact,
  ServerFeatureFlags,
} from '@/types';

export interface DemoDataset {
  currentUser: User;
  groups: Group[];
  projects: Project[];
  members: GroupMember[];
  messages: Message[];
  tasks: Task[];
  decisions: Decision[];
  memories: MemoryEntry[];
  memoryCandidates: Array<{ id: string; content: string; scope: string }>;
  notifications: NotificationItem[];
  aiActions: AiAction[];
  artifacts: Artifact[];
  featureFlags: ServerFeatureFlags;
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
      user: currentUser,
      joined_at: groups[0]!.created_at,
      created_at: groups[0]!.created_at,
      updated_at: groups[0]!.updated_at,
    },
    {
      user_id: 'user_priya_2',
      group_id: groups[0]!.id,
      role: 'ADMIN',
      user: mkUser('user_priya_2', 'priya@clanmind.io', 'Priya Sharma'),
      joined_at: new Date(now - 55 * DAY).toISOString(),
      created_at: new Date(now - 55 * DAY).toISOString(),
      updated_at: new Date(now - DAY).toISOString(),
    },
    {
      user_id: 'user_marcus_3',
      group_id: groups[0]!.id,
      role: 'MEMBER',
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

  const tasks: Task[] = [
    {
      id: 'task_1',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      title: 'Configure DMA1 Stream 0 circular ring buffer for SPI1 RX',
      description:
        'Implement double-buffered circular DMA reception into SRAM1 memory space with EXTI line 1 interrupt handler.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      assignee_id: 'user_priya_2',
      assignee_name: 'Priya Sharma',
      due_date: new Date(now + 2 * DAY).toISOString(),
      created_at: new Date(now - DAY).toISOString(),
      updated_at: new Date(now - DAY).toISOString(),
    },
    {
      id: 'task_2',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      title: 'Bench test 1 kHz sensor telemetry loop under vibration load',
      description: 'Verify zero packet drops and consistent attitude timestamping on the hardware shaker table.',
      status: 'TODO',
      priority: 'MEDIUM',
      assignee_id: 'user_marcus_3',
      assignee_name: 'Marcus Vance',
      due_date: new Date(now + 5 * DAY).toISOString(),
      created_at: new Date(now - 2 * DAY).toISOString(),
      updated_at: new Date(now - 2 * DAY).toISOString(),
    },
    {
      id: 'task_3',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      title: 'Approve & Merge GitHub PR #4 (feat/spi-dma-driver)',
      description: 'Review firmware diff and approve hardware merge into main branch.',
      status: 'TODO',
      priority: 'HIGH',
      assignee_id: currentUser.id,
      assignee_name: currentUser.name,
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    },
    {
      id: 'task_4',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      title: 'Initial SPI clock polarity (CPOL) and phase (CPHA) validation',
      description: 'Verified with logic analyzer: SPI Mode 3 (CPOL=1, CPHA=1) active.',
      status: 'DONE',
      priority: 'MEDIUM',
      assignee_id: currentUser.id,
      assignee_name: currentUser.name,
      created_at: new Date(now - 4 * DAY).toISOString(),
      updated_at: new Date(now - 3 * DAY).toISOString(),
    },
  ];

  const decisions: Decision[] = [
    {
      id: 'dec_1',
      decision_number: 1,
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      title: 'Adopt SPI DMA over I2C for IMU Sensor Telemetry',
      status: 'APPROVED',
      context: 'I2C bus arbitration introduced 150 µs jitter per cycle, violating the 1 kHz attitude control deadline.',
      reason: 'SPI DMA at 24 MHz with circular buffering reduces latency to 6.5 µs with zero CPU blocking.',
      approved_by_id: currentUser.id,
      approved_by_name: currentUser.name,
      sources: ['ICM-42688P Datasheet Rev 1.2', 'STM32H7 Reference Manual RM0433'],
      created_at: new Date(now - 2 * DAY).toISOString(),
      updated_at: new Date(now - 2 * DAY).toISOString(),
    },
    {
      id: 'dec_2',
      decision_number: 2,
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      title: 'Allocate SRAM1 for Real-Time Telemetry Ring Buffers',
      status: 'APPROVED',
      context: 'AXI SRAM contention between Cortex-M7 D-Cache and DMA caused intermittent cache coherency stalls.',
      reason: 'Placing DMA buffers in dedicated SRAM1 (D2 domain) eliminates cache invalidation requirements.',
      approved_by_id: 'user_priya_2',
      approved_by_name: 'Priya Sharma',
      sources: ['AN5280: STM32H7 DMA Coherency Guidelines'],
      created_at: new Date(now - 3 * DAY).toISOString(),
      updated_at: new Date(now - 3 * DAY).toISOString(),
    },
  ];

  const memories: MemoryEntry[] = [
    {
      id: 'mem_1',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      scope: 'PROJECT',
      entry_type: 'CONVENTION',
      title: 'STM32 Peripheral Clocks Rule',
      content: 'All high-speed SPI peripherals on APB2 must maintain clock division <= /2 to preserve signal integrity.',
      source: 'Discussion with Marcus Vance',
      created_at: new Date(now - 5 * DAY).toISOString(),
      updated_at: new Date(now - 5 * DAY).toISOString(),
    },
    {
      id: 'mem_2',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      scope: 'PROJECT',
      entry_type: 'CONSTRAINT',
      title: 'Attitude Loop Frequency Ceiling',
      content: 'Attitude PID loop is strictly hard-coded to 1,000 Hz. Filter delays must remain below 3 ms.',
      source: 'Odin Research Evaluation',
      created_at: new Date(now - 4 * DAY).toISOString(),
      updated_at: new Date(now - 4 * DAY).toISOString(),
    },
    {
      id: 'mem_3',
      group_id: groups[0]!.id,
      scope: 'GROUP',
      entry_type: 'FACT',
      title: 'Hardware Revision Target',
      content: 'Current prototype boards are Hardware Rev B with STM32H743VIT6 480 MHz chip.',
      created_at: new Date(now - 7 * DAY).toISOString(),
      updated_at: new Date(now - 7 * DAY).toISOString(),
    },
  ];

  const memoryCandidates: DemoDataset['memoryCandidates'] = [
    {
      id: 'cand_1',
      content: 'Always disable SPI peripheral before reconfiguring DMA stream registers to avoid bus locking.',
      scope: 'PROJECT',
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: 'notif_1',
      group_id: groups[0]!.id,
      category: 'AI_ACTION_APPROVAL',
      delivery_state: 'DELIVERED_REALTIME',
      title: 'GitHub PR #4 ready for approval',
      body: 'Odin prepared feat/spi-dma-driver for review.',
      target_route: '/group/grp_robotics_1/project/proj_flight_ctrl',
      is_read: false,
      created_at: new Date(now - 30 * 60_000).toISOString(),
    },
    {
      id: 'notif_2',
      group_id: groups[0]!.id,
      category: 'DECISION_APPROVAL',
      delivery_state: 'DELIVERED_REALTIME',
      title: 'Decision #1 recorded',
      body: 'Adopt SPI DMA over I2C for IMU Sensor Telemetry has been approved.',
      target_route: '/group/grp_robotics_1/project/proj_flight_ctrl',
      is_read: false,
      created_at: new Date(now - HOUR).toISOString(),
    },
  ];

  const aiActions: AiAction[] = [
    {
      id: 'act_github_1',
      group_id: groups[0]!.id,
      project_id: projects[0]!.id,
      action_kind: 'MODIFY_GITHUB_FILES',
      risk_level: 'HIGH',
      status: 'WAITING_APPROVAL',
      payload: {
        branch: 'feat/spi-dma-driver',
        files: [
          { path: 'Drivers/SPI/spi_dma.c', change: 'A', additions: 142, deletions: 0 },
          { path: 'Drivers/SPI/spi_dma.h', change: 'A', additions: 64, deletions: 0 },
          { path: 'Core/Src/main.c', change: 'M', additions: 12, deletions: 4 },
        ],
        hunks: [
          '+ #include "spi_dma.h"',
          '+ static DMA_HandleTypeDef hdma_spi1_rx;',
          '+ void SPI1_DMA_RX_Callback(DMA_HandleTypeDef *hdma);',
          '+ MX_SPI1_Init() {',
          '+   hdma_spi1_rx.Init.Mode = DMA_CIRCULAR;',
          '+ }',
          '~ void main() {',
          '~   MX_SPI1_Init();',
          '~   MX_DMA_Init();',
          '~   HAL_SPI_Receive_DMA(&hspi1, rxBuf, 14);',
          '-   HAL_SPI_Receive(&hspi1, rxBuf, 14, 100);',
        ],
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
      action_kind: 'BULK_DELETE_ARTIFACTS',
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
      versions: [
        {
          id: 'v_1',
          artifact_id: 'art_diagram_1',
          version_number: 1,
          content:
            'graph TD\n  IMU[ICM-42688P IMU Sensor] -->|SPI 24MHz| DMA[STM32 DMA1 Stream 0]\n  DMA -->|Circular Buffer| SRAM[SRAM1 Ring Buffer]\n  SRAM -->|1 kHz IRQ| PID[Attitude PID Controller]',
          created_by_name: 'Odin',
          created_at: new Date(now - DAY).toISOString(),
        },
        {
          id: 'v_2',
          artifact_id: 'art_diagram_1',
          version_number: 2,
          content:
            'graph TD\n  IMU[ICM-42688P IMU Sensor] -->|SPI 24MHz| DMA[STM32 DMA1 Stream 0]\n  DMA -->|Circular Buffer| SRAM[SRAM1 Ring Buffer]\n  SRAM -->|1 kHz IRQ| PID[Attitude PID Controller]\n  PID -->|PWM Signals| ESC[Electronic Speed Controllers]\n  PID -->|Telemetry Stream| Radio[Ground 915MHz Radio]',
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
    notifications,
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
  };
}
