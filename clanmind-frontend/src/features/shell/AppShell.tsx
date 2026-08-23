import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { sectionFromPathname } from '@/app/nav';
import { TopBar } from './TopBar';
import { LeftNav } from './LeftNav';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import { MessageList } from '@/features/chat/MessageList';
import { Composer } from '@/features/chat/Composer';
import { useChatController } from '@/features/chat/useChatController';
import { ArtifactPanel } from '@/features/artifacts/ArtifactPanel';
import { ThreadPanel } from '@/features/chat/ThreadPanel';
import { MeetingActiveHeader } from '@/features/meetings/MeetingActiveHeader';
import { MeetingPanel } from '@/features/meetings/MeetingPanel';
import { MeetingStartDialog, MeetingEndSummaryDialog } from '@/features/meetings/MeetingDialogs';
import { GitHubDiffViewer } from '@/features/approvals/GitHubDiffViewer';
import { ApprovalCard } from '@/features/approvals/ApprovalCard';
import { ContextInspector } from '@/features/artifacts/ContextInspector';
import { ResearchDrawer } from '@/features/ai/ResearchDrawer';
import { SyncConflictCard } from '@/features/sync/SyncConflictCard';
import { SyncBanner } from '@/features/sync/SyncBanner';
import { GarageView } from '@/features/garage/GarageView';
import { ProjectOverview } from '@/features/projects/ProjectOverview';
import { TasksView } from '@/features/tasks/TasksView';
import { DecisionsView } from '@/features/decisions/DecisionsView';
import { MemoryView } from '@/features/memory/MemoryView';
import { TeamView } from '@/features/team/TeamView';
import { SettingsView } from '@/features/settings/SettingsView';
import { ActivityView } from '@/features/notifications/ActivityView';
import { CreateGroupDialog } from '@/features/groups/CreateGroupDialog';
import { JoinGroupDialog } from '@/features/groups/JoinGroupDialog';
import { CommandPalette } from '@/design-system/components/CommandPalette';
import { Dialog } from '@/design-system/components/Dialog';
import { Button } from '@/design-system/components/Button';
import { useToast } from '@/design-system/components/Toast';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { useAuthStore } from '@/state/useAuthStore';
import { useGroupStore } from '@/state/useGroupStore';
import { useChatStore } from '@/state/useChatStore';
import { useArtifactStore } from '@/state/useArtifactStore';
import { useMeetingStore } from '@/state/useMeetingStore';
import { useSyncStore } from '@/state/useSyncStore';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import { useUiStore } from '@/state/useUiStore';
import { AlertOctagon, X } from 'lucide-react';
import type { Message, Task, Decision, MainNavSection, MeetingCandidate } from '@/types';
import { applyWindowState, captureWindowState, checkForUpdate, installUpdate, restoreWindowState, saveWindowState } from '@/tauri/bridge';

/** §249/§220: right panel resize with keyboard alternative */
function PanelResizer({ width, onResize }: { width: number; onResize: (w: number) => void }) {
  const MIN = 320;
  const MAX = 640;
  const draggingRef = useRef(false);

  const clamp = (w: number) => Math.min(Math.max(w, MIN), MAX);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    onResize(clamp(width - e.movementX));
  };

  const onPointerUp = () => {
    draggingRef.current = false;
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={MIN}
      aria-valuemax={MAX}
      aria-label="Resize work surface panel"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onResize(clamp(width - 16));
        if (e.key === 'ArrowRight') onResize(clamp(width + 16));
        if (e.key === 'Home') onResize(MIN);
        if (e.key === 'End') onResize(MAX);
      }}
      className="w-1 shrink-0 cursor-col-resize select-none touch-none outline-none focus-visible:shadow-[var(--focus-ring)]"
      style={{ background: 'var(--color-border)' }}
    />
  );
}

