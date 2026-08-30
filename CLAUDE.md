@AGENTS.md

# FLARE — project spec

**Financial Literacy Advancement for RGV Equity.** A student-run video library where members of
FLARE at Lamar Academy (and approved outside contributors) publish videos explaining financial
literacy, taxes, and economics — sorted by difficulty so a 12-year-old and a college junior can both
find the right explanation of the same topic.

This file is the source of truth for architecture, schema, and brand. Read it before making
structural changes. If a decision here turns out to be wrong, update this file in the same commit.

---

## 1. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router, TypeScript) | Server components for reads, route handlers for writes |
| Styling | Tailwind CSS v4 | Tokens in `src/app/globals.css` under `@theme`, see Brand |
| Backend | Supabase (Postgres + Auth + RLS) | `@supabase/ssr` for cookie-based sessions |
| Auth | Supabase Auth: Google OAuth and email/password | Email confirmation required. See below |
| Video | YouTube embeds, resolved automatically | We store the video ID, never the file. See §5 |
| Hosting | Vercel | Preview deploys on every branch |

**Do not** add a state library, an ORM, or a component library. Server components plus the Supabase
client cover this app.

> **Changed after phase 2.** This row originally read "Google OAuth only, no password auth, no
> email/password fallback". Email and password sign-in was added alongside Google at the client's
> request. Two consequences follow, both recorded in §9.4:
>
> 1. **Email confirmation is mandatory and must stay on.** With it off, anyone can register an
>    address they do not control. Supabase links accounts by email, so when the real owner of that
>    address later signs in with Google, they are handed the attacker's existing account. The
>    project currently reports `mailer_autoconfirm: false`, which is correct. Do not turn it off,
>    not even to make local testing quicker.
> 2. **The age gate is gone.** §9.4's under-13 protection rested entirely on Google performing age
>    verification. An email/password signup asks nobody's age. See §9.4.

> **Confirmation links arrive three different ways.** `/auth/confirm` has to handle all of them, and
> the first version handled only the first, so every real confirmation email failed with "That
> confirmation link is not valid":
>
> | Query | When |
> |---|---|
> | `token_hash` + `type` | the email template was customised to use `{{ .TokenHash }}` |
> | `code` | the **default** `{{ .ConfirmationURL }}` template, which verifies at Supabase first and then redirects here with a PKCE code |
> | `#access_token=...` | same, on the implicit flow. A fragment never reaches the server, so this one is finished in the browser by `ConfirmFromFragment` |
>
> The default template is the common case. If a confirmation link fails, check which of these the
> URL actually carries before suspecting the redirect allowlist: reaching this route's error message
> at all proves the allowlist is fine, because the redirect resolved.

> **Launch blocker: transactional email.** Confirmation mail currently goes through Supabase's
> default shared sender, which is rate limited to a handful of messages per hour and is not intended
> for production. A club meeting where thirty students sign up at once will silently fail for most
> of them. Wire up Resend (or another real SMTP provider) in Supabase Auth, SMTP Settings, before
> launch.

> **Corrected in phase 1.** This section originally said tokens live in `tailwind.config.ts`. There
> is no such file: Tailwind v4 is CSS-first and `create-next-app` no longer generates one. The
> tokens are declared in the `@theme` block in `src/app/globals.css`.

---

## 2. People model

Four roles. Role sets the public tag and the sensible defaults; actual authority comes from three
capability flags a sponsor ticks per person.

| Role | Public tag | Typical capabilities |
|---|---|---|
| `viewer` | none | none |
| `member` | "Member" | `can_post` |
| `officer` | their `title` | `can_post`, usually `can_moderate` |
| `sponsor` | "Sponsor" | all three, including `can_manage_users` |

### Capability flags on `profiles`

- **`can_post`** — publish and edit their own videos
- **`can_moderate`** — edit, hide, or delete **any** video; resolve reported comments
- **`can_manage_users`** — change anyone's role, title, and capability flags

Always gate features on the capability, never on the role string. `role` is for display and for
listing current officers on the landing page.

### Titles

`profiles.title` is free text set by a sponsor: "Vice President", "Treasurer", "Faculty Sponsor",
"Guest Contributor". It renders next to the person's name on their profile and comments.

**"Former officer" is not a separate state.** At the end of a term the sponsor unticks the
capability boxes and sets the title to "Former Vice President". The person keeps their account,
keeps commenting, and keeps the tag. No extra schema, no extra UI.

### Suspension

Any account can be suspended. A suspended user can still sign in and watch, but cannot post, comment,
accept collaborations, or edit their profile — they see a banner explaining they've been suspended
and who to talk to. Their existing videos and comments stay up unless separately removed.

