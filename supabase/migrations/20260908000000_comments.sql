-- Phase 5: comments, reports, and the moderation surface around them.
--
-- CLAUDE.md sections 3, 4, 6 and 9. Section 4's rule is that comments ship
-- with the moderation stack or they do not ship, so everything here lands
-- together: the tables, the rate limit, the kill switch enforcement, the
-- report path, the officer queue's reads, and the audited soft delete that
-- copies its evidence out as plain text.

-- ===========================================================================
-- comments
-- ===========================================================================
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  video_id   uuid not null references public.videos on delete cascade,
  author_id  uuid not null references public.profiles on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles
);

alter table public.comments
  drop constraint if exists comments_body_length;
alter table public.comments
  add constraint comments_body_length
  check (char_length(btrim(body)) between 1 and 1000);

alter table public.comments
  drop constraint if exists comments_delete_complete;
alter table public.comments
  add constraint comments_delete_complete
  check ((deleted_at is null) = (deleted_by is null));

create index if not exists comments_video_idx
  on public.comments (video_id, created_at);
create index if not exists comments_author_idx
  on public.comments (author_id, created_at desc);

-- ===========================================================================
-- reports
-- ===========================================================================
/*
 * reporter_id cascades, unlike audit_log.actor_id.
 *
 * Section 2 pins the accounts named in a moderation record because the record
 * is the point. A report is not that: it is a workflow item saying somebody
 * asked an officer to look at something, and if an officer acted on it there
 * is an audit_log row with the actor's name in text. Pinning a reporter's
 * account forever because they once tapped Report would be the fifth instance
 * of that mistake, so this one cascades.
 */
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.comments on delete cascade,
  reporter_id uuid not null references public.profiles on delete cascade,
  reason      text,
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles on delete set null,

  -- One report per person per comment. Re-reporting is a no-op rather than a
  -- way to make the queue look busier than it is.
  unique (comment_id, reporter_id)
);

alter table public.reports
  drop constraint if exists reports_status_valid;
alter table public.reports
  add constraint reports_status_valid
  check (status in ('open', 'resolved', 'dismissed'));

alter table public.reports
  drop constraint if exists reports_resolution_complete;
alter table public.reports
  add constraint reports_resolution_complete
  check ((status = 'open') = (resolved_at is null));

create index if not exists reports_open_idx
  on public.reports (status, created_at desc);

-- ===========================================================================
-- Policy helpers
-- ===========================================================================
/*
 * comments_are_enabled reads the kill switch. Section 6 wants the comments
 * insert policy to check site_settings.comments_enabled, so that flipping the
 * switch holds even against someone hitting the API directly rather than only
 * hiding the UI.
 *
 * Definer because the policy is on comments and this reads site_settings; and
 * because a policy that reads a table the caller might not be able to read is
 * a policy that silently fails closed for the wrong reason.
 */
create or replace function public.comments_are_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.comments_enabled from public.site_settings s where s.id = 1),
    true
  );
$$;

/*
 * The rate limit from section 4: five comments per user per minute.
 *
 * Definer, and it has to be. This is called from a policy ON comments and it
 * counts rows IN comments, which under the caller's own RLS would recurse.
 * Same technique as has_capability and is_collaborator.
 *
 * Counts non-deleted and deleted alike: deleting your own comment must not
 * hand back a slot, or the limit is trivially defeated by posting, deleting,
 * and posting again.
 */
create or replace function public.recent_comment_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.comments c
  where c.author_id = (select auth.uid())
    and c.created_at > now() - interval '1 minute';
$$;

comment on function public.recent_comment_count() is
  'Comments this account has posted in the last minute, deleted ones included. '
  'Backs the five-per-minute rate limit in the comments insert policy.';

-- ===========================================================================
-- RLS on comments
-- ===========================================================================
alter table public.comments enable row level security;

-- Anyone, account or not, on a published video. Viewing is public.
drop policy if exists "Comments on published videos are public" on public.comments;
create policy "Comments on published videos are public"
  on public.comments for select
  to anon, authenticated
  using (deleted_at is null and public.video_is_public(video_id));

drop policy if exists "Authors read their own comments" on public.comments;
create policy "Authors read their own comments"
  on public.comments for select
  to authenticated
  using ((select auth.uid()) = author_id);

