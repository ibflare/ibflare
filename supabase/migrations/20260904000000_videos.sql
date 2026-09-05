-- Phase 3: the library.
--
-- The videos table, its RLS, and the public projection /library and /v/[id]
-- read. CLAUDE.md sections 3, 5 and 6.
--
-- We never hold a video file. youtube_id is the whole asset reference, and
-- everything else here is metadata we resolved from the Data API at upload.

create table if not exists public.videos (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  youtube_id     text not null,
  thumbnail_url  text,
  duration_s     integer,
  difficulty     smallint not null,
  topic          text not null,
  owner_id       uuid not null references public.profiles on delete cascade,
  status         text not null default 'published',
  release_ok     boolean not null default false,
  view_count     integer not null default 0,
  created_at     timestamptz not null default now(),
  published_at   timestamptz,
  deleted_at     timestamptz,
  deleted_by     uuid references public.profiles,

  -- Generated and stored, so search never recomputes it and an index can sit
  -- on it. to_tsvector with an explicit config is immutable, which is what a
  -- generated column requires; the two-argument form without a config is not.
  search_tsv tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(description, '')
    )
  ) stored
);

-- ===========================================================================
-- Constraints
-- ===========================================================================
-- The same approach as profiles: every rule section 3 states in prose gets a
-- constraint, so the invariant holds whatever code path is writing.

alter table public.videos
  drop constraint if exists videos_difficulty_range;
alter table public.videos
  add constraint videos_difficulty_range
  check (difficulty between 1 and 5);

-- Must stay in step with TOPICS in src/lib/taxonomy.ts.
alter table public.videos
  drop constraint if exists videos_topic_valid;
alter table public.videos
  add constraint videos_topic_valid
  check (topic in ('taxes','banking','credit','investing','career','macro','micro','corporate'));

alter table public.videos
  drop constraint if exists videos_status_valid;
alter table public.videos
  add constraint videos_status_valid
  check (status in ('draft','published','hidden'));

-- An 11 character YouTube ID. Checked here as well as in the resolver, because
-- the column is in the INSERT grant and PostgREST is reachable directly.
alter table public.videos
  drop constraint if exists videos_youtube_id_format;
alter table public.videos
  add constraint videos_youtube_id_format
  check (youtube_id ~ '^[A-Za-z0-9_-]{11}$');

alter table public.videos
  drop constraint if exists videos_title_length;
alter table public.videos
  add constraint videos_title_length
  check (char_length(btrim(title)) between 1 and 200);

alter table public.videos
  drop constraint if exists videos_description_length;
alter table public.videos
  add constraint videos_description_length
  check (description is null or char_length(description) <= 5000);

alter table public.videos
  drop constraint if exists videos_duration_sane;
alter table public.videos
  add constraint videos_duration_sane
  check (duration_s is null or duration_s between 0 and 86400);

/*
 * Section 9.5: the media release is attested before publishing. This is what
 * makes that more than a checkbox someone can skip by calling the API. A draft
 * may sit unattested; a published row may not exist without it.
 */
alter table public.videos
  drop constraint if exists videos_published_requires_release;
alter table public.videos
  add constraint videos_published_requires_release
  check (status <> 'published' or release_ok);

-- Published rows carry a publish time, so "newest first" is orderable without
-- falling back to created_at and quietly mixing drafts in.
alter table public.videos
  drop constraint if exists videos_published_has_timestamp;
alter table public.videos
  add constraint videos_published_has_timestamp
  check (status <> 'published' or published_at is not null);

alter table public.videos
  drop constraint if exists videos_delete_complete;
alter table public.videos
  add constraint videos_delete_complete
  check ((deleted_at is null) = (deleted_by is null));

-- ===========================================================================
-- Indexes
-- ===========================================================================
create index if not exists videos_search_idx on public.videos using gin (search_tsv);
create index if not exists videos_difficulty_idx on public.videos (difficulty);
create index if not exists videos_topic_idx on public.videos (topic);
create index if not exists videos_owner_idx on public.videos (owner_id);
create index if not exists videos_feed_idx on public.videos (status, published_at desc);

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.videos enable row level security;