- **`can_moderate`** may suspend a `viewer` or `member`. This is the fast lever for a spammer.
- **`can_manage_users`** is required to suspend an `officer` or `sponsor`, and to lift any suspension.
- Suspending requires a reason. It writes an `audit_log` row with the actor, target, and reason.
- The suspend dialog offers a checkbox: "Also delete this person's comments." One click, soft-deleted,
  logged.

Suspend is reversible and is the default response. Deleting an account is not offered in the UI —
if it's ever genuinely needed, it happens in the SQL editor with a sponsor present.

### Succession and lockout

Sponsors are the only role that can create other sponsors — this is how the club survives a faculty
change. Two hard rules:

1. Only a user with `can_manage_users` may grant or revoke `can_manage_users`.
2. The app must **refuse** any change that would leave zero accounts with `can_manage_users`.
   Show: "FLARE needs at least one sponsor. Promote someone else first."

Escape hatch if it happens anyway — in the Supabase SQL editor:
```sql
update profiles set role = 'sponsor', can_post = true, can_moderate = true,
       can_manage_users = true, title = 'Faculty Sponsor'
where username = 'the_username';
```
The first sponsor is created this way. There is no self-serve path to sponsor.

---

## 3. Data model

Difficulty is an integer 1–5. The scale is fixed and public-facing:

The wording below is public-facing and comes from the client copy deck. It lives in
`src/lib/taxonomy.ts` as `DIFFICULTY_LEVELS`, which is the single source the UI reads; keep the two
in step.

| Level | Name | Audience | Assumes |
|---|---|---|---|
| 1 | Spark | Ages 13–14 | Assumes nothing. What a paycheck is, what a bank does with your money |
| 2 | Ember | Ages 14–16 | You have a job or you're about to. Pay stubs, simple tax returns, how credit works |
| 3 | Blaze | Ages 16–18 | You have money to make decisions about. Index funds, 1099 work, FAFSA and student loans |
| 4 | Torch | 18 and up | College level. Macroeconomic policy, company filings, valuation |
| 5 | Flare | College and up | A single question examined in depth. Assumes coursework in economics or finance |

Topics (enum): `taxes`, `banking`, `credit`, `investing`, `career`, `macro`, `micro`, `corporate`.

```sql
profiles (
  id                uuid primary key references auth.users on delete cascade,
  username          text unique not null,        -- 3-20 chars, [a-z0-9_], lowercase
  display_name      text not null,
  title             text,                        -- sponsor-set, e.g. 'Vice President'
  avatar_url        text,
  bio               text,
  role              text not null default 'viewer',  -- viewer|member|officer|sponsor
  can_post          boolean not null default false,
  can_moderate      boolean not null default false,
  can_manage_users  boolean not null default false,
  grade             text,      -- PRIVATE. 9-12 | college | educator | other
  city              text,      -- PRIVATE. City only, never an address
  school            text,      -- PRIVATE
  birth_year        smallint,  -- PRIVATE. Year only. The month is never stored. See §9.4
  age_attested_at   timestamptz,  -- set only by attest_age()
  terms_accepted_at timestamptz,  -- set only by accept_terms()
  onboarded         boolean not null default false,
  suspended_at      timestamptz,
  suspended_by      uuid references profiles,
  suspension_reason text,
  created_at        timestamptz not null default now()
)

videos (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  youtube_id     text not null,          -- 11-char ID
  thumbnail_url  text,
  duration_s     integer,
  difficulty     smallint not null check (difficulty between 1 and 5),
  topic          text not null,
  owner_id       uuid not null references profiles on delete cascade,
  status         text not null default 'published',  -- draft|published|hidden
  release_ok     boolean not null default false,     -- media release attested at upload
  view_count     integer not null default 0,
  created_at     timestamptz not null default now(),
  published_at   timestamptz,
  deleted_at     timestamptz,            -- soft delete
  deleted_by     uuid references profiles,
  search_tsv     tsvector generated always as (
                   to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))
                 ) stored
)

video_collaborators (
  video_id    uuid references videos on delete cascade,
  profile_id  uuid references profiles on delete cascade,
  status      text not null default 'pending',   -- pending|accepted|declined
  invited_at  timestamptz not null default now(),
  primary key (video_id, profile_id)
)

comments (
  id          uuid primary key default gen_random_uuid(),
  video_id    uuid not null references videos on delete cascade,
  author_id   uuid not null references profiles on delete cascade,
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  deleted_by  uuid references profiles
)

reports (
  id           uuid primary key default gen_random_uuid(),
  comment_id   uuid references comments on delete cascade,
  reporter_id  uuid not null references profiles,
  reason       text,
  status       text not null default 'open',   -- open|resolved|dismissed
  created_at   timestamptz not null default now()
)

audit_log (
  id          bigserial primary key,
  actor_id    uuid references profiles,
  action      text not null,     -- 'video.delete', 'user.permissions', 'comment.delete', ...
  target      text,              -- id or username of the thing acted on
  detail      jsonb,             -- before/after for permission changes
  created_at  timestamptz not null default now()
)

-- exactly one row, id = 1. The kill switches live here so they can be flipped
-- from the admin panel without a deploy.
site_settings (
  id                 smallint primary key default 1 check (id = 1),
  comments_enabled   boolean not null default true,
  signups_enabled    boolean not null default true,
  updated_by         uuid references profiles,
  updated_at         timestamptz not null default now()
)
```