drop policy if exists "Moderators read every comment" on public.comments;
create policy "Moderators read every comment"
  on public.comments for select
  to authenticated
  using (public.has_capability('moderate'));

/*
 * Insert. Everything section 4 and section 6 ask for, in one place:
 * the author is the caller, the account is onboarded and unsuspended, the kill
 * switch is on, and the rate limit has room.
 *
 * The wordlist filter is NOT here and cannot be: it lives in
 * src/lib/moderation and runs in the server action. So a client calling
 * PostgREST directly bypasses the wordlist but not the capability, the
 * suspension, the kill switch, or the rate limit. Section 4 is explicit that
 * the filter is the smallest part of the system and stops careless posts
 * rather than determined ones, so this is the intended split rather than a
 * gap: the things that must hold are in the database, and the thing that
 * catches accidents is in the application.
 */
drop policy if exists "Members comment on published videos" on public.comments;
create policy "Members comment on published videos"
  on public.comments for insert
  to authenticated
  with check (
    (select auth.uid()) = author_id
    and public.video_is_public(video_id)
    and public.is_onboarded()
    and not public.is_suspended()
    and public.comments_are_enabled()
    and public.recent_comment_count() < 5
  );

/*
 * Update: your own, for five minutes, per section 6. deleted_at is checked so
 * a soft-deleted comment cannot be edited back into something else, and the
 * suspension check is there because a suspended account cannot participate.
 *
 * The column grant below is what stops this being an edit of anything but the
 * body, and a trigger sets edited_at, so the window cannot be extended by
 * lying about when the edit happened.
 */
drop policy if exists "Authors edit their own comment briefly" on public.comments;
create policy "Authors edit their own comment briefly"
  on public.comments for update
  to authenticated
  using (
    (select auth.uid()) = author_id
    and deleted_at is null
    and created_at > now() - interval '5 minutes'
    and not public.is_suspended()
  )
  with check (
    (select auth.uid()) = author_id
    and deleted_at is null
  );

/*
 * No DELETE policy. Section 4: comment deletion is soft, so nothing should
 * ever issue DELETE FROM comments and nothing is permitted to.
 */

revoke all on public.comments from anon, authenticated;
grant select on public.comments to anon, authenticated;
grant insert (video_id, author_id, body) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;

-- edited_at is set here rather than granted, so an author cannot edit the body
-- while claiming they did not, or backdate the edit to widen their window.
create or replace function public.comments_stamp_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists comments_stamp_edit on public.comments;
create trigger comments_stamp_edit
  before update on public.comments
  for each row execute function public.comments_stamp_edit();

-- ===========================================================================
-- RLS on reports
-- ===========================================================================
alter table public.reports enable row level security;

-- Section 6: readable only with can_moderate. A report is a private note to
-- the officers, not something the reported person gets to read.
drop policy if exists "Moderators read reports" on public.reports;
create policy "Moderators read reports"
  on public.reports for select
  to authenticated
  using (public.has_capability('moderate'));

/*
 * No insert, update or delete policy and no write grants: report_comment and
 * resolve_report below are the only paths. The insert needs `on conflict do
 * nothing` for the one-per-person rule, and the resolve needs an audit row in
 * the same transaction, and neither is expressible as a policy.
 */
revoke all on public.reports from anon, authenticated;
grant select on public.reports to authenticated;

-- ===========================================================================
-- public_comments
-- ===========================================================================
/*
 * What /v/[id] reads. Exists for the same reason public_videos does: a comment
 * needs its author's name and picture, the base profiles table is not readable
 * by anon, and PostgREST cannot embed public_profiles because a view has no
 * foreign key to follow.
 *
 * Filtered to non-deleted comments on published videos, so a soft-deleted
 * comment is gone from the page without the page having to remember to filter.
 * Never add a private profile column here.
 */
drop view if exists public.public_comments;
create view public.public_comments
with (security_invoker = false, security_barrier = true) as
  select
    c.id,
    c.video_id,
    c.body,
    c.created_at,
    c.edited_at,
    c.author_id,
    p.username     as author_username,
    p.display_name as author_display_name,
    p.avatar_url   as author_avatar_url,
    p.title        as author_title,
    p.role         as author_role
  from public.comments c
  join public.videos v on v.id = c.video_id
  join public.profiles p on p.id = c.author_id
  where c.deleted_at is null
    and v.status = 'published'
    and v.deleted_at is null;

