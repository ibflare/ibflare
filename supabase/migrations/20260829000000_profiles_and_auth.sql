-- Phase 2: people.
--
-- profiles, the capability helpers RLS is written against, the auth.users
-- insert trigger, and every policy that governs this table. Policies live in
-- the same migration as the table they protect, so a table is never briefly
-- readable in a deploy window.
--
-- See CLAUDE.md sections 2 (roles, capabilities, suspension, succession),
-- 3 (schema), 6 (RLS), and 9 (privacy).

-- ===========================================================================
-- profiles
-- ===========================================================================

create table if not exists public.profiles (
  id                uuid primary key references auth.users on delete cascade,
  username          text unique not null,
  display_name      text not null,
  title             text,
  avatar_url        text,
  bio               text,
  role              text not null default 'viewer',
  can_post          boolean not null default false,
  can_moderate      boolean not null default false,
  can_manage_users  boolean not null default false,
  -- PRIVATE. Never rendered on a public page. Section 9.1.
  grade             text,
  city              text,
  school            text,
  onboarded         boolean not null default false,
  suspended_at      timestamptz,
  suspended_by      uuid references public.profiles,
  suspension_reason text,
  created_at        timestamptz not null default now(),

  constraint profiles_username_format
    check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_role_valid
    check (role in ('viewer', 'member', 'officer', 'sponsor')),
  constraint profiles_grade_valid
    check (grade is null or grade in ('9', '10', '11', '12', 'college', 'educator', 'other')),
  constraint profiles_display_name_length
    check (char_length(display_name) between 1 and 60),
  constraint profiles_bio_length
    check (bio is null or char_length(bio) <= 500),
  -- A suspension is only coherent with a reason attached. Section 2.
  constraint profiles_suspension_complete
    check (suspended_at is null or suspension_reason is not null)
);

comment on column public.profiles.grade is 'PRIVATE. Visible only to can_manage_users holders.';
comment on column public.profiles.city is 'PRIVATE. City only, never an address.';
comment on column public.profiles.school is 'PRIVATE. Visible only to can_manage_users holders.';

-- ===========================================================================
-- audit_log
-- ===========================================================================
-- Declared here, ahead of its own phase, because the permission-change
-- function below cannot exist without it: section 2 requires every role and
-- capability change to write a row. Later phases add rows for videos and
-- comments without changing this shape.

create table if not exists public.audit_log (
  id         bigserial primary key,
  actor_id   uuid references public.profiles,
  action     text not null,
  target     text,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx
  on public.audit_log (created_at desc);

-- ===========================================================================
-- Capability helpers
-- ===========================================================================
-- SECURITY DEFINER with an empty search_path, per section 6.
--
-- These exist because a policy on profiles that queries profiles to decide
-- who may read profiles recurses forever. The definer function runs outside
-- the caller's RLS context, which breaks the cycle. Never inline the subquery
-- into a policy on this table.
--
-- search_path = '' means every reference inside must be schema-qualified, so a
-- caller cannot shadow `profiles` with their own table and lie about their
-- permissions.

create or replace function public.has_capability(cap text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case cap
               when 'post'         then p.can_post
               when 'moderate'     then p.can_moderate
               when 'manage_users' then p.can_manage_users
               else false
             end
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$$;

comment on function public.has_capability(text) is
  'Capability check for RLS. Pass post | moderate | manage_users.';

-- Deliberately separate from has_capability. Section 6 requires insert
-- policies to check suspension *in addition to* capability, and keeping them
-- apart means a suspended sponsor does not silently lose the ability to be
-- un-suspended by another sponsor.
create or replace function public.is_suspended()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.suspended_at is not null
      from public.profiles p
      where p.id = (select auth.uid())
    ),
    false
  );
$$;

-- ===========================================================================
-- RLS
-- ===========================================================================

alter table public.profiles enable row level security;
alter table public.audit_log enable row level security;

-- The base table is never readable by anon. The public projection below is.
create policy "profiles: owner reads own row"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: manage_users reads every row"
  on public.profiles for select
  to authenticated
  using (public.has_capability('manage_users'));

-- The trigger creates the row, so this is a fallback rather than the usual
-- path. A user may only ever insert their own row.
create policy "profiles: owner inserts own row"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- Which *columns* a user may write is enforced by column privileges below,
-- not by this policy. RLS decides rows; grants decide columns.
create policy "profiles: owner updates own row"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Section 6: audit_log is readable only with can_moderate. Writes go through
-- SECURITY DEFINER functions, so there is no insert policy for end users.
create policy "audit_log: moderators read"
  on public.audit_log for select
  to authenticated
  using (public.has_capability('moderate'));

-- ===========================================================================
-- Column privileges
-- ===========================================================================
-- This is what actually stops a user from promoting themselves to sponsor.
-- The update policy above authorizes the row; these grants authorize the
-- columns. role, title, the three capability flags, and the suspension
-- columns are absent from the grant list, so an UPDATE touching any of them
-- is rejected by Postgres before RLS is consulted.

revoke all on public.profiles from anon, authenticated;
revoke all on public.audit_log from anon, authenticated;