Indexes: GIN on `videos.search_tsv`; btree on `videos(difficulty)`, `videos(topic)`,
`videos(owner_id)`, `videos(status, published_at desc)`, `comments(video_id, created_at)`.

**Deletes are soft.** Set `deleted_at` and `deleted_by`; never `DELETE FROM videos`. Deleted rows
disappear from every public query but stay recoverable, and moderators can see them in the admin
panel. Write an `audit_log` row for every delete, permission change, and role change.

### Collaboration

A video has one `owner_id` (controls the fields) and any number of collaborators. Tagging creates a
`pending` row; the tagged person accepts or declines from their dashboard. **Only `accepted`
collaborators are shown as co-authors** — a pending tag is invisible to everyone but the owner and
the invitee. Byline: `Maya R. and Andre L.`, or `Maya R. + 2 others` beyond one.

---

## 4. Comments and moderation

Comments require a signed-in, onboarded account. Anonymous commenting never exists.

**Filter pipeline**, in `lib/moderation/`:

1. Normalize — lowercase, strip zero-width characters, collapse repeats (`fuuuck` → `fuck`), map
   common substitutions (`@`→a, `1`/`!`→i, `0`→o, `$`→s, `3`→e).
2. Match the normalized text against the wordlist using **word boundaries**, not substrings.
3. Two tiers:
   - **Profanity** → reject on submit with "That comment contains language we don't allow. Edit it and try again." Nothing is stored.
   - **Slurs and harassment** → reject *and* write an `audit_log` entry flagged for officers. Repeat hits from one account should surface in the admin panel.

Keep the wordlist in `lib/moderation/wordlist.ts`, exported as two arrays (`PROFANITY`, `SLURS`), so
it can be edited without touching logic. Do not enumerate it in this file.

**What the filter is for.** Word matching stops careless posts, not determined ones — spacing,
symbols, and unicode homoglyphs all walk through it, and strict matching flags legitimate words
(Dickinson, Scunthorpe, assassin, class). Word boundaries plus normalization is the right balance.
Do not escalate to substring matching to catch more; the false positives cost more than the misses.

**The filter is the smallest part of the system.** This site is scoped to one school. Every comment
is attached to a Google-authenticated account with a real name, a grade, and a school on file, and
the officers and faculty sponsor know these people personally. Someone who posts something ugly gets
identified in about thirty seconds and handled through the school, which is a consequence no
automated filter can match. Build the moderation tools around that fact:

- A **Report** button on every comment, writing to `reports`
- An officer queue at `/dashboard/admin/reports`, showing the comment, the author, and their history
- Anyone with `can_moderate` can delete any comment
- **Suspend author** inline on every comment and video in the admin panel — see §2
- Rate limit: 5 comments per user per minute

**Kill switches.** `site_settings.comments_enabled` is a single toggle in the admin panel that hides
every comment UI site-wide and rejects writes at the API layer. If comments turn into a problem
during a school week, one person flips it off in ten seconds — no deploy, no code change, no waiting
on whoever has repo access. Existing comments are hidden, not deleted, and come back when it's
flipped on. `signups_enabled` works the same way if the site ever gets found by people it wasn't
built for. Comments can also be disabled per-video by the owner or a moderator.

---

## 5. YouTube handling — must be fully automatic

The contributor pastes a URL. Nothing else is manual, ever. Nobody hand-writes an embed.

**On paste, before the form can be submitted:**

1. Parse the ID from any of `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/embed/`,
   `youtube.com/shorts/`, with or without extra query params.
2. Call **YouTube Data API v3 `videos.list`** (`part=snippet,contentDetails,status`) from a server
   route — never expose the key client-side. Pull back title, thumbnail, and ISO-8601 duration, and
   parse `PT14M3S` into seconds.
