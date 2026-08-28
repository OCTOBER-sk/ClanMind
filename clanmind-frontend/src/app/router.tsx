/**
 * Route tree — stable deep-linkable URLs per FE §193:
 *   /auth · /onboarding · /group/:groupId/:section ·
 *   /group/:groupId/project/:projectId/:section
 * plus object deep links (/message/:id, /artifact/:id, /task/:id,
 * /decision/:id, /meeting/:id) that resolve into Group context (FE §177).
 *
 * Sections are flat routes that all render the AppShell; the shell derives
 * its center-pane content from the URL (single layout tree, no Outlet split).
 */

import {
  createBrowserRouter,
  Navigate,
  useNavigate,
  useParams,
} from 'react-router';
import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useAuthStore } from '@/state/useAuthStore';
import { useGroupStore } from '@/state/useGroupStore';
import { useUiStore } from '@/state/useUiStore';
import { useChatStore } from '@/state/useChatStore';
import { useArtifactStore } from '@/state/useArtifactStore';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import { AppShell } from '@/features/shell/AppShell';
import { AuthScreen } from '@/features/auth/AuthScreen';
import { OnboardingWizard } from '@/features/onboarding/CreateGroupOnboarding';
import { NAV_SECTION_PATHS, sectionFromPathname, shellBasePath } from '@/app/nav';
import { createGroup } from '@/api/endpoints/groups';
import { createProject } from '@/api/endpoints/projects';
import { useToast } from '@/design-system/components/Toast';

export { NAV_SECTION_PATHS, sectionFromPathname };

// ─── Guards & redirects ──────────────────────────────────────────────────────

function RequireAuth({ children }: { children: ReactElement }): ReactElement {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return children;
}

