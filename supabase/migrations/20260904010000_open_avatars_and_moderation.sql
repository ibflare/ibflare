-- Profile pictures for everyone, and a way to take a bad one down.
--
-- Two changes that belong together.
--
-- 1. Uploading no longer requires can_post. Any onboarded, unsuspended account
--    may set its own picture. That widens the moderation surface deliberately,
--    which is why (2) exists in the same migration.
--
-- 2. A can_moderate holder can clear anyone's picture, audited. Until now the
--    only person who could remove an image was the person who uploaded it, so
--    a bad picture had no path down short of the SQL editor.
--
-- See CLAUDE.md sections 2 and 9.

-- ===========================================================================
-- is_onboarded
-- ===========================================================================
-- The companion to is_suspended, and needed for the same reason: a storage
-- policy has to ask about the caller's profile without tripping over RLS on
-- profiles or recursing. SECURITY DEFINER with an empty search_path, exactly
-- like the other two.
--
-- Onboarded rather than merely signed in: a half-created account, one that has
-- an auth row but has not been through the age screen and the terms, has no
-- business uploading an image.

create or replace function public.is_onboarded()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.onboarded
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$$;

comment on function public.is_onboarded() is
  'Whether the caller has a completed profile. Used by the avatars storage '
  'policies. Companion to is_suspended().';

-- ===========================================================================
-- Storage policies: drop the capability check, keep the rest
-- ===========================================================================
-- The folder check is unchanged and is still what stops one person overwriting
-- another's picture. The suspension check is unchanged. Only
-- has_capability('post') goes, replaced by is_onboarded().

drop policy if exists "Contributors upload their own avatar" on storage.objects;
drop policy if exists "Contributors replace their own avatar" on storage.objects;
drop policy if exists "Contributors delete their own avatar" on storage.objects;

create policy "Members upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_onboarded()
    and not public.is_suspended()
  );

-- Separate from insert because the upload uses upsert, so replacing a picture
-- that already exists is an update.
create policy "Members replace their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_onboarded()
    and not public.is_suspended()
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_onboarded()
    and not public.is_suspended()
  );

/*
 * Delete is the one that is not symmetric. Your own folder, or any folder if
 * you hold can_moderate, because taking a bad picture down is the whole point
 * of the moderator path below and the object has to go with the column.
 *
 * A suspended moderator is deliberately still allowed here: suspension stops
 * someone contributing, and removing a bad image is not a contribution. A
 * suspended member cannot delete their own, though, which matches every other
 * insert policy in the schema.
 */
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

-- ===========================================================================
-- clear_avatar
-- ===========================================================================
/*
 * A moderator clearing someone else's picture, with an audit_log row.
 *
 * SECURITY DEFINER because avatar_url on another person's row is not writable
 * by anyone: the update policy on profiles is owner-only, so without this
 * there is no path at all. That makes this function the only way one account
 * can change another's picture, and it checks the capability itself.
 *
 * It nulls the column and writes the log. It cannot delete the storage object,
 * because SQL has no reach into the storage API, so the caller does that
 * straight afterwards; the delete policy above is what permits it. If that
 * second step fails the object is orphaned but unreferenced, which is
 * harmless: nothing renders it and the owner's next upload overwrites it.
 *
 * Deliberately not a general "set anyone's avatar". A moderator can remove,
 * never replace.
 */
create or replace function public.clear_avatar(
  p_target uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor  uuid := (select auth.uid());
  v_before text;
  v_target_username text;
begin
  if v_actor is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  if not public.has_capability('moderate') then
    raise exception 'Removing another person''s picture requires moderator permission.'
      using errcode = 'insufficient_privilege';
  end if;

  select p.avatar_url, p.username
    into v_before, v_target_username
  from public.profiles p
  where p.id = p_target;

  if v_target_username is null then
    raise exception 'No such account.' using errcode = 'no_data_found';
  end if;

  update public.profiles
  set avatar_url = null
  where id = p_target;

  insert into public.audit_log (actor_id, action, target, detail)
  values (
    v_actor,
    'profile.avatar_clear',
    v_target_username,
    jsonb_build_object(
      'before', v_before,
      'after', null,
      'reason', nullif(btrim(coalesce(p_reason, '')), '')
    )
  );
end;
$$;

revoke all on function public.clear_avatar(uuid, text) from public;
grant execute on function public.clear_avatar(uuid, text) to authenticated;
