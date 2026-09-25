-- URGENT. Make the public_* views read-only.
--
-- Found by the 25 September audit, and it is live and exploitable right now by
-- anybody holding the anon key, which ships to every browser by design.
--
-- WHAT IS WRONG
--
-- `public_profiles` is a simple single-table view, which makes it AUTO-UPDATABLE
-- in Postgres: an UPDATE or INSERT through it rewrites `profiles` underneath.
-- It is also `security_invoker = false`, which §6 chose deliberately so that
-- anon can read a byline out of a table it cannot touch. Reads were the only
-- thing anyone considered. Writes run as the view's owner too, which means they
-- BYPASS RLS ON `profiles` COMPLETELY.
--
-- And the view was never revoked, so Supabase's default privileges left `anon`
-- and `authenticated` holding ALL on it.
--
-- Demonstrated against the live project, as an ANONYMOUS request:
--     PATCH /rest/v1/public_profiles?id=eq.<the sponsor>
--     {"display_name":"ANON-PWNED"}   -> 200, and the row really changed
-- Also `role` and `title`. The same call as a signed-in ordinary member works
-- equally well. Every profile on the site was rewritable by anyone: display
-- name, title, bio, avatar_url, and the public role tag.
--
-- Two things limited the damage and neither was by design:
--   - `username` is in the view, but `enforce_username_immutable` is a trigger
--     on the base table and still fires, so a rename of an onboarded account
--     was refused anyway.
--   - `avatar_url` is in the view, but `profiles_avatar_url_allowed` is a base
--     table constraint and still applies, so it could not be pointed offsite.
--   - DELETE returned 409 only because other rows reference the profile.
-- Nothing stopped display_name, title, bio or role.
--
-- WHY THE OTHER VIEWS WERE NOT AFFECTED, AND ARE STILL LOCKED HERE
--
-- public_videos, public_comments, public_articles and public_library all join
-- or union, which makes them non-auto-updatable: a write returns 55000 rather
-- than touching anything. That is Postgres declining, not this project having
-- decided. If any of them is ever simplified to a single-table projection it
-- would silently become writable, so they are revoked explicitly as well.
--
-- THE GENERAL RULE, WHICH IS NOW THE THIRD TIME THIS SHAPE HAS APPEARED
--
-- 20260925010000 said it for tables: revoke before you grant, because Supabase
-- grants ALL on new objects by default. A VIEW is a new object too. §6 has a
-- long note about `public_profiles` and its grant, and every word of it is
-- about SELECT, which is exactly how the write side stayed invisible for a
-- month: the documentation described the surface it was thinking about.

revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

revoke all on public.public_videos from anon, authenticated;
grant select on public.public_videos to anon, authenticated;

revoke all on public.public_comments from anon, authenticated;
grant select on public.public_comments to anon, authenticated;

-- Already done in 20260925010000; repeated so this file is the whole statement
-- of what the view privileges are, rather than half of it.
revoke all on public.public_articles from anon, authenticated;
grant select on public.public_articles to anon, authenticated;

revoke all on public.public_library from anon, authenticated;
grant select on public.public_library to anon, authenticated;

comment on view public.public_profiles is
  'Public projection of profiles, onboarded accounts only. Never add grade, '
  'city, or school. Section 9.1. SELECT ONLY: this view is auto-updatable and '
  'security_invoker = false, so any write privilege on it bypasses RLS on '
  'profiles entirely. See 20260925020000.';
