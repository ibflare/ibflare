-- Remove the age screen.
--
-- Client decision, 16 September. The birth month and year selects, attest_age,
-- birth_year, age_attested_at, and the under-13 account deletion all go. The
-- terms checkbox and terms_accepted_at stay.
--
-- What this changes about the site, stated plainly because section 9 is
-- non-negotiable and this edits it:
--
-- FLARE no longer asks anybody's age and no longer screens for it. The
-- under-13 protection that 20260830000000 built is gone, and with it the
-- reasoning in section 9.4 about neutral age screens, resolving ambiguous
-- months downward, and deleting the auth row rather than recording a failed
-- attempt. None of that applies to a site that does not ask.
--
-- The requirement itself does not disappear by removing the mechanism. A site
-- collecting a name, a grade and comments from children under 13 is the thing
-- COPPA is about, and the answer is now a stated rule in /privacy and /terms
-- rather than a form control. The client is handling that wording in the legal
-- review. Until it lands, the site asks for less and promises nothing about
-- who may sign up, which is a gap the review has to close rather than one this
-- migration can.
--
-- The upside, and it is real: this is the largest single reduction in what
-- FLARE collects from minors since the project started. No birth month is
-- typed, no birth year is stored, and nothing is ever deleted-on-failure
-- because there is no failure path. Rule 9.3 forbids collecting a date of
-- birth; now nothing near one is collected at all.

-- ===========================================================================
-- The function first, because the columns cannot go while it writes them.
-- ===========================================================================
drop function if exists public.attest_age(integer, integer);

-- ===========================================================================
-- Consent now means the terms alone.
-- ===========================================================================
-- Rewritten rather than dropped. Onboarding still cannot complete without an
-- accepted-terms stamp, and keeping that in a constraint rather than only in
-- the action is the same decision 20260830000000 made for both halves.
alter table public.profiles
  drop constraint if exists profiles_onboarded_requires_consent;
alter table public.profiles
  add constraint profiles_onboarded_requires_consent
  check (not onboarded or terms_accepted_at is not null);

comment on constraint profiles_onboarded_requires_consent on public.profiles is
  'onboarded = true means the terms were accepted. The age half was removed '
  'on 16 September with the age screen; see 20260916000000.';

-- ===========================================================================
-- The columns.
-- ===========================================================================
-- age_attested_at goes as well as birth_year, and that is a deliberate reading
-- of "remove the age screen entirely" rather than an overreach worth hiding:
-- with attest_age gone nothing can ever write it again, and a timestamp
-- asserting that an account passed a screen the site no longer runs is a
-- worse record than no timestamp. Two existing rows carry a value; both are
-- lost. If that record is wanted as evidence, keep the column instead and say
-- so before running this.
alter table public.profiles
  drop constraint if exists profiles_birth_year_sane;

alter table public.profiles
  drop column if exists birth_year,
  drop column if exists age_attested_at;

comment on column public.profiles.terms_accepted_at is
  'When the account accepted the terms. Set only by accept_terms(). The one '
  'consent stamp left after the age screen was removed.';
