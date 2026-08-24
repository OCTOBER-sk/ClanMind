/**
 * Artifact export builders (FE §254 — "only show supported exports").
 *
 * Every listed format is REALLY generated client-side and downloaded:
 *   • Markdown  — DOCUMENT/MARKDOWN/RESEARCH bodies
 *   • SVG       — diagram-family artifacts, serialized from the same
 *                 deterministic layout the interactive renderer uses
 *   • PNG       — that SVG rasterized through an offscreen canvas
 *   • JSON      — any structured version content
 *   • Source    — CODE artifacts, byte-exact
 *
 * PDF is deliberately NOT offered: the client has no honest PDF producer,
 * and §254 forbids showing unsupported formats.
 */

import { parseDiagramContent, diagramToSvg } from './diagramUtils';
import type { Artifact, ArtifactType, ArtifactVersion } from '@/types';

export type ExportFormatId = 'markdown' | 'svg' | 'png' | 'json' | 'source';

export interface ExportOption {
  id: ExportFormatId;
  label: string;
  filename: string;
  /** Builds the payload; resolves null when the format can't be produced. */
  build: () => Promise<string | Blob | null> | string | Blob | null;
}

const DIAGRAM_FAMILY: ReadonlySet<ArtifactType> = new Set([
  'DIAGRAM',
  'FLOWCHART',
  'ARCHITECTURE',
  'GRAPH',
  'TIMELINE',
  'MINDMAP',
  'DECISION_TREE',
] as ArtifactType[]);

const DOC_FAMILY: ReadonlySet<ArtifactType> = new Set(['DOCUMENT', 'MARKDOWN', 'RESEARCH'] as ArtifactType[]);

function slugify(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return slug || 'artifact';
}

async function svgToPngBlob(svg: string): Promise<Blob | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG decode failed'));
      img.src = url;
    });
    const width = Math.max(1, img.naturalWidth || 1024);
    const height = Math.max(1, img.naturalHeight || 768);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * The export surface for one artifact version. Only genuinely producible
 * formats appear; a diagram whose content cannot be parsed loses SVG/PNG
 * rather than exporting something broken.
 */
export function supportedExports(artifact: Artifact, version: ArtifactVersion): ExportOption[] {
  const base = slugify(artifact.title);
  const type = artifact.artifact_type;
  const options: ExportOption[] = [];

  if (DOC_FAMILY.has(type)) {
    options.push({
      id: 'markdown',
      label: 'Markdown (.md)',
      filename: `${base}.md`,
      build: () => version.content,
    });
  }

  if (type === 'CODE') {
    options.push({
      id: 'source',
      label: 'Source file (.txt)',
      filename: `${base}.txt`,
      build: () => version.content,
    });
  }

  if (DIAGRAM_FAMILY.has(type)) {
    const parsed = parseDiagramContent(version.content);
    if (parsed) {
      const svg = diagramToSvg(parsed.content, artifact.title);
      options.push({ id: 'svg', label: 'SVG vector (.svg)', filename: `${base}.svg`, build: () => svg });
      options.push({
        id: 'png',
        label: 'PNG image (.png)',
        filename: `${base}.png`,
        build: () => svgToPngBlob(svg),
      });
    }
  }

  // JSON is always available — it IS the stored version content envelope.
  options.push({
    id: 'json',
    label: 'JSON data (.json)',
    filename: `${base}.json`,
    build: () =>
      JSON.stringify(
        {
          id: artifact.id,
          title: artifact.title,
          artifact_type: artifact.artifact_type,
          version: version.version_number,
          content: version.content,
        },
        null,
        2,
      ),
  });

  return options;
}

/** Trigger a browser download for a built export payload. */
export function downloadExport(option: ExportOption, payload: string | Blob): void {
  const blob = typeof payload === 'string' ? new Blob([payload], { type: 'text/plain;charset=utf-8' }) : payload;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = option.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
