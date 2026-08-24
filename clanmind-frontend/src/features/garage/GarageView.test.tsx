/**
 * P6 — Garage sections, ordering and views (FE §87–§90, §257).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider } from '@/design-system/components/Toast';
import { GarageView } from './GarageView';
import { useUiStore } from '@/state/useUiStore';
import type { Artifact } from '@/types';

function artifact(overrides: Partial<Artifact> & { id: string }): Artifact {
  return {
    group_id: 'g1',
    title: `Artifact ${overrides.id}`,
    artifact_type: 'MARKDOWN',
    current_version: 1,
    pinned: false,
    used_as_context: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    versions: [{
      version_number: 1,
      content: 'hello',
      created_by_name: 'Priya Sharma',
      created_at: new Date().toISOString(),
    }],
    ...overrides,
  };
}

const FIXTURES: Artifact[] = [
  artifact({ id: 'a_doc', title: 'Integration Spec', updated_at: new Date(Date.now() - 3_600_000).toISOString() }),
  artifact({
    id: 'a_pinned_old',
    title: 'Pinned Old Diagram',
    artifact_type: 'ARCHITECTURE',
    pinned: true,
    used_as_context: true,
    updated_at: new Date(Date.now() - 86_400_000).toISOString(),
  }),
  artifact({ id: 'a_research', title: 'DMA Benchmarks', artifact_type: 'RESEARCH' }),
];

function cardTitles(container: HTMLElement): Array<string | null> {
  return [...container.querySelectorAll('h3')].map((h) => h.textContent);
}

function renderGarage(items: Artifact[] = FIXTURES) {
  return render(
    <ToastProvider>
      <GarageView artifacts={items} onOpenArtifact={() => {}} />
    </ToastProvider>,
  );
}

describe('GarageView (FE §87–§90)', () => {
  beforeEach(() => {
    useUiStore.setState({ garageViewMode: 'grid' });
  });

  it('renders the §87 section set', () => {
    renderGarage();
    for (const label of ['All', 'Artifacts', 'Files', 'Research', 'Pinned', 'Recent']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('All shows everything with PINNED FIRST regardless of recency (§257)', () => {
    const { container } = renderGarage();
    const titles = cardTitles(container);
    expect(titles.indexOf('Pinned Old Diagram')).toBeLessThan(titles.indexOf('Integration Spec'));
    expect(titles).toContain('DMA Benchmarks');
  });

  it('Research section filters to RESEARCH artifacts only', () => {
    const { container } = renderGarage();
    fireEvent.click(screen.getByRole('button', { name: 'Research' }));
    expect(cardTitles(container)).toEqual(['DMA Benchmarks']);
  });

  it('Pinned section shows only pins', () => {
    const { container } = renderGarage();
    fireEvent.click(screen.getByRole('button', { name: 'Pinned' }));
    expect(cardTitles(container)).toEqual(['Pinned Old Diagram']);
  });

  it('empty Pinned section explains why and what to do next (§179)', () => {
    renderGarage([artifact({ id: 'solo', title: 'Solo Doc' })]);
    fireEvent.click(screen.getByRole('button', { name: 'Pinned' }));
    expect(screen.getByText(/Nothing pinned yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Pin artifacts from the work surface/i)).toBeInTheDocument();
  });

  it('list view renders the §89 columns with creator + version data', () => {
    useUiStore.setState({ garageViewMode: 'list' });
    const { container } = renderGarage();
    for (const column of ['Name', 'Type', 'Updated', 'Creator', 'Version']) {
      expect(container.textContent).toContain(column);
    }
    expect(container.textContent).toContain('Priya Sharma');
  });

  it('diagram cards expose a real SVG preview derived from version content (§88)', () => {
    const diagram = artifact({
      id: 'a_diag',
      title: 'Pipeline',
      artifact_type: 'ARCHITECTURE',
      versions: [{
        version_number: 1,
        content: JSON.stringify({ nodes: [{ id: 'n', label: 'Node A' }], edges: [] }),
        created_by_name: 'Odin',
        created_at: new Date().toISOString(),
      }],
    });
    const { container } = renderGarage([diagram]);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toContain('data:image/svg+xml');
  });

  it('search filters by title across sections', () => {
    const { container } = renderGarage();
    fireEvent.change(screen.getByLabelText('Filter garage items'), {
      target: { value: 'integration' },
    });
    expect(cardTitles(container)).toEqual(['Integration Spec']);
  });
});
