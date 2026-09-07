-- The audit log keeps the actor's name as plain text.
--
-- Two changes, and the first is only safe because of the second.
--
--   1. site_settings.updated_by becomes ON DELETE SET NULL, so the last person
--      to flip a kill switch no longer pins their own account in place.
--   2. audit_log stores the actor's username and display name as text at write
--      time, so "Aryan N. turned comments off" reads that way forever.
--
-- CLAUDE.md sections 2 and 3.

-- ===========================================================================
-- 1. site_settings.updated_by no longer pins an account
-- ===========================================================================
/*
 * Found by trying to delete a throwaway sponsor after a verification run: the
 * delete failed with 23503 because site_settings.updated_by referenced it.
 *
 * That is the fourth column with this shape, and the only one where it is
 * wrong. Section 2 keeps audit_log.actor_id, profiles.suspended_by and
 * videos.deleted_by pinned deliberately, because each of those *is* the
 * record: a moderation trail that has lost its actor is most of the way to no
 * trail at all.
 *
 * updated_by is not that. It is a convenience column saying who touched the
 * settings row most recently, and the accountable version of the same fact is
 * already an audit_log row with the actor's name in it. Keeping a whole
 * account undeletable to preserve a duplicate pointer is the tail wagging the
 * dog, so this one lets go.
 *
 * What is lost when it nulls: nothing that is not in the log. What is kept:
 * the log entry, in full, with the name spelled out. That is the trade, and it
 * only holds because of part 2 below.
 */
alter table public.site_settings
  drop constraint if exists site_settings_updated_by_fkey;
alter table public.site_settings
  add constraint site_settings_updated_by_fkey
  foreign key (updated_by) references public.profiles(id) on delete set null;

comment on column public.site_settings.updated_by is
  'Who last changed a switch. ON DELETE SET NULL: this is a convenience '
  'pointer, and audit_log holds the accountable record with the actor''s name '
  'as text. Unlike audit_log.actor_id, this one does not pin the account.';

-- ===========================================================================
-- 2. The actor's name, frozen at write time
-- ===========================================================================
/*
 * The requirement: an audit_log entry has to keep showing who did the thing,
 * as text, whether or not that account still exists.
 *
 * It did not behave that way. read_audit_log resolved the name by joining
 * profiles on actor_id, so the log was reading a live account every time.
 * Three ways that goes wrong:
 *
 *   - A display name is editable. Someone who acts as "Aryan N." and later
 *     renames themselves rewrites the whole history of what they did, because
 *     a live join shows the current name, not the name they acted under.
 *   - A null actor_id, from any future path that allows one, means the entry
 *     loses its actor entirely rather than degrading to a name.
 *   - It makes the log's correctness depend on a foreign key that section 2
 *     keeps for a different reason. Two unrelated requirements resting on one
 *     constraint is how one of them quietly breaks.
 *
 * So the name is denormalised into the row, which is the same thing section 4
 * already specifies for a deleted comment's body and author, and for the same
 * reason: the copy that survives is the one that was written down.
 */
alter table public.audit_log
  add column if not exists actor_username text,
  add column if not exists actor_display_name text;

comment on column public.audit_log.actor_username is
  'The actor''s username as it was when they acted. Written by trigger, never '
  'resolved from profiles at read time: a display name is editable and an '
  'account may eventually be deletable, and neither should rewrite history.';

/*
 * A trigger rather than seven edited functions.
 *
 * There are seven audit_log inserts across three migrations
 * (set_user_permissions, clear_avatar, suspend_user, unsuspend_user,
 * soft_delete_video, restore_video, set_site_settings), and phase 5 adds at
 * least one more for comment.delete. Editing each one means seven chances to
 * forget, and the eighth writer would arrive without it.
 *
 * Stamping at the table means every writer is covered, including the ones that
 * do not exist yet, and the fill is skipped if a caller has already supplied
 * the values.
 */
create or replace function public.audit_log_stamp_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.actor_username is null or new.actor_display_name is null then
    select p.username, p.display_name
      into new.actor_username, new.actor_display_name
    from public.profiles p
    where p.id = new.actor_id;
  end if;

  return new;
end;
$$;

drop trigger if exists audit_log_stamp_actor on public.audit_log;
create trigger audit_log_stamp_actor
  before insert on public.audit_log
  for each row execute function public.audit_log_stamp_actor();

-- Backfill, for completeness. The table is empty at the time of writing, so
-- this is a no-op today and correct if it is ever run against rows.
update public.audit_log l
set actor_username = p.username,
    actor_display_name = p.display_name
from public.profiles p
where p.id = l.actor_id
  and (l.actor_username is null or l.actor_display_name is null);

-- ===========================================================================
-- read_audit_log, with no join
-- ===========================================================================
/*
 * Recreated to read the stored text and nothing else. The join to profiles is
 * gone entirely rather than kept as a fallback, which is the point: a fallback
 * would mean the log still resolves a live account under some conditions, and
 * "under some conditions" is not a property anybody can reason about later.
 *
 * Rows written before the trigger existed would show a null name. There are
 * none: audit_log was empty when this migration was written, and the backfill
 * above covers the case where it was not.
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
           l.actor_username, l.actor_display_name
    from public.audit_log l
    order by l.created_at desc, l.id desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500);
end;
$$;

revoke all on function public.read_audit_log(integer) from public;
grant execute on function public.read_audit_log(integer) to authenticated;