comment on view public.public_comments is
  'Non-deleted comments on published videos, with the author''s public fields. '
  'Granted to anon because viewing does not require an account. Never add '
  'grade, city, school or birth_year here (section 9.1).';

grant select on public.public_comments to anon, authenticated;

-- ===========================================================================
-- report_comment
-- ===========================================================================
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
  on conflict (comment_id, reporter_id) do nothing;
end;
$$;

revoke all on function public.report_comment(uuid, text) from public;
grant execute on function public.report_comment(uuid, text) to authenticated;

-- ===========================================================================
-- soft_delete_comment
-- ===========================================================================
/*
 * Section 4, and the reason the evidence is copied is spelled out there:
 * comments.author_id cascades on profile delete, so deleting the account takes
 * the comment row and its whole soft-delete trail with it, and the audit_log
 * row is then the only surviving copy. An account deleted after a serious
 * incident is both the case where the record matters most and the case where
 * every reference-based record disappears.
 *
 * The copy is denormalised text: the body, the author's username and display
 * name, the video title, and the reason. Written in the same transaction as
 * the delete, in this function, so a delete cannot succeed without its record.
 *
 * An author deleting their own comment writes no copy. Section 9 is explicit
 * that the retention is narrow: a comment a moderator removed, not every
 * comment, and nothing when somebody takes down their own.
 */
