import type { LocalFileItem } from './LocalFileTreeView';

/**
 * Seed local project files covering the full §189 nine-value sync set and the
 * §212 five-value index set — replaced by real Tauri folder contents when the
 * filesystem bridge is connected to a chosen folder (§187).
 */
export const SEED_LOCAL_FILES: LocalFileItem[] = [
  {
    id: 'lf_1',
    name: 'spi_dma_driver.c',
    isFolder: false,
    size: 14820,
    syncState: 'SYNCED',
    indexState: 'READY',
  },
  {
    id: 'lf_2',
    name: 'imu_calibration.h',
    isFolder: false,
    size: 4210,
    syncState: 'LOCAL_CHANGED',
    indexState: 'STALE',
  },
  {
    id: 'lf_3',
    name: 'telemetry_bench.csv',
    isFolder: false,
    size: 892300,
    syncState: 'REMOTE_CHANGED',
    indexState: 'READY',
  },
  {
    id: 'lf_4',
    name: 'attitude_pid.c',
    isFolder: false,
    size: 22340,
    syncState: 'UPLOADING',
    indexState: 'INDEXING',
  },
  {
    id: 'lf_5',
    name: 'power_notes.md',
    isFolder: false,
    size: 4820,
    syncState: 'QUEUED',
    indexState: 'INDEXING',
  },
  {
    id: 'lf_6',
    name: 'flight_logs/',
    isFolder: true,
    size: 0,
    syncState: 'SYNCED',
    indexState: 'READY',
    children: [
      {
        id: 'lf_6a',
        name: 'flight_2026_08_20.bin',
        isFolder: false,
        size: 4096000,
        syncState: 'CONFLICT',
        indexState: 'FAILED',
      },
      {
        id: 'lf_6b',
        name: 'flight_2026_08_19.bin',
        isFolder: false,
        size: 3900000,
        syncState: 'DELETED',
        indexState: 'DELETED',
      },
    ],
  },
  {
    id: 'lf_7',
    name: 'bms_can_log.csv',
    isFolder: false,
    size: 104200,
    syncState: 'RESTORABLE',
    indexState: 'DELETED',
  },
  {
    id: 'lf_8',
    name: 'sensor_bom.xlsx',
    isFolder: false,
    size: 66400,
    syncState: 'LOCAL_ONLY',
    indexState: 'INDEXING',
  },
];