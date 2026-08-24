import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { sectionFromPathname } from '@/app/nav';
import { TopBar } from './TopBar';
import { LeftNav } from './LeftNav';
import { PanelResizer } from './PanelResizer';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import { MessageList } from '@/features/chat/MessageList';
import { Composer } from '@/features/chat/Composer';
import { useChatController } from '@/features/chat/useChatController';
import { useAttachmentUploads } from '@/features/chat/useAttachmentUploads';
import { useChatMessages } from '@/features/chat/useChatMessages';
import {
  mergeMessages,
  filterMessagesForScope,
  annotateThreadCounts,
  activeTypingUsers,
  type ChatScope,
} from '@/features/chat/chatSelectors';
import { ArtifactPanel } from '@/features/artifacts/ArtifactPanel';
import { useConstructionStore } from '@/features/artifacts/constructionStore';
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
import { Sheet } from '@/design-system/components/Sheet';
import { useToast } from '@/design-system/components/Toast';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import { useAuthStore } from '@/state/useAuthStore';
import { useGroupStore } from '@/state/useGroupStore';
import { useMyProfile } from '@/features/auth/useMyProfile';
import { signOutSession } from '@/features/auth/session';
import { useChatStore } from '@/state/useChatStore';
import { useArtifactStore } from '@/state/useArtifactStore';
import { useMeetingStore } from '@/state/useMeetingStore';
import { useSyncStore } from '@/state/useSyncStore';
import { useProjectDataStore } from '@/state/useProjectDataStore';
import { useUiStore } from '@/state/useUiStore';
import { cn } from '@/design-system/utils';
import { AlertOctagon, X } from 'lucide-react';
import type { GroupRole, Message, Task, Decision, MainNavSection, MeetingCandidate } from '@/types';
import { applyWindowState, captureWindowState, checkForUpdate, installUpdate, restoreWindowState, saveWindowState } from '@/tauri/bridge';

