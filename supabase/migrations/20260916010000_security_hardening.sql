-- Eight hardening fixes from the 14 September audit. All client-approved.
--
-- The theme running through most of them is the one section 6 already states
-- and the audit kept finding exceptions to: a rule the application enforces
-- and the database does not is not enforced. Each item below moves one such
-- rule down into Postgres, where a direct PostgREST call meets it too.

-- ===========================================================================
-- 1. thumbnail_url may only point at YouTube
-- ===========================================================================
-- The column is written by createVideo from the resolver's answer, but it is
-- an ordinary column in the insert grant, so a contributor can PATCH it to any
-- string: a tracking pixel that fires on every library page, or an image
-- hotlinked from somewhere that will later serve something else. Exactly the
-- hole profiles_avatar_url_allowed closed for avatars, left open here.
--
-- Two hosts, because YouTube serves thumbnails from both and which one you get
-- depends on the endpoint. The eleven-character id is the same shape
-- videos_youtube_id_format already enforces on the id column.
alter table public.videos
  drop constraint if exists videos_thumbnail_url_allowed;
alter table public.videos
  add constraint videos_thumbnail_url_allowed
  check (
    thumbnail_url is null
    or thumbnail_url ~ '^https://i\.ytimg\.com/vi/[A-Za-z0-9_-]{11}/'
    or thumbnail_url ~ '^https://img\.youtube\.com/vi/[A-Za-z0-9_-]{11}/'
  );

comment on constraint videos_thumbnail_url_allowed on public.videos is
  'Thumbnails come from YouTube or nowhere. Without this the column accepts '
  'any URL and renders it on every library card.';

-- ===========================================================================
-- 2. The video UPDATE policy gains the checks the INSERT policy always had
-- ===========================================================================
-- Insert required can_post and an unsuspended account. Update required only
-- ownership, so a suspended contributor, or one whose can_post was revoked at
-- the end of term, could still rewrite the title, description, difficulty and
-- thumbnail of everything they had already published. Section 2 says a
-- suspended user cannot post; editing what is already up is posting.
--
-- The moderator branch deliberately keeps no suspension check, matching the
-- avatar delete policy and for the same reason recorded there: suspension
-- stops somebody contributing, and taking bad content down is not a
-- contribution.
drop policy if exists "Owners and moderators update videos" on public.videos;
create policy "Owners and moderators update videos"
  on public.videos for update
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
      (select auth.uid()) = owner_id
      and public.has_capability('post')
      and not public.is_suspended()
    )
    or public.has_capability('moderate')
  );

-- ===========================================================================
-- 3. The comment word filter moves into the database
-- ===========================================================================
-- It lived only in the server action, which means it applied to the form and
-- to nothing else. An onboarded account posting straight to PostgREST walked
-- past it entirely, and the insert policy had no opinion about the body.
--
-- The list lives in a table so section 4's "editable without touching logic"
-- still holds, and the table has NO grants to any client role: only the
-- definer function below reads it. Section 4 is explicit that the list is not
-- worth publishing, and a readable table is a published list.

create table if not exists public.moderation_terms (
  term text primary key,
  tier text not null check (tier in ('profanity', 'slur'))
);

alter table public.moderation_terms enable row level security;
revoke all on table public.moderation_terms from anon, authenticated;

comment on table public.moderation_terms is
  'The two-tier wordlist, mirrored from src/lib/moderation/wordlist.ts. No '
  'grants to any client role: comment_is_clean() is the only reader. Matching '
  'is whole-token, so entries are base words.';

