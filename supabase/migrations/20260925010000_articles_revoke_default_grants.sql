-- Take back the privileges Supabase hands out by default on a new table.
--
-- MY BUG, IN 20260923000000. That migration wrote careful column grants:
--
--   grant insert (title, description, body, difficulty, topic, owner_id,
--                 status, published_at) on public.articles to authenticated;
--   grant update (title, description, body, difficulty, topic, status,
--                 published_at, edited_at) on public.articles to authenticated;
--
-- and its comment claimed that "deleted_at, deleted_by and view_count are
-- absent from both grants, so the soft delete has to go through the audited
-- function". That was not true, because the migration never revoked first.
--
-- Supabase grants ALL on new tables in the public schema to `anon` and
-- `authenticated` through default privileges. A table-level grant covers every
-- column, so adding column-level grants on top changed nothing at all: they
-- were a description of intent sitting next to a privilege that ignored them.
-- 20260904000000 opens with `revoke all on public.videos from anon,
-- authenticated;` and 20260829000000 does the same for profiles, which is
-- exactly why their column grants bite and these did not. I copied the grants
-- and missed the line above them.
--
-- Measured, not assumed. An ordinary contributor editing their own article
-- could PATCH:
--   view_count  -> accepted, set to 99999
--   edited_at   -> accepted, backdated to 2020, which is the one signal a
--                  reader has that a piece changed after publishing, and the
--                  whole point of the trigger added hours earlier
--   created_at  -> accepted
--   deleted_at  -> refused, but only by articles_delete_complete happening to
--                  reject a half-set pair. Sent with deleted_by it would have
--                  soft-deleted the row without the audit_log entry that
--                  soft_delete_article exists to guarantee.
-- The same PATCHes against `videos` are refused with 42501.
--
-- The lesson is the one section 6 keeps relearning in a new costume: a rule
-- written in a comment is not a rule. This one was written in a GRANT, which
-- looks even more like enforcement, and still was not.

revoke all on public.articles from anon, authenticated;

grant select on public.articles to anon, authenticated;

-- Unchanged from 20260923000000. They only start meaning something now.
-- id, created_at, view_count, edited_at, deleted_at and deleted_by are absent
-- on purpose: defaults own the first two, nobody may inflate a view count, the
-- edit stamp belongs to articles_stamp_edit, and a soft delete has to go
-- through soft_delete_article so it cannot happen without its audit row.
grant insert (
  title, description, body, difficulty, topic, owner_id, status, published_at
) on public.articles to authenticated;

grant update (
  title, description, body, difficulty, topic, status, published_at
) on public.articles to authenticated;

-- The two views are SELECT surfaces and nothing else. Neither is auto-updatable
-- in practice (one joins, the other unions), but saying so explicitly costs a
-- line and removes the question.
revoke all on public.public_articles from anon, authenticated;
grant select on public.public_articles to anon, authenticated;

revoke all on public.public_library from anon, authenticated;
grant select on public.public_library to anon, authenticated;

comment on table public.articles is
  'Written explainers. Mirrors videos: same difficulty ladder, same topics, '
  'same soft delete. Body is plain text by design, see 20260923000000. The '
  'column grants are only meaningful because 20260925010000 revokes the '
  'default ALL first: never grant columns on a new table without revoking.';
