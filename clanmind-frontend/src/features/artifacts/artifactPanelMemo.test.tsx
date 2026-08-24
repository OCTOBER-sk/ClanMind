/**
 * P14 — ArtifactPanel memo contract (FE §203/§288).
 *
 * §203 forbids re-rendering the artifact surface per stream batch; §288 ranks
 * composer typing above all else ("No animation is allowed to cause typing
 * lag"). AppShell subscribes to whole stores, so every keystroke re-renders
 * AppShell; the panel survives that ONLY via its export-boundary memo plus
 * referentially stable callback props (store actions / useCallback upstream).
 *
 * Instrument: DocumentViewer is mocked with a render counter. It is an
 * always-mounted child for DOCUMENT artifacts, so its invocation count equals
 * actual panel-body renders — a keystroke-shaped parent render must invoke it
 * ZERO additional times.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const viewerRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock('./DocumentViewer', () => ({
  DocumentViewer: () => {
    viewerRenders.count += 1;
    return <div data-testid="document-viewer-stub" />;
  },
}));

import { ToastProvider } from '@/design-system/components/Toast';
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
        version_number: 2,
        content: '# v2 body\n\nHello.',
        created_by_name: 'Odin',
        created_at: new Date().toISOString(),
      },
    ],
    ...overrides,
  };
}

/**
 * Stable handler identities — the POST-P14 AppShell wiring: zustand actions
 * and useCallback-wrapped callbacks keep referential equality across shell
 * re-renders. Shallow memo comparison then bails out on keystroke renders.
 */
function stableHandlers() {
  return {
    onClose: () => {},
    onSelectVersion: () => {},
    onSetCompareVersion: () => {},
    onAskOdinAboutNode: () => {},
    onSendToChat: () => {},
  };
}

const HANDLERS = stableHandlers();

function panelProps(artifact: Artifact) {
  return {
    ...HANDLERS,
    artifact,
    activeVersionNumber: artifact.current_version,
    compareVersionNumber: null as number | null,
    construction: null,
  };
}

function renderPanel(props: ReturnType<typeof panelProps>) {
  return render(
    <ToastProvider>
      <ArtifactPanel {...props} />
    </ToastProvider>,
  );
}

describe('ArtifactPanel memo contract (§203/§288)', () => {
  beforeEach(() => {
    useArtifactStore.setState({ artifacts: [], activeArtifact: null, rightPanelMode: 'closed', aiRunsByMessage: {} });
    useConstructionStore.setState({ byArtifact: {} });
    viewerRenders.count = 0;
  });

  it('keystroke-shaped parent render (fresh callbacks, same inputs) costs ZERO viewer work', () => {
    const artifact = makeArtifact();
    const view = renderPanel(panelProps(artifact));
    expect(view.container.querySelector('[data-testid="document-viewer-stub"]')).not.toBeNull();
    const afterMount = viewerRenders.count;
    expect(afterMount).toBeGreaterThanOrEqual(1);

    // Same data props, ALL-NEW inline lambdas — exactly a composer-keystroke render.
    view.rerender(
      <ToastProvider>
        <ArtifactPanel {...panelProps(artifact)} />
      </ToastProvider>,
    );

    expect(viewerRenders.count).toBe(afterMount);
  });

  it('re-renders when a real input changes (artifact row update reaches the header)', () => {
    const view = renderPanel(panelProps(makeArtifact()));
    const afterMount = viewerRenders.count;

    const renamed = makeArtifact({ title: 'Renamed Spec' });
    view.rerender(
      <ToastProvider>
        <ArtifactPanel {...panelProps(renamed)} />
      </ToastProvider>,
    );

    expect(viewerRenders.count).toBeGreaterThan(afterMount);
    expect(view.container.textContent).toContain('Renamed Spec');
  });
});