grant select on public.profiles to authenticated;
grant insert on public.profiles to authenticated;
grant update (display_name, avatar_url, bio, username, grade, city, school, onboarded)
  on public.profiles to authenticated;

grant select on public.audit_log to authenticated;

-- ===========================================================================
-- public_profiles
-- ===========================================================================
-- The public projection, per section 6. grade, city, and school are absent by
-- construction: this view is the only profile surface anon can reach, so the
-- private columns cannot leak through it even if a query asks for them.
--
-- security_invoker = false is deliberate. The view runs with its owner's
-- rights and so bypasses RLS on the base table, which is the point: these
-- columns are public and the base table is not readable by anon at all.

create or replace view public.public_profiles
with (security_invoker = false, security_barrier = true) as
  select id, username, display_name, title, avatar_url, bio, role
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;

comment on view public.public_profiles is
  'Public projection of profiles. Never add grade, city, or school. Section 9.1.';

-- ===========================================================================
-- Signup trigger
-- ===========================================================================

-- Derives a first-name + last-initial display name from whatever Google
-- returns, because that is the public identity section 9.2 asks contributors
-- to use. Onboarding lets them edit it; this only sets the default, so the
-- privacy-preserving form is what happens when someone clicks through.
create or replace function public.default_display_name(full_name text, fallback text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  parts text[];
begin
  full_name := trim(coalesce(full_name, ''));
  if full_name = '' then
    return fallback;
  end if;

  parts := regexp_split_to_array(full_name, '\s+');
  if array_length(parts, 1) = 1 then
    return left(parts[1], 60);
  end if;

  return left(parts[1] || ' ' || upper(left(parts[array_length(parts, 1)], 1)) || '.', 60);
end;
$$;

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

  candidate := base;
  while exists (select 1 from public.profiles p where p.username = candidate) loop
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Username immutability
-- ===========================================================================
-- The username is chosen once, at onboarding, and is then fixed. It is the
-- public identity and the key in /u/[username]; letting it change would
-- silently break every link to that profile. Enforced here rather than by
-- withholding the column grant, because onboarding needs to write it once.

create or replace function public.enforce_username_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.onboarded and new.username is distinct from old.username then
    raise exception 'Your username is set when you first sign in and cannot be changed.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_username_immutable on public.profiles;
create trigger profiles_username_immutable
  before update on public.profiles
  for each row execute function public.enforce_username_immutable();

-- ===========================================================================
-- Permission changes
-- ===========================================================================
-- The only supported path for writing role, title, or a capability flag.
-- Section 6: checks can_manage_users and writes audit_log. Section 2: refuses
-- any change that would leave the site with zero sponsors.
--
-- Runs as owner, so it is unaffected by the column grants above. That is the
-- whole design: the columns are unreachable except through this function.

create or replace function public.set_user_permissions(
  target_id            uuid,
  new_role             text,
  new_title            text,
  new_can_post         boolean,
  new_can_moderate     boolean,
  new_can_manage_users boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_row jsonb;
  others     integer;
begin
  if not public.has_capability('manage_users') then
    raise exception 'You do not have permission to change roles or capabilities.'
      using errcode = 'insufficient_privilege';
  end if;

  select to_jsonb(p) into before_row
  from public.profiles p
  where p.id = target_id;

  if before_row is null then
    raise exception 'No such account.' using errcode = 'no_data_found';
  end if;

  -- Last-sponsor guard. Section 2: the app must refuse any change that would
  -- leave zero accounts holding can_manage_users.
  if (before_row->>'can_manage_users')::boolean and not new_can_manage_users then
    select count(*) into others
    from public.profiles p
    where p.can_manage_users and p.id <> target_id;

    if others = 0 then
      raise exception 'FLARE needs at least one sponsor. Promote someone else first.'
        using errcode = 'raise_exception';
    end if;
  end if;

  update public.profiles
  set role             = new_role,
      title            = new_title,
      can_post         = new_can_post,
      can_moderate     = new_can_moderate,
      can_manage_users = new_can_manage_users
  where id = target_id;

  insert into public.audit_log (actor_id, action, target, detail)
  values (
    (select auth.uid()),
    'user.permissions',
    target_id::text,
    jsonb_build_object(
      'before', jsonb_build_object(
        'role', before_row->>'role',
        'title', before_row->>'title',
        'can_post', before_row->'can_post',
        'can_moderate', before_row->'can_moderate',
        'can_manage_users', before_row->'can_manage_users'
      ),
      'after', jsonb_build_object(
        'role', new_role,
        'title', new_title,
        'can_post', new_can_post,
        'can_moderate', new_can_moderate,
        'can_manage_users', new_can_manage_users
      )
    )
  );
end;
$$;

revoke all on function public.set_user_permissions(uuid, text, text, boolean, boolean, boolean) from public;
grant execute on function public.set_user_permissions(uuid, text, text, boolean, boolean, boolean) to authenticated;

-- ===========================================================================
-- Indexes
-- ===========================================================================
-- username already carries a unique index. This supports the sponsor search
-- in section 7, which matches on name as well as username.

create index if not exists profiles_display_name_idx
  on public.profiles using gin (to_tsvector('english', display_name));
