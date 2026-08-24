/**
 * Device-local persistence — account-scoped IndexedDB (FE §283/§284).
 *
 * Every database is namespaced per authenticated account (`cm_<userId>`);
 * switching or signing out of an account can never read another account's
 * drafts, cached messages, or sync queue.
 */

import { openDB, deleteDB, type IDBPDatabase } from 'idb';

export type { IDBPDatabase };

export interface CachedMessageRecord {
  id: string;
  group_id: string;
  project_id: string | null;
  server_sequence: number;
  body: string;
  payload: unknown;
}

const DB_VERSION = 1;

const dbCache = new Map<string, Promise<IDBPDatabase>>();

function dbNameFor(userId: string): string {
  return `cm_${userId}`;
}

/**
 * Environments without IndexedDB (some webviews, test DOMs) must not crash
 * the account lifecycle — local persistence is a progressive enhancement;
 * drafts/cache simply stay memory-only there.
 */
function hasIndexedDb(): boolean {
  return typeof globalThis.indexedDB !== 'undefined';
}

export function openAccountDb(userId: string): Promise<IDBPDatabase> {
  if (!hasIndexedDb()) {
    return Promise.reject(new Error('[local] IndexedDB unavailable in this environment'));
  }
  const existing = dbCache.get(userId);
  if (existing) return existing;

  const opening = openDB(dbNameFor(userId), DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv');
      }
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'scope' });
      }
      if (!db.objectStoreNames.contains('sync_ops')) {
        db.createObjectStore('sync_ops', { keyPath: 'client_operation_id' });
      }
      if (!db.objectStoreNames.contains('messages')) {
        const messages = db.createObjectStore('messages', { keyPath: 'id' });
        messages.createIndex('by_group_sequence', ['group_id', 'server_sequence']);
      }
    },
  });

  dbCache.set(userId, opening);
  opening.catch(() => dbCache.delete(userId));
  return opening;
}

export async function closeAccountDb(userId: string): Promise<void> {
  const opening = dbCache.get(userId);
  if (!opening) return;
  dbCache.delete(userId);
  const db = await opening;
  db.close();
}

/** FE §284 — full local wipe when an account signs out. */
export async function wipeAccountDb(userId: string): Promise<void> {
  await closeAccountDb(userId);
  if (!hasIndexedDb()) return;
  await deleteDB(dbNameFor(userId));
}

// ─── Small typed helpers used by later phases (drafts / queue / cache) ──────

export async function kvGet<T>(userId: string, key: string): Promise<T | undefined> {
  const db = await openAccountDb(userId);
  return (await db.get('kv', key)) as T | undefined;
}

export async function kvSet(userId: string, key: string, value: unknown): Promise<void> {
  const db = await openAccountDb(userId);
  await db.put('kv', value, key);
}
