-- Articles: written explainers alongside the videos.
--
-- Client request, 23 September. FLARE was a video library and nothing else;
-- this adds a second kind of thing a contributor can publish.
--
-- The shape deliberately mirrors `videos` rather than inventing a parallel
-- world. Same difficulty ladder, same topic enum, same owner, same published /
-- draft / hidden states, same soft delete, same search column. That is not
-- laziness: difficulty and topic ARE the site's organising idea, and an article
-- that could not be filtered to "level 2, credit" would not be findable in the
-- one way this site expects everything to be findable.
--
-- THREE DECISIONS WORTH ARGUING WITH LATER.
--
-- 1. The body is PLAIN TEXT, not markdown and not HTML.
--    Section 7 already records that /privacy and /terms are written as markup
--    rather than pulled through a markdown dependency, so adding one here would
--    reverse a decision the project made deliberately. More importantly, this
--    is arbitrary text submitted by minors on a site with a moderation stack:
--    rendering user-supplied HTML is an XSS surface, and a hand-rolled markdown
--    parser that emits HTML is the same surface with extra steps. The page
--    renders it with whitespace-pre-line, exactly like a comment body. If rich
--    formatting is wanted later, the safe route is a sanitising renderer, and
--    that is a change worth making on purpose rather than by accident.
--
-- 2. Articles have no comments in this migration.
--    `comments.video_id` is `not null references videos`, so comments on
--    articles means making that column polymorphic, which touches the phase 5
--    insert policy, `public_comments`, `read_report_queue`, and the evidence
--    copy in `soft_delete_comment`. Section 9.6 makes that last one a retention
--    claim about a minor's words. Rushing it alongside a new content type is
--    how a moderation stack gets weakened, so it is left out and flagged.
--
-- 3. There is no media release checkbox, unlike videos.
--    Section 9.5 exists because a video contains people: faces and voices that
--    need a signed release. Prose does not. Asking for the attestation anyway
--    would train contributors to tick a release box that means nothing, which
--    makes the one on the upload form mean less.

-- ===========================================================================
-- Table
-- ===========================================================================
create table if not exists public.articles (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  -- The summary shown on a card, the same role description plays for a video.
  description   text,
  body          text not null,
  difficulty    smallint not null,
  topic         text not null,
  owner_id      uuid not null references public.profiles on delete cascade,
  status        text not null default 'published',
  view_count    integer not null default 0,
  created_at    timestamptz not null default now(),
  published_at  timestamptz,
  edited_at     timestamptz,
  deleted_at    timestamptz,
  deleted_by    uuid references public.profiles,
  search_tsv    tsvector generated always as (
                  to_tsvector(
                    'english',
                    coalesce(title, '') || ' ' ||
                    coalesce(description, '') || ' ' ||
                    coalesce(body, '')
                  )
                ) stored
);

comment on table public.articles is
  'Written explainers. Mirrors videos: same difficulty ladder, same topics, '
  'same soft delete. Body is plain text by design, see 20260923000000.';

-- ===========================================================================
-- Constraints, mirroring videos so the invariants hold whatever writes
-- ===========================================================================
alter table public.articles drop constraint if exists articles_difficulty_range;
alter table public.articles add constraint articles_difficulty_range
  check (difficulty between 1 and 5);

alter table public.articles drop constraint if exists articles_topic_valid;
alter table public.articles add constraint articles_topic_valid
  check (topic in ('taxes','banking','credit','investing','career','macro','micro','corporate'));

alter table public.articles drop constraint if exists articles_status_valid;
alter table public.articles add constraint articles_status_valid
  check (status in ('draft','published','hidden'));

alter table public.articles drop constraint if exists articles_title_length;
alter table public.articles add constraint articles_title_length
  check (char_length(btrim(title)) between 1 and 200);

alter table public.articles drop constraint if exists articles_description_length;
alter table public.articles add constraint articles_description_length
  check (description is null or char_length(description) <= 500);

-- 40000 is roughly a 6000 word piece. Long enough for anything a student will
-- write, short enough that a single row cannot be used as free storage.
alter table public.articles drop constraint if exists articles_body_length;
alter table public.articles add constraint articles_body_length
  check (char_length(btrim(body)) between 200 and 40000);

-- Same rule as videos_delete_complete: a soft delete is both columns or
-- neither, so there is no such thing as an article deleted by nobody.
alter table public.articles drop constraint if exists articles_delete_complete;
alter table public.articles add constraint articles_delete_complete
  check ((deleted_at is null) = (deleted_by is null));

