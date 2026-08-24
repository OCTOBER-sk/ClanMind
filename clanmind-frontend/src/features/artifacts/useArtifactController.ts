/**
 * Artifact feature controller (FE §9 — components never touch the api layer
 * directly). Owns the P6 mutation flows:
 *
 *   • Pin / unpin        — optimistic store flip, POST /artifacts/:id/pin,
 *                          rollback + honest error on failure (§88/§257)
 *   • Restore version    — POST /artifacts/:id/restore {version_number},
 *                          merged as the new current version (§102)
 *   • Use-as-context     — §113 confirmation copy ("Odin may reference…")
 *   • Export             — §254 real downloads via exporters
 *
 * The backend stays the security authority: failures surface as toasts and
 * the optimistic state is rolled back, never papered over.
 */

import { useCallback } from 'react';
import { pinArtifact, restoreArtifactVersion } from '@/api/endpoints/artifacts';
import { ApiError } from '@/api/errors';
import { useToast } from '@/design-system/components/Toast';
import { useArtifactStore } from '@/state/useArtifactStore';
import {
  downloadExport,
  supportedExports,
  type ExportFormatId,
} from './exporters';

function failureMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.message) return err.message;
  return fallback;
}

export function useArtifactController() {
  const { toast } = useToast();

  /** §88/§257 — optimistic pin with server reconciliation. */
  const togglePin = useCallback(
    (artifactId: string): void => {
      const before = useArtifactStore.getState().artifacts.find((a) => a.id === artifactId);
      if (!before) return;
      const nextPinned = !before.pinned;
      useArtifactStore.getState().toggleArtifactPin(artifactId);
      void pinArtifact(artifactId, nextPinned)
        .then((row) => {
          // Server truth wins for updated_at ordering.
          useArtifactStore.setState((state) => ({
            artifacts: state.artifacts.map((a) =>
              a.id === row.id ? { ...a, pinned: row.pinned, updated_at: row.updated_at } : a,
            ),
          }));
        })
        .catch((err: unknown) => {
          useArtifactStore.getState().toggleArtifactPin(artifactId); // rollback
          toast({
            title: nextPinned ? "Couldn't pin" : "Couldn't unpin",
            description: failureMessage(err, 'The change was reverted. Try again in a moment.'),
            variant: 'error',
          });
        });
    },
    [toast],
  );

  /** §102 — restore an older version; response becomes the current version. */
  const restoreVersion = useCallback(
    (artifactId: string, versionNumber: number): Promise<boolean> => {
      return restoreArtifactVersion(artifactId, versionNumber)
        .then((row) => {
          const store = useArtifactStore.getState();
          store.mergeArtifactVersion(row);
          store.setActiveVersionNumber(row.current_version);
          toast({
            title: `Restored v${versionNumber}`,
            description: 'It is now the current version. History is preserved.',
            variant: 'success',
          });
          return true;
        })
        .catch((err: unknown) => {
          toast({
            title: "Couldn't restore",
            description: failureMessage(err, 'Nothing was changed. Try again in a moment.'),
            variant: 'error',
          });
          return false;
        });
    },
    [toast],
  );

  /** §113 — context opt-in with the exact expectation-setting copy. */
  const toggleContext = useCallback(
    (artifactId: string): void => {
      const before = useArtifactStore.getState().artifacts.find((a) => a.id === artifactId);
      useArtifactStore.getState().toggleArtifactContext(artifactId);
      if (!before?.used_as_context) {
        toast({
          title: 'Added to Project context',
          description: 'Odin may reference this item when working on this Project.',
        });
      }
    },
    [toast],
  );

  /** §254 — run one supported export; honest failure when a build fails. */
  const exportAs = useCallback(
    (artifactId: string, versionNumber: number, formatId: ExportFormatId): void => {
      const state = useArtifactStore.getState();
      const artifact =
        state.artifacts.find((a) => a.id === artifactId) ?? (state.activeArtifact?.id === artifactId ? state.activeArtifact : null);
      const version =
        artifact?.versions.find((v) => v.version_number === versionNumber) ??
        artifact?.versions[0];
      if (!artifact || !version || !version.content) {
        toast({ title: 'Nothing to export yet', description: 'This version has no content.' });
        return;
      }
      const option = supportedExports(artifact, version).find((o) => o.id === formatId);
      if (!option) return; // never offer what we cannot produce
      void Promise.resolve()
        .then(option.build)
        .then((payload) => {
          if (payload == null) throw new Error('build failed');
          downloadExport(option, payload);
        })
        .catch(() => {
          toast({
            title: "Couldn't export",
            description: `${option.label} could not be generated from this version.`,
            variant: 'error',
          });
        });
    },
    [toast],
  );

  return { togglePin, restoreVersion, toggleContext, exportAs };
}
