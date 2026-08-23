-- Atomic job claim + retry bookkeeping for the §158A JobRunner.

create or replace function public.claim_due_jobs(p_limit integer, p_now timestamptz)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.background_jobs j
  set status = 'RUNNING',
      started_at = p_now,
      retry_count = j.retry_count  -- counted on failure, not claim
  where j.id in (
    select id from public.background_jobs
    where status in ('QUEUED', 'FAILED_RETRYABLE')
      and (next_attempt_at is null or next_attempt_at <= p_now)
    order by next_attempt_at nulls first, created_at
    for update skip locked
    limit p_limit
  )
  returning j.*;
end;
$$;

create or replace function public.mark_job_retryable(
  p_job_id uuid,
  p_last_error text,
  p_next_attempt_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.background_jobs
  set status = 'FAILED_RETRYABLE',
      retry_count = retry_count + 1,
      last_error = p_last_error,
      next_attempt_at = p_next_attempt_at
  where id = p_job_id;
end;
$$;
