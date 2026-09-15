-- Make city and school optional again. Grade stays required.
--
-- 20260902000000 added profiles_onboarded_requires_profile so that phase 3
-- could read `onboarded` as "the profile is complete". It required grade, city
-- and school, which had the side effect of turning two optional questions into
-- mandatory ones: the form could not leave them blank without the final
-- `onboarded = true` write failing at the last step.
--
-- CLAUDE.md recorded that trade at the time and named this exact lever:
--
--   "If that is the wrong trade, the lever is the constraint, not the form:
--    drop city and school from profiles_onboarded_requires_profile and make
--    the fields optional again in the same commit."
--
-- It was the wrong trade. Section 9 opens with "most users are minors", and
-- requiring a student to name their school and their city before they can use
-- a financial literacy library collects two more identifying facts about a
-- child than the site needs. Grade is the one of the three the product
-- actually uses: it is what the difficulty ladder is pitched at.
--
-- What does NOT change: all three columns stay PRIVATE under rule 9.1, absent
-- from public_profiles by construction rather than merely unrendered, and city
-- stays city-only under rule 9.3. This narrows what we ask for; it does not
-- move anything into public view.
--
-- Nothing is dropped and no existing value is touched. Accounts that already
-- supplied a city and a school keep them; the constraint simply stops
-- demanding them of the next person.

alter table public.profiles
  drop constraint if exists profiles_onboarded_requires_profile;

-- Emptiness, not just nullness, for the column that remains. A column grant
-- lets a client write '' as readily as a real value, and '' is not a grade.
alter table public.profiles
  add constraint profiles_onboarded_requires_profile
  check (
    not onboarded
    or coalesce(btrim(grade), '') <> ''
  );

comment on constraint profiles_onboarded_requires_profile on public.profiles is
  'onboarded = true means grade is present. city and school are optional as of '
  '20260909000000: see that file for why two required questions about a minor '
  'were the wrong default. Section 9 keeps all three private either way.';