create or replace function public.soft_delete_comment(
  p_comment uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor        uuid := (select auth.uid());
  v_author       uuid;
  v_body         text;
  v_author_user  text;
  v_author_name  text;
  v_video_title  text;
  v_is_moderator boolean;
begin
  if v_actor is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  select c.author_id, c.body, p.username, p.display_name, v.title
    into v_author, v_body, v_author_user, v_author_name, v_video_title
  from public.comments c
  join public.profiles p on p.id = c.author_id
  join public.videos v on v.id = c.video_id
  where c.id = p_comment and c.deleted_at is null;

  if v_author is null then
    raise exception 'That comment is not there any more.'
      using errcode = 'no_data_found';
  end if;

  v_is_moderator := public.has_capability('moderate');

  if v_author <> v_actor and not v_is_moderator then
    raise exception 'You cannot delete that comment.'
      using errcode = 'insufficient_privilege';
  end if;

  -- A suspended author cannot act on their own comment; a suspended moderator
  -- still can, because taking something down is not participating.
  if v_author = v_actor and not v_is_moderator and public.is_suspended() then
    raise exception 'Your account is suspended.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.comments
  set deleted_at = now(), deleted_by = v_actor
  where id = p_comment;

  -- Only a moderator removing somebody else's comment leaves a copy.
  if v_is_moderator and v_author <> v_actor then
    insert into public.audit_log (actor_id, action, target, detail)
    values (
      v_actor,
      'comment.delete',
      p_comment::text,
      jsonb_build_object(
        'body', v_body,
        'author_username', v_author_user,
        'author_display_name', v_author_name,
        'video_title', v_video_title,
        'reason', nullif(btrim(coalesce(p_reason, '')), '')
      )
    );

    -- Any open report on it is answered by the removal.
    update public.reports
    set status = 'resolved', resolved_at = now(), resolved_by = v_actor
    where comment_id = p_comment and status = 'open';
  end if;
end;
$$;

revoke all on function public.soft_delete_comment(uuid, text) from public;
grant execute on function public.soft_delete_comment(uuid, text) to authenticated;

-- ===========================================================================
-- restore_comment
-- ===========================================================================
-- Moderator only, mirroring restore_video. A deletion made in error is two
-- columns away from being undone, which is the point of soft deletion.
create or replace function public.restore_comment(p_comment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_found boolean;
begin
  if not public.has_capability('moderate') then
    raise exception 'Restoring a comment requires moderator permission.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.comments
  set deleted_at = null, deleted_by = null
  where id = p_comment and deleted_at is not null
  returning true into v_found;

  if v_found is null then
    raise exception 'No such deleted comment.' using errcode = 'no_data_found';
  end if;

  insert into public.audit_log (actor_id, action, target, detail)
  values (v_actor, 'comment.restore', p_comment::text, '{}'::jsonb);
end;
$$;

revoke all on function public.restore_comment(uuid) from public;
grant execute on function public.restore_comment(uuid) to authenticated;

-- ===========================================================================
-- resolve_report
-- ===========================================================================
create or replace function public.resolve_report(
  p_report uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_found boolean;
begin
  if not public.has_capability('moderate') then
    raise exception 'Handling reports requires moderator permission.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_status not in ('resolved', 'dismissed') then
    raise exception 'A report is either resolved or dismissed.'
      using errcode = 'check_violation';
  end if;

  update public.reports
  set status = p_status, resolved_at = now(), resolved_by = v_actor
  where id = p_report and status = 'open'
  returning true into v_found;

  if v_found is null then
    raise exception 'That report has already been handled.'
      using errcode = 'no_data_found';
  end if;

  insert into public.audit_log (actor_id, action, target, detail)
  values (v_actor, 'report.' || p_status, p_report::text, '{}'::jsonb);
end;
$$;

revoke all on function public.resolve_report(uuid, text) from public;
grant execute on function public.resolve_report(uuid, text) to authenticated;

-- ===========================================================================
-- flag_blocked_comment
-- ===========================================================================
/*
 * Section 4's second tier: a slur is rejected AND written to audit_log flagged
 * for officers, so repeat hits from one account surface in the admin panel.
 *
 * A definer function because authenticated has no insert on audit_log, by
 * design: the log is written by the code that does the thing, not by clients.
 * This is the one case where the client is the thing that happened, since the
 * comment was refused and there is no row anywhere else to point at.
 *
 * The rejected text is stored verbatim. That is the evidence, and it is the
 * point: "this account tried to post a slur three times this week" is not a
 * claim anybody can act on without the words. Section 9 records that this
 * means the database holds text that was never accepted onto the site.
 */
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

-- ===========================================================================
-- read_report_queue
-- ===========================================================================
/*
 * What /dashboard/admin/reports reads. Section 4: the queue shows the comment,
 * the author, and their history.
 *
 * Definer for the usual reason: a moderator without can_manage_users cannot
 * read another person's profile row, so a plain query gives a queue of
 * anonymous comment ids. It also assembles the history here, where it is three
 * scalar subqueries, rather than in the page, where it would be a query per
 * row.
 *
 * "History" is deliberately three counts and a suspension flag, not a
 * transcript. What an officer needs to know before acting is whether this is
 * a first offence or a pattern.
 */
create or replace function public.read_report_queue(p_include_handled boolean default false)
returns table (
  report_id           uuid,
  report_reason       text,
  report_status       text,
  reported_at         timestamptz,
  reporter_name       text,
  comment_id          uuid,
  comment_body        text,
  comment_created_at  timestamptz,
  comment_deleted     boolean,
  video_id            uuid,
  video_title         text,
  author_id           uuid,
  author_username     text,
  author_display_name text,
  author_suspended    boolean,
  author_report_count integer,
  author_blocked_count integer,
  author_deleted_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_capability('moderate') then
    raise exception 'The report queue requires moderator permission.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      r.id, r.reason, r.status, r.created_at,
      rp.display_name,
      c.id, c.body, c.created_at, (c.deleted_at is not null),
      v.id, v.title,
      a.id, a.username, a.display_name, (a.suspended_at is not null),
      (select count(*)::integer from public.reports r2
         join public.comments c2 on c2.id = r2.comment_id
        where c2.author_id = a.id),
      (select count(*)::integer from public.audit_log l
        where l.actor_id = a.id and l.action = 'comment.blocked'),
      (select count(*)::integer from public.comments c3
        where c3.author_id = a.id and c3.deleted_at is not null)
    from public.reports r
    join public.comments c on c.id = r.comment_id
    join public.videos v on v.id = c.video_id
    join public.profiles a on a.id = c.author_id
    left join public.profiles rp on rp.id = r.reporter_id
    where p_include_handled or r.status = 'open'
    order by (r.status = 'open') desc, r.created_at desc;
end;
$$;

revoke all on function public.read_report_queue(boolean) from public;
grant execute on function public.read_report_queue(boolean) to authenticated;