3. Validate and block submission with a specific message if:
   - the video doesn't exist → "We couldn't find that video. Check the link."
   - `status.privacyStatus === 'private'` → "Private videos can't be embedded. Set it to Unlisted or Public."
   - `status.embeddable === false` → "Embedding is turned off for this video. Turn it on in YouTube Studio."
4. Prefill title and duration into the form; the contributor can edit the title, and fills in
   description, difficulty, topic, and collaborators.
5. Show a live thumbnail preview so they can confirm it's the right video before publishing.

Unlisted is fine and is what we recommend — unlisted videos embed normally.

Fallback with no API key: `https://www.youtube.com/oembed?url={url}&format=json` returns title and
thumbnail with no key and no quota, but **not** duration. Use the Data API as the default.

Player: `youtube-nocookie.com`, lazy-loaded, thumbnail-first — don't mount the iframe until click.
Thumbnail: store `https://img.youtube.com/vi/{id}/hqdefault.jpg` at submit time.

Never accept a raw video file upload. If that ever changes, it's Mux, not Supabase Storage.

### `/contribute` — how to post

A plain instructions page, written for someone who has never uploaded to YouTube:
upload to YouTube → set visibility to **Unlisted** (explain: not searchable, anyone with the link
can watch, and we only ever show it inside FLARE) → confirm embedding is allowed → copy the link →
paste it here. Include what makes a good FLARE video: cite sources on screen, teach how something
works rather than what to buy, no sponsors or referral codes, say so when you're unsure.

---

## 6. RLS

RLS on every table. Write `has_capability(cap text)` as a `SECURITY DEFINER` function with
`search_path = ''` and call it from policies.

> **Gotcha:** a policy on `profiles` that queries `profiles` to check permissions recurses forever.
> That's what the definer function is for. Never inline the subquery.

- **profiles** — public view `public_profiles` exposes `id, username, display_name, title,
  avatar_url, bio, role` to anon. The base table is readable by its owner and by `can_manage_users`
  holders only. Users update their own row but **cannot** touch `role`, `title`, or any capability
  flag; those go through a definer function that checks `can_manage_users` and writes `audit_log`.
- **videos** — `status='published' AND deleted_at IS NULL` readable by anon. Insert requires
  `auth.uid() = owner_id AND can_post`. Update/delete for the owner or `can_moderate`.
- **video_collaborators** — readable when the parent video is public, or by owner/invitee. Insert by
  the video owner. Update (accept/decline) by the invitee, on their own row only.
- **comments** — non-deleted comments on published videos readable by anon. Insert by any onboarded
  user. Update own within 5 minutes; delete own, or any with `can_moderate`.
- **reports / audit_log** — readable only with `can_moderate`. Insert on `reports` by any signed-in user.
- **site_settings** — readable by anon (the app needs to know if comments are on). Update requires
  `can_manage_users`.

**Suspension is enforced in the database, not just the UI.** Every insert policy on `videos`,
`comments`, `video_collaborators`, and `reports` also requires `suspended_at IS NULL` on the acting
profile. Hiding a button is not enforcement. Likewise, the comments insert policy checks
`site_settings.comments_enabled` — the kill switch has to hold even if someone hits the API directly.

---

## 7. Routes

```
/                       Landing. Mission, what FLARE does at Lamar Academy, difficulty ladder, CTA
/library                Browse. Search + difficulty + topic filters. Server-rendered, paginated
/v/[id]                 Video page. Embed, byline with collaborators, comments
/u/[username]           Public profile. Name, title, bio, their videos. No grade/city/school
/contribute             How to upload to YouTube and post here
/login                  Google sign-in, nothing else
/onboarding             First run: username, display name, grade, school, city
/dashboard              Own videos, drafts, pending collaboration invites
/dashboard/upload       Gated on can_post
/dashboard/admin        Gated on can_moderate. All videos incl. deleted, restore, reported comments
/dashboard/admin/people Gated on can_manage_users. See below
/dashboard/admin/log    Gated on can_moderate. Audit log, newest first
/dashboard/admin/settings  Gated on can_manage_users. The kill switches from §4
/suspended              Shown to a suspended user: reason, date, who to contact
/privacy                Privacy Policy. Client-supplied copy. Linked from the footer and onboarding
/terms                  Terms of Service. Client-supplied copy. Linked from the footer and onboarding
```