delete from public.moderation_terms;
insert into public.moderation_terms (term, tier) values
  ('arse', 'profanity'),
  ('arsehole', 'profanity'),
  ('ass', 'profanity'),
  ('asses', 'profanity'),
  ('asshat', 'profanity'),
  ('asshole', 'profanity'),
  ('assholes', 'profanity'),
  ('bastard', 'profanity'),
  ('bastards', 'profanity'),
  ('bitch', 'profanity'),
  ('bitches', 'profanity'),
  ('bitching', 'profanity'),
  ('bollocks', 'profanity'),
  ('bullshit', 'profanity'),
  ('cock', 'profanity'),
  ('crap', 'profanity'),
  ('cunt', 'profanity'),
  ('cunts', 'profanity'),
  ('dick', 'profanity'),
  ('dickhead', 'profanity'),
  ('dildo', 'profanity'),
  ('douche', 'profanity'),
  ('douchebag', 'profanity'),
  ('dumbass', 'profanity'),
  ('fuck', 'profanity'),
  ('fucked', 'profanity'),
  ('fucker', 'profanity'),
  ('fuckers', 'profanity'),
  ('fucking', 'profanity'),
  ('fucks', 'profanity'),
  ('goddamn', 'profanity'),
  ('handjob', 'profanity'),
  ('horseshit', 'profanity'),
  ('jackass', 'profanity'),
  ('jerkoff', 'profanity'),
  ('motherfucker', 'profanity'),
  ('motherfucking', 'profanity'),
  ('nutsack', 'profanity'),
  ('piss', 'profanity'),
  ('pissed', 'profanity'),
  ('prick', 'profanity'),
  ('pussy', 'profanity'),
  ('shit', 'profanity'),
  ('shite', 'profanity'),
  ('shithead', 'profanity'),
  ('shitty', 'profanity'),
  ('slut', 'profanity'),
  ('sluts', 'profanity'),
  ('twat', 'profanity'),
  ('wank', 'profanity'),
  ('wanker', 'profanity'),
  ('whore', 'profanity'),
  ('whores', 'profanity'),
  ('chink', 'slur'),
  ('chinks', 'slur'),
  ('coon', 'slur'),
  ('coons', 'slur'),
  ('dyke', 'slur'),
  ('dykes', 'slur'),
  ('fag', 'slur'),
  ('faggot', 'slur'),
  ('faggots', 'slur'),
  ('fags', 'slur'),
  ('gook', 'slur'),
  ('gooks', 'slur'),
  ('kike', 'slur'),
  ('kikes', 'slur'),
  ('nigga', 'slur'),
  ('niggas', 'slur'),
  ('nigger', 'slur'),
  ('niggers', 'slur'),
  ('paki', 'slur'),
  ('pakis', 'slur'),
  ('raghead', 'slur'),
  ('retard', 'slur'),
  ('retarded', 'slur'),
  ('retards', 'slur'),
  ('spic', 'slur'),
  ('spics', 'slur'),
  ('tranny', 'slur'),
  ('trannies', 'slur'),
  ('wetback', 'slur'),
  ('wetbacks', 'slur')
on conflict (term) do nothing;

-- ---------------------------------------------------------------------------
-- normalize_for_moderation
-- ---------------------------------------------------------------------------
-- The SQL half of normalize() in src/lib/moderation/index.ts, and it has to
-- stay in step with it. Same four steps in the same order: lowercase, strip
-- the invisibles, map the substitutions, split on anything that is not a
-- letter or a digit.
--
-- One translate() does both the substitutions and the invisible-stripping,
-- which is why the `from` string is longer than the `to` string: translate
-- maps the first ten characters positionally and DELETES every later one that
-- has no partner. So the substitutions are
--   @ 4 -> a a      1 ! | -> i i i      0 -> o      $ 5 -> s s      3 -> e      7 -> t
-- and everything after them in `from` is simply removed.
--
-- The invisibles are written as a U& literal rather than as \u escapes inside
-- a regex bracket. Both are legal, but the regex spelling depends on how the
-- string literal and the regex engine each treat a backslash, and a mistake
-- there fails open: the pattern silently matches nothing and the stripping
-- quietly stops happening. A U& literal is resolved by the parser, so it is
-- either a valid escape or a syntax error at creation time. Given this
-- function's whole job is stripping characters nobody can see, a failure mode
-- nobody can see is the wrong one to accept.
--
-- Soft hyphen, Mongolian vowel separator, the zero-width and directional
-- marks, the bidi overrides, the word joiner and invisible operators, and the
-- byte order mark. Same set as INVISIBLE in src/lib/moderation/index.ts.
create or replace function public.normalize_for_moderation(p_body text)
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select array_remove(
    regexp_split_to_array(
      translate(
        lower(coalesce(p_body, '')),
        '@41!|0$537'
          || U&'\00AD\180E\200B\200C\200D\200E\200F'
          || U&'\202A\202B\202C\202D\202E'
          || U&'\2060\2061\2062\2063\2064\FEFF',
        'aaiiiosset'
      ),
      '[^a-z0-9]+'
    ),
    ''
  );
