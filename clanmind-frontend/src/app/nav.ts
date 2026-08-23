/**
 * Shared navigation vocabulary — imported by both the router and the shell,
 * kept dependency-free to avoid module cycles.
 */

import type { MainNavSection } from '@/state/useUiStore';

export const NAV_SECTION_PATHS: readonly MainNavSection[] = [
  'chat',
  'overview',
  'garage',
  'team',
  'tasks',
  'decisions',
  'memory',
  'activity',
  'settings',
];

const SECTION_SET = new Set<string>(NAV_SECTION_PATHS);

/** Extract the nav section from a shell URL segment (defaults to chat). */
export function sectionFromPathname(pathname: string): MainNavSection {
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1] ?? '';
  return (SECTION_SET.has(last) ? last : 'chat') as MainNavSection;
}

export function shellBasePath(groupId: string, projectId?: string | null): string {
  return projectId ? `/group/${groupId}/project/${projectId}` : `/group/${groupId}`;
}