export function AppShell() {
  const { user } = useAuthStore();
  const { logout } = useAuthStore();
  const {
    groups,
    activeGroup,
    projects,
    activeProject,
    members,
    featureFlags,
    memberNicknames,
    setActiveGroup,
    setActiveProject,
    setMemberNickname,
  } = useGroupStore();

  const {
    messages,
    replyTarget,
    composerText,
    composerAttachments,
    visibility,
    privateRecipientName,
    typingUsers,
    lastReadMessageIdByScope,
    pendingMessages,
    setComposerText,
    addMessage,
    updateMessage,
    deleteMessage,
    addReaction,
    setReplyTarget,
    addComposerAttachment,
    removeComposerAttachment,
    setVisibility,
    setProjectFilterId,
    saveDraft,
    loadDraft,
    markScopeRead,
    confirmPendingMessage,
  } = useChatStore();

  const {
    rightPanelMode,
    activeArtifact,
    activeVersionNumber,
    compareVersionNumber,
    artifacts,
    aiRunsByMessage,
    setRightPanelMode,
    setActiveVersionNumber,
    setCompareVersionNumber,
    toggleArtifactPin,
    toggleArtifactContext,
    openArtifactPanel,
    closeRightPanel,
  } = useArtifactStore();

  const {
    isMeetingActive,
    isMeetingPaused,
    elapsedSeconds,
    currentSession,
    pauseMeeting,
    resumeMeeting,
    endMeeting,
    tickTimer,
    addLiveNote,
    updateCandidateStatus,
    restoreCandidate,
    setStartDialogOpen,
  } = useMeetingStore();

  const {
    status: syncStatus,
    conflicts,
    resolveConflict,
    protocolMismatch,
    recommendedUpdate,
    removeOperation: removeSyncOperation,
    setRecommendedUpdate,
    dismissRecommendedUpdate,
  } = useSyncStore();

  const {
    tasks,
    decisions,
    memories,
    memoryCandidates,
    notifications,
    aiActions,
    addTask,
    updateTask,
    addDecision,
    addMemory,
    removeMemoryCandidate,
    updateAiAction,
    refreshAiAction,
  } = useProjectDataStore();

  const {
    theme,
    toggleTheme,
    isCommandPaletteOpen,
    isKeyboardHelpOpen,
    rightPanelWidth,
    isCreateGroupDialogOpen,
    setCommandPaletteOpen,
    setKeyboardHelpOpen,
    setRightPanelWidth,
    setCreateGroupDialogOpen,
  } = useUiStore();

  // ─── §193 — the URL is authoritative for Group/Project/section context ────
  const navigate = useNavigate();
  const location = useLocation();
  const routeParams = useParams<{ groupId?: string; projectId?: string }>();

  const routeGroupId = routeParams.groupId ?? null;
  const routeProjectId = routeParams.projectId ?? null;
  const activeNavSection = sectionFromPathname(location.pathname);

  const groupForRoute = groups.find((g) => g.id === routeGroupId) ?? null;
  const projectForRoute = routeProjectId
    ? projects.find((p) => p.id === routeProjectId) ?? null
    : null;

  const navigateToSection = useCallback(
    (section: MainNavSection) => {
      if (!routeGroupId) return;
      const base = projectForRoute
        ? `/group/${routeGroupId}/project/${projectForRoute.id}`
        : `/group/${routeGroupId}`;
      navigate(`${base}/${section}`);
    },
    [navigate, routeGroupId, projectForRoute],
  );

  // Keep store selection aligned with the route (single source of truth = URL).
  useEffect(() => {
    if (groupForRoute && activeGroup?.id !== groupForRoute.id) {
      setActiveGroup(groupForRoute);
    }
    if (projectForRoute && activeProject?.id !== projectForRoute.id) {
      setActiveProject(projectForRoute);
      setProjectFilterId(projectForRoute.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeGroupId, routeProjectId]);

  const { toast } = useToast();
  useGlobalShortcuts();

  const [activeThreadMessage, setActiveThreadMessage] = useState<Message | null>(null);
  const [isJoinGroupDialogOpen, setJoinGroupDialogOpen] = useState(false);

  // Quick Action Dialog States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');

  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [decisionTitle, setDecisionTitle] = useState('');
  const [decisionReason, setDecisionReason] = useState('');

  // ─── Chat pipeline (refactor R1) — send/retry/AI-trigger live in the
  // chat controller; the shell only wires UI events to it. ───────────────────
  const { sendMessage, retryMessage } = useChatController();
  const handleSendMessage = useCallback(() => sendMessage(), [sendMessage]);
  const handleRetryMessage = retryMessage;

  // ─── §190 drafts: persist per account:group:project scope; restore on switch ───
  const scopeKey = `${user?.id ?? 'anon'}:${groupForRoute?.id ?? 'none'}:${projectForRoute?.id ?? 'group'}`;

  useEffect(() => {
    saveDraft(scopeKey, composerText);
  }, [composerText, scopeKey, saveDraft]);

  useEffect(() => {
    loadDraft(scopeKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey]);

  // ─── §183/§186A.2: when connectivity returns, acknowledge queued messages ───
  useEffect(() => {
    if (syncStatus === 'connected' && pendingMessages.length > 0) {
      const t = setTimeout(() => {
        pendingMessages.forEach((p) => {
          confirmPendingMessage(p.clientMessageId);
          removeSyncOperation(p.clientMessageId);
        });
      }, 800);
      return () => clearTimeout(t);
    }
  }, [syncStatus, pendingMessages, confirmPendingMessage, removeSyncOperation]);

  // ─── §195 Window state persistence ───
  useEffect(() => {
    let disposed = false;
    (async () => {
      const saved = await restoreWindowState();
      if (saved && !disposed) {
        await applyWindowState(saved);
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let last = 0;
    const save = async () => {
      const now = Date.now();
      if (now - last < 1000) return;
      last = now;
      const state = await captureWindowState();
      if (state) await saveWindowState(state);
    };
    window.addEventListener('resize', save);
    window.addEventListener('beforeunload', save);
    return () => {
      window.removeEventListener('resize', save);
      window.removeEventListener('beforeunload', save);
    };
  }, []);

  // ─── §309A.1 Recommended-but-not-required update check ───
  useEffect(() => {
    let disposed = false;
    (async () => {
      const result = await checkForUpdate();
      if (!disposed && result.available) {
        setRecommendedUpdate({ available: true, version: result.version });
      }
    })();
    return () => {
      disposed = true;
    };
  }, [setRecommendedUpdate]);

  // ─── §165A.3: re-fetch per-Group flags on switch ───
  useEffect(() => {
    if (activeGroup) {
      useGroupStore.getState().refetchFeatureFlags(activeGroup.id);
    }
  }, [activeGroup]);

  // ─── §123: live meeting timer — tick every second while active & not paused ───
  useEffect(() => {
    if (!isMeetingActive || isMeetingPaused) return;
    const id = setInterval(() => tickTimer(), 1000);
    return () => clearInterval(id);
  }, [isMeetingActive, isMeetingPaused, tickTimer]);

  // (Send/retry/AI-trigger pipeline moved to features/chat/useChatController.ts — R1)

  /** §124A.2: create the real object, wait for confirmation, then mark ACCEPTED */
  const handleAcceptMeetingCandidate = async (c: MeetingCandidate) => {
    if (c.candidate_type === 'DECISION') {
      const id = `dec_${Date.now()}`;
      addDecision({
        id,
        decision_number: decisions.length + 1,
        group_id: groupForRoute?.id ?? '',
        project_id: projectForRoute?.id ?? '',
        title: c.content,
        status: 'APPROVED',
        approved_by_name: user?.name || 'Arun Kumar',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await new Promise((r) => setTimeout(r, 400));
      updateCandidateStatus(c.id, 'ACCEPTED', { type: 'DECISION', id });
      toast({ title: 'Decision saved', variant: 'success' });
      return;
    }
    if (c.candidate_type === 'TASK') {
      const id = `task_${Date.now()}`;
      addTask({
        id,
        group_id: groupForRoute?.id ?? '',
        project_id: projectForRoute?.id ?? '',
        title: c.content,
        status: 'TODO',
        priority: 'HIGH',
        assignee_id: currentUserId,
        assignee_name: user?.name || 'Arun Kumar',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await new Promise((r) => setTimeout(r, 400));
      updateCandidateStatus(c.id, 'ACCEPTED', { type: 'TASK', id });
      toast({ title: 'Task created', variant: 'success' });
      return;
    }
    // OPEN_QUESTION / CONTRADICTION / RESEARCH_NEED / MILESTONE_CHANGE — addressed
    await new Promise((r) => setTimeout(r, 300));
    updateCandidateStatus(c.id, 'ACCEPTED');
  };

  /** §164A.2/3: approve submits exact payload hash+version; success → APPROVED→EXECUTING→SUCCEEDED */
  const handleApproveAction = (actionId: string, hash: string, version: number) => {
    const action = aiActions.find((a) => a.id === actionId);
    if (!action) return;
    // §164A.2: only valid for the payload snapshot on screen
    if (action.payload_hash !== hash || action.payload_version !== version) {
      updateAiAction(actionId, { status: 'EXPIRED' });
      return;
    }
    updateAiAction(actionId, { status: 'APPROVED' });
    setTimeout(() => {
      updateAiAction(actionId, { status: 'EXECUTING' });
      setTimeout(() => {
        updateAiAction(actionId, { status: 'SUCCEEDED' });
        toast({ title: 'Action completed', variant: 'success' });
      }, 1200);
    }, 400);
  };

  const handleRejectAction = (actionId: string) => {
    updateAiAction(actionId, {
      status: 'REJECTED',
      rejected_by_user_id: currentUserId,
      rejected_by_name: user?.name || 'Admin',
    });
    toast({ title: 'Action rejected' });
  };

  /** §164: merge is GitHub-specific and high-impact */
  const handleApproveAndMerge = () => {
    const gh = aiActions.find((a) => a.action_kind.includes('GITHUB'));
    if (gh) handleApproveAction(gh.id, gh.payload_hash, gh.payload_version);
    toast({ title: 'PR merged', description: 'feat/spi-dma-driver merged into main.' });
    closeRightPanel();
  };

  /** §128: saved summary becomes a Garage artifact */
  const handleSaveMeetingSummary = () => {
    const groupName = activeGroup?.name || 'Group';
    const now = new Date().toISOString();
    const sessionDecisions =
      currentSession?.candidates.filter(
        (c) => c.status === 'ACCEPTED' && c.candidate_type === 'DECISION'
      ).length ?? 0;
    const sessionTasks =
      currentSession?.candidates.filter(
        (c) => c.status === 'ACCEPTED' && c.candidate_type === 'TASK'
      ).length ?? 0;
    addMemory({
      id: `mem_summary_${Date.now()}`,
      group_id: groupForRoute?.id ?? '',
      project_id: activeProject?.id,
      scope: 'PROJECT',
      entry_type: 'LESSON',
      title: `${groupName} — Meeting summary`,
      content: `Meeting summary with ${decisions.length + sessionDecisions} decisions and ${tasks.length + sessionTasks} tasks.`,
      source: 'meeting',
      created_at: now,
      updated_at: now,
    });
    toast({ title: 'Meeting summary saved', description: 'Available in Garage as an artifact.' });
  };

  const handleOpenThread = (msg: Message) => {
    setActiveThreadMessage(msg);
    setRightPanelMode('thread');
  };

  const handleCreateTaskFromMessage = (msg: Message) => {
    setTaskTitle(msg.body.slice(0, 60));
    setTaskDesc(msg.body);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = () => {
    if (!taskTitle.trim()) return;
    const newTask: Task = {
      id: `task_${Date.now()}`,
      group_id: groupForRoute?.id ?? '',
      project_id: projectForRoute?.id ?? '',
      title: taskTitle.trim(),
      description: taskDesc.trim(),
      status: 'TODO',
      priority: 'HIGH',
      assignee_id: currentUserId,
      assignee_name: user?.name || 'Arun Kumar',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    addTask(newTask);
    setIsTaskModalOpen(false);
    setTaskTitle('');
    setTaskDesc('');
    toast({ title: 'Task created', variant: 'success' });
  };

  const handleCreateDecisionFromMessage = (msg: Message) => {
    setDecisionTitle(msg.body.slice(0, 60));
    setDecisionReason(msg.body);
    setIsDecisionModalOpen(true);
  };

  const handleSaveDecision = () => {
    if (!decisionTitle.trim()) return;
    const newDec: Decision = {
      id: `dec_${Date.now()}`,
      decision_number: decisions.length + 1,
      group_id: groupForRoute?.id ?? '',
      project_id: projectForRoute?.id ?? '',
      title: decisionTitle.trim(),
      status: 'PROPOSED',
      reason: decisionReason.trim(),
      approved_by_id: currentUserId,
      approved_by_name: user?.name || 'Arun Kumar',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    addDecision(newDec);
    setIsDecisionModalOpen(false);
    setDecisionTitle('');
    setDecisionReason('');
    toast({ title: 'Decision proposed', variant: 'success' });
  };

  // §193 — every notification/activity route is a real URL now; the router
  // resolves object deep links into Group/Project context.
  const handleDeepLink = (route: string) => {
    navigate(route);
  };

  if (!user || !groupForRoute) {
    // Live mode before the workspace query resolves; demo hydrates instantly.
    return (
      <div
        className="h-screen w-screen flex items-center justify-center text-sm"
        style={{ background: 'var(--color-background)', color: 'var(--color-text-secondary)' }}
        role="status"
      >
        Loading workspace…
      </div>
    );
  }

  const currentUserId = user.id;
  const unreadActivityCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden font-sans"
      style={{
        background: 'var(--color-background)',
        color: 'var(--color-text)',
      }}
    >
      {/* §309A.2 CLIENT_UPDATE_REQUIRED — blocking, full-screen state */}
      {protocolMismatch?.isRequired && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6 text-white text-center">
          <div className="max-w-md bg-[var(--color-surface-raised)] p-8 rounded-2xl border space-y-4" style={{ borderColor: 'var(--color-border)' }}>
            <AlertOctagon className="w-12 h-12 mx-auto" style={{ color: 'var(--color-danger)' }} />
            <h2 className="text-xl font-bold">ClanMind needs an update to continue.</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Your team has moved to a newer version of ClanMind. Local drafts and cached data are safe.
            </p>
            <Button size="lg" variant="spectral" onClick={() => void installUpdate()}>
              Update now
            </Button>
          </div>
        </div>
      )}

      {/* §309A.1 Non-blocking recommended update banner — once per session */}
      {recommendedUpdate.available && !recommendedUpdate.dismissed && (
        <div
          className="flex items-center justify-between px-4 py-2 text-xs border-b"
          style={{ background: 'var(--color-info-bg)', borderColor: 'var(--color-border)' }}
        >
          <span style={{ color: 'var(--color-info)' }}>
            A newer version of ClanMind is available{recommendedUpdate.version ? ` (${recommendedUpdate.version})` : ''}.
          </span>
          <span className="flex gap-2">
            <Button size="sm" variant="primary" onClick={() => void installUpdate()}>
              Update now
            </Button>
            <Button size="sm" variant="ghost" onClick={dismissRecommendedUpdate}>
              Later
            </Button>
          </span>
        </div>
      )}

      {/* Top Header (§14) */}
      <TopBar
        user={user}
        activeGroup={activeGroup}
        activeProject={activeProject}
        unreadNotificationsCount={unreadActivityCount}
        isMeetingActive={isMeetingActive}
        meetingEnabled={featureFlags.meeting_mode}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSearch={() => setCommandPaletteOpen(true)}
        onStartMeeting={() => setStartDialogOpen(true)}
        onOpenNotifications={() => navigateToSection('activity')}
        onOpenProfile={() => navigateToSection('settings')}
        onSignOut={() => {
          logout();
          toast({ title: 'Signed out' });
        }}
        onCreateGroup={() => setCreateGroupDialogOpen(true)}
        onJoinGroup={() => setJoinGroupDialogOpen(true)}
        onSelectGroup={(g) => navigate(`/group/${g.id}/chat`)}
        onSelectProject={(p) => {
          const base = `/group/${p.group_id}`;
          navigate(`${base}/project/${p.id}/chat`);
        }}
        groups={groups}
        projects={projects}
      />

      {/* §185 Sync Banner — standalone strip, separate from TopBar */}
      <SyncBanner />

      {/* Active Meeting Banner if active (§123) */}
      {isMeetingActive && (
        <MeetingActiveHeader
          elapsedSeconds={elapsedSeconds}
          isPaused={isMeetingPaused}
          onPause={pauseMeeting}
          onResume={resumeMeeting}
          onEnd={endMeeting}
        />
      )}

      {/* Sync Conflict Notification Banner if any (§186) */}
      {conflicts.length > 0 && (
        <div
          className="px-4 py-2 border-b"
          style={{ background: 'var(--color-warning-bg)', borderColor: 'var(--color-border)' }}
        >
          <SyncConflictCard
            conflict={conflicts[0]!}
            onResolve={(id, strategy) => resolveConflict(id, strategy, currentUserId)}
          />
        </div>
      )}

      {/* Main 3-Pane Body (§12) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Rail */}
        <LeftNav
          projects={projects}
          activeProject={activeProject}
          activeSection={activeNavSection}
          onSelectSection={navigateToSection}
          onSelectProject={(proj) => {
            navigate(`/group/${proj.group_id}/project/${proj.id}/chat`);
            setProjectFilterId(proj.id);
          }}
          onCreateProject={() => toast({ title: 'Project creation', description: 'Create a project from the Overview.' })}
          unreadCounts={{ activity: unreadActivityCount }}
        />

        {/* Center Main Work Surface */}
        <main
          className="flex-1 flex flex-col min-w-0 overflow-hidden"
          style={{ background: 'var(--color-background)' }}
        >
          {activeNavSection === 'chat' && (
            <ErrorBoundary label="Chat">
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <MessageList
                  messages={messages}
                  currentUserId={currentUserId}
                  typingUsers={typingUsers}
                  lastReadMessageId={lastReadMessageIdByScope[scopeKey]}
                  onMarkRead={(messageId) => markScopeRead(scopeKey, messageId)}
                  aiRunsByMessage={aiRunsByMessage}
                  streamingMessageIds={messages
                    .filter((m) => aiRunsByMessage[m.id]?.status === 'STREAMING')
                    .map((m) => m.id)}
                  aiName={activeGroup?.ai_name || 'Odin'}
                  groupName={activeGroup?.name || 'Group Chat'}
                  activeProjectName={activeProject?.name}
                  presenceCount={members.length}
                  aiWorking={Object.values(aiRunsByMessage).some(
                    (r) => r.status === 'RUNNING' || r.status === 'WAITING_TOOL' || r.status === 'STREAMING'
                  )}
                  meetingEnabled={featureFlags.meeting_mode}
                  isMeetingActive={isMeetingActive}
                  onOpenSearch={() => setCommandPaletteOpen(true)}
                  onStartMeeting={() => setStartDialogOpen(true)}
                  onRetry={handleRetryMessage}
                  canModerate={members.find((m) => m.user_id === currentUserId)?.role === 'OWNER' || members.find((m) => m.user_id === currentUserId)?.role === 'ADMIN'}
                  userRole={members.find((m) => m.user_id === currentUserId)?.role ?? 'MEMBER'}
                  onOpenSettings={() => navigateToSection('settings')}
                  onReply={(msg) =>
                    setReplyTarget({
                      messageId: msg.id,
                      senderName: msg.sender_name,
                      preview: msg.body.slice(0, 80),
                    })
                  }
                  onReact={(messageId, emoji) => addReaction(messageId, emoji, currentUserId)}
                  onEditSave={(id, text) => updateMessage(id, { body: text, edited: true })}
                  onDelete={deleteMessage}
                  onTogglePin={(id) => {
                    const m = messages.find((msg) => msg.id === id);
                    if (m) updateMessage(id, { pinned: !m.pinned });
                  }}
                  onCreateTask={handleCreateTaskFromMessage}
                  onCreateDecision={handleCreateDecisionFromMessage}
                  onUseAsContext={(msg) =>
                    toast({ title: 'Added to Odin context', description: `${msg.body.slice(0, 40)}…` })
                  }
                  onOpenThread={handleOpenThread}
                  onCreateProject={() => navigateToSection('overview')}
                  onInviteTeammates={() => navigateToSection('settings')}
                  onAskOdin={() => {
                    setComposerText(`@${activeGroup?.ai_name || 'Odin'} `);
                  }}
                />

                <Composer
                  text={composerText}
                  onChangeText={setComposerText}
                  onSend={() => handleSendMessage()}
                  attachments={composerAttachments}
                  onAddAttachment={addComposerAttachment}
                  onRemoveAttachment={removeComposerAttachment}
                  replyTarget={replyTarget}
                  onClearReplyTarget={() => setReplyTarget(null)}
                  visibility={visibility}
                  privateRecipientName={privateRecipientName}
                  onClearPrivateMode={() => setVisibility('GROUP')}
                  onSetPrivateMode={(recId, recName) => setVisibility('PRIVATE_PAIR', recId, recName)}
                  members={members}
                  aiName={activeGroup?.ai_name || 'Odin'}
                  activeProjectName={activeProject?.name}
                  featureFlags={featureFlags}
                  syncStatus={syncStatus}
                />
              </div>
            </ErrorBoundary>
          )}

          {activeNavSection === 'overview' && activeProject && (
            <ErrorBoundary label="Project Overview">
              <ProjectOverview
                project={activeProject}
                tasks={tasks}
                decisions={decisions}
                artifacts={artifacts}
                onNavigateToSection={(s: MainNavSection) => navigateToSection(s)}
              />
            </ErrorBoundary>
          )}

          {activeNavSection === 'garage' && (
            <ErrorBoundary label="Garage">
              <GarageView
                artifacts={artifacts}
                onOpenArtifact={(art) => openArtifactPanel(art)}
                onTogglePin={toggleArtifactPin}
              />
            </ErrorBoundary>
          )}

          {activeNavSection === 'tasks' && (
            <ErrorBoundary label="Tasks">
              <TasksView
                tasks={tasks}
                onAddTask={() => setIsTaskModalOpen(true)}
                onUpdateStatus={(id, status) => updateTask(id, { status })}
              />
            </ErrorBoundary>
          )}

          {activeNavSection === 'decisions' && (
            <ErrorBoundary label="Decisions">
              <DecisionsView
                decisions={decisions}
                onAddDecision={() => setIsDecisionModalOpen(true)}
              />
            </ErrorBoundary>
          )}

          {activeNavSection === 'memory' && (
            <ErrorBoundary label="Memory">
              <MemoryView
                memories={memories}
                memoryCandidates={memoryCandidates}
                onSaveCandidate={(candId) => {
                  const cand = memoryCandidates.find((c) => c.id === candId);
                  if (cand) {
                    addMemory({
                      id: `mem_${Date.now()}`,
                      group_id: groupForRoute?.id ?? '',
                      scope: 'PROJECT',
                      entry_type: 'CONVENTION',
                      title: 'Accepted Convention',
                      content: cand.content,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    });
                    removeMemoryCandidate(candId);
                    toast({ title: 'Memory saved', variant: 'success' });
                  }
                }}
                onDismissCandidate={removeMemoryCandidate}
                onAddMemory={() => toast({ title: 'Add memory', description: 'Type "Remember this" in chat.' })}
              />
            </ErrorBoundary>
          )}

          {activeNavSection === 'team' && (
            <ErrorBoundary label="Team">
              <TeamView
                members={members}
                memberNicknames={memberNicknames}
                onSetNickname={setMemberNickname}
                onStartPrivateChat={(m) => {
                  setVisibility('PRIVATE_PAIR', m.user_id, m.nickname || m.user.name);
                  navigateToSection('chat');
                }}
                onInviteTeammate={() => navigateToSection('settings')}
              />
            </ErrorBoundary>
          )}

          {activeNavSection === 'activity' && (
            <ErrorBoundary label="Activity">
              <ActivityView onNavigate={handleDeepLink} />
            </ErrorBoundary>
          )}

          {activeNavSection === 'settings' && activeGroup && (
            <ErrorBoundary label="Settings">
              <SettingsView
                group={activeGroup}
                members={members}
                featureFlags={featureFlags}
                onUpdateGroup={(u) => {
                  useGroupStore.setState((s) => ({
                    groups: s.groups.map((g) =>
                      g.id === activeGroup.id ? { ...g, ...u } : g
                    ),
                    activeGroup: { ...activeGroup, ...u },
                  }));
                  toast({ title: 'Settings saved', variant: 'success' });
                }}
                onUpdateFeatureFlags={() => {}}
                onTransferOwnership={() => toast({ title: 'Ownership transfer', description: 'Available for group Owners.' })}
                onDeleteGroup={() => toast({ title: 'Group deletion', description: 'Danger zone actions require confirmation.' })}
                onUpdateMemberRole={(userId, role) => useGroupStore.getState().updateMemberRole(userId, role)}
                onRemoveMember={(userId) => {
                  useGroupStore.getState().removeMember(userId);
                  toast({ title: 'Member removed' });
                }}
              />
            </ErrorBoundary>
          )}
        </main>

        {/* Right Work Surface (Contextual Collapsible Panel, §94, §95, §124, §146) */}
        {rightPanelMode !== 'closed' && (
          <>
            <PanelResizer width={rightPanelWidth} onResize={setRightPanelWidth} />
            <aside
              className="h-full flex flex-col shrink-0 panel-open"
              style={{ width: rightPanelWidth, background: 'var(--color-surface)' }}
            >
              {isMeetingActive ? (
                <MeetingPanel
                  candidates={currentSession?.candidates || []}
                  liveNotes={currentSession?.live_notes || []}
                  aiName={activeGroup?.ai_name || 'Odin'}
                  onAcceptCandidate={handleAcceptMeetingCandidate}
                  onDismissCandidate={(id) => updateCandidateStatus(id, 'REJECTED')}
                  onRestoreCandidate={restoreCandidate}
                  onAddNote={addLiveNote}
                  onResearchShortcut={(topic) => {
                    setComposerText(`/research ${topic}`);
                    navigateToSection('chat');
                  }}
                  onOpenPromoted={(type) => {
                    if (type === 'DECISION') navigateToSection('decisions');
                    else navigateToSection('tasks');
                  }}
                  onClose={closeRightPanel}
                />
              ) : rightPanelMode === 'thread' && activeThreadMessage ? (
                <ThreadPanel
                  rootMessage={activeThreadMessage}
                  currentUserId={currentUserId}
                  currentUserName={user?.name}
                  onClose={closeRightPanel}
                  onSendReply={(rootId, text) => {
                    const replyMsg: Message = {
                      id: `msg_${Date.now()}`,
                      group_id: groupForRoute?.id ?? '',
                      project_id: activeProject?.id,
                      sender_type: 'USER',
                      sender_id: currentUserId,
                      sender_name: user?.name || 'Arun Kumar',
                      body: text,
                      visibility: 'GROUP',
                      reply_to_message_id: rootId,
                      pinned: false,
                      edited: false,
                      deleted: false,
                      attachments: [],
                      reactions: [],
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    };
                    addMessage(replyMsg);
                  }}
                />
              ) : rightPanelMode === 'research' ? (
                <ResearchDrawer
                  topic="STM32H743 DMA SPI vs I2C Sensor Fusion Latency"
                  summary="Hardware datasheet analysis verifies SPI full-duplex DMA operates at 24 MHz without CPU interrupt locks."
                  findings={[
                    'SPI DMA reduces sensor packet transfer latency from 160 µs to 6.5 µs at 1 kHz ODR.',
                    'I2C bus congestion locks the microcontroller bus for ~16% of the real-time attitude loop.',
                    'DMA1 Stream 0 circular ring buffers in SRAM1 eliminate double-copy memory overhead.',
                  ]}
                  projectImpact="Adopting SPI DMA allows the quadcopter flight controller to execute attitude PID calculations at a rock-solid 1 kHz rate without jitter or dropped frames."
                  sources={[
                    {
                      id: 's1',
                      title: 'ICM-42688P Motion Tracking Datasheet',
                      domain: 'invensense.tdk.com',
                      url: 'https://invensense.tdk.com',
                      snippet: 'High performance 6-axis MEMS IMU with 24 MHz SPI master interface.',
                      retrieved_at: new Date().toISOString(),
                    },
                    {
                      id: 's2',
                      title: 'STM32H7 DMA Architecture Reference',
                      domain: 'st.com',
                      url: 'https://st.com',
                      snippet: 'Master Direct Memory Access (MDMA) and peripheral DMA streams configuration.',
                      retrieved_at: new Date().toISOString(),
                    },
                  ]}
                  onClose={closeRightPanel}
                />
              ) : rightPanelMode === 'context' ? (
                <ContextInspector onClose={closeRightPanel} />
              ) : rightPanelMode === 'diff' ? (
                <GitHubDiffViewer
                  action={aiActions.find((a) => a.action_kind.includes('GITHUB'))}
                  onClose={closeRightPanel}
                  onApproveAndMerge={handleApproveAndMerge}
                />
              ) : rightPanelMode === 'approval' ? (
                <div
                  className="flex flex-col h-full border-l text-xs"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>
                      Approvals
                    </h3>
                    <button
                      onClick={closeRightPanel}
                      aria-label="Close approvals panel"
                      className="p-1 cursor-pointer hover:opacity-80"
                      style={{ color: 'var(--color-text-tertiary)' }}
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {aiActions
                      .filter((a) => a.status !== 'SUCCEEDED' && a.status !== 'REJECTED')
                      .map((a) => (
                        <ApprovalCard
                          key={a.id}
                          action={a}
                          onApprove={handleApproveAction}
                          onReject={handleRejectAction}
                          onReviewLatest={refreshAiAction}
                          onViewDiff={
                            a.action_kind.includes('GITHUB')
                              ? () => setRightPanelMode('diff')
                              : undefined
                          }
                        />
                      ))}
                  </div>
                </div>
              ) : activeArtifact ? (
                <ArtifactPanel
                  artifact={activeArtifact}
                  activeVersionNumber={activeVersionNumber || activeArtifact.current_version}
                  compareVersionNumber={compareVersionNumber}
                  onClose={closeRightPanel}
                  onSelectVersion={setActiveVersionNumber}
                  onSetCompareVersion={setCompareVersionNumber}
                  onTogglePin={toggleArtifactPin}
                  onToggleContext={toggleArtifactContext}
                  onAskOdinAboutNode={(nodeLabel) => {
                    setComposerText(`@Odin Explain details for component: "${nodeLabel}"`);
                    navigateToSection('chat');
                  }}
                />
              ) : null}
            </aside>
          </>
        )}
      </div>

      {/* Global Command Palette (§61) */}
      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        projects={projects}
        artifacts={artifacts}
        tasks={tasks}
        decisions={decisions}
        messages={messages}
        members={members}
        onSelectProject={(p) => {
          setActiveProject(p);
          setProjectFilterId(p.id);
          navigateToSection('chat');
        }}
        onSelectArtifact={(a) => openArtifactPanel(a)}
        onSelectMessage={(msg) => {
          navigateToSection('chat');
          const m = messages.find((x) => x.id === msg.id);
          if (m) setReplyTarget({ messageId: m.id, senderName: m.sender_name, preview: m.body.slice(0, 80) });
        }}
        onSelectMember={(m) => {
          setVisibility('PRIVATE_PAIR', m.user_id, m.nickname || m.user.name);
          navigateToSection('chat');
        }}
        onSelectAction={(act) => {
          if (act === 'start_meeting' && featureFlags.meeting_mode) setStartDialogOpen(true);
          if (act === 'create_task') setIsTaskModalOpen(true);
          if (act === 'propose_decision') setIsDecisionModalOpen(true);
          if (act.startsWith('view_task_')) navigateToSection('tasks');
          if (act.startsWith('view_decision_')) navigateToSection('decisions');
          if (act === 'review_approvals') setRightPanelMode('approval');
        }}
      />

      {/* §126/§127 meeting start + end summary dialogs */}
      <MeetingStartDialog />
      <MeetingEndSummaryDialog
        onAcceptCandidate={handleAcceptMeetingCandidate}
        onSaveSummary={handleSaveMeetingSummary}
      />

      {/* Keyboard shortcuts help (§63) */}
      <KeyboardShortcutsDialog open={isKeyboardHelpOpen} onOpenChange={setKeyboardHelpOpen} />

      {/* §15 Group switcher dialogs */}
      <CreateGroupDialog open={isCreateGroupDialogOpen} onOpenChange={setCreateGroupDialogOpen} />
      <JoinGroupDialog open={isJoinGroupDialogOpen} onOpenChange={setJoinGroupDialogOpen} />

      {/* Quick Task Modal (§121) */}
      <Dialog
        open={isTaskModalOpen}
        onOpenChange={setIsTaskModalOpen}
        title="Create New Project Task"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setIsTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={handleSaveTask}>
              Create Task
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Title
            </label>
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border outline-none"
              style={{
                borderColor: 'var(--color-border-strong)',
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text)',
              }}
            />
          </div>
          <div>
            <label className="block font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Description
            </label>
            <textarea
              value={taskDesc}
              onChange={(e) => setTaskDesc(e.target.value)}
              rows={3}
              className="w-full px-3 py-1.5 rounded-lg border outline-none"
              style={{
                borderColor: 'var(--color-border-strong)',
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text)',
              }}
            />
          </div>
        </div>
      </Dialog>

      {/* Quick Decision Modal (§122) */}
      <Dialog
        open={isDecisionModalOpen}
        onOpenChange={setIsDecisionModalOpen}
        title="Propose Architectural Decision"
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setIsDecisionModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={handleSaveDecision}>
              Save Decision
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Decision Title
            </label>
            <input
              value={decisionTitle}
              onChange={(e) => setDecisionTitle(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border outline-none"
              style={{
                borderColor: 'var(--color-border-strong)',
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text)',
              }}
            />
          </div>
          <div>
            <label className="block font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              Rationale
            </label>
            <textarea
              value={decisionReason}
              onChange={(e) => setDecisionReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-1.5 rounded-lg border outline-none"
              style={{
                borderColor: 'var(--color-border-strong)',
                background: 'var(--color-surface-raised)',
                color: 'var(--color-text)',
              }}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}