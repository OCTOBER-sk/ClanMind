-- M4 (BACKEND_AUDIT2 §6): tighten ai_runs RLS so PRIVATE_AI run metadata is
-- not readable group-wide. Previously `ai_runs_select` granted every active
-- member read access to every run in the Group — letting any member enumerate
-- who ran private Odin sessions, when, and with which model. Now a run is
-- readable only by its requester, or by an OWNER/ADMIN of the Group.

alter table public.ai_runs enable row level security;

drop policy if exists ai_runs_select on public.ai_runs;
create policy ai_runs_select on public.ai_runs
  for select
  using (
    requester_user_id = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = ai_runs.group_id
        and gm.user_id = auth.uid()
        and gm.role in ('OWNER','ADMIN')
        and gm.removed_at is null
    )
  );

-- ai_run_steps select already joins through ai_runs for membership; tighten it
-- to the same requester-or-privileged predicate so step metadata matches.
alter table public.ai_run_steps enable row level security;

drop policy if exists ai_run_steps_select on public.ai_run_steps;
create policy ai_run_steps_select on public.ai_run_steps
  for select
  using (exists (
    select 1 from public.ai_runs r
    where r.id = ai_run_steps.ai_run_id
      and (
        r.requester_user_id = auth.uid()
        or exists (
          select 1 from public.group_members gm
          where gm.group_id = r.group_id
            and gm.user_id = auth.uid()
            and gm.role in ('OWNER','ADMIN')
            and gm.removed_at is null
        )
      )
  ));