$$;

comment on function public.normalize_for_moderation(text) is
  'Mirror of normalize() in src/lib/moderation/index.ts. Keep the two in step: '
  'the app produces the readable refusal, this one enforces it.';

-- ---------------------------------------------------------------------------
-- comment_is_clean
-- ---------------------------------------------------------------------------
-- True when no token matches the list. Each token is tested as written and
-- again with runs of three or more collapsed, which is what catches "fuuuck"
-- without turning "book" into "bok". Tokens under three characters are skipped
-- for the same reason the app skips them: two characters cannot be a listed
-- word and can easily be a false positive.
--
-- SECURITY DEFINER so the policy can call it without granting anybody read on
-- the wordlist.
create or replace function public.comment_is_clean(p_body text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from unnest(public.normalize_for_moderation(p_body)) as t(token)
    join public.moderation_terms m
      on m.term = t.token
      or m.term = regexp_replace(t.token, '(.)\1{2,}', '\1', 'g')
    where char_length(t.token) >= 3
  );
$$;

revoke all on function public.comment_is_clean(text) from public;
grant execute on function public.comment_is_clean(text) to authenticated;

comment on function public.comment_is_clean(text) is
  'Whole-token wordlist check, the database half of section 4. The app checks '
  'first so a person gets a sentence rather than an RLS error; this is what '
  'makes the rule true of a direct API write as well.';

-- The insert policy gains the body check. Everything else about it is
-- unchanged from 20260908000000.
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
    and public.comment_is_clean(body)
  );

-- And the edit window, for the same reason: editing a clean comment into a
-- dirty one is the obvious way around a check that only runs on insert.
--
-- THE NAME HAS TO MATCH THE EXISTING POLICY EXACTLY. Permissive policies are
-- OR'd together, so recreating this under a new name would leave the original
-- in place beside it and the looser of the two would keep winning: the body
-- check would be added and change nothing. Everything here except the
-- comment_is_clean line is copied unchanged from 20260908000000.
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
    and public.comment_is_clean(body)
  );

-- ===========================================================================
-- 4. public_profiles shows onboarded accounts only
-- ===========================================================================
-- The signup trigger creates a profile row the moment an auth user exists, so
-- every abandoned half-signup was publicly listed: a derived username and a
-- display name guessed from an email local-part, readable by anyone with the
-- anon key, for somebody who never finished creating an account and never
-- agreed to anything.
--
-- public_videos and public_comments join public.profiles directly rather than
-- this view, so bylines are unaffected. Only accounts that completed
-- onboarding can own a video or a comment anyway.
create or replace view public.public_profiles
with (security_invoker = false, security_barrier = true) as
  select id, username, display_name, title, avatar_url, bio, role
  from public.profiles
  where onboarded;

grant select on public.public_profiles to anon, authenticated;

comment on view public.public_profiles is
  'Public projection of profiles, onboarded accounts only. Never add grade, '
  'city, or school. Section 9.1.';

-- ===========================================================================
-- 5. Avatar uploads are one fixed object per account
-- ===========================================================================
-- The folder check stopped one person writing into another person's folder,
-- but inside your own folder any name and any number of objects were allowed.
-- Section 6 says one object per user at a fixed name, so that a replacement
-- overwrites rather than accumulating and there is nothing to garbage collect.
-- That was true of what the app uploads and not of what the bucket accepted:
-- a signed-in member could fill their folder with arbitrary files.
--
-- The whole object path is now pinned, so the only writable name is
-- '<uid>/avatar.webp'. The bucket already restricts the mime type to webp.
drop policy if exists "Members upload their own avatar" on storage.objects;
create policy "Members upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and name = (select auth.uid())::text || '/avatar.webp'
    and public.is_onboarded()
    and not public.is_suspended()
  );

drop policy if exists "Members replace their own avatar" on storage.objects;
create policy "Members replace their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and name = (select auth.uid())::text || '/avatar.webp'
    and public.is_onboarded()
    and not public.is_suspended()
  )
  with check (
    bucket_id = 'avatars'
    and name = (select auth.uid())::text || '/avatar.webp'
    and public.is_onboarded()
    and not public.is_suspended()
  );