> **Both pages now exist, with client-supplied copy.** They are static, rendered as markup rather
> than through a markdown dependency, sharing the `.legal` prose class in `globals.css`.
>
> Two things in them still need attention before launch:
> - The privacy policy says the site is at **`flare.example.org`**, which is a placeholder. Replace
>   it with the real domain when there is one.
> - Neither has been reviewed by an adult with authority over the club. They describe collection of
>   `grade`, `city`, `school`, and `birth_year` from minors, so that review matters.
>
> **The privacy policy and the viewing gate have to move together.** Its "who can see what" table
> now says "Anyone with an account" for both profile fields and published content, which is true
> only while `REQUIRE_ACCOUNT_TO_VIEW` is set. Flip that constant and both rows become wrong.
>
> The profile row was corrected, and the date bumped to 30 August, when `/u/[username]` moved behind
> sign-in. **The prose elsewhere in both documents still says "public"** in several places: "Username
> and display name. These are public", "Bio and profile picture ... public if you provide them",
> "Comments are public", and clause 3 of the terms. That reading is defensible, since the content is
> posted rather than private, and the table is the precise statement. It was left alone rather than
> rewritten unasked. Decide whether it should be tightened when the gate decision is settled.

**Officers are no longer listed on the landing page.** The placeholder cards
were removed in phase 1. Note that §2 gives "listing current officers on the
landing page" as a reason `role` exists for display; that rationale now has no
consumer. Keep `role` regardless, since it drives the public tag on profiles and
comments.

### `/dashboard/admin/people` — built for a non-technical teacher

This page is the sponsor's whole job. It must work without anyone opening Supabase.

- A **search box at the top**: type a name, username, or email, get matching accounts. Partial
  matches, case-insensitive. This is how a sponsor finds four officers among hundreds of accounts.
- Each result is a row with the person's name, username, current title, and role tag.
- Clicking a row opens an editor with: a **title text field**, a **role dropdown**, and **three
  checkboxes** labeled in plain language, not field names:
  - "Can post videos"
  - "Can edit and delete other people's videos"
  - "Can manage people and permissions"
- A short line under each checkbox saying what it actually allows.
- Save writes an `audit_log` entry recording who changed what.
- The last-sponsor guard from §2 blocks the save with a clear message.

No bulk actions, no CSV import, no inline table editing. One person at a time, obvious buttons.

Middleware: unauthenticated users hitting `/dashboard/*` go to `/login`. Signed-in users with
`onboarded = false` are redirected to `/onboarding` from everywhere except `/onboarding`.

`/login`, `/onboarding`, `/auth/*`, and `/account-unavailable` render without the footer. It is a
site-wide navigation surface, and three columns of links plus a liability notice under a form asking
for a date of birth is noise. They keep the header, so the wordmark and a way out are still there.
The list is in `ConditionalFooter`.

> **The file is `src/proxy.ts`, not `middleware.ts`.** Next 16 deprecated the `middleware` file
> convention and renamed it to `proxy`; the export is `proxy`, and `middleware.ts` is silently
> ignored. Execution model, matcher, and position in the request lifecycle are unchanged, so
> "middleware" remains the right word for what it does. It also refreshes the Supabase session on
> every request: server components cannot write cookies, so without it sessions expire on their own.

Search uses `websearch_to_tsquery` against `search_tsv`. Never fetch the whole table and filter
client-side — it breaks at a few hundred rows.

---

## 8. Brand

From the logo: a high-contrast Didone serif wordmark with a flame containing a negative-space dollar
sign, over a wide-tracked geometric sans tagline.

```
--ink        #041B11   deep green, primary surface and text (SAMPLED, see below)
--paper      #E8EDE9   pale sage, page background
--paper-deep #DBE3DD   one step down from paper, for alternating bands
--mist       #EDEDEB   the flame's negative space in the logo; text on ink
--black      #0A0A0A
--ember      #F0B429   accent, ONLY on difficulty 4-5 markers and focus states
--hot        #E8622C   accent, difficulty 5 only
```

Type: **Bodoni Moda** or **Playfair Display** for display and headings (matches the wordmark).
**Jost** or **Archivo** for body, UI, and labels. Eyebrows, buttons, and small caps get
`letter-spacing: 0.18em` and uppercase, echoing the tagline lockup.

Phase 1 uses **Bodoni Moda** (display) and **Jost** (body), both via `next/font/google`. The tracked
label style is the `.label` component class in `globals.css`.

Logo at `/public/images/FLARE_LOGO.png`. Sample the green from the file rather than assuming
`#0B1F17` — they may be a shade apart, and the header must match the mark exactly.