function GuestOnly({ children }: { children: ReactElement }): ReactElement {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

/** FE §69/§196 — signed-in users land in their Group; new accounts onboard. */
function RootRedirect(): ReactElement {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onboardingComplete = useUiStore((s) => s.onboardingComplete);
  const groups = useGroupStore((s) => s.groups);
  const activeGroup = useGroupStore((s) => s.activeGroup);

  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (!onboardingComplete && groups.length === 0) return <Navigate to="/onboarding" replace />;

  const target = activeGroup ?? groups[0];
  if (!target) return <Navigate to="/onboarding" replace />;
  return <Navigate to={`/group/${target.id}/chat`} replace />;
}

/** FE §70 — onboarding completion creates the first Group, then enters it. */
function OnboardingRoute(): ReactElement {
  const navigate = useNavigate();
  const { toast } = useToast();
  const onboardingComplete = useUiStore((s) => s.onboardingComplete);
  const groups = useGroupStore((s) => s.groups);

  // FE §69/§196 — if the user already has a Group (invitee, or completion raced
  // a reload), the wizard must not trap them: exit to the Group once data lands
  // and self-heal the persisted flag so future cold loads skip the redirect.
  useEffect(() => {
    if (groups.length > 0) {
      if (!onboardingComplete) useUiStore.getState().setOnboardingComplete(true);
      navigate(`/group/${groups[0].id}/chat`, { replace: true });
    }
  }, [onboardingComplete, groups, navigate]);

  const handleComplete = async (
    groupName: string,
    projectName: string,
    aiName: string,
  ): Promise<void> => {
    const { addGroup, addProject } = useGroupStore.getState();
    const { setOnboardingComplete } = useUiStore.getState();

    try {
      const group = await createGroup({ name: groupName, description: '' });
      addGroup(group);
      if (projectName.trim()) {
        const proj = await createProject(group.id, { name: projectName.trim() });
        addProject(proj);
      }
      setOnboardingComplete(true);
      navigate(`/group/${group.id}/chat`, { replace: true });
    } catch (err) {
      toast({
        title: 'Failed to create group',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'error',
      });
    }
  };

  return <OnboardingWizard onComplete={handleComplete} />;
}

function AuthRoute(): ReactElement {
  return <AuthScreen />;
}

// ─── Object deep links ───────────────────────────────────────────────────────

type ObjectKind = 'message' | 'artifact' | 'task' | 'decision' | 'meeting';

/**
 * Resolve an object id to its Group/Project context and navigate there
 * (FE §177: switch Group → Project → load → scroll/highlight happens in-chat).
 * Unknown ids fall back to the safest shared surface rather than erroring.
 */
function ObjectRedirect({ kind }: { kind: ObjectKind }): null {
  const navigate = useNavigate();
  const params = useParams<{ objectId?: string }>();
  const objectId = params.objectId ?? '';

  queueMicrotask(() => {
    navigate(resolveObjectLocation(kind, objectId) ?? '/', { replace: true });
  });
  return null;
}

function resolveObjectLocation(kind: ObjectKind, id: string): string | null {
  if (!id) return null;

  if (kind === 'message') {
    const m = useChatStore.getState().messages.find((x) => x.id === id);
    if (!m) return null;
    return shellPath(m.group_id, m.project_id ?? undefined);
  }
  if (kind === 'artifact') {
    const a = useArtifactStore.getState().artifacts.find((x) => x.id === id);
    if (!a) return null;
    return shellPath(a.group_id, a.project_id ?? undefined);
  }
  if (kind === 'task') {
    // §48 — tasks carry no group_id; the enclosing Project resolves it.
    const t = useProjectDataStore.getState().tasks.find((x) => x.id === id);
    if (!t) return null;
    const group = useGroupStore
      .getState()
      .projects.find((p) => p.id === t.project_id)?.group_id;
    return shellPath(group ?? '', t.project_id);
  }
  if (kind === 'decision') {
    const d = useProjectDataStore.getState().decisions.find((x) => x.id === id);
    if (!d) return null;
    const group = useGroupStore
      .getState()
      .projects.find((p) => p.id === d.project_id)?.group_id;
    return shellPath(group ?? '', d.project_id);
  }
  // Meetings resolve through the session list in P9; safest shared surface now.
  const g = useGroupStore.getState().activeGroup ?? useGroupStore.getState().groups[0];
  return g ? `/group/${g.id}/chat` : null;
}

function shellPath(groupId: string, projectId?: string | null): string {
  return `${shellBasePath(groupId, projectId)}/chat`;
}

/** `/group/:groupId` and `/group/:groupId/project/:projectId` → chat section. */
function GroupIndexRedirect(): null {
  const navigate = useNavigate();
  const { groupId, projectId } = useParams<{ groupId?: string; projectId?: string }>();
  queueMicrotask(() => {
    if (groupId) navigate(shellPath(groupId, projectId), { replace: true });
    else navigate('/', { replace: true });
  });
  return null;
}

// ─── Router factory ──────────────────────────────────────────────────────────

function shellRoute(path: string): { path: string; element: ReactElement } {
  return {
    path,
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
  };
}

export function createAppRouter() {
  const groupSections = NAV_SECTION_PATHS.map(
    (section) => shellRoute(`/group/:groupId/${section}`),
  );
  const projectSections = NAV_SECTION_PATHS.map(
    (section) => shellRoute(`/group/:groupId/project/:projectId/${section}`),
  );

  return createBrowserRouter([
    { path: '/', element: <RootRedirect /> },
    { path: '/auth', element: <GuestOnly><AuthRoute /></GuestOnly> },
    { path: '/onboarding', element: <RequireAuth><OnboardingRoute /></RequireAuth> },

    // Bare group / project paths redirect into the chat section
    { path: '/group/:groupId', element: <GroupIndexRedirect /> },
    { path: '/group/:groupId/project/:projectId', element: <GroupIndexRedirect /> },

    ...groupSections,
    ...projectSections,

    // Object deep links (FE §193)
    { path: '/message/:objectId', element: <ObjectRedirect kind="message" /> },
    { path: '/artifact/:objectId', element: <ObjectRedirect kind="artifact" /> },
    { path: '/task/:objectId', element: <ObjectRedirect kind="task" /> },
    { path: '/decision/:objectId', element: <ObjectRedirect kind="decision" /> },
    { path: '/meeting/:objectId', element: <ObjectRedirect kind="meeting" /> },

    { path: '*', element: <RootRedirect /> },
  ]);
}
