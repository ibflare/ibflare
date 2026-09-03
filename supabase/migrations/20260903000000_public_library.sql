-- Watching no longer requires an account.
--
-- The club's decision, which settles the open question in CLAUDE.md section
-- 9.4: the library, video pages and profiles are public, and an account is
-- needed only in order to contribute.
--
-- This is the database half. The routing half is REQUIRE_ACCOUNT_TO_VIEW in
-- src/proxy.ts, now false. The two have to move together, which is exactly why
-- 20260902000000 recorded the coupling in both directions.

-- ===========================================================================
-- public_profiles is readable by anon again
-- ===========================================================================
-- 20260902000000 revoked this, because at the time the proxy gated
-- /u/[username] and the grant left the underlying data readable by anyone
-- holding the anon key. That was a genuine hole *while the gate was on*: the
-- page was closed and the data was not.
--
-- With the gate off, the same grant is no longer a hole, it is the point. The
-- profile page is deliberately public, and without this a signed-out visitor
-- gets an empty page rather than a profile, because the server client falls
-- back to the anon role when there is no session.
--
-- What has NOT changed, and must not: the base table stays unreadable by anon,
-- and grade, city, school and birth_year are absent from this view by
-- construction. Asking for them through it still fails with 42703. Section 9.1
-- is unaffected by this migration. Public means the seven columns in the view,
-- and only those.

grant select on public.public_profiles to anon;

comment on view public.public_profiles is
  'Public projection of profiles. Never add grade, city, or school (section 9.1). '
  'Granted to anon as well as authenticated: viewing does not require an account. '
  'If REQUIRE_ACCOUNT_TO_VIEW in src/proxy.ts is ever set back to true, revoke '
  'the anon grant in the same commit.';
