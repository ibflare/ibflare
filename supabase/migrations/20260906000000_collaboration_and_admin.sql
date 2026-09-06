-- Phase 4: collaboration and admin.
--
-- video_collaborators with invite and accept, site_settings with the two kill
-- switches, the audited soft-delete path for videos, suspension enforced in
-- the database, and the helper functions the admin pages call.
-- CLAUDE.md sections 2, 3, 4 and 6.

-- ===========================================================================
-- Definer helpers
-- ===========================================================================
/*
 * These three exist to break RLS recursion, not to save typing.
 *
 * The invitee has to be able to read a video they were invited to, including a
 * draft, so videos needs a policy that consults video_collaborators. But
 * video_collaborators needs policies that consult videos, to know whether the
 * parent is public and who owns it. Written directly that is mutual recursion
 * between two policy sets.
 *
 * SECURITY DEFINER with an empty search_path runs outside the caller's RLS, so
 * each of these reads its table without triggering the other's policies. Same
 * technique and same reason as has_capability in 20260829000000.
 */

create or replace function public.owns_video(p_video uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.videos v
    where v.id = p_video and v.owner_id = (select auth.uid())
  );
$$;

create or replace function public.video_is_public(p_video uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.videos v
    where v.id = p_video
      and v.status = 'published'
      and v.deleted_at is null
  );
$$;

comment on function public.owns_video(uuid) is
  'Whether the caller owns this video. Definer, to keep video_collaborators '
  'policies from recursing into videos policies and back.';

-- is_collaborator is the third of these and is defined further down, after the
-- table it reads. It cannot live here with its siblings: a `language sql` body
-- is parsed and its objects resolved at creation time, unlike plpgsql, so
-- declaring it before video_collaborators exists fails with 42P01. The two
-- above only touch videos, which already exists by this point.

-- ===========================================================================
-- video_collaborators
-- ===========================================================================
-- A pending row is an invitation. Section 3: only `accepted` rows are shown as
-- co-authors, and a pending tag is invisible to everyone but the owner and the
-- invitee.

create table if not exists public.video_collaborators (
  video_id     uuid not null references public.videos on delete cascade,
  profile_id   uuid not null references public.profiles on delete cascade,
  status       text not null default 'pending',
  invited_at   timestamptz not null default now(),
  responded_at timestamptz,
  primary key (video_id, profile_id)
);

alter table public.video_collaborators
  drop constraint if exists video_collaborators_status_valid;
alter table public.video_collaborators
  add constraint video_collaborators_status_valid
  check (status in ('pending', 'accepted', 'declined'));

-- A response has a time; a pending invitation does not.
alter table public.video_collaborators
  drop constraint if exists video_collaborators_response_complete;
alter table public.video_collaborators
  add constraint video_collaborators_response_complete
  check ((status = 'pending') = (responded_at is null));

create index if not exists video_collaborators_profile_idx
  on public.video_collaborators (profile_id, status);

alter table public.video_collaborators enable row level security;

drop policy if exists "Accepted collaborators are public" on public.video_collaborators;
create policy "Accepted collaborators are public"
  on public.video_collaborators for select
  to anon, authenticated
  using (status = 'accepted' and public.video_is_public(video_id));

drop policy if exists "Invitees read their own invitations" on public.video_collaborators;
create policy "Invitees read their own invitations"
  on public.video_collaborators for select
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "Owners read every collaborator on their video" on public.video_collaborators;
create policy "Owners read every collaborator on their video"
  on public.video_collaborators for select
  to authenticated
  using (public.owns_video(video_id));

drop policy if exists "Moderators read every collaborator" on public.video_collaborators;
create policy "Moderators read every collaborator"
  on public.video_collaborators for select
  to authenticated
  using (public.has_capability('moderate'));

/*
 * No insert, update or delete policy, and no write grants either. Every write
 * goes through one of the three definer functions below.
 *
 * That is a deliberate departure from the profiles pattern, where writes are
 * restricted by column grant. Here the rules are about relationships rather
 * than columns: who owns the parent video, whether the target is the owner
 * themselves, whether the invitation is still pending. None of that is
 * expressible as a column privilege, and expressing it as a policy would mean
 * trusting the client to send a sensible `status`. A function is the smaller
 * surface.
 */