create index if not exists articles_search_idx on public.articles using gin (search_tsv);
create index if not exists articles_difficulty_idx on public.articles (difficulty);
create index if not exists articles_topic_idx on public.articles (topic);
create index if not exists articles_owner_idx on public.articles (owner_id);
create index if not exists articles_published_idx on public.articles (status, published_at desc);

-- ===========================================================================
-- RLS
-- ===========================================================================
alter table public.articles enable row level security;

drop policy if exists "Published articles are readable by anyone" on public.articles;
create policy "Published articles are readable by anyone"
  on public.articles for select
  to anon, authenticated
  using (status = 'published' and deleted_at is null);

drop policy if exists "Owners read their own articles" on public.articles;
create policy "Owners read their own articles"
  on public.articles for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Moderators read every article" on public.articles;
create policy "Moderators read every article"
  on public.articles for select
  to authenticated
  using (public.has_capability('moderate'));

-- The insert policy carries everything the comments insert policy carries,
-- because an article is user-submitted text in exactly the same sense: the
-- capability, the suspension check, and the wordlist. The 16 September
-- hardening's lesson is that a rule the app enforces and the database does not
-- is not enforced, and this is a brand new write path.
drop policy if exists "Contributors publish their own articles" on public.articles;
create policy "Contributors publish their own articles"
  on public.articles for insert
  to authenticated
  with check (
    (select auth.uid()) = owner_id
    and public.has_capability('post')
    and not public.is_suspended()
    and public.comment_is_clean(title)
    and public.comment_is_clean(coalesce(description, ''))
    and public.comment_is_clean(body)
  );

-- Update mirrors the video UPDATE policy as it stands after 20260916010000:
-- the owner needs can_post and an unsuspended account, or a moderator. The
-- wordlist applies here too, because editing a clean article into a dirty one
-- is the same hole the comments update policy closed.
drop policy if exists "Owners and moderators update articles" on public.articles;
create policy "Owners and moderators update articles"
  on public.articles for update
  to authenticated
  using (
    (
      (select auth.uid()) = owner_id
      and public.has_capability('post')
      and not public.is_suspended()
    )
    or public.has_capability('moderate')
  )
  with check (
    (
      (
        (select auth.uid()) = owner_id
        and public.has_capability('post')
        and not public.is_suspended()
      )
      or public.has_capability('moderate')
    )
    and public.comment_is_clean(title)
    and public.comment_is_clean(coalesce(description, ''))
    and public.comment_is_clean(body)
  );

-- No DELETE policy, deliberately, exactly as for videos. Deletes are soft.

grant select on public.articles to anon, authenticated;

-- deleted_at, deleted_by and view_count are absent from both grants, so the
-- soft delete has to go through the audited function below.
grant insert (
  title, description, body, difficulty, topic, owner_id, status, published_at
) on public.articles to authenticated;

grant update (
  title, description, body, difficulty, topic, status, published_at, edited_at
) on public.articles to authenticated;

-- ===========================================================================
-- public_articles
-- ===========================================================================
-- Same arrangement and same warning as public_videos: security_invoker = false
-- so it bypasses RLS on the base table, which is what lets anon read a byline
-- out of a profiles table it cannot touch. A column added here is public.
--
-- body is included. An article's text IS the public content, the way a
-- youtube_id is for a video.
drop view if exists public.public_articles;
create view public.public_articles
with (security_invoker = false, security_barrier = true) as
  select
    a.id,
    a.title,
    a.description,
    a.body,
    a.difficulty,
    a.topic,
    a.view_count,
    a.created_at,
    a.published_at,
    a.edited_at,
    a.search_tsv,
    a.owner_id,
    p.username     as owner_username,
    p.display_name as owner_display_name,
    p.title        as owner_title,
    p.avatar_url   as owner_avatar_url,
    p.role         as owner_role
  from public.articles a
  join public.profiles p on p.id = a.owner_id
  where a.status = 'published'
    and a.deleted_at is null;

grant select on public.public_articles to anon, authenticated;

comment on view public.public_articles is
  'Public projection of articles with the owner byline. A column added here is '
  'public. Filtered to published and non-deleted.';