-- Delete keeps the folder form rather than the fixed name on the moderator
-- branch, so an object left behind by the looser policy can still be removed.
drop policy if exists "Members and moderators delete an avatar" on storage.objects;
create policy "Members and moderators delete an avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (
        (storage.foldername(name))[1] = (select auth.uid())::text
        and public.is_onboarded()
        and not public.is_suspended()
      )
      or public.has_capability('moderate')
    )
  );

-- The URL constraint narrows from "any Supabase project" to this one. The old
-- pattern accepted storage on somebody else's project, which is an offsite URL
-- wearing a familiar hostname.
--
-- THIS HARDCODES THE PROJECT REF. If the project is ever moved or restored
-- under a new ref, this constraint is the thing that will reject every avatar
-- until it is updated.
alter table public.profiles
  drop constraint if exists profiles_avatar_url_allowed;
alter table public.profiles
  add constraint profiles_avatar_url_allowed
  check (
    avatar_url is null
    or avatar_url ~ '^https://[a-z0-9-]+\.googleusercontent\.com/'
    or avatar_url ~ '^https://ijqgffyfhdlovnqmiwnp\.supabase\.co/storage/v1/object/public/avatars/'
  );

-- ===========================================================================
-- 6. onboarded leaves the grants, so the username lock actually holds
-- ===========================================================================
-- enforce_username_immutable() refuses a username change when old.onboarded is
-- true. onboarded was itself in the update grant, so the lock was opt-out:
-- PATCH onboarded=false, PATCH username='somethingelse', PATCH onboarded=true.
-- Three ordinary requests and the immutable key behind every /u/<username>
-- link has moved.
--
-- complete_onboarding() replaces the client's final write. It refuses unless
-- the profile is actually complete, so the flag cannot be set on a half-filled
-- row, and it is the only writer of the column now.
revoke update (onboarded) on public.profiles from authenticated;
revoke insert (onboarded) on public.profiles from authenticated;

create or replace function public.complete_onboarding()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  select * into v_row from public.profiles where id = v_uid;

  if v_row.id is null then
    raise exception 'No profile to finish.' using errcode = 'no_data_found';
  end if;

  if coalesce(btrim(v_row.grade), '') = '' then
    raise exception 'Choose a grade first.' using errcode = 'check_violation';
  end if;

  if v_row.terms_accepted_at is null then
    raise exception 'Accept the terms first.' using errcode = 'check_violation';
  end if;

  update public.profiles set onboarded = true where id = v_uid;
end;
$$;

revoke all on function public.complete_onboarding() from public;
grant execute on function public.complete_onboarding() to authenticated;

comment on function public.complete_onboarding() is
  'The only writer of profiles.onboarded. The column left the client grants so '
  'that enforce_username_immutable() cannot be stepped around by unsetting it.';

-- ===========================================================================
-- 7. flag_blocked_comment is rate limited
-- ===========================================================================
-- 20260914000000 stopped it being an open write into audit_log by requiring an
-- onboarded, unsuspended caller and a real public video. What it still allowed
-- was volume: a legitimate member could call it in a loop and bury the
-- "Blocked before posting" panel, which is the panel an officer reads to tell
-- a first offence from a pattern.
--
-- Five a minute, the same number section 4 gives for comments, and for the
-- same reason: the honest path through this function is one call per refused
-- comment, so anybody hitting the limit is not typing.
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
  v_actor  uuid := (select auth.uid());
  v_recent integer;
begin
  if v_actor is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

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
    return;
  end if;

  select count(*) into v_recent
  from public.audit_log
  where actor_id = v_actor
    and action = 'comment.blocked'
    and created_at > now() - interval '1 minute';

  if v_recent >= 5 then
    -- Silent rather than an exception. The app calls this without checking the
    -- result, and the refusal the person sees is the filter's, not this one's.
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

comment on function public.flag_blocked_comment(uuid, text, text) is
  'Records a tier-two filter refusal. Requires onboarded, not suspended, a '
  'real public video, and at most five a minute.';
