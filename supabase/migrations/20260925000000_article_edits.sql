-- Let a writer edit their own article, and make `edited_at` honest.
--
-- Client request, 25 September: an Edit control beside Remove on the dashboard,
-- able to change anything about the piece.
--
-- The UPDATE policy from 20260923000000 already allows exactly this: the owner
-- with can_post and no suspension, or a moderator, and the wordlist over the
-- title, the summary and the body. So nothing about permissions changes here.
-- What changes is `edited_at`.
--
-- IT WAS IN THE UPDATE GRANT, WHICH MADE IT A CLAIM RATHER THAN A RECORD.
-- Any client could PATCH it to any value: rewrite the piece and leave the
-- column null so the page never says "edited", or set it to a date that
-- flatters the timeline. /a/[id] renders ", edited" from this column, so it is
-- the one thing on the page a reader uses to know the text has moved since it
-- was published.
--
-- 20260908000000 already settled this shape for comments, and its comment says
-- why in one line: "a trigger sets edited_at, so the window cannot be extended
-- by lying about when the edit happened". Same fix, same reasoning.
--
-- The trigger fires only when the text actually changes. Re-filing a piece
-- from `credit` to `other`, or moving it a level, is not an edit to the words
-- and should not mark the article as rewritten.

revoke update (edited_at) on public.articles from authenticated;

create or replace function public.articles_stamp_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.title       is distinct from old.title
     or new.description is distinct from old.description
     or new.body        is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists articles_stamp_edit on public.articles;
create trigger articles_stamp_edit
  before update on public.articles
  for each row
  execute function public.articles_stamp_edit();

comment on function public.articles_stamp_edit() is
  'Stamps edited_at when the title, summary or body changes. edited_at is not '
  'in the update grant, so this is the only writer and the timestamp cannot be '
  'forged or suppressed. Changing level or topic is not an edit to the words.';
