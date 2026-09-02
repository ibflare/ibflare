-- Closes three findings from the phase 2 audit. All three are on profiles, and
-- all three are cases where a rule existed in the application but not in the
-- database.
--
--   01  public_profiles was granted to anon, so gating /u/[username] in the
--       proxy protected the page and not the data. The anon key ships to every
--       browser by design, so every username, display name, title, bio and
--       avatar URL was readable without signing in.
--   02  the reserved username list lived only in the server action, and a test
--       account was successfully renamed to "flare" through the API.
--   03  onboarded implied the two consent stamps and nothing else, so an
--       account could be marked onboarded with no grade, city or school.
--
-- See CLAUDE.md sections 6, 7 and 9.

-- ===========================================================================
-- 01. public_profiles is no longer readable by anon
-- ===========================================================================
-- The view is declared security_invoker = false, so it runs with its owner's
-- rights and bypasses RLS on the base table. That means this grant is the only
-- thing standing between anon and the data, and it is why revoking it is the
-- whole fix: there is no policy to also adjust.
--
-- COUPLED TO THE PROXY. REQUIRE_ACCOUNT_TO_VIEW in src/proxy.ts and this grant
-- now have to move together. While the gate is on, this revoke is what makes
-- it real. If the gate is ever turned off, /u/[username] and any future
-- anon-readable page reading this view will return nothing until the grant is
-- restored, because the server client falls back to the anon role when there
-- is no session. Restore it with:
--
--     grant select on public.public_profiles to anon;
--
-- authenticated keeps the grant, so both consumers (SiteHeader and the profile
-- page) are unaffected: neither queries this view without a session.

revoke select on public.public_profiles from anon;

comment on view public.public_profiles is
  'Public projection of profiles. Never add grade, city, or school (section 9.1). '
  'Granted to authenticated only: anon lost SELECT in 20260902000000 so that the '
  'viewing gate in src/proxy.ts covers the data and not just the page.';

-- ===========================================================================
-- 02. Reserved usernames
-- ===========================================================================
-- The list is a database function rather than a literal inside the constraint
-- so that the signup trigger can consult the same list. Without that, an
-- account created from admin@example.org would derive the username "admin",
-- fail the constraint, and take the whole signup down with it.
--
-- Exact matches only, deliberately. Substring matching would reject the club's
-- own ibflare account and every legitimate name that happens to contain a
-- reserved word, which is the same trade section 4 makes for the comment
-- filter: the false positives cost more than the misses.
--
-- Entries shorter than three characters cannot satisfy profiles_username_format
-- as it stands today. They are listed anyway so the list stays correct if that
-- rule is ever relaxed.