revoke all on public.video_collaborators from anon, authenticated;
grant select on public.video_collaborators to anon, authenticated;

-- ---------------------------------------------------------------------------
-- invite_collaborator
-- ---------------------------------------------------------------------------
-- Takes a username, because that is what the owner knows and what the picker
-- searches. Resolving it here keeps the client from having to read profiles.

create or replace function public.invite_collaborator(
  p_video uuid,
  p_username text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := (select auth.uid());
  v_target uuid;
  v_owner  uuid;
  v_title  text;
begin
  if v_actor is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  if public.is_suspended() then
    raise exception 'Your account is suspended.' using errcode = 'insufficient_privilege';
  end if;

  select v.owner_id, v.title into v_owner, v_title
  from public.videos v
  where v.id = p_video and v.deleted_at is null;

  if v_owner is null then
    raise exception 'No such video.' using errcode = 'no_data_found';
  end if;

  -- The owner controls the fields, and that includes who is tagged.
  if v_owner <> v_actor then
    raise exception 'Only the person who posted a video can tag collaborators.'
      using errcode = 'insufficient_privilege';
  end if;

  select p.id into v_target
  from public.profiles p
  where p.username = lower(btrim(p_username)) and p.onboarded;

  if v_target is null then
    raise exception 'No account with that username.' using errcode = 'no_data_found';
  end if;

  if v_target = v_actor then
    raise exception 'You are already on this video as its owner.'
      using errcode = 'check_violation';
  end if;

  /*
   * on conflict do nothing rather than an error: re-inviting somebody who has
   * already accepted should be a no-op, and re-inviting somebody who declined
   * should not quietly reset their answer to pending. Both are covered.
   */
  insert into public.video_collaborators (video_id, profile_id)
  values (p_video, v_target)
  on conflict (video_id, profile_id) do nothing;
end;
$$;

revoke all on function public.invite_collaborator(uuid, text) from public;
grant execute on function public.invite_collaborator(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- respond_to_invite
-- ---------------------------------------------------------------------------
-- Section 6: a suspended user cannot accept collaborations. Declining is
-- allowed while suspended, since refusing is not participation.

create or replace function public.respond_to_invite(
  p_video uuid,
  p_accept boolean
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
  if v_actor is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  if p_accept and public.is_suspended() then
    raise exception 'Your account is suspended, so you cannot accept a tag.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.video_collaborators
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where video_id = p_video
    and profile_id = v_actor
    and status = 'pending'
  returning true into v_found;

  if v_found is null then
    raise exception 'That invitation is not open any more.'
      using errcode = 'no_data_found';
  end if;
end;
$$;

revoke all on function public.respond_to_invite(uuid, boolean) from public;
grant execute on function public.respond_to_invite(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- remove_collaborator
-- ---------------------------------------------------------------------------
-- The owner untagging someone, or a person removing themselves from a video
-- they had accepted. A hard delete, because an invitation is not content: no
-- soft-delete trail is owed to a tag that was withdrawn.

create or replace function public.remove_collaborator(
  p_video uuid,
  p_profile uuid
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

  if not (public.owns_video(p_video) or v_actor = p_profile
          or public.has_capability('moderate')) then
    raise exception 'You cannot change the collaborators on that video.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.video_collaborators
  where video_id = p_video and profile_id = p_profile;
end;
$$;

revoke all on function public.remove_collaborator(uuid, uuid) from public;
grant execute on function public.remove_collaborator(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- is_collaborator
-- ---------------------------------------------------------------------------
-- The third recursion-breaking helper, placed here rather than with the other
-- two because a `language sql` body is validated when the function is created:
-- video_collaborators has to exist first.

create or replace function public.is_collaborator(p_video uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.video_collaborators vc
    where vc.video_id = p_video and vc.profile_id = (select auth.uid())
  );
$$;

-- ===========================================================================
-- videos: the invitee needs to see what they were invited to
-- ===========================================================================
-- Without this an invitation to a draft is unreadable by the person invited,
-- so their dashboard would show a tag on a video whose title it cannot fetch.

drop policy if exists "Invitees read videos they are tagged on" on public.videos;
create policy "Invitees read videos they are tagged on"
  on public.videos for select
  to authenticated
  using (public.is_collaborator(id));

-- ===========================================================================
-- public_videos, now carrying the byline
-- ===========================================================================
/*
 * Recreated to add `collaborators`, a jsonb array of the accepted ones.
 *
 * Aggregated in the view rather than fetched per card, because /library
 * renders twelve at a time and a query per card is the N+1 that makes a list
 * page slow. The array is empty for the common case of a video with one
 * author, which costs nothing to render.
 *
 * Ordered by display_name so a byline is stable between requests rather than
 * reshuffling on whatever order the planner returns.
 */
drop view if exists public.public_videos;
create view public.public_videos
with (security_invoker = false, security_barrier = true) as
  select
    v.id,
    v.title,
    v.description,
    v.youtube_id,
    v.thumbnail_url,
    v.duration_s,
    v.difficulty,
    v.topic,
    v.view_count,
    v.published_at,
    v.search_tsv,
    v.owner_id,
    p.username     as owner_username,
    p.display_name as owner_display_name,
    p.title        as owner_title,
    p.avatar_url   as owner_avatar_url,
    p.role         as owner_role,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'username', cp.username,
                   'display_name', cp.display_name
                 )
                 order by cp.display_name
               )
        from public.video_collaborators vc
        join public.profiles cp on cp.id = vc.profile_id
        where vc.video_id = v.id and vc.status = 'accepted'
      ),
      '[]'::jsonb
    ) as collaborators
  from public.videos v
  join public.profiles p on p.id = v.owner_id
  where v.status = 'published'
    and v.deleted_at is null;

comment on view public.public_videos is
  'Published, non-deleted videos with their owner''s public fields and their '
  'accepted collaborators. Read by /library and /v/[id]. Granted to anon '
  'because viewing does not require an account. Never add a private profile '
  'column here: grade, city, school and birth_year are not public (section 9.1).';

grant select on public.public_videos to anon, authenticated;

-- ===========================================================================
-- site_settings
-- ===========================================================================
-- Exactly one row. Section 4: the kill switches live here so they can be
-- flipped from the admin panel without a deploy.

create table if not exists public.site_settings (
  id               smallint primary key default 1,
  comments_enabled boolean not null default true,
  signups_enabled  boolean not null default true,
  updated_by       uuid references public.profiles,
  updated_at       timestamptz not null default now()
);

alter table public.site_settings
  drop constraint if exists site_settings_singleton;
alter table public.site_settings
  add constraint site_settings_singleton check (id = 1);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

alter table public.site_settings enable row level security;

-- Readable by anon: the app has to know whether comments are on before it
-- decides whether to render the comment UI, and that decision happens on
-- pages a signed-out visitor sees.
drop policy if exists "Site settings are readable by anyone" on public.site_settings;
create policy "Site settings are readable by anyone"
  on public.site_settings for select
  to anon, authenticated
  using (true);

/*
 * No update policy and no update grant. set_site_settings below is the only
 * way to change these, so that every flip is audited and updated_by cannot be
 * forged. A kill switch nobody can attribute is a kill switch nobody is
 * accountable for.
 */
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;

create or replace function public.set_site_settings(
  p_comments_enabled boolean,
  p_signups_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := (select auth.uid());
  v_before jsonb;
begin
  if v_actor is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  if not public.has_capability('manage_users') then
    raise exception 'Changing site settings requires sponsor permission.'
      using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
           'comments_enabled', s.comments_enabled,
           'signups_enabled', s.signups_enabled
         )
    into v_before
  from public.site_settings s where s.id = 1;

  update public.site_settings
  set comments_enabled = coalesce(p_comments_enabled, comments_enabled),
      signups_enabled  = coalesce(p_signups_enabled, signups_enabled),
      updated_by = v_actor,
      updated_at = now()
  where id = 1;

  insert into public.audit_log (actor_id, action, target, detail)
  values (
    v_actor,
    'settings.update',
    'site_settings',
    jsonb_build_object(
      'before', v_before,
      'after', jsonb_build_object(
        'comments_enabled', coalesce(p_comments_enabled, (v_before->>'comments_enabled')::boolean),
        'signups_enabled',  coalesce(p_signups_enabled,  (v_before->>'signups_enabled')::boolean)
      )
    )
  );
end;
$$;

revoke all on function public.set_site_settings(boolean, boolean) from public;
grant execute on function public.set_site_settings(boolean, boolean) to authenticated;

-- ===========================================================================
-- Suspension, enforced
-- ===========================================================================
/*
 * Section 2: a suspended user can still sign in and watch, but cannot post,
 * comment, accept collaborations, or edit their profile.
 *
 * The first three were already enforced. Profile editing was not: the owner
 * update policy checked only that the row belonged to the caller. Adding the
 * suspension test here is what makes that sentence true.
 *
 * attest_age, accept_terms and clear_avatar are unaffected, being definer
 * functions that bypass RLS, so a suspended account can still finish
 * onboarding and a moderator can still clear a suspended person's picture.
 */
drop policy if exists "profiles: owner updates own row" on public.profiles;
create policy "profiles: owner updates own row"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id and not public.is_suspended())
  with check ((select auth.uid()) = id and not public.is_suspended());

create or replace function public.suspend_user(
  p_target uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor       uuid := (select auth.uid());
  v_target_role text;
  v_target_name text;
begin
  if v_actor is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Suspending someone requires a reason.'
      using errcode = 'check_violation';
  end if;

  select p.role, p.username into v_target_role, v_target_name
  from public.profiles p where p.id = p_target;

  if v_target_name is null then
    raise exception 'No such account.' using errcode = 'no_data_found';
  end if;

  -- Suspending yourself is never the intent, and for a sole sponsor it would
  -- lock the club out of its own profile editing.
  if p_target = v_actor then
    raise exception 'You cannot suspend your own account.'
      using errcode = 'check_violation';
  end if;

  /*
   * Section 2: can_moderate is the fast lever for a spammer and reaches a
   * viewer or a member. Suspending an officer or a sponsor is a different kind
   * of decision and needs can_manage_users.
   */
  if v_target_role in ('officer', 'sponsor') then
    if not public.has_capability('manage_users') then
      raise exception 'Suspending an officer or sponsor requires sponsor permission.'
        using errcode = 'insufficient_privilege';
    end if;
  elsif not public.has_capability('moderate') then
    raise exception 'Suspending an account requires moderator permission.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.profiles
  set suspended_at = now(),
      suspended_by = v_actor,
      suspension_reason = btrim(p_reason)
  where id = p_target;

  insert into public.audit_log (actor_id, action, target, detail)
  values (
    v_actor, 'user.suspend', v_target_name,
    jsonb_build_object('reason', btrim(p_reason), 'role', v_target_role)
  );
end;
$$;

revoke all on function public.suspend_user(uuid, text) from public;
grant execute on function public.suspend_user(uuid, text) to authenticated;

-- Lifting any suspension requires can_manage_users, per section 2, whoever
-- applied it. A moderator can stop a spammer but cannot undo a sponsor's call.
create or replace function public.unsuspend_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_name  text;
begin
  if v_actor is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  if not public.has_capability('manage_users') then
    raise exception 'Lifting a suspension requires sponsor permission.'
      using errcode = 'insufficient_privilege';
  end if;

  select p.username into v_name from public.profiles p where p.id = p_target;
  if v_name is null then
    raise exception 'No such account.' using errcode = 'no_data_found';
  end if;

  update public.profiles
  set suspended_at = null, suspended_by = null, suspension_reason = null
  where id = p_target;

  insert into public.audit_log (actor_id, action, target, detail)
  values (v_actor, 'user.unsuspend', v_name, '{}'::jsonb);
end;
$$;

revoke all on function public.unsuspend_user(uuid) from public;
grant execute on function public.unsuspend_user(uuid) to authenticated;

-- ===========================================================================
-- The audited soft-delete path for videos
-- ===========================================================================
/*
 * Section 3: deletes are soft, and every delete writes an audit_log row.
 * 20260904000000 deliberately left deleted_at and deleted_by out of the column
 * grants and gave videos no DELETE policy at all, so this is the only way a
 * video comes down.
 *
 * The evidence is copied into detail as plain text, for the same reason
 * section 4 gives for comments: videos.owner_id cascades on profile delete, so
 * deleting the account takes the video row and its soft-delete trail with it,
 * and the log row is then the only surviving record of what was removed.
 */
create or replace function public.soft_delete_video(
  p_video uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_title text;
  v_owner text;
begin
  if v_actor is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  select v.title, p.username into v_title, v_owner
  from public.videos v
  join public.profiles p on p.id = v.owner_id
  where v.id = p_video and v.deleted_at is null;

  if v_title is null then
    raise exception 'No such video, or it is already deleted.'
      using errcode = 'no_data_found';
  end if;

  if not (public.owns_video(p_video) or public.has_capability('moderate')) then
    raise exception 'You cannot delete that video.'
      using errcode = 'insufficient_privilege';
  end if;

  if public.owns_video(p_video) and public.is_suspended() then
    raise exception 'Your account is suspended.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.videos
  set deleted_at = now(), deleted_by = v_actor
  where id = p_video;

  insert into public.audit_log (actor_id, action, target, detail)
  values (
    v_actor, 'video.delete', p_video::text,
    jsonb_build_object(
      'title', v_title,
      'owner_username', v_owner,
      'reason', nullif(btrim(coalesce(p_reason, '')), ''),
      'by_owner', public.owns_video(p_video)
    )
  );
end;
$$;

revoke all on function public.soft_delete_video(uuid, text) from public;
grant execute on function public.soft_delete_video(uuid, text) to authenticated;

-- Restore is a moderator action only. An owner who deleted their own video
-- asks an officer to put it back, which leaves a record of both halves.
create or replace function public.restore_video(p_video uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_title text;
begin
  if v_actor is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  if not public.has_capability('moderate') then
    raise exception 'Restoring a video requires moderator permission.'
      using errcode = 'insufficient_privilege';
  end if;

  select v.title into v_title
  from public.videos v
  where v.id = p_video and v.deleted_at is not null;

  if v_title is null then
    raise exception 'No such deleted video.' using errcode = 'no_data_found';
  end if;

  update public.videos
  set deleted_at = null, deleted_by = null
  where id = p_video;

  insert into public.audit_log (actor_id, action, target, detail)
  values (v_actor, 'video.restore', p_video::text,
          jsonb_build_object('title', v_title));
end;
$$;

revoke all on function public.restore_video(uuid) from public;
grant execute on function public.restore_video(uuid) to authenticated;

-- ===========================================================================
-- search_people
-- ===========================================================================
/*
 * What /dashboard/admin/people searches. Section 7: "type a name, username, or
 * email, get matching accounts", which is how a sponsor finds four officers
 * among hundreds of accounts.
 *
 * It has to be a definer function because of the email. Email lives in
 * auth.users, which no client role can read at all, so a sponsor searching by
 * the only identifier they reliably know, the address a student signed up
 * with, is impossible without this.
 *
 * Gated on can_manage_users rather than can_moderate. Section 9's table puts
 * email in reach of officers and the sponsor, and this is deliberately the
 * tighter of the two: the page it serves is the sponsor's page, and an email
 * list of minors is worth handing to fewer people rather than more.
 *
 * Capped at 50. A sponsor looking for one person needs a search box, not a
 * paginated table, and 50 unmatched results means the query was too broad.
 */
create or replace function public.search_people(p_query text)
returns table (
  id                uuid,
  username          text,
  display_name      text,
  title             text,
  role              text,
  can_post          boolean,
  can_moderate      boolean,
  can_manage_users  boolean,
  suspended_at      timestamptz,
  suspension_reason text,
  email             text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q text := '%' || lower(btrim(coalesce(p_query, ''))) || '%';
begin
  if not public.has_capability('manage_users') then
    raise exception 'Managing people requires sponsor permission.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select p.id, p.username, p.display_name, p.title, p.role,
           p.can_post, p.can_moderate, p.can_manage_users,
           p.suspended_at, p.suspension_reason,
           u.email::text
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(p.username) like v_q
       or lower(p.display_name) like v_q
       or lower(coalesce(u.email, '')) like v_q
    order by p.display_name
    limit 50;
end;
$$;

revoke all on function public.search_people(text) from public;
grant execute on function public.search_people(text) to authenticated;

-- ===========================================================================
-- read_audit_log
-- ===========================================================================
/*
 * What /dashboard/admin/log reads. The audit_log policy already limits SELECT
 * to can_moderate, so a plain query would work for the rows themselves. This
 * exists for the actor's name: actor_id points at profiles, and a moderator
 * without can_manage_users cannot read another person's profile row, so a log
 * of "someone did something" is what a plain query returns.
 *
 * Resolving the name here keeps the page from being useless to exactly the
 * people it is for.
 */
create or replace function public.read_audit_log(p_limit integer default 200)
returns table (
  id             bigint,
  action         text,
  target         text,
  detail         jsonb,
  created_at     timestamptz,
  actor_username text,
  actor_name     text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_capability('moderate') then
    raise exception 'Reading the log requires moderator permission.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select l.id, l.action, l.target, l.detail, l.created_at,
           p.username, p.display_name
    from public.audit_log l
    left join public.profiles p on p.id = l.actor_id
    order by l.created_at desc, l.id desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500);
end;
$$;

revoke all on function public.read_audit_log(integer) from public;
grant execute on function public.read_audit_log(integer) to authenticated;

-- ===========================================================================
-- signups_enabled, enforced in the trigger
-- ===========================================================================
/*
 * handle_new_user recreated, identical to the 20260902000000 version except
 * that it now refuses to create a profile while signups are switched off.
 *
 * The trigger is the only place this can actually be enforced. An account is
 * created through the auth API, not through PostgREST, so there is no policy
 * and no grant standing in front of it: an app-layer check is a check the
 * client could skip. Raising here rolls back the auth.users insert that fired
 * the trigger, so the account is never created at all.
 *
 * Section 4 pairs this with comments_enabled, which will be enforced by the
 * comments insert policy in phase 5. That one can be a policy because a
 * comment is an ordinary table write; this one cannot.
 *
 * The cost is the error message. Supabase surfaces a trigger exception as a
 * generic signup failure, so the sign-in page also checks the switch first in
 * order to say something useful. That check is the courtesy; this is the gate.
 */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base      text;
  candidate text;
  suffix    integer := 0;
  meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if not coalesce(
       (select s.signups_enabled from public.site_settings s where s.id = 1),
       true
     ) then
    raise exception 'FLARE is not accepting new accounts right now.'
      using errcode = 'insufficient_privilege';
  end if;

  -- A username is required at signup because the column is NOT NULL, but the
  -- user does not choose one until onboarding. Derive a legal placeholder now
  -- and let them replace it there.
  base := lower(split_part(coalesce(new.email, ''), '@', 1));
  base := regexp_replace(base, '[^a-z0-9_]', '', 'g');
  if char_length(base) < 3 then
    base := 'member';
  end if;
  -- Leave headroom for a disambiguating suffix inside the 20 char limit.
  base := left(base, 16);

  -- Reserved names are suffixed rather than rejected, exactly like collisions.
  candidate := base;
  while public.is_reserved_username(candidate)
        or exists (select 1 from public.profiles p where p.username = candidate)
  loop
    suffix := suffix + 1;
    candidate := base || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    candidate,
    public.default_display_name(
      coalesce(meta->>'full_name', meta->>'name'),
      candidate
    ),
    nullif(coalesce(meta->>'avatar_url', meta->>'picture'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
