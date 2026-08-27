import React, { useEffect, useState } from 'react';
import {
  Bot,
  ArrowRight,
  GitPullRequest,
  Bookmark,
  CheckSquare,
  Users,
  Copy,
  Check,
  ArrowLeft,
  Search,
  LayoutPanelTop,
} from 'lucide-react';
import clanmindMark from '@/assets/brand/clanmind-mark.png';
import odinAvatar from '@/assets/brand/odin-avatar.png';
import { Button } from '@/design-system/components/Button';
import { Badge } from '@/design-system/components/Badge';
import { Input } from '@/design-system/components/Input';
import { Textarea } from '@/design-system/components/Textarea';
import { useToast } from '@/design-system/components/Toast';
import { copyToClipboard } from '@/tauri/bridge';

/**
 * §70 Create Group Onboarding — 7 steps, everything non-essential skippable:
 *   1. Group name (+ optional description, §71)
 *   2. Invite teammates (skippable, §72)
 *   3. Meet AI (§73)
 *   4. Optional AI setup — rename / avatar (§73, product rule 12)
 *   5. First-run demo animation — all 10 steps (§74, §75)
 *   6. Optional first Project (§77)
 *   7. Enter ClanMind (§70) — never "Workspace" (§2 rule 1)
 */

export interface OnboardingWizardProps {
  onComplete: (groupName: string, projectName: string, aiName: string) => void;
}

/** §17.1 — Default AI identity; user can rename during onboarding. */
const DEFAULT_AI_NAME = 'Odin';

const STEP_LABELS = [
  'Team Setup',
  'Invite',
  `Meet ${DEFAULT_AI_NAME}`,
  'AI Setup',
  'Core Loop Demo',
  'First Project',
  'Enter',
];