> **Corrected in phase 1.** Sampled. The wordmark's body colour clusters tightly around **`#041B11`**
> (top samples by pixel count: `#031A11`, `#041B11`, `#031A10`) — darker and less blue than the
> `#0B1F17` this file originally specified. `--ink` is now the sampled value. The logo's background
> is transparent, and the flame's negative space is `#EDEDEB`, which is where `--mist` comes from.
> `--paper` and `--paper-deep` are not derivable from the file and remain design choices.

Voice: **plain and direct, addressed to the reader.** Second person and contractions are correct
("If a video assumes something you haven't learned yet, there is a simpler version of it"). What is
banned is salesy, jokey, or padded writing, not informality itself. Every claim should be concrete:
"Pay stubs, simple tax returns, how credit works", not "essential money skills". Sentence case
except the tracked-out label style. Errors state what happened and what the reader can do next,
without implying reader error. This is a nonprofit teaching young people about money, not a fintech
startup.

**Don't explain the UI. No reassurance copy, no explaining why a choice was made. Label the thing
and move on.**

A button that says "Continue with Google" does not need a paragraph above it explaining that Google
is how you sign in, or one below reassuring you that we never see your password. Both are visible
from the button. This applies hardest to auth, settings, and forms, where the instinct to explain is
strongest and the reader is least interested. Teaching copy about money is the exception: that is
the product, and it should be as long as it needs to be.

**No em dashes anywhere in UI copy. Use commas, colons, or a new sentence.**

Code comments follow the same rule, so `grep` for the character over `src/` comes back empty and
stays a usable check. This file is exempt: it is a working document, not UI copy, and its prose uses
them throughout. En dashes in numeric ranges ("Ages 13–14") are a different character, are correct,
and are not affected.

> **This section has been wrong twice. The copy deck is the authority, not this paragraph.**
> Phase 1 was first written conversationally per the original rule, judged too informal, and
> rewritten in a stiff formal register with contractions and second person stripped out. The
> client-supplied copy deck that followed restored both. The description above is derived from that
> deck, which is the ground truth for register. Match its cadence when writing new copy, and do not
> re-formalize on the strength of an adjective in this file.

The footer liability notice is deliberately heavier than the rest of the copy. It is doing legal
work, not teaching, and should not be loosened to match the surrounding voice.

---

## 9. Privacy rules — non-negotiable

Most users are minors. Hard constraints, not preferences.

1. `grade`, `city`, and `school` are **never** rendered on a public page. Visible only to accounts
   with `can_manage_users`.
2. Public identity is username, display name, and title. Encourage first name + last initial.
3. Never collect a street address, phone number, or date of birth.
4. ~~Google sign-in only, which puts age gating on Google's side. No under-13 signup path.~~
   Superseded. Email/password sign-in was added after phase 2, so age gating no longer rests on
   Google. **The app now runs its own age screen**, and the state of play is:

   **The age screen.** Part of the single onboarding form, not a separate step. Two selects, birth
   month and birth year, neither pre-selected, and no text anywhere naming a threshold or saying
   what happens next. `attest_age()` computes the age in Postgres and writes `age_attested_at` only
   if it clears 13; under that it writes nothing at all, since recording the attempt would mean
   holding data about a child who may not have an account.

   **Nothing is stored for an under-13, even though the form asks for everything at once.** The
   action calls `attest_age()` before it writes a single other field. An under-13 will have typed a
   name and a school by the time they submit, and none of it reaches the database: the call fails,
   the account is deleted, and the request redirects before the profile write is reached. Typed is
   not collected. Keep that ordering if this action is ever refactored.

   **Only the year is stored.** The month is a function argument used to work out whether this
   year's birthday has passed, and is discarded. A year on its own is not a date of birth, so
   rule 3 above still holds. Where the month makes the age ambiguous, it resolves downward: someone
   who might still be 12 is treated as 12.

   **Why a birth date and not a checkbox.** The FTC treats "I am 13 or older" as a leading design,
   because it tells the reader which answer opens the door. A neutral age screen asks for a birth
   date without signalling the cutoff. This is why the page says nothing about an age requirement,
   and why neither select has a default.

   **Failing the age screen deletes the account.** Signup has already created an `auth.users` row
   holding an email address by the time the age screen runs, and `attest_age()` deliberately writes
   nothing. Leaving that row would mean holding a child's email address with no profile attached and
   no way for them to ever use it. The action deletes the auth user through the service role client
   in `src/lib/supabase/admin.ts`, which cascades to `profiles`, then signs them out. That file
   imports `server-only`, so pulling it into a client component is a build error rather than a
   leaked service role key.

   **Retry is deliberately not prevented.** A blocked visitor can reload and give a different year.
   Stopping that would mean recording that this person failed, which means keeping data about the
   child, which is the thing the deletion above exists to avoid. The weaker gate is the right trade.

   **Watching now requires an account, which shuts under-13 visitors out of the site entirely.**
   `/library`, `/v/[id]`, and `/u/[username]` are gated. Profiles are in that list because a profile
   page carries a contributor's name and picture, and gating the library while leaving profiles open
   would put the same people on a public page by another route. An under-13 cannot pass the age
   screen, so cannot get an account, so cannot watch anything, including Spark, the level written
   for the youngest readers. Level 1 is relabelled "Ages 13–14" to match, since no one younger can
   reach it.

   **This is provisional.** It is a placeholder until the club and the faculty sponsor decide what
   they actually want, and it is expected to be reversed. The gate is a single constant,
   `REQUIRE_ACCOUNT_TO_VIEW` in `src/proxy.ts`: set it to false and the library is public again with
   no other change. No page component contains an auth check of its own, deliberately.

   Open question for that discussion, which the code does not answer: should watching require an
   account at all? Gating a free financial literacy library for a public school district is a real
   cost, and it is the reason under-13s are excluded rather than merely limited.

   **Optional lever worth knowing about:** Google returns an `hd` (hosted domain) claim for
   Workspace accounts. Signups can be restricted to the school's domain, with an allowlist table for
   outside contributors like guest economists. This makes a suspended student unable to simply
   return under a new Google account, which is otherwise the one hole in suspension. Leave it off
   for now; wire the check so it can be turned on from `site_settings` later if it's ever needed.
