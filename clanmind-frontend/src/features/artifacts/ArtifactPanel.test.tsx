/**
 * P6 — ArtifactPanel behaviors (FE §96/§102/§104/§200/§254/§291).
 * Rendering-level checks: header anatomy, version menu actions, graceful
 * degradation for unknown types, renderer isolation fallbacks.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/design-system/components/Toast';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { ArtifactPanel } from './ArtifactPanel';
import { useArtifactStore } from '@/state/useArtifactStore';
import { useConstructionStore } from './constructionStore';
import type { Artifact } from '@/types';

function makeArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: 'art_doc',
    group_id: 'g1',
    title: 'Integration Spec',
    artifact_type: 'DOCUMENT',
    current_version: 2,
    pinned: false,
    used_as_context: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    versions: [
      {
        version_number: 1,
        content: '# v1 body\n\nHello.',
        created_by_name: 'Arun Kumar',
        created_at: new Date(Date.now() - 3_600_000).toISOString(),
      },
      {
        version_number: 2,
        content: '# v2 body\n\nHello.',
        created_by_name: 'Odin',
        change_summary: 'Rewrote intro.',
        ai_run_id: 'run_9',
        created_at: new Date().toISOString(),
      },
    ],
    ...overrides,
  };
}

function resetStores(): void {
  useArtifactStore.setState({ artifacts: [], activeArtifact: null, rightPanelMode: 'closed', aiRunsByMessage: {} });
  useConstructionStore.setState({ byArtifact: {} });
}

function renderPanel(artifact: Artifact, props: Record<string, unknown> = {}) {
  return render(
    <ToastProvider>
      <ArtifactPanel
        artifact={artifact}
        activeVersionNumber={artifact.current_version}
        compareVersionNumber={null}
        construction={null}
        onClose={() => {}}
        onSelectVersion={() => {}}
        onSetCompareVersion={() => {}}
        {...props}
      />
    </ToastProvider>,
  );
}

describe('ArtifactPanel', () => {
  beforeEach(resetStores);

  it('§96 — header shows name and TYPE · vN line', () => {
    renderPanel(makeArtifact());
    expect(screen.getByText('Integration Spec')).toBeInTheDocument();
    expect(screen.getByText('DOCUMENT')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /version 2/i })).toHaveTextContent('v2');
  });

  it('renders document content through the safe markdown pipeline (§101)', () => {
    renderPanel(makeArtifact());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('v2 body');
  });

  it('§102 — version menu lists creator, time, run info with View/Compare/Restore', async () => {
    renderPanel(makeArtifact());
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /version 2/i }));
    expect(await screen.findByText(/AI run/)).toBeInTheDocument();

    // Restore is offered for the NON-current version only.
    expect(screen.getByRole('button', { name: /restore version 1/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restore version 2/i })).not.toBeInTheDocument();
    // Compare targets any other version.
    expect(screen.getByRole('button', { name: /compare current with version 1/i })).toBeInTheDocument();
  });

  it('§200 — unknown artifact types show the update-to-view card, no crash', () => {
    const exotic = makeArtifact({
      artifact_type: 'OTHER',
      versions: [{ version_number: 1, content: '{}', created_by_name: 'Odin', created_at: new Date().toISOString() }],
    });
    renderPanel(exotic);
    expect(screen.getByText(/newer ClanMind version/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export json/i })).toBeInTheDocument();
  });

  it('§291 — a crashing renderer is contained by its error boundary', () => {
    // The panel wraps each viewer in an ErrorBoundary whose custom fallback
    // IS the §291 isolation surface. Prove containment at the mechanism level.
    function Bomb(): null {
      throw new Error('renderer exploded');
    }
    const { container } = render(
      <ToastProvider>
        <ErrorBoundary label="Diagram renderer" fallback={<div>renderer isolated</div>}>
          <Bomb />
        </ErrorBoundary>
      </ToastProvider>,
    );
    expect(container.textContent).toContain('renderer isolated');
  });

  it('§254 — export menu only advertises supported formats for the type', async () => {
    const structured = JSON.stringify({ nodes: [{ id: 'a', label: 'N' }], edges: [] });
    const diagram = makeArtifact({
      artifact_type: 'ARCHITECTURE',
      versions: [{ version_number: 2, content: structured, created_by_name: 'Odin', created_at: new Date().toISOString() }],
    });
    renderPanel(diagram);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /more artifact actions/i }));
    const menu = await screen.findByRole('menu');
    const labels = menu.textContent ?? '';
    expect(labels).toContain('SVG');
    expect(labels).toContain('PNG');
    expect(labels).toContain('JSON');
    expect(labels).not.toContain('Markdown');
  });

  it('§110 — More menu carries Use as Project Context and Send to Chat', async () => {
    renderPanel(makeArtifact(), { onSendToChat: () => {} });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /more artifact actions/i }));
    const menu = await screen.findByRole('menu');
    expect(menu.textContent).toContain('Use as Project Context');
    expect(menu.textContent).toContain('Send to Chat');
  });
});