-- ===========================================================================
-- public_library
-- ===========================================================================
-- One surface /library reads, so a mixed list can be searched, filtered,
-- ordered and paginated in Postgres.
--
-- The alternative was two queries merged in the page, and that breaks the
-- moment there is more than one page of anything: "page 2 of the library" has
-- no meaning if each half is paginated separately, and merging full result
-- sets in JS to slice them is the thing section 7 forbids in the same breath
-- as client-side filtering. A union view keeps `range()` and `count` honest.
--
-- What it deliberately does NOT carry is the article body. Twelve rows of up
-- to 40000 characters each is a megabyte of payload to render twelve cards.
-- `preview` and `reading_minutes` are computed here instead, so the list page
-- ships what it draws and nothing else.
drop view if exists public.public_library;
create view public.public_library
with (security_invoker = false, security_barrier = true) as
  select
    'video'::text    as kind,
    v.id,
    v.title,
    v.description,
    v.difficulty,
    v.topic,
    v.published_at,
    v.search_tsv,
    v.owner_username,
    v.owner_display_name,
    v.owner_avatar_url,
    v.youtube_id,
    v.thumbnail_url,
    v.duration_s,
    v.collaborators,
    null::text       as preview,
    null::integer    as reading_minutes
  from public.public_videos v
  union all
  select
    'article'::text  as kind,
    a.id,
    a.title,
    a.description,
    a.difficulty,
    a.topic,
    a.published_at,
    a.search_tsv,
    a.owner_username,
    a.owner_display_name,
    a.owner_avatar_url,
    null::text       as youtube_id,
    null::text       as thumbnail_url,
    null::integer    as duration_s,
    '[]'::jsonb      as collaborators,
    -- The summary if there is one, otherwise the opening of the piece. 300
    -- characters is comfortably more than the card shows at three lines.
    left(coalesce(nullif(btrim(a.description), ''), btrim(a.body)), 300) as preview,
    -- Roughly 200 words a minute, floored at one. Counting words in SQL avoids
    -- shipping the body just to measure it.
    greatest(
      1,
      round(
        array_length(
          regexp_split_to_array(btrim(a.body), '\s+'), 1
        )::numeric / 200
      )::integer
    ) as reading_minutes
  from public.public_articles a;

grant select on public.public_library to anon, authenticated;

comment on view public.public_library is
  'Videos and articles as one list for /library. Carries a preview and a '
  'reading time rather than the article body, so a page of cards does not '
  'ship a megabyte of prose.';

-- ===========================================================================
-- soft_delete_article / restore_article
-- ===========================================================================
-- Copied in shape from soft_delete_video, including the asymmetry section 2
-- describes: an owner may remove their own, a moderator may remove anyone's
-- and has to give a reason for the log, and restore is moderator-only so a
-- piece cannot flicker in and out of the library unlogged.
create or replace function public.soft_delete_article(
  p_article uuid,
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
  v_owner_id uuid;
begin
  if v_actor is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  select a.title, p.username, a.owner_id into v_title, v_owner, v_owner_id
  from public.articles a
  join public.profiles p on p.id = a.owner_id
  where a.id = p_article and a.deleted_at is null;

  if v_title is null then
    raise exception 'No such article, or it is already deleted.'
      using errcode = 'no_data_found';
  end if;

  if not (v_owner_id = v_actor or public.has_capability('moderate')) then
    raise exception 'You cannot delete that article.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_owner_id = v_actor and public.is_suspended() then
    raise exception 'Your account is suspended.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.articles
  set deleted_at = now(), deleted_by = v_actor
  where id = p_article;

  insert into public.audit_log (actor_id, action, target, detail)
  values (
    v_actor, 'article.delete', p_article::text,
    jsonb_build_object(
      'title', v_title,
      'owner_username', v_owner,
      'reason', nullif(btrim(coalesce(p_reason, '')), ''),
      'by_owner', v_owner_id = v_actor
    )
  );
end;
$$;

revoke all on function public.soft_delete_article(uuid, text) from public;
grant execute on function public.soft_delete_article(uuid, text) to authenticated;

create or replace function public.restore_article(p_article uuid)
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
    raise exception 'You cannot restore an article.'
      using errcode = 'insufficient_privilege';
  end if;

  select title into v_title
  from public.articles
  where id = p_article and deleted_at is not null;

  if v_title is null then
    raise exception 'No such article, or it is not deleted.'
      using errcode = 'no_data_found';
  end if;

  update public.articles
  set deleted_at = null, deleted_by = null
  where id = p_article;

  insert into public.audit_log (actor_id, action, target, detail)
  values (v_actor, 'article.restore', p_article::text,
          jsonb_build_object('title', v_title));
end;
$$;

revoke all on function public.restore_article(uuid) from public;
grant execute on function public.restore_article(uuid) to authenticated;