5. **Media release.** The upload form carries a required checkbox before publishing: confirmation
   that everyone appearing or speaking in the video has agreed to it being posted publicly, and that
   for anyone under 18 a signed release is on file with FLARE. Store the attestation as
   `videos.release_ok` with the timestamp. The paper releases live outside the app, in a folder the
   officers keep. The checkbox is a record, not a substitute — say so in the label.
6. Comments ship with the moderation stack in §4 or they don't ship.

---

## 10. Build order

Do not attempt this in one pass. Each phase runs and deploys before the next begins.

1. **Scaffold** — Next.js + Tailwind + brand tokens + fonts. Static landing page with real copy about
   FLARE at Lamar Academy. Placeholder officer cards. Deploy to Vercel.
2. **Auth and people** — Supabase project, Google OAuth, `profiles` + insert trigger, onboarding,
   middleware, `/u/[username]`. Seed the first sponsor by SQL.
3. **Library** — `videos`, RLS, the YouTube resolver from §5, upload form gated on `can_post`,
   `/library` with search and filters, `/v/[id]`, `/contribute`.
4. **Collaboration and admin** — collaborators + invite/accept, byline rendering,
   `/dashboard/admin` and `/dashboard/admin/people` with the search UI, suspension, audit log,
   last-sponsor guard, `site_settings` + the settings page.
5. **Comments** — comments table, the §4 filter, report button, officer queue, inline suspend.
   The kill switch from phase 4 must already work before comments go live.

Seed ~15 videos across all five levels so `/library` looks real in development. Mark them clearly so
they can be deleted before launch.

### Phase 1 status

Done and running locally; **not yet deployed to Vercel**. Built: brand tokens and fonts,
`SiteHeader`, `SiteFooter`, a branded 404, the landing page (hero over background video, what FLARE
does, the five-level ladder, CTA band), and `src/lib/taxonomy.ts` (the difficulty scale and topic
list, which phase 3 reads).

Outstanding, to be cleared as later phases land:

- The header, footer, and CTAs link to `/library`, `/contribute`, and `/login`, which do not exist
  yet. They 404 until phases 2 and 3.
- `/privacy` and `/terms` are linked from the footer and 404. See §7.
- Officers are not shown anywhere. If they should return to the landing page, read them from
  `profiles` in phase 2 rather than reinstating a placeholder file.

### Phase 2 status

Done and verified against the live project. Built:
`supabase/migrations/20260829000000_profiles_and_auth.sql`, the Supabase browser/server clients,
`src/proxy.ts`, `/login`, `/auth/callback`, `/onboarding`, and `/u/[username]`. The header reflects
signed-in state.

Verified rather than assumed, by probing the project directly:

| Check | Result |
|---|---|
| Migration objects present | `profiles`, `audit_log`, `public_profiles` |
| Google enabled | yes |
| anon reads base `profiles` | `401` |
| anon reads `audit_log` | `401` |
| anon reads `public_profiles` | `200` |
| anon selects `grade` from the view | `42703 column does not exist` |
| `/dashboard` while signed out | redirects to `/login?next=/dashboard` |
| `/u/<unknown>` | `404` |
| Google handoff | correct `redirect_uri`, `scope=email profile` |

