/**
 * ClanMind Tauri Bridge — §294, §295, §194, §195, §309
 *
 * Provides safe, narrow wrappers around Tauri v2 APIs.
 * Falls back gracefully in browser/non-Tauri environments so
 * the React app remains runnable as a plain web app during dev.
 *
 * DO NOT import Tauri modules directly in feature components —
 * always use these wrappers.
 */

import { invoke } from '@tauri-apps/api/core';
import { requestPermission, isPermissionGranted, sendNotification } from '@tauri-apps/plugin-notification';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { open as openWithShell } from '@tauri-apps/plugin-shell';
import { check, Update } from '@tauri-apps/plugin-updater';
import { load } from '@tauri-apps/plugin-store';

/** Detect whether we are running inside Tauri */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Safe wrapper around `@tauri-apps/api/core` invoke.
 * Returns null in non-Tauri environments instead of throwing.
 */
export async function tauriInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T | null> {
  if (!isTauri()) return null;
  try {
    return (await invoke<T>(cmd, args)) ?? null;
  } catch (err) {
    console.warn('[TauriBridge] invoke failed:', cmd, err);
    return null;
  }
}

// ─── Native Notifications — §194, §174 ───

/**
 * Request OS notification permission.
 * Only call this when the reason is clear to the user (§194).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const granted = await isPermissionGranted();
    if (granted) return true;
    const permission = await requestPermission();
    return permission === 'granted';
  } catch {
    return false;
  }
}

export interface NativeNotificationOptions {
  title: string;
  body?: string;
}

/**
 * Send a native OS notification.
 * Silently no-ops in browser context.
 */
export async function sendNativeNotification(
  options: NativeNotificationOptions,
): Promise<void> {
  if (!isTauri()) return;
  try {
    await sendNotification({ title: options.title, body: options.body });
  } catch (err) {
    console.warn('[TauriBridge] notification failed:', err);
  }
}

// ─── Window State — §195 ───

export interface WindowState {
  width: number;
  height: number;
  x: number;
  y: number;
  maximized: boolean;
}

const WINDOW_STATE_KEY = 'cm_window_state';

/**
 * Persist window geometry.
 * In Tauri the state is stored via the store plugin (app local data);
 * in the browser it falls back to localStorage so dev flows keep working.
 */
export async function saveWindowState(state: WindowState): Promise<void> {
  try {
    if (isTauri()) {
      const store = await load('window-state.json', { autoSave: true });
      await store.set(WINDOW_STATE_KEY, state);
      return;
    }
  } catch (err) {
    console.warn('[TauriBridge] store save failed:', err);
  }
  localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(state));
}

export async function restoreWindowState(): Promise<WindowState | null> {
  try {
    if (isTauri()) {
      const store = await load('window-state.json', { autoSave: true });
      const raw = await store.get<WindowState>(WINDOW_STATE_KEY);
      if (raw) return raw;
    }
  } catch (err) {
    console.warn('[TauriBridge] store load failed:', err);
  }
  const raw = localStorage.getItem(WINDOW_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WindowState;
  } catch {
    return null;
  }
}

/**
 * Apply persisted geometry to the native window (Tauri only).
 * §195 window state.
 */
export async function applyWindowState(state: WindowState): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow, LogicalSize, LogicalPosition } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    await win.setSize(new LogicalSize(state.width, state.height));
    if (typeof state.x === 'number' && typeof state.y === 'number') {
      await win.setPosition(new LogicalPosition(state.x, state.y));
    }
  } catch (err) {
    console.warn('[TauriBridge] apply window state failed:', err);
  }
}

/** Capture current native window geometry (Tauri only). */
export async function captureWindowState(): Promise<WindowState | null> {
  if (!isTauri()) return null;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    const [size, pos, maximized] = await Promise.all([
      win.innerSize(),
      win.outerPosition(),
      win.isMaximized(),
    ]);
    return {
      width: size.width,
      height: size.height,
      x: pos.x,
      y: pos.y,
      maximized,
    };
  } catch {
    return null;
  }
}

// ─── Local Filesystem — §187, §188, §298 ───

/**
 * Open a native folder picker dialog and return the chosen path.
 * Returns null on cancel or in browser context.
 *
 * IMPORTANT: Tauri capabilities must be narrowly scoped to
 * the chosen folder only (§294). Never grant broad FS access.
 */
export async function pickLocalFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const result = await openDialog({ directory: true, multiple: false });
    return typeof result === 'string' ? result : null;
  } catch {
    return null;
  }
}

// ─── Application update — §309, §309A ───

export interface UpdateInfo {
  available: boolean;
  version?: string;
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  if (!isTauri()) return { available: false };
  try {
    const update: Update | null = await check();
    if (!update) return { available: false };
    return { available: true, version: update.version };
  } catch {
    return { available: false };
  }
}

export async function installUpdate(): Promise<void> {
  if (!isTauri()) return;
  try {
    const update: Update | null = await check();
    if (update) {
      await update.downloadAndInstall();
    }
  } catch (err) {
    console.error('[TauriBridge] update install failed:', err);
  }
}

// ─── External links — §295 ───

/**
 * Open an external URL through the OS default browser.
 * NEVER execute arbitrary shell commands from URL content.
 */
export async function openExternalUrl(url: string): Promise<void> {
  // Validate URL before opening — §292
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      console.warn('[TauriBridge] Blocked non-http URL:', url);
      return;
    }
  } catch {
    console.warn('[TauriBridge] Invalid URL:', url);
    return;
  }

  if (isTauri()) {
    try {
      await openWithShell(url);
      return;
    } catch {
      // fallback to browser
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ─── Clipboard — used by copy-message (§26), code copy (§27) ───

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older contexts
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}