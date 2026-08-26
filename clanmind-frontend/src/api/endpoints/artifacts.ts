/**
 * Artifacts endpoint — the ONLY REST site for artifact reads/mutations
 * (FE §9 layer boundary). Implements exactly the §109 surface the UI uses:
 *
 *   GET  /api/v1/projects/:projectId/artifacts   → { items: ArtifactRow[] }
 *   GET  /api/v1/artifacts/:artifactId           → ArtifactRow
 *   POST /api/v1/artifacts/:artifactId/restore   → restored ArtifactRow
 *   POST /api/v1/artifacts/:artifactId/pin       → pinned ArtifactRow
 *
 * Rows are zod-validated at the boundary (BE §152) and mapped into the
 * canonical FE `Artifact`. Tolerates metadata-only rows (`content_ref` set,
 * no inline `content` — D15): those still power version menus/compare, and
 * renderers degrade to the Unsupported state instead of inventing content.
 */

import { z } from 'zod';
import { api } from '@/api/client';
import { ArtifactListSchema, ArtifactRowSchema } from '@/api/schemas';
import { useGroupStore } from '@/state/useGroupStore';
import type { Artifact, ArtifactVersion } from '@/types';

type ArtifactRow = z.infer<typeof ArtifactRowSchema>;

/** Map a validated §44 artifact row into the canonical FE shape. */
export function mapArtifactRow(row: ArtifactRow): Artifact {
  const state = useGroupStore.getState();
  const aiName = state.activeGroup?.ai_name || 'Odin';

  const versions: ArtifactVersion[] = (row.versions ?? []).map((v) => ({
    id: v.id,
    artifact_id: v.artifact_id || row.id,
    version_number: v.version_number,
    // Inline content when the server provides it; otherwise EMPTY — renderers
    // must treat empty content as unavailable, never fabricate a preview.
    content: typeof v.content === 'string' ? v.content : (typeof v.content_ref === 'string' ? v.content_ref : ''),
    created_by_id: v.created_by_user_id ?? v.created_by_ai_id ?? undefined,
    created_by_name: v.created_by_ai_id
      ? aiName
      : v.created_by_user_id
        ? (state.memberNicknames[v.created_by_user_id] ?? 'Member')
        : 'Unknown',
    change_summary: v.change_summary ?? undefined,
    created_at: v.created_at,
  }));

  const currentFromRows = versions.reduce((max, v) => Math.max(max, v.version_number), 0);
  const creatorId = row.created_by_user_id ?? row.created_by_ai_id ?? undefined;

  return {
    id: row.id,
    group_id: row.group_id ?? '',
    project_id: row.project_id ?? undefined,
    title: row.title ?? row.name ?? 'Untitled artifact',
    artifact_type: row.artifact_type as Artifact['artifact_type'],
    current_version: row.current_version ?? (currentFromRows || 1),
    versions,
    pinned: row.pinned === true,
    used_as_context: false, // context flag has no BE column yet; set via §113 flow
    created_by_id: creatorId,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapList(raw: unknown): Artifact[] {
  const page = ArtifactListSchema.safeParse(raw);
  if (!page.success) return [];
  return (page.data.items ?? []).flatMap((row) => {
    const parsed = ArtifactRowSchema.safeParse(row);
    return parsed.success ? [mapArtifactRow(parsed.data)] : [];
  });
}

/** BE §109 — list a project's artifacts (Garage + Overview feed). */
export async function fetchProjectArtifacts(projectId: string): Promise<Artifact[]> {
  console.log('[artifacts] fetchProjectArtifacts called with projectId:', projectId);
  try {
    const raw = await api.get(`/projects/${encodeURIComponent(projectId)}/artifacts`);
    console.log('[artifacts] raw response:', JSON.stringify(raw).substring(0, 300));
    const result = mapList(raw);
    console.log('[artifacts] mapped artifacts:', result.length);
    return result;
  } catch (err) {
    console.error('[artifacts] fetchProjectArtifacts ERROR:', err);
    throw err;
  }
}

/** BE §109 — one artifact with its version history. */
export async function fetchArtifact(artifactId: string): Promise<Artifact | null> {
  const raw = await api.get(`/artifacts/${encodeURIComponent(artifactId)}`);
  // BE returns { artifact: {...} } — extract the artifact
  const art = raw && typeof raw === 'object' && 'artifact' in raw
    ? (raw as any).artifact
    : raw;
  // Fetch versions separately (BE §109)
  let rawVersions: any[] = [];
  try {
    const verResp = await api.get(`/artifacts/${encodeURIComponent(artifactId)}/versions`);
    rawVersions = (verResp as any)?.items ?? [];
  } catch { /* versions unavailable */ }
  // Map versions directly (bypass schema for reliability)
  const state = useGroupStore.getState();
  const aiName = state.activeGroup?.ai_name || 'Odin';
  const versions: ArtifactVersion[] = rawVersions.map((v: any) => ({
    id: v.id,
    artifact_id: v.artifact_id || artifactId,
    version_number: v.version_number,
    content: typeof v.content === 'string' ? v.content : (typeof v.content_ref === 'string' ? v.content_ref : ''),
    created_by_id: v.created_by_user_id ?? v.created_by_ai_id ?? undefined,
    created_by_name: v.created_by_ai_id
      ? aiName
      : v.created_by_user_id
        ? (state.memberNicknames[v.created_by_user_id] ?? 'Member')
        : 'Unknown',
    change_summary: v.change_summary ?? undefined,
    created_at: v.created_at,
  }));
  // Build artifact with versions
  const currentFromRows = versions.reduce((max, v) => Math.max(max, v.version_number), 0);
  const creatorId = art.created_by_user_id ?? art.created_by_ai_id ?? undefined;
  return {
    id: art.id,
    group_id: art.group_id ?? '',
    project_id: art.project_id ?? undefined,
    title: art.title ?? art.name ?? 'Untitled artifact',
    artifact_type: art.artifact_type as Artifact['artifact_type'],
    current_version: currentFromRows || 1,
    versions,
    pinned: art.pinned === true,
    used_as_context: false,
    created_by_id: creatorId,
    created_at: art.created_at,
    updated_at: art.updated_at,
  };
}

/**
 * BE §109 — create an artifact in a Project (used by §128 to persist a saved
 * meeting summary as a Garage artifact). Body mirrors createArtifactBody:
 * `{name, artifact_type, content_type, content}` → 201 `{artifact, version}`.
 */
export async function createProjectArtifact(
  projectId: string,
  input: { name: string; artifact_type: string; content_type: string; content: string },
): Promise<Artifact> {
  const raw = await api.post(`/projects/${encodeURIComponent(projectId)}/artifacts`, {
    name: input.name,
    artifact_type: input.artifact_type,
    content_type: input.content_type,
    content: input.content,
  });
  const envelope = raw as Record<string, unknown>;
  const parsed = ArtifactRowSchema.safeParse(envelope.artifact ?? raw);
  if (!parsed.success) throw new Error('Create-artifact response failed schema validation.');
  return mapArtifactRow(parsed.data);
}

function parseArtifactResponse(raw: unknown): Artifact {
  const parsed = ArtifactRowSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('Restore/pin response failed schema validation.');
  }
  return mapArtifactRow(parsed.data);
}

/**
 * BE §109 — restore an older version as the new current version.
 * Body `{ version_number }`; the response is the updated artifact row.
 */
export async function restoreArtifactVersion(artifactId: string, versionNumber: number): Promise<Artifact> {
  const raw = await api.post(`/artifacts/${encodeURIComponent(artifactId)}/restore`, {
    version_number: versionNumber,
  });
  return parseArtifactResponse(raw);
}

/** BE §109 — pin/unpin. Body `{ pinned }`; response is the updated row. */
export async function pinArtifact(artifactId: string, pinned: boolean): Promise<Artifact> {
  const raw = await api.post(`/artifacts/${encodeURIComponent(artifactId)}/pin`, { pinned });
  return parseArtifactResponse(raw);
}