That `42703` is the point of the view: the private columns are not merely unrendered, they are
absent from the only profile surface anon can reach.

Migrations are applied with `supabase db push` against a CLI-linked project.

Decisions worth knowing:

- `audit_log` is created in this migration rather than in phase 4, because `set_user_permissions`
  cannot exist without it and section 6 makes that function part of the profiles security model.
  No videos or comments tables were touched.
- **Column privileges, not RLS, are what stop self-promotion.** `authenticated` is granted UPDATE on
  only the columns a user owns; `role`, `title`, the capability flags, and the suspension columns
  are simply not in the grant list, so Postgres rejects the write before RLS is consulted.
  `set_user_permissions` runs as owner and is the sole path to those columns.

  **INSERT needed the same treatment and originally did not have it.** `20260829000000` granted
  INSERT with no column list, and the insert policy only checks that the id is your own. An
  authenticated user with no profile row could therefore insert one with `can_manage_users = true`
  and make themselves a sponsor. The signup trigger normally creates the row first, so the insert
  collides on the primary key and the hole stays invisible; it stops being invisible the moment a
  row is missing, which is what happens when rows are cleared by hand during testing. Fixed in
  `20260830010000`. If a column is ever added that a user may write, add it to **both** grants.

- **Do not use PostgREST upsert on `profiles`.** It compiles to `INSERT ... ON CONFLICT DO UPDATE`,
  which needs UPDATE privilege on every column in the payload, including `id`. `id` is deliberately
  absent from the update grant because a primary key must never change, so an upsert fails with
  "permission denied for table profiles". Onboarding updates first and inserts only if nothing
  matched, which needs each privilege separately and never asks to update `id`.
- Usernames are immutable once `onboarded` is true, enforced by trigger. They are the key in
  `/u/[username]`, so letting them change would break every existing link to a profile.
- The signup trigger defaults `display_name` to first name + last initial from Google, which is the
  public identity section 9.2 asks for. Onboarding lets them edit it.
- **Signing in lands on `/u/[username]`, not `/dashboard`.** `/dashboard` is the natural destination
  and returns in phase 3, but it does not exist yet and dropping someone into a 404 straight after
  sign-in is not a welcome. `/login` and `/auth/callback` treat a blank `next` as "resolve the
  destination from the account": onboarded users go to their profile, everyone else to
  `/onboarding`. An explicit `next` still wins, and is rejected unless it is a same-site path, so
  the parameter cannot be used as an open redirect.

### Media assets

Masters live in `media-src/`, which is gitignored. Only encoded web versions belong in `public/`.

- **GitHub rejects any file over 100MB**, so a 4K master in `public/` breaks the first push.
- Background video is encoded to 1080p, 24fps, no audio (the element is muted, so an audio track is
  pure waste), H.264 CRF 32, `+faststart`. The 16s hero master went from 79MB to 4.7MB this way.
- Filenames in `public/` must be lowercase. Vercel serves from a case-sensitive filesystem, so
  `HERO.mp4` resolves locally on Windows and 404s in production.
- Generate a poster frame alongside any background video and set it on the element, so the first
  paint is not a black rectangle.

---

## 11. Environment

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server-only, never imported into a client component
YOUTUBE_API_KEY=                # server-only, Data API v3
```

Google OAuth: Google Cloud Console → Credentials → OAuth client (Web) → authorized redirect URI is
`https://<project-ref>.supabase.co/auth/v1/callback` → paste client ID and secret into Supabase Auth
→ Providers → Google. Add `http://localhost:3000` to authorized JS origins for local dev.

YouTube Data API: same Google Cloud project → enable "YouTube Data API v3" → create an API key →
restrict it to that API. Free quota is 10,000 units/day; a `videos.list` call costs 1 unit, so
uploads will never come close.

All schema changes go in `supabase/migrations/` as timestamped SQL files. Never change schema only
through the dashboard UI — the migration file is the record.

---

## 12. Working notes

**`create-next-app` overwrites `CLAUDE.md`.** Next 16's scaffolder writes its own agent files and
replaced this spec with a one-line `@AGENTS.md` stub during phase 1. It does this *before* running
`git init`, so the initial commit captured the stub, not the spec — there was no git copy to restore
from. The spec was restored by hand. If the scaffolder is ever re-run in this directory, back this
file up first. The `@AGENTS.md` import is kept on line 1 so the Next.js agent rules still load.