-- Anyone, account or not. Viewing is public as of 20260903000000.
drop policy if exists "Published videos are readable by anyone" on public.videos;
create policy "Published videos are readable by anyone"
  on public.videos for select
  to anon, authenticated
  using (status = 'published' and deleted_at is null);

-- So an owner can still reach their own draft or hidden video, and a moderator
-- can reach anything including soft-deleted rows for the phase 4 admin panel.
drop policy if exists "Owners read their own videos" on public.videos;
create policy "Owners read their own videos"
  on public.videos for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Moderators read every video" on public.videos;
create policy "Moderators read every video"
  on public.videos for select
  to authenticated
  using (public.has_capability('moderate'));

/*
 * Insert requires the capability and an unsuspended account, checked here and
 * not only in the upload form. Section 6: hiding a button is not enforcement.
 * owner_id has to be the caller, so a contributor cannot publish under someone
 * else's byline.
 */
drop policy if exists "Contributors publish their own videos" on public.videos;
create policy "Contributors publish their own videos"
  on public.videos for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_id
    and public.has_capability('post')
    and not public.is_suspended()
  );

drop policy if exists "Owners and moderators update videos" on public.videos;
create policy "Owners and moderators update videos"
  on public.videos for update
  to authenticated
  using (
    (select auth.uid()) = owner_id or public.has_capability('moderate')
  )
  with check (
    (select auth.uid()) = owner_id or public.has_capability('moderate')
  );

/*
 * No DELETE policy, deliberately. Section 3: deletes are soft. Nothing should
 * ever issue DELETE FROM videos, so there is no policy permitting it, and the
 * soft-delete path arrives with the admin panel in phase 4.
 */

-- ===========================================================================
-- Grants
-- ===========================================================================
-- Column grants, not RLS, are what stop a client writing the columns it has no
-- business writing. view_count, deleted_at and deleted_by are absent from both
-- lists on purpose: a viewer must not be able to inflate a count, and a soft
-- delete has to go through the audited path phase 4 adds rather than a PATCH.
-- created_at and id are absent because defaults own them.

revoke all on public.videos from anon, authenticated;

grant select on public.videos to anon, authenticated;

grant insert (
  title, description, youtube_id, thumbnail_url, duration_s,
  difficulty, topic, owner_id, status, release_ok, published_at
) on public.videos to authenticated;

grant update (
  title, description, youtube_id, thumbnail_url, duration_s,
  difficulty, topic, status, release_ok, published_at
) on public.videos to authenticated;

-- ===========================================================================
-- public_videos
-- ===========================================================================
/*
 * What /library and /v/[id] read.
 *
 * It exists for one practical reason: a byline needs the owner's display name,
 * and the base profiles table is not readable by anon. PostgREST cannot embed
 * public_profiles either, because a view has no foreign key to follow. So the
 * join is done here, once, and the pages select from a flat surface.
 *
 * security_invoker = false, so this runs with its owner's rights and the
 * published-and-not-deleted filter below is the whole visibility rule for it.
 * That is the same arrangement as public_profiles, and it carries the same
 * warning: adding a column here makes it public, so never expose anything from
 * profiles beyond what public_profiles already does.
 *
 * A draft is therefore invisible through this view even to its owner. That is
 * fine while nothing renders drafts; the phase 4 dashboard reads the base
 * table, where the owner policy above lets it through.
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
    p.role         as owner_role
  from public.videos v
  join public.profiles p on p.id = v.owner_id
  where v.status = 'published'
    and v.deleted_at is null;

comment on view public.public_videos is
  'Published, non-deleted videos with their owner''s public fields. Read by '
  '/library and /v/[id]. Granted to anon as well as authenticated because '
  'viewing does not require an account. Never add a private profile column '
  'here: grade, city, school and birth_year are not public (section 9.1).';

grant select on public.public_videos to anon, authenticated;
