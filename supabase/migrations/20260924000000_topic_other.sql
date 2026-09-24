-- Add 'other' to the topic list.
--
-- Client request, 24 September. The eight topics were taxes, banking, credit,
-- investing, career, macro, micro and corporate, and a contributor whose video
-- fitted none of them had to file it under the nearest wrong one. A reader
-- filtering by "banking" and finding something that is not about banking is
-- worse served than one who sees an honest "Other".
--
-- BOTH constraints have to move, and this is the whole reason this is a
-- migration rather than a one-line edit to taxonomy.ts. `TOPICS` in
-- src/lib/taxonomy.ts is what the form offers; `videos_topic_valid` and
-- `articles_topic_valid` are what the database accepts. Widening only the
-- first would put a value in the select box that every insert then refuses
-- with 23514, and the refusal would arrive at the moment of publishing.
--
-- Section 3 lists the enum, so it moves in the same commit.

alter table public.videos
  drop constraint if exists videos_topic_valid;
alter table public.videos
  add constraint videos_topic_valid
  check (topic in ('taxes','banking','credit','investing','career','macro','micro','corporate','other'));

alter table public.articles
  drop constraint if exists articles_topic_valid;
alter table public.articles
  add constraint articles_topic_valid
  check (topic in ('taxes','banking','credit','investing','career','macro','micro','corporate','other'));

comment on constraint videos_topic_valid on public.videos is
  'Keep in step with TOPICS in src/lib/taxonomy.ts. The form offers what this '
  'accepts, and a value in one but not the other fails at publish time.';

comment on constraint articles_topic_valid on public.articles is
  'Keep in step with TOPICS in src/lib/taxonomy.ts and with videos_topic_valid.';