export function AppShell() {
  const { user } = useAuthStore();
  // P1 — GET /me is the post-boot profile authority (TopBar identity).
  useMyProfile();
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
    privateRecipientId,
    privateRecipientName,
    typingUsers,
    presenceOnlineCount,
    lastReadMessageIdByScope,
    pendingMessages,
    setComposerText,
    updateMessage,
    deleteMessage,
    addReaction,
    setReplyTarget,
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
    sidebarWidth,
    isSidebarCollapsed,
    isCreateGroupDialogOpen,
    setCommandPaletteOpen,
    setKeyboardHelpOpen,
    setRightPanelWidth,
    setSidebarWidth,
    setSidebarCollapsed,
    setCreateGroupDialogOpen,
    recordLastGroup,
    recordLastProject,
    recentGroupIds,
  } = useUiStore();

  // ─── §13 — responsive layout mode drives docked panes vs sheets ───────────
  //   ≥1440 three-pane · 1200–1439 compressed (icon rail) ·
  //   900–1199 two-pane · <900 single pane, both work surfaces become sheets.
  const layout = useLayoutMode();
  const [isNavSheetOpen, setNavSheetOpen] = useState(false);

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
    // §195 — remember the visited Group (and its Project) so boot restore and
    // the §15 recents switcher have data; §305 restores per-Group last Project.
    if (groupForRoute) {
      if (projectForRoute) recordLastProject(groupForRoute.id, projectForRoute.id);
      else recordLastGroup(groupForRoute.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeGroupId, routeProjectId]);

  // §13 off-canvas nav: close after navigating, and whenever the viewport
  // grows back into a band where the rail docks inline again.
  useEffect(() => {
    setNavSheetOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (layout.leftRailDocked) setNavSheetOpen(false);
  }, [layout.leftRailDocked]);

  const { toast } = useToast();
  useGlobalShortcuts();

  // ─── §95/§248 — right-surface open/close transitions ──────────────────────
  // Open: chat scroll is PRESERVED (captured + re-applied across the width
  // animation) and focus stays where the user had it (§253 — never stolen).
  // Close: panel contracts, chat recovers its width, focus returns to the
  // trigger (or the composer as a safe fallback).
  const prevPanelModeRef = useRef(rightPanelMode);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const savedChatScrollRef = useRef<number | null>(null);
  const [animatePanelWidth, setAnimatePanelWidth] = useState(false);

  useEffect(() => {
    const wasOpen = prevPanelModeRef.current !== 'closed';
    const isOpen = rightPanelMode !== 'closed';
    prevPanelModeRef.current = rightPanelMode;

    if (isOpen && !wasOpen) {
      const active = document.activeElement;
      lastTriggerRef.current = active instanceof HTMLElement ? active : null;
      const scroller = document.querySelector<HTMLElement>('[data-virt-viewport="true"]');
      savedChatScrollRef.current = scroller?.scrollTop ?? null;
      // Animate the width expansion for one transition window only, so the
      // resizer stays immediate afterwards.
      setAnimatePanelWidth(true);
      const t = setTimeout(() => setAnimatePanelWidth(false), 300);
      // Re-assert the captured scrollTop once the width transition lands.
      const t2 = setTimeout(() => {
        const el = document.querySelector<HTMLElement>('[data-virt-viewport="true"]');
        if (el && savedChatScrollRef.current != null) el.scrollTop = savedChatScrollRef.current;
      }, 240);
      return () => {
        clearTimeout(t);
        clearTimeout(t2);
      };
    }

    if (!isOpen && wasOpen) {
      const el = document.querySelector<HTMLElement>('[data-virt-viewport="true"]');
      if (el && savedChatScrollRef.current != null) el.scrollTop = savedChatScrollRef.current;
      savedChatScrollRef.current = null;
      const trigger = lastTriggerRef.current;
      lastTriggerRef.current = null;
      if (trigger && document.contains(trigger)) {
        trigger.focus({ preventScroll: true });
      } else {
        document.querySelector<HTMLElement>('[data-composer-textarea="true"]')?.focus({ preventScroll: true });
      }
    }
  }, [rightPanelMode]);

  // Live construction trace of the artifact currently on the surface (§97).
  const activeConstruction = useConstructionStore((s) =>
    activeArtifact ? s.byArtifact[activeArtifact.id] ?? null : null,
  );

  // §30 — the thread surface tracks a root MESSAGE ID and resolves it live
  // from the merged list, so replies/edits appear without stale snapshots.
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [isJoinGroupDialogOpen, setJoinGroupDialogOpen] = useState(false);

  // Quick Action Dialog States
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');

  const [isDecisionModalOpen, setIsDecisionModalOpen] = useState(false);
  const [decisionTitle, setDecisionTitle] = useState('');
  const [decisionReason, setDecisionReason] = useState('');

  // §15 — switcher lists the current Group first, then recently visited ones
  // (§195 recents); unvisited Groups keep their original order at the end.
  const orderedGroups = useMemo(() => {
    const rank = new Map(recentGroupIds.map((id, index) => [id, index]));
    return [...groups].sort(
      (a, b) => (rank.get(a.id) ?? Number.POSITIVE_INFINITY) - (rank.get(b.id) ?? Number.POSITIVE_INFINITY),
    );
  }, [groups, recentGroupIds]);

  // ─── Chat pipeline (refactor R1) — send/retry/AI-trigger live in the
  // chat controller; the shell only wires UI events to it. ───────────────────
  const { sendMessage, retryMessage, sendThreadReply, stopAiRun, retryAiResponse } =
    useChatController();
  const handleSendMessage = useCallback(() => sendMessage(), [sendMessage]);
  const handleRetryMessage = retryMessage;
  /** P4 §47–§53 — upload lifecycle controller for composer chips. */
  const attachmentUploads = useAttachmentUploads();
  const handleSendThreadReply = useCallback(
    (rootId: string, body: string) => sendThreadReply(rootId, body),
    [sendThreadReply],
  );

  // ─── §202/§289 — cursor-paged history (server truth) merged with the live
  // realtime tail (store) into ONE ascending list, then scoped per FE rule 26:
  // GROUP view never sees PRIVATE_* content; private views see only their own
  // conversation. The same scoped list feeds search (§176). ──────────────────
  const { historyMessages, hasOlder, isLoadingOlder, loadOlder } = useChatMessages(
    groupForRoute?.id,
  );
  const chatScope = useMemo<ChatScope | null>(
    () =>
      groupForRoute
        ? {
            groupId: groupForRoute.id,
            visibility,
            currentUserId: user?.id ?? '',
            recipientId: privateRecipientId ?? null,
          }
        : null,
    [groupForRoute, visibility, user?.id, privateRecipientId],
  );

  // §37 — typing indicators are ephemeral; prune on a 1s tick while any exist.
  const [typingNow, setTypingNow] = useState(Date.now());
  useEffect(() => {
    if (typingUsers.length === 0) return;
    const id = setInterval(() => setTypingNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [typingUsers.length]);
  const activeTyping = useMemo(
    () => activeTypingUsers(typingUsers, typingNow),
    [typingUsers, typingNow],
  );

  /** Server history ⊕ realtime tail → one ascending list (§202). */
  const allMessages = useMemo(
    () => annotateThreadCounts(mergeMessages(historyMessages, messages)),
    [historyMessages, messages],
  );

  /** Rule-26 scope filter — shared surface AND search see only their scope. */
  const scopedMessages = useMemo(
    () =>
      chatScope
        ? filterMessagesForScope(allMessages, chatScope)
        : [],
    [allMessages, chatScope],
  );

  // ─── §137 — the active AI run in THIS conversation scope drives the
  // composer's Stop control; Stop always targets the most recent run. ────────
  const activeAiMessageId = useMemo(() => {
    for (let i = scopedMessages.length - 1; i >= 0; i -= 1) {
      const run = aiRunsByMessage[scopedMessages[i]!.id];
      if (
        run &&
        (run.status === 'QUEUED' ||
          run.status === 'RUNNING' ||
          run.status === 'WAITING_TOOL' ||
          run.status === 'STREAMING')
      ) {
        return scopedMessages[i]!.id;
      }
    }
    return null;
  }, [scopedMessages, aiRunsByMessage]);
  const handleStopAi = useCallback(() => {
    if (activeAiMessageId) stopAiRun(activeAiMessageId);
  }, [activeAiMessageId, stopAiRun]);

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

  /** §30 — Reply opens the thread in the right work surface. */
  const handleOpenThread = useCallback(
    (msg: Message) => {
      setThreadRootId(msg.id);
      setRightPanelMode('thread');
    },
    [setRightPanelMode],
  );

  const handleCloseThread = useCallback(() => {
    setThreadRootId(null);
    closeRightPanel();
  }, [closeRightPanel]);

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

  // §30 — resolve the open thread's root + replies LIVE from merged messages.
  const activeThreadMessage = useMemo(
    () => (threadRootId ? allMessages.find((m) => m.id === threadRootId) ?? null : null),
    [allMessages, threadRootId],
  );
  const activeThreadReplies = useMemo(
    () =>
      threadRootId
        ? allMessages.filter((m) => m.reply_to_message_id === threadRootId)
        : [],
    [allMessages, threadRootId],
  );

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
  // §20 — the signed-in member's role in this Group (drives LeftNav affordances)
  const myRole: GroupRole =
    members.find((m) => m.user_id === currentUserId)?.role ?? 'MEMBER';

  // ─── Right work surface (§12 contextual surface; §94/§95/§124/§146) ────────
  // The identical content renders either docked (≥1200, §13) with the
  // §220/§249 resizer, or inside a sheet below that. Built once here so the
  // two presentations can never drift apart (§250 single primary surface).
  const rightSurfaceTitle = isMeetingActive
    ? 'Live meeting'
    : rightPanelMode === 'thread'
      ? 'Thread'
      : rightPanelMode === 'research'
        ? 'Research'
        : rightPanelMode === 'context'
          ? 'Context inspector'
          : rightPanelMode === 'diff'
            ? 'GitHub diff'
            : rightPanelMode === 'approval'
              ? 'Approvals'
              : activeArtifact
                ? `Artifact — ${activeArtifact.title}`
                : 'Work surface';

  /** True only when the current mode actually has something to show. */
  const hasRightSurfaceContent =
    isMeetingActive ||
    (rightPanelMode === 'thread' && activeThreadMessage != null) ||
    rightPanelMode === 'research' ||
    rightPanelMode === 'context' ||
    rightPanelMode === 'diff' ||
    rightPanelMode === 'approval' ||
    (rightPanelMode === 'artifact' && activeArtifact != null);
  const showRightSheet =
    rightPanelMode !== 'closed' && !layout.rightSurfaceDocked && hasRightSurfaceContent;

  const renderRightSurface = () => (
    <>
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
          replies={activeThreadReplies}
          onClose={handleCloseThread}
          onSendReply={handleSendThreadReply}
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
          construction={activeConstruction}
          onClose={closeRightPanel}
          onSelectVersion={setActiveVersionNumber}
          onSetCompareVersion={setCompareVersionNumber}
          onAskOdinAboutNode={(nodeLabel) => {
            // §107 — the selected object id/context rides into the request.
            setComposerText(`@${activeGroup?.ai_name || 'Odin'} About "${nodeLabel}" in ${activeArtifact.title}: `);
            navigateToSection('chat');
          }}
          onSendToChat={(art) => {
            setComposerText(`@${activeGroup?.ai_name || 'Odin'} Using "${art.title}" as context — `);
            navigateToSection('chat');
          }}
        />
      ) : null}
    </>
  );

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
          // P1 — end the session; this account's device-local state is kept
          // for a same-account return (FE §284 clears only on account SWITCH).
          void signOutSession().then(() => toast({ title: 'Signed out' }));
        }}
        onCreateGroup={() => setCreateGroupDialogOpen(true)}
        onJoinGroup={() => setJoinGroupDialogOpen(true)}
        onSelectGroup={(g) => navigate(`/group/${g.id}/chat`)}
        onSelectProject={(p) => {
          const base = `/group/${p.group_id}`;
          navigate(`${base}/project/${p.id}/chat`);
        }}
        groups={orderedGroups}
        projects={projects}
        // §13 — the rail goes off-canvas below 900px; the top bar carries its trigger.
        onToggleNav={layout.leftRailDocked ? undefined : () => setNavSheetOpen(true)}
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

      {/* Main 3-Pane Body (§12) — pane count collapses with viewport width (§13) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {layout.leftRailDocked ? (
          <>
            {/* Left Rail — inline; icon-only in the compressed band or when
                the user collapsed it (§13, §195 persisted preference) */}
            <LeftNav
              projects={projects}
              activeProject={activeProject}
              activeSection={activeNavSection}
              myRole={myRole}
              aiName={activeGroup?.ai_name}
              onSelectSection={navigateToSection}
              onSelectProject={(proj) => {
                navigate(`/group/${proj.group_id}/project/${proj.id}/chat`);
                setProjectFilterId(proj.id);
              }}
              onCreateProject={() => toast({ title: 'Project creation', description: 'Create a project from the Overview.' })}
              unreadCounts={{ activity: unreadActivityCount }}
              collapsed={layout.railCompressed || isSidebarCollapsed}
              onToggleCollapsed={
                layout.railCompressed
                  ? undefined
                  : () => setSidebarCollapsed(!isSidebarCollapsed)
              }
              width={sidebarWidth}
            />
            {/* §195/§249 sidebar width is a persisted, keyboard-resizable pref */}
            {!layout.railCompressed && !isSidebarCollapsed && (
              <PanelResizer
                side="left"
                width={sidebarWidth}
                min={200}
                max={320}
                label="Resize navigation sidebar"
                onResize={setSidebarWidth}
              />
            )}
          </>
        ) : (
          /* §13 <900 — navigation becomes an off-canvas sheet */
          <Sheet
            open={isNavSheetOpen}
            onOpenChange={setNavSheetOpen}
            side="left"
            title="Navigation"
          >
            <LeftNav
              projects={projects}
              activeProject={activeProject}
              activeSection={activeNavSection}
              myRole={myRole}
              aiName={activeGroup?.ai_name}
              onSelectSection={(section) => {
                // Close even when the section is already active (no route
                // change would otherwise dismiss the sheet).
                setNavSheetOpen(false);
                navigateToSection(section);
              }}
              onSelectProject={(proj) => {
                setNavSheetOpen(false);
                navigate(`/group/${proj.group_id}/project/${proj.id}/chat`);
                setProjectFilterId(proj.id);
              }}
              onCreateProject={() => toast({ title: 'Project creation', description: 'Create a project from the Overview.' })}
              unreadCounts={{ activity: unreadActivityCount }}
              width="fill"
            />
          </Sheet>
        )}

        {/* Center Main Work Surface */}
        <main
          className="flex-1 flex flex-col min-w-0 overflow-hidden"
          style={{ background: 'var(--color-background)' }}
        >
          {activeNavSection === 'chat' && (
            <ErrorBoundary label="Chat">
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <MessageList
                  messages={scopedMessages}
                  currentUserId={currentUserId}
                  typingUsers={activeTyping}
                  lastReadMessageId={lastReadMessageIdByScope[scopeKey]}
                  onMarkRead={(messageId) => markScopeRead(scopeKey, messageId)}
                  aiRunsByMessage={aiRunsByMessage}
                  streamingMessageIds={scopedMessages
                    .filter((m) => aiRunsByMessage[m.id]?.status === 'STREAMING')
                    .map((m) => m.id)}
                  aiName={activeGroup?.ai_name || 'Odin'}
                  groupName={activeGroup?.name || 'Group Chat'}
                  activeProjectName={activeProject?.name}
                  presenceCount={presenceOnlineCount ?? members.length}
                  aiWorking={Object.values(aiRunsByMessage).some(
                    (r) => r.status === 'RUNNING' || r.status === 'WAITING_TOOL' || r.status === 'STREAMING'
                  )}
                  meetingEnabled={featureFlags.meeting_mode}
                  isMeetingActive={isMeetingActive}
                  onOpenSearch={() => setCommandPaletteOpen(true)}
                  onStartMeeting={() => setStartDialogOpen(true)}
                  onRetry={handleRetryMessage}
                  onRegenerate={retryAiResponse}
                  canModerate={members.find((m) => m.user_id === currentUserId)?.role === 'OWNER' || members.find((m) => m.user_id === currentUserId)?.role === 'ADMIN'}
                  userRole={members.find((m) => m.user_id === currentUserId)?.role ?? 'MEMBER'}
                  onOpenSettings={() => navigateToSection('settings')}
                  // §30 — Reply opens the thread in the right work surface.
                  onReply={handleOpenThread}
                  onReact={(messageId, emoji) => addReaction(messageId, emoji, currentUserId)}
                  onEditSave={(id, text) => updateMessage(id, { body: text, edited: true })}
                  onDelete={deleteMessage}
                  onTogglePin={(id) => {
                    const m = scopedMessages.find((msg) => msg.id === id);
                    if (m) updateMessage(id, { pinned: !m.pinned });
                  }}
                  onCreateTask={handleCreateTaskFromMessage}
                  onCreateDecision={handleCreateDecisionFromMessage}
                  onUseAsContext={(msg) =>
                    toast({ title: 'Added to Odin context', description: `${msg.body.slice(0, 40)}…` })
                  }
                  onOpenThread={handleOpenThread}
                  onLoadOlder={loadOlder}
                  hasOlder={hasOlder}
                  isLoadingOlder={isLoadingOlder}
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
                  onAddFiles={attachmentUploads.addFiles}
                  onRemoveAttachment={attachmentUploads.removeAttachment}
                  onRetryAttachment={attachmentUploads.retryAttachment}
                  onCancelAttachment={attachmentUploads.cancelAttachment}
                  replyTarget={replyTarget}
                  onClearReplyTarget={() => setReplyTarget(null)}
                  visibility={visibility}
                  privateRecipientId={privateRecipientId}
                  privateRecipientName={privateRecipientName}
                  onClearPrivateMode={() => setVisibility('GROUP')}
                  onSetPrivateMode={(vis, recId, recName) => setVisibility(vis, recId, recName)}
                  members={members}
                  aiName={activeGroup?.ai_name || 'Odin'}
                  activeProjectName={activeProject?.name}
                  isAiResponding={activeAiMessageId != null}
                  onStopAi={handleStopAi}
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

        {/* Right Work Surface (§12 contextual surface; §94/§95/§124/§146).
            Docks beside chat where the viewport affords three panes (§13,
            ≥1200) with the §220/§249 keyboard-accessible resizer; below that
            it opens as a sheet so the conversation keeps its full width.
            Single primary surface either way (§250). */}
        {rightPanelMode !== 'closed' &&
          layout.rightSurfaceDocked &&
          hasRightSurfaceContent && (
          <>
            <PanelResizer
              side="right"
              width={rightPanelWidth}
              min={320}
              max={640}
              label="Resize work surface panel"
              onResize={setRightPanelWidth}
            />
            <aside
              className={cn(
                'panel-open h-full flex flex-col shrink-0',
                // §95/§248 — the width EXPANSION animates once per open; the
                // resizer stays immediate afterwards.
                animatePanelWidth && 'transition-[width] duration-200 ease-out',
              )}
              style={{ width: rightPanelWidth, background: 'var(--color-surface)' }}
              aria-label={rightSurfaceTitle}
            >
              {renderRightSurface()}
            </aside>
          </>
        )}
      </div>

      {/* §13 — narrow bands (<1200): the same work surface opens as a sheet.
          Escape closes and focus returns to the trigger (Radix Dialog, §8). */}
      <Sheet
        open={showRightSheet}
        onOpenChange={(open) => {
          if (!open) closeRightPanel();
        }}
        side="right"
        title={rightSurfaceTitle}
        showCloseButton={false}
      >
        {showRightSheet ? renderRightSurface() : null}
      </Sheet>

      {/* Global Command Palette (§61) — §176: it receives ONLY the active
          conversational scope's messages; private content can never surface
          in a shared search view. */}
      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        projects={projects}
        artifacts={artifacts}
        tasks={tasks}
        decisions={decisions}
        messages={scopedMessages}
        members={members}
        onSelectProject={(p) => {
          setActiveProject(p);
          setProjectFilterId(p.id);
          navigateToSection('chat');
        }}
        onSelectArtifact={(a) => openArtifactPanel(a)}
        onSelectMessage={(msg) => {
          navigateToSection('chat');
          const m = scopedMessages.find((x) => x.id === msg.id);
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