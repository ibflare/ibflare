-- Custom profile pictures for contributors.
--
-- Default stays the Google avatar the signup trigger stores. A user with
-- can_post may replace it with an upload, or remove it and fall back to
-- initials. Users without can_post keep their Google picture and get no
-- control, because a user-supplied image is a moderation surface and
-- contributors are a known group. See CLAUDE.md sections 2 and 9.
--
-- Three things are set up here: the bucket, RLS on the objects in it, and a
-- constraint on where profiles.avatar_url is allowed to point.

-- ===========================================================================
-- The bucket
-- ===========================================================================
-- public = true, so reads go through /storage/v1/object/public/avatars/... and
-- need no token. Profiles are public, so their pictures are too.
--
-- file_size_limit and allowed_mime_types are a backstop, not the primary
-- check: the server action validates the bytes before anything reaches storage.
-- They exist because the storage API is reachable directly with the anon key,
-- so the limits have to hold there as well.
--
-- image/webp only, deliberately. The action accepts jpg, png and webp as
-- *input* and re-encodes every one of them to webp, so webp is the only thing
-- that ever legitimately arrives. Listing the input types here would permit
-- uploads that never come from this app.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp'])
on conflict (id) do update
  set public             = true,
      file_size_limit    = 2097152,
      allowed_mime_types = array['image/webp'];

-- ===========================================================================
-- Who may write into it
-- ===========================================================================
-- One folder per user, named with their uid, holding exactly one file. The
-- folder check is what stops one person overwriting another's picture:
-- storage.foldername(name) splits the object path, and [1] is the first
-- segment, so 'avatars/<uid>/avatar.webp' has to open with the caller's own id.
--
-- The capability and suspension checks are here rather than only in the UI.
-- Section 6: hiding a button is not enforcement. This also gives is_suspended()
-- its first caller.

drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "Contributors upload their own avatar" on storage.objects;
create policy "Contributors upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_capability('post')
    and not public.is_suspended()
  );

-- Needed as well as insert: the action uploads with upsert, so replacing an
-- existing picture is an update rather than an insert.
drop policy if exists "Contributors replace their own avatar" on storage.objects;
create policy "Contributors replace their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_capability('post')
    and not public.is_suspended()
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_capability('post')
    and not public.is_suspended()
  );

drop policy if exists "Contributors delete their own avatar" on storage.objects;
create policy "Contributors delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_capability('post')
    and not public.is_suspended()
  );

-- ===========================================================================
-- Where avatar_url may point
-- ===========================================================================
-- Without this the rest is decorative. avatar_url is in the UPDATE grant for
-- authenticated, so any signed-in user can PATCH it to an arbitrary string
-- through PostgREST: an offsite tracking pixel, a hotlinked image, anything.
-- Restricting the folder someone may upload into means nothing while the
-- column itself accepts any URL.
--
-- Two shapes are allowed, and they are exactly the two the app produces:
-- a Google avatar from the signup trigger, or an object in this bucket.
-- NULL is allowed and means "render initials", which is what remove leaves
-- behind. Note that removal is not a revert: it does not restore the Google
-- URL, by design.
--
-- Every existing row was checked before this was written; both hold
-- lh3.googleusercontent.com URLs and satisfy it.
--
-- If a future avatar source is added, widen this in the same commit as the
-- code that writes it, or the write fails with a check violation.

alter table public.profiles
  drop constraint if exists profiles_avatar_url_allowed;
alter table public.profiles
  add constraint profiles_avatar_url_allowed
  check (
    avatar_url is null
    or avatar_url ~ '^https://[a-z0-9-]+\.googleusercontent\.com/'
    or avatar_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/'
  );

comment on column public.profiles.avatar_url is
  'Google avatar from signup, or an uploaded object in the avatars bucket, or '
  'NULL meaning render initials. Constrained to those hosts by '
  'profiles_avatar_url_allowed. Google URLs expire when someone changes their '
  'Google photo, so every render site needs an onError fallback.';
