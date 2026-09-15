-- Put the suspension guard on the two write paths that feed the officer queue.
--
-- Found by the 14 September audit, by calling both functions from a real
-- authenticated session rather than by reading the policies.
--
-- Both are SECURITY DEFINER, and neither table grants INSERT to `authenticated`
-- at all, so these functions are the ONLY way a row reaches `reports` or an
-- audit_log `comment.blocked` entry. That means the guard has to live in the
-- function: there is no policy standing behind it to catch what it misses.
-- Section 6's line "every insert policy on videos, comments,
-- video_collaborators and reports also requires suspended_at IS NULL" was not
-- true of reports, because reports has no insert policy to carry it.
--
-- 1. report_comment checked signed-in, onboarded, comment-exists and
--    not-your-own, but not suspension. A suspended account could still file
--    reports, which is precisely the spam channel suspension exists to close:
--    section 2 calls suspension "the fast lever for a spammer", and this left
--    the lever half-pulled.
--
-- 2. flag_blocked_comment checked only that the caller was signed in. Any
--    authenticated account, including one that never finished onboarding and
--    one that is suspended, could write up to 1000 characters of arbitrary
--    text into audit_log as a 'comment.blocked' row, attributed to itself,
--    against any video id it liked. Three things that spoils:
--      - it fills the "Blocked before posting" panel with content the filter
--        never refused, which is the panel an officer uses to judge whether
--        somebody is a repeat problem;
--      - audit_log.actor_id does not cascade (section 2), so writing to the
--        log is how an account makes itself undeletable. That should be a
--        consequence of moderating, not something anyone can do on demand;
--      - section 9.6 treats this table as a retention claim about words a
--        minor was prevented from publishing. Text that no filter ever saw
--        does not belong in that record.
--
--    It now requires what the comments insert policy requires of a real
--    comment: onboarded, not suspended, and a video that actually exists and
--    is public. A blocked comment only makes sense on a video the caller could
--    have commented on in the first place.
--
-- Neither change affects the application's own call path. postComment only
-- reaches flag_blocked_comment after whyNot() has already established that the
-- account is onboarded, unsuspended and looking at a public video.

create or replace function public.report_comment(
  p_comment uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := (select auth.uid());
  v_author uuid;
begin
  if v_actor is null then
    raise exception 'Sign in to report a comment.'
      using errcode = 'insufficient_privilege';
  end if;

  if not public.is_onboarded() then
    raise exception 'Finish setting up your account first.'
      using errcode = 'insufficient_privilege';
  end if;

  if public.is_suspended() then
    raise exception 'Your account is suspended, so you cannot report comments.'
      using errcode = 'insufficient_privilege';
  end if;

  select c.author_id into v_author
  from public.comments c
  where c.id = p_comment and c.deleted_at is null;

  if v_author is null then
    raise exception 'That comment is not there any more.'
      using errcode = 'no_data_found';
  end if;

  if v_author = v_actor then
    raise exception 'You cannot report your own comment.'
      using errcode = 'check_violation';
  end if;

  -- One per person per comment. Reporting twice is not an error, it just does
  -- nothing, so the button never has to explain itself.
  insert into public.reports (comment_id, reporter_id, reason)
  values (p_comment, v_actor, nullif(btrim(coalesce(p_reason, '')), ''))
  on conflict do nothing;
end;
$$;

revoke all on function public.report_comment(uuid, text) from public;
grant execute on function public.report_comment(uuid, text) to authenticated;

create or replace function public.flag_blocked_comment(
  p_video uuid,
  p_body text,
  p_tier text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  -- The same three the comments insert policy requires. Without them this is
  -- an open write into the moderation record: see the header of this file.
  if not public.is_onboarded() then
    raise exception 'Finish setting up your account first.'
      using errcode = 'insufficient_privilege';
  end if;

  if public.is_suspended() then
    raise exception 'Your account is suspended.'
      using errcode = 'insufficient_privilege';
  end if;

  if not public.video_is_public(p_video) then
    raise exception 'That video is not there.' using errcode = 'no_data_found';
  end if;

  if p_tier not in ('slur') then
    -- Profanity is refused and not recorded. Section 4 asks for a log entry
    -- on the second tier only, and logging every "damn" would bury the tier
    -- that matters under noise.
    return;
  end if;

  insert into public.audit_log (actor_id, action, target, detail)
  values (
    v_actor,
    'comment.blocked',
    p_video::text,
    jsonb_build_object('tier', p_tier, 'body', left(coalesce(p_body, ''), 1000))
  );
end;
$$;

revoke all on function public.flag_blocked_comment(uuid, text, text) from public;
grant execute on function public.flag_blocked_comment(uuid, text, text) to authenticated;

comment on function public.report_comment(uuid, text) is
  'Files a report. Requires onboarded and not suspended: reports has no insert '
  'grant, so this function is the only path and carries the guard itself.';

comment on function public.flag_blocked_comment(uuid, text, text) is
  'Records a tier-two filter refusal. Requires onboarded, not suspended, and a '
  'real public video, so the moderation log cannot be written to on demand.';
