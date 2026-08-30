-- Close a privilege escalation path in the profiles insert grant.
--
-- 20260829000000 restricted UPDATE to the columns a user owns, so nobody can
-- promote themselves by updating their own row. It granted INSERT without a
-- column list, which leaves the same door open in the other direction: an
-- authenticated user with no profile row can insert one, and the insert policy
-- only checks that the id is their own. Nothing stopped them setting
-- can_manage_users = true in that insert and becoming a sponsor.
--
-- Normally the signup trigger creates the row first, so an insert collides on
-- the primary key and the hole is invisible. It stops being invisible the
-- moment a row is missing, which is exactly what happens when rows are cleared
-- out by hand during testing.
--
-- Grant the same columns INSERT that UPDATE already allows. role and the three
-- capability flags keep their defaults (viewer, false, false, false) and can
-- still only be changed through set_user_permissions().

revoke insert on public.profiles from authenticated;

grant insert (
  id,
  username,
  display_name,
  avatar_url,
  bio,
  grade,
  city,
  school,
  onboarded
) on public.profiles to authenticated;
