-- Age screening and terms acceptance.
--
-- Adds birth_year, age_attested_at and terms_accepted_at to profiles, plus the
-- two functions that write them. See CLAUDE.md sections 3 and 9.

alter table public.profiles
  add column if not exists birth_year        smallint,
  add column if not exists age_attested_at   timestamptz,
  add column if not exists terms_accepted_at timestamptz;

comment on column public.profiles.birth_year is
  'PRIVATE. Year only. The birth month is used to compute age at the age screen and is deliberately never stored.';
comment on column public.profiles.age_attested_at is
  'When the account passed the age screen. Set only by attest_age().';
comment on column public.profiles.terms_accepted_at is
  'When the account accepted the terms. Set only by accept_terms().';

-- A year, never a date. Rule 3 in section 9 forbids collecting a date of
-- birth, and a year on its own is not one.
alter table public.profiles
  drop constraint if exists profiles_birth_year_sane;
alter table public.profiles
  add constraint profiles_birth_year_sane
  check (birth_year is null or birth_year between 1900 and 2100);

-- Onboarding cannot be finished without both. Enforced here rather than only
-- in the action, so the invariant holds even if some later code path sets
-- onboarded directly.
alter table public.profiles
  drop constraint if exists profiles_onboarded_requires_consent;
alter table public.profiles
  add constraint profiles_onboarded_requires_consent
  check (
    not onboarded
    or (age_attested_at is not null and terms_accepted_at is not null)
  );

-- ===========================================================================
-- attest_age
-- ===========================================================================
-- Takes a birth month and year, computes the age in the database, and writes
-- the attestation only if it clears the minimum. Returns whether it did.
--
-- SECURITY DEFINER, and the three columns above are deliberately absent from
-- the grants in the previous migration. That means this function is the only
-- way they can be written: a client cannot mark itself age-attested by calling
-- PostgREST directly, and cannot choose its own attestation timestamp.
--
-- The month is a parameter and not a column. It is needed to work out whether
-- this year's birthday has happened yet, and is discarded immediately after.

create or replace function public.attest_age(
  p_birth_month integer,
  p_birth_year  integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- COPPA's threshold, and the reason this screen exists at all.
  minimum_age constant integer := 13;
  v_age       integer;
  v_uid       uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  if p_birth_month is null or p_birth_month < 1 or p_birth_month > 12 then
    raise exception 'Choose a birth month.' using errcode = 'check_violation';
  end if;

  if p_birth_year is null or p_birth_year < 1900 or p_birth_year > extract(year from current_date)::integer then
    raise exception 'Choose a birth year.' using errcode = 'check_violation';
  end if;

  -- Without a day, the birth month itself is ambiguous: someone born late in
  -- the month has not had their birthday yet. Resolve that downward, so a
  -- person who might still be 12 is treated as 12.
  v_age := (extract(year from current_date)::integer - p_birth_year)
           - case
               when extract(month from current_date)::integer <= p_birth_month then 1
               else 0
             end;

  if v_age < minimum_age then
    -- Write nothing at all. Recording the attempt would mean holding data
    -- about a child who is not permitted to have an account.
    return false;
  end if;

  update public.profiles
  set birth_year      = p_birth_year,
      age_attested_at = now()
  where id = v_uid;

  return true;
end;
$$;

revoke all on function public.attest_age(integer, integer) from public;
grant execute on function public.attest_age(integer, integer) to authenticated;

-- ===========================================================================
-- accept_terms
-- ===========================================================================
-- Separate from the age screen on purpose. Bundling "I am old enough" with
-- "I accept the terms" into one checkbox makes each a worse record of the
-- other.

create or replace function public.accept_terms()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = 'insufficient_privilege';
  end if;

  update public.profiles
  set terms_accepted_at = now()
  where id = v_uid;
end;
$$;

revoke all on function public.accept_terms() from public;
grant execute on function public.accept_terms() to authenticated;
