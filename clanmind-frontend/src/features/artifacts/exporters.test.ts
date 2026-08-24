/**
 * P6 — artifact exports (FE §254 "only show supported exports").
 * Every advertised format must really build a payload; unsupported formats
 * must never appear.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supportedExports, downloadExport } from './exporters';
import type { Artifact, ArtifactVersion } from '@/types';

function makeArtifact(type: Artifact['artifact_type'], content: string): { artifact: Artifact; version: ArtifactVersion } {
  return {
    artifact: {
      id: 'art_1',
      group_id: 'g1',
      title: 'Telemetry Blueprint',
      artifact_type: type,
      current_version: 1,
      pinned: false,
      used_as_context: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      versions: [{
        version_number: 1,
        content,
        created_by_name: 'Odin',
        created_at: new Date().toISOString(),
      }],
    },
    version: {
      version_number: 1,
      content,
      created_by_name: 'Odin',
      created_at: new Date().toISOString(),
    },
  };
}

describe('supportedExports (§254)', () => {
  it('offers Markdown + JSON for document artifacts', () => {
    const { artifact, version } = makeArtifact('DOCUMENT', '# Hello');
    const ids = supportedExports(artifact, version).map((o) => o.id);
    expect(ids).toContain('markdown');
    expect(ids).toContain('json');
    expect(ids).not.toContain('svg');
    expect(ids).not.toContain('png');
  });

  it('offers SVG + PNG + JSON only when diagram content is parseable', () => {
    const structured = JSON.stringify({ nodes: [{ id: 'a', label: 'A' }], edges: [] });
    const { artifact, version } = makeArtifact('ARCHITECTURE', structured);
    const ids = supportedExports(artifact, version).map((o) => o.id);
    expect(ids).toEqual(expect.arrayContaining(['svg', 'png', 'json']));
    expect(ids).not.toContain('markdown');
  });

  it('withholds SVG/PNG for unparseable diagram content — nothing broken offered', () => {
    const { artifact, version } = makeArtifact('FLOWCHART', '');
    const ids = supportedExports(artifact, version).map((o) => o.id);
    expect(ids).not.toContain('svg');
    expect(ids).not.toContain('png');
  });

  it('offers source export for CODE artifacts', () => {
    const { artifact, version } = makeArtifact('CODE', 'int main(void){return 0;}');
    const ids = supportedExports(artifact, version).map((o) => o.id);
    expect(ids).toContain('source');
  });

  it('builds JSON with the version envelope', async () => {
    const { artifact, version } = makeArtifact('MARKDOWN', '# body');
    const jsonOption = supportedExports(artifact, version).find((o) => o.id === 'json')!;
    const payload = await jsonOption.build();
    const parsed = JSON.parse(String(payload)) as Record<string, unknown>;
    expect(parsed.title).toBe('Telemetry Blueprint');
    expect(parsed.version).toBe(1);
    expect(parsed.content).toBe('# body');
  });

  it('markdown builds byte-exact content', async () => {
    const { artifact, version } = makeArtifact('RESEARCH', '# Findings\n- a');
    const md = supportedExports(artifact, version).find((o) => o.id === 'markdown')!;
    expect(await md.build()).toBe('# Findings\n- a');
  });
});

describe('downloadExport', () => {
  let anchorClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    anchorClick = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => `blob:mock-${anchorClick.mock.calls.length}`),
      revokeObjectURL: vi.fn(),
    });
    const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(((node: Node) => {
      (node as unknown as HTMLAnchorElement).click = anchorClick as unknown as () => void;
      return node;
    }) as never);
    void appendChild;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('triggers a download with the option filename', () => {
    const { artifact, version } = makeArtifact('MARKDOWN', '# x');
    const md = supportedExports(artifact, version).find((o) => o.id === 'markdown')!;
    downloadExport(md, '# x');
    expect(anchorClick).toHaveBeenCalledTimes(1);
  });
});