create or replace function public.is_reserved_username(u text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(btrim(coalesce(u, ''))) = any (array[
    -- Posing as FLARE, the club, or its officers
    'flare', 'flares', 'theflare', 'flareofficial', 'flare_official',
    'flare_team', 'flare_admin', 'flarergv', 'flare_rgv', 'rgvflare',
    'official', 'officialflare', 'lamar', 'lamaracademy', 'lamar_academy',
    'rgv', 'club', 'team', 'org', 'organization', 'board', 'council',
    'faculty', 'staff', 'sponsor', 'sponsors', 'officer', 'officers',
    'president', 'vicepresident', 'vice_president', 'treasurer', 'secretary',
    'member', 'members',

    -- Posing as the system or as someone with authority over it
    'admin', 'admins', 'administrator', 'administrators', 'root', 'superuser',
    'sysadmin', 'system', 'systems', 'moderator', 'moderators', 'mod', 'mods',
    'support', 'help', 'helpdesk', 'contact', 'info', 'hello', 'service',
    'security', 'abuse', 'legal', 'billing', 'notifications', 'alerts',
    'noreply', 'no_reply', 'donotreply', 'do_not_reply', 'postmaster',
    'webmaster', 'hostmaster', 'bot', 'robot',

    -- Route names, current and specified. Section 7.
    'api', 'auth', 'login', 'logout', 'signin', 'signout', 'signup',
    'register', 'onboarding', 'dashboard', 'library', 'contribute', 'privacy',
    'terms', 'suspended', 'settings', 'account', 'profile', 'profiles',
    'people', 'reports', 'report', 'log', 'logs', 'upload', 'search', 'watch',
    'video', 'videos', 'u', 'v', 'new', 'edit', 'delete', 'static', 'public',
    'assets', 'images', 'img', 'media', 'favicon', 'robots', 'sitemap',
    'well_known', '_next', 'next',

    -- Values that read as an absent or special account
    'anonymous', 'anon', 'guest', 'user', 'users', 'me', 'self', 'you',
    'everyone', 'somebody', 'nobody', 'null', 'undefined', 'none', 'nan',
    'true', 'false', 'deleted', 'removed', 'unknown', 'test', 'demo', 'example'
  ]);
$$;

comment on function public.is_reserved_username(text) is
  'Whether a username would collide with a route or let someone pose as the club '
  'or the system. Backs profiles_username_not_reserved and the signup trigger. '
  'Editing the list here changes the constraint without revalidating existing rows.';

-- Not secret, and callable so a form can check a name before submitting it.
revoke all on function public.is_reserved_username(text) from public;
grant execute on function public.is_reserved_username(text) to anon, authenticated;

-- A CHECK constraint may call an immutable function, and this one is genuinely
-- immutable: it compares a string against a literal array. Note the
-- consequence, though: replacing the function body above changes what this
-- constraint means without revalidating rows that already exist. Adding a name
-- to the list does not retroactively rename anyone holding it.
alter table public.profiles
  drop constraint if exists profiles_username_not_reserved;
alter table public.profiles
  add constraint profiles_username_not_reserved
  check (not public.is_reserved_username(username));

-- ---------------------------------------------------------------------------
-- The signup trigger has to skip reserved names too
-- ---------------------------------------------------------------------------
-- Identical to the version in 20260829000000 except for the loop condition.
-- The username is derived from the email local-part, so without this an
-- address like admin@lamaracademy.org produces a candidate the constraint
-- above rejects, the insert raises, and the auth.users insert that fired this
-- trigger is rolled back. That is signup failing outright, for that person,
-- with no way for them to work around it.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base      text;
  candidate text;
  suffix    integer := 0;
  meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  -- A username is required at signup because the column is NOT NULL, but the
  -- user does not choose one until onboarding. Derive a legal placeholder now
  -- and let them replace it there.
  base := lower(split_part(coalesce(new.email, ''), '@', 1));
  base := regexp_replace(base, '[^a-z0-9_]', '', 'g');
  if char_length(base) < 3 then
    base := 'member';
  end if;
  -- Leave headroom for a disambiguating suffix inside the 20 char limit.
  base := left(base, 16);

  -- Reserved names are suffixed rather than rejected, exactly like collisions.
  -- 'member' is itself reserved, so the fallback above always lands on
  -- member1, member2 and so on, which is a better placeholder anyway.
  candidate := base;
  while public.is_reserved_username(candidate)
        or exists (select 1 from public.profiles p where p.username = candidate)
  loop
    suffix := suffix + 1;
    candidate := base || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    candidate,
    public.default_display_name(
      coalesce(meta->>'full_name', meta->>'name'),
      candidate
    ),
    nullif(coalesce(meta->>'avatar_url', meta->>'picture'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ===========================================================================
-- 03. onboarded requires a complete profile
-- ===========================================================================
-- profiles_onboarded_requires_consent already covers the two consent stamps.
-- This is a second, separately named constraint rather than an edit to that
-- one, so a violation says which half is missing.
--
-- The gap it closes: calling attest_age, then accept_terms, then patching
-- onboarded = true through PostgREST produced an onboarded account with a null
-- grade. Phase 3 will treat onboarded as meaning the profile is complete, so
-- the invariant belongs here rather than in the one action that happens to
-- write it today.
--
-- Emptiness, not just nullness. A column grant lets a client write '' as
-- readily as a real value, and '' is not a city.

alter table public.profiles
  drop constraint if exists profiles_onboarded_requires_profile;
alter table public.profiles
  add constraint profiles_onboarded_requires_profile
  check (
    not onboarded
    or (
      coalesce(btrim(grade), '') <> ''
      and coalesce(btrim(city), '') <> ''
      and coalesce(btrim(school), '') <> ''
    )
  );

comment on constraint profiles_onboarded_requires_profile on public.profiles is
  'onboarded = true means grade, city and school are all present. Section 9 keeps '
  'all three private; this only requires that they exist.';