const AI_AVATARS = [
  { id: 'odin-default', src: odinAvatar, label: 'Default' },
  { id: 'odin-aurora', gradient: 'linear-gradient(135deg,#ff5f6d,#7e57c2)', label: 'Aurora' },
  { id: 'odin-ocean', gradient: 'linear-gradient(135deg,#0ea5e9,#6366f1)', label: 'Ocean' },
  { id: 'odin-ember', gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)', label: 'Ember' },
];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectGoal, setProjectGoal] = useState('');
  const [aiName, setAiName] = useState(DEFAULT_AI_NAME);
  const [aiAvatar, setAiAvatar] = useState('odin-default');
  const [inviteEmails, setInviteEmails] = useState<string[]>(['']);
  const [inviteCopied, setInviteCopied] = useState(false);

  // ─── Demo animation (§75) — timers cleaned up on unmount/step change ───
  const [demoStep, setDemoStep] = useState(0);

  useEffect(() => {
    // §6 reduced motion: no animation timers at all
    if (prefersReducedMotion()) return;
    if (step !== 5 || demoStep >= 10) return;
    const t = setTimeout(() => setDemoStep(demoStep + 1), demoStep === 0 ? 600 : 780);
    return () => clearTimeout(t);
  }, [step, demoStep]);

  const runDemo = () => {
    setDemoStep(0);
  };

  // Render state: reduced motion shows the completed story immediately
  const displayStep = prefersReducedMotion() ? 10 : demoStep;

  // ─── Invite (§72) ───
  const handleSendInvites = () => {
    const valid = inviteEmails.map((e) => e.trim()).filter(Boolean);
    if (valid.length === 0) {
      toast({ title: 'Add at least one email', variant: 'info' });
      return;
    }
    toast({
      title: 'Invite sent',
      description: `${valid.length} invite${valid.length === 1 ? '' : 's'} on the way.`,
    });
    setInviteEmails(['']);
    setStep(3);
  };

  const handleCopyInviteLink = async () => {
    const ok = await copyToClipboard('https://clanmind.io/join/demo-team');
    if (ok) {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    }
  };

  const canContinueStep1 = groupName.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 select-none overflow-y-auto"
      style={{ background: 'var(--color-background)', color: 'var(--color-text)' }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl p-8 space-y-6"
        style={{
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Logo & Tagline Header */}
        <div className="flex items-center justify-between pb-2">
          <img
            src={clanmindMark}
            alt="ClanMind"
            className="h-6 w-auto dark:invert"
          />
          <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
            A shared project room for people + AI
          </span>
        </div>

        {/* Step Indicator */}
        <div
          className="flex items-center justify-between border-b pb-4"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full spectral-active" aria-hidden="true" />
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: 'var(--color-text-tertiary)' }}
            >
              Onboarding · Step {step} of {STEP_LABELS.length}
            </span>
          </div>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {STEP_LABELS[step - 1]}
          </span>
        </div>

        {/* ── STEP 1: GROUP NAME (§71) ── */}
        {step === 1 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">What&rsquo;s your team called?</h1>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Groups are where your team thinks, talks, researches with AI, and builds together.
            </p>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label
                  htmlFor="onb-group-name"
                  className="block text-xs font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Group Name
                </label>
                <Input
                  id="onb-group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Robotics Team, Startup Core"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="onb-group-desc"
                  className="block text-xs font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Give it a little context (optional)
                </label>
                <Textarea
                  id="onb-group-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Autonomous flight controllers and ground telemetry"
                  minHeight={64}
                  maxHeight={100}
                />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button
                variant="spectral"
                size="md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => setStep(2)}
                disabled={!canContinueStep1}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: INVITE (§72) ── */}
        {step === 2 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Bring your team in</h1>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              You can invite teammates now or later — Owners and Admins can always invite.
            </p>
            <div className="space-y-2 pt-1">
              {inviteEmails.map((email, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setInviteEmails((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                    }
                    placeholder={`teammate${i + 1}@team.com`}
                    aria-label={`Teammate email ${i + 1}`}
                  />
                  {inviteEmails.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setInviteEmails((prev) => prev.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInviteEmails((prev) => [...prev, ''])}
              >
                + Add another email
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
              <Button variant="primary" size="md" onClick={handleSendInvites}>
                <Users className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Send invites
              </Button>
              <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                or
              </span>
              <Button variant="ghost" size="md" onClick={handleCopyInviteLink}>
                {inviteCopied ? (
                  <Check className="w-4 h-4 mr-1.5" aria-hidden="true" />
                ) : (
                  <Copy className="w-4 h-4 mr-1.5" aria-hidden="true" />
                )}
                {inviteCopied ? 'Link copied' : 'Copy invite link'}
              </Button>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="ghost" size="md" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Back
              </Button>
              <Button variant="ghost" size="md" onClick={() => setStep(3)}>
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: MEET ODIN (§73) ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div
                className="p-3 rounded-xl border flex items-center justify-center"
                style={{
                  background: 'var(--color-surface-hover)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <Bot className="w-6 h-6" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Meet {aiName}.</h1>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Your shared AI teammate for research, planning, artifacts and project work.
                </p>
              </div>
            </div>

            <div
              className="p-4 rounded-xl border text-xs space-y-2"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-surface)',
              }}
            >
              <p style={{ color: 'var(--color-text-secondary)' }}>
                {aiName} listens in public conversations when tagged with{' '}
                <span className="font-mono" style={{ color: 'var(--color-warning)' }}>
                  @{aiName}
                </span>
                , synthesizes web research into live visual blueprints, and proposes safe,
                human-approved decisions.
              </p>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" size="md" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Back
              </Button>
              <Button
                variant="spectral"
                size="md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => {
                  setStep(4);
                  runDemo();
                }}
              >
                See the core loop
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: OPTIONAL AI SETUP (§73, product rule 12) ── */}
        {step === 4 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Make {aiName} yours</h1>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Rename {aiName} and pick an avatar for this Group. Admins can change this anytime.
            </p>
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <label
                  htmlFor="onb-ai-name"
                  className="block text-xs font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  AI name
                </label>
                <Input
                  id="onb-ai-name"
                  value={aiName}
                  onChange={(e) => setAiName(e.target.value || DEFAULT_AI_NAME)}
                  placeholder={DEFAULT_AI_NAME}
                  maxLength={20}
                />
              </div>
              <div>
                <span
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Avatar
                </span>
                <div className="flex gap-2.5">
                  {AI_AVATARS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setAiAvatar(a.id)}
                      aria-label={`Avatar ${a.label}`}
                      aria-pressed={aiAvatar === a.id}
                      className="w-10 h-10 rounded-full cursor-pointer transition-transform focus-visible:shadow-[var(--focus-ring)] overflow-hidden"
                      style={{
                        background: 'src' in a ? undefined : a.gradient,
                        outline: aiAvatar === a.id ? '2px solid var(--color-primary)' : 'none',
                        outlineOffset: '2px',
                      }}
                    >
                      {'src' in a && (
                        <img
                          src={a.src}
                          alt={a.label}
                          className="w-full h-full object-cover dark:invert"
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="ghost" size="md" onClick={() => setStep(3)}>
                <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="md" onClick={() => setStep(5)}>
                  Skip
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => setStep(5)}
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 5: CORE LOOP DEMO (§74, §75) ── */}
        {step === 5 && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold">The ClanMind core loop</h1>
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Ask {aiName} to research. Turn findings into a plan. Turn the plan into project
              work. Approve real changes when you&rsquo;re ready.
            </p>

            <div
              className="p-4 rounded-xl border text-xs space-y-2.5 min-h-[260px]"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
            >
              {/* 1 — chat bubble */}
              {displayStep >= 1 && (
                <div
                  className="p-2.5 rounded-lg border node-arrive"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
                >
                  <span className="font-semibold">Arun: </span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    @{aiName} Can you research SPI vs I2C for our IMU?
                  </span>
                </div>
              )}

              {/* 2 — @AI token activates */}
              {displayStep >= 2 && (
                <div className="node-arrive">
                  <Badge variant="spectral" size="sm">
                    <Bot className="w-3 h-3" aria-hidden="true" />
                    @{aiName} activated
                  </Badge>
                </div>
              )}

              {/* 3 — AI status starts */}
              {displayStep >= 3 && (
                <div className="flex items-center gap-2 node-arrive" style={{ color: 'var(--color-warning)' }}>
                  <Bot className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{aiName} is researching…</span>
                </div>
              )}

              {/* 4 — source cards arrive */}
              {displayStep >= 4 && (
                <div className="grid grid-cols-2 gap-2 node-arrive">
                  <div className="p-2 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                    <Search className="w-3 h-3 inline mr-1" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
                    <span className="font-medium">ICM-42688P datasheet</span>
                    <span className="block text-[10px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                      invensense.tdk.com
                    </span>
                  </div>
                  <div className="p-2 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
                    <Search className="w-3 h-3 inline mr-1" style={{ color: 'var(--color-text-tertiary)' }} aria-hidden="true" />
                    <span className="font-medium">STM32H7 DMA reference</span>
                    <span className="block text-[10px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
                      st.com
                    </span>
                  </div>
                </div>
              )}

              {/* 5 — research summary appears */}
              {displayStep >= 5 && (
                <div
                  className="p-2.5 rounded-lg border node-arrive"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
                >
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    SPI with DMA cuts sensor latency from 160&nbsp;µs to 6.5&nbsp;µs.
                  </span>
                </div>
              )}

              {/* 6 — right panel expands */}
              {displayStep >= 6 && (
                <div className="flex items-center gap-2 node-arrive" style={{ color: 'var(--color-text-secondary)' }}>
                  <LayoutPanelTop className="w-3.5 h-3.5" aria-hidden="true" />
                  Work surface expands on the right
                </div>
              )}

              {/* 7 — diagram nodes form */}
              {displayStep >= 7 && (
                <div className="flex items-center gap-1.5 node-arrive">
                  {['Sensor', 'SPI DMA', 'Attitude Loop'].map((n, i) => (
                    <React.Fragment key={n}>
                      {i > 0 && (
                        <span className="w-4 h-0.5 spectral-active rounded-full" aria-hidden="true" />
                      )}
                      <span
                        className="px-2 py-1 rounded-md border text-[10px] font-medium"
                        style={{
                          borderColor: 'var(--color-border)',
                          background: 'var(--color-surface-raised)',
                          color: 'var(--color-text)',
                        }}
                      >
                        {n}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              )}

              {/* 8 — decision card appears */}
              {displayStep >= 8 && (
                <div
                  className="p-2.5 rounded-lg border flex items-center gap-2 node-arrive"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
                >
                  <Bookmark className="w-3.5 h-3.5" style={{ color: 'var(--color-success)' }} aria-hidden="true" />
                  <span>
                    Decision #1 proposed: <span className="font-medium">Use SPI with DMA</span>
                  </span>
                </div>
              )}

              {/* 9 — task cards appear */}
              {displayStep >= 9 && (
                <div className="flex gap-2 node-arrive">
                  {['DMA ring buffer', 'Telemetry bench test'].map((t) => (
                    <span
                      key={t}
                      className="px-2 py-1 rounded-md border text-[10px] flex items-center gap-1"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <CheckSquare className="w-3 h-3" style={{ color: 'var(--color-info)' }} aria-hidden="true" />
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* 10 — GitHub approval card appears */}
              {displayStep >= 10 && (
                <div
                  className="p-2.5 rounded-lg border flex items-center gap-2 node-arrive"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}
                >
                  <GitPullRequest className="w-3.5 h-3.5" style={{ color: 'var(--color-warning)' }} aria-hidden="true" />
                  <span>
                    GitHub action ready for approval: <span className="font-medium">feat/spi-dma-driver</span>
                  </span>
                  <span className="ml-auto">
                    <Badge variant="info" size="sm">Approve</Badge>
                  </span>
                </div>
              )}

              {displayStep === 0 && (
                <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  {prefersReducedMotion() ? 'Loading the story…' : 'Starting…'}
                </p>
              )}
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="ghost" size="md" onClick={() => setStep(4)}>
                <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="md" onClick={runDemo}>
                  Replay Demo
                </Button>
                <Button
                  variant="spectral"
                  size="md"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => setStep(6)}
                >
                  Create First Project
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 6: OPTIONAL FIRST PROJECT (§77) ── */}
        {step === 6 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Create your first Project</h1>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Projects give {aiName} and your team a focused working context. You can always add
              more later.
            </p>
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <label
                  htmlFor="onb-project-name"
                  className="block text-xs font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Project name
                </label>
                <Input
                  id="onb-project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Flight Controller Firmware"
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="onb-project-goal"
                  className="block text-xs font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Goal (optional)
                </label>
                <Textarea
                  id="onb-project-goal"
                  value={projectGoal}
                  onChange={(e) => setProjectGoal(e.target.value)}
                  placeholder="What does success look like?"
                  minHeight={64}
                  maxHeight={96}
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="onb-project-type"
                  className="block text-xs font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Project type
                </label>
                <select
                  id="onb-project-type"
                  className="w-full px-3 py-2 rounded-lg border text-sm outline-none cursor-pointer"
                  style={{
                    borderColor: 'var(--color-border-strong)',
                    background: 'var(--color-surface-raised)',
                    color: 'var(--color-text)',
                  }}
                >
                  {['software', 'iot', 'startup', 'research', 'college', 'school', 'personal', 'other'].map(
                    (t) => (
                      <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="ghost" size="md" onClick={() => setStep(5)}>
                <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="md" onClick={() => setStep(7)}>
                  Skip
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => setStep(7)}
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 7: ENTER (§70) ── */}
        {step === 7 && (
          <div className="space-y-5 text-center">
            <div className="flex flex-col items-center gap-3 pt-2">
              <img
                src={clanmindMark}
                alt="ClanMind"
                className="h-10 w-auto dark:invert"
              />
              <h1 className="text-2xl font-bold">Your team is ready.</h1>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Start talking, create a Project or ask {aiName} something.
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 pt-2">
              <Button
                variant="spectral"
                size="lg"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => onComplete(groupName, projectName, aiName)}
              >
                Enter {groupName || 'your Group'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStep(6)}>
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}