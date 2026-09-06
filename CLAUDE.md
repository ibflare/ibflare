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
- **`can_moderate`** — edit, hide, or delete **any** video; resolve reported comments; clear anyone's
  profile picture
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

> **That escape hatch does not currently work for anyone who has ever moderated anything**, and it
> fails in a confusing way. `audit_log.actor_id` references `profiles` with no `ON DELETE` clause,
> so deleting the `auth.users` row cascades to `profiles` and is then refused with `23503`,
> "key is still referenced from table audit_log". Found by deleting a throwaway moderator account
> after a verification run.
>
> The fix is a design decision, not a typo, which is why it is recorded rather than applied:
>
> - `on delete set null` keeps the log entry and loses the actor. The record of *what happened*
>   survives; the record of *who did it* does not, which is most of the value.
> - Leaving it means audit history pins accounts in place. Defensible, arguably correct: a
>   moderation log you can erase by deleting the moderator is not much of a log. But then §2's
>   sentence above is wrong and the real answer is that officers cannot be deleted, only suspended
>   and retitled, which §2 already prefers anyway.
>
> `profiles.suspended_by` and `videos.deleted_by` have the same shape and will behave the same way.
> Decide before phase 4 builds the tools that write these rows, because every row written before the
> decision inherits it.

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
| 1 | Spark | Ages 13–14 | Assumes nothing. What a paycheck is, what a bank does with your money. |
| 2 | Ember | Ages 14–16 | Assumes a first job. Pay stubs, a simple return, how credit is scored. |
| 3 | Blaze | Ages 16–18 | Assumes earned income. Index funds, 1099 work, student loans, and aid. |
| 4 | Torch | 18 and up | Assumes introductory coursework. Monetary policy, filings, valuations. |
| 5 | Flare | College and up | Assumes study in the field. One narrow question, examined at length. |

> **Revised 3 September**, on the client's instruction, to the wording above. Levels 2 to 5 were
> previously phrased as statements about the reader ("You have a job or you're about to", "College
> level"); they now all open on what the level assumes, which is what the column is actually
> sorting by. Level 1 was already in that form and is unchanged.
>
> **The age brackets were explicitly kept as they are.** Level 1's "Ages 13–14" was set to 13 rather
> than 11 because an account was required to watch and the age screen blocks under-13 signups, so
> nobody younger could reach it. Viewing is public now, so a 12-year-old can watch Spark and the
> bracket no longer describes an access rule. The client's decision was to keep it, and it reads as
> what the level is pitched at, which is what the column means for every other row.

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

### Deleting a comment, in phase 5

**Comment deletion is soft, like everything else.** Set `deleted_at` and `deleted_by`. Never
`DELETE FROM comments`. The row stays in the table, so a sponsor opening Supabase sees the comment
and its full history rather than a gap where something used to be, and a deletion made in error is
reversible by clearing two columns.

**A moderator deleting a comment also writes an `audit_log` row that copies the evidence out as
plain text.** Not ids, not foreign keys: the comment body, the author's username, the author's
display name, the video title, and the reason, all denormalised into `detail`.

That duplication is the point, and it is worth being explicit about why, because a reviewer will
otherwise see it as sloppy schema design and normalise it away:

- `comments.author_id` and `videos.owner_id` both cascade on profile delete. Delete the account and
  the comment row goes with it, taking `deleted_at` and the whole soft-delete trail with it.
- So the `audit_log` row is the only copy that survives. An account deleted after a serious incident
  is exactly the case where the record matters most, and it is exactly the case where every
  reference-based record disappears.
- `audit_log.actor_id` is the one FK that does not cascade, which is why the log outlives the rows
  it describes. See the note in §2 about what that means for deleting an account.

Write the row inside the same transaction as the soft delete, in a definer function, so a delete
cannot succeed without its record.

```
action  'comment.delete'
target  the comment id
detail  { body, author_username, author_display_name, video_title, reason, deleted_by }
```

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

- **profiles** — view `public_profiles` exposes `id, username, display_name, title, avatar_url, bio,
  role`. The base table is readable by its owner and by `can_manage_users` holders only. Users
  update their own row but **cannot** touch `role`, `title`, or any capability flag; those go
  through a definer function that checks `can_manage_users` and writes `audit_log`.

> **The grant on this view and `REQUIRE_ACCOUNT_TO_VIEW` have to move together.** The view is
> `security_invoker = false`, so it bypasses RLS on the base table and the grant is the only thing
> guarding it: there is no policy to also adjust. The two have now moved twice, in opposite
> directions, and the history is worth keeping because each state was right for its gate:
>
> | Migration | Grant | Gate | Why |
> |---|---|---|---|
> | `20260829000000` | anon + authenticated | on | The original. A hole: page gated, data open |
> | `20260902000000` | authenticated only | on | Closed that. Contributor names off the open web |
> | `20260903000000` | anon + authenticated | **off** | Viewing is public, so the grant is the point |
>
> The middle row was a genuine finding. The anon key ships to every browser by design, so gating
> `/u/[username]` in the proxy protected the page while leaving every username, display name, title,
> bio and avatar URL readable by anyone who asked PostgREST directly. No private column ever leaked,
> since `grade`, `city` and `school` are absent from the view by construction, but the reason for
> gating profiles was to keep contributor names off the open web and the gate alone did not do it.
>
> With the gate off, the same grant is not a hole, it is the requirement: without it a signed-out
> visitor gets an empty profile page, because the server client falls back to the anon role when
> there is no session. **If viewing is ever re-gated, revoke the anon grant in the same commit.**
> What has not changed in any of the three states: the base table is unreadable by anon, and the
> private columns are absent from this view rather than merely unrendered.
- **videos** — `status='published' AND deleted_at IS NULL` readable by anon. Insert requires
  `auth.uid() = owner_id AND can_post`. Update/delete for the owner or `can_moderate`.
- **video_collaborators** — readable when the parent video is public, or by owner/invitee. Insert by
  the video owner. Update (accept/decline) by the invitee, on their own row only.
- **comments** — non-deleted comments on published videos readable by anon. Insert by any onboarded
  user. Update own within 5 minutes; delete own, or any with `can_moderate`.
- **reports / audit_log** — readable only with `can_moderate`. Insert on `reports` by any signed-in user.
- **site_settings** — readable by anon (the app needs to know if comments are on). Update requires
  `can_manage_users`.
- **storage.objects, `avatars` bucket** — public read. Insert and update require the object path to
  open with the caller's own uid, plus `is_onboarded()` and `suspended_at IS NULL`. Delete is the
  asymmetric one: your own folder on those same terms, **or** any folder with `can_moderate`.

### Profile pictures

Added after phase 2 in `20260903010000`, then opened up in `20260904010000`. The default is the
Google avatar the signup trigger stores, and **any onboarded, unsuspended account** may replace it
or remove it.

> **It was limited to `can_post` first, and the reason for that limit did not go away.** A
> user-supplied image is a moderation surface, and contributors are a known group, so restricting
> uploads to them was the cheap way to keep the surface small. Opening it to everyone was the
> client's call, and it is only safe because `20260904010000` adds the thing that was missing: a way
> to take an image down. Before that, the only person who could remove a picture was the person who
> uploaded it.
>
> **`can_moderate` can clear anyone's picture, audited.** `clear_avatar(target, reason)` is a
> definer function, because `avatar_url` on someone else's row is not writable by anybody: the
> update policy on `profiles` is owner-only. So that function is the whole mechanism, it checks the
> capability itself, and it writes an `audit_log` row with `profile.avatar_clear`.
>
> **Remove, never replace.** A moderator has no path to *setting* another person's picture, and
> `clear_avatar` deliberately does not offer one.
>
> **The object and the column come down separately.** SQL cannot reach the storage API, so
> `clear_avatar` nulls the column and the server action deletes the object straight afterwards,
> which the moderator branch of the delete policy permits. If that second step fails the object is
> orphaned but unreferenced: nothing renders it, and the owner's next upload overwrites it.
>
> **The control lives on the profile page**, not in an admin queue, because there is no admin
> surface until phase 4 and the page the image is on is where a moderator would look for it.

- **One object per user, at a fixed name:** `avatars/<uid>/avatar.webp`. An upload replaces the
  previous file rather than adding to a pile, so nothing accumulates and there is nothing to garbage
  collect. The fixed name is why the storage policies cover UPDATE as well as INSERT: `upsert`
  makes a replacement an update.
- **Everything is re-encoded to webp** at 400x400, `fit: cover`. The bucket therefore allows
  `image/webp` only. jpg and png are accepted as *input* and converted; listing them on the bucket
  would permit uploads that never come from this app.
- **The file type is read from the bytes, never the extension.** A magic-byte check runs first so an
  obviously wrong file is rejected without decoding, then sharp's own read is the authoritative
  check. `limitInputPixels` is capped at 50MP: a 2MB PNG can describe hundreds of megapixels, and
  decoding it is how a small upload becomes an out-of-memory kill.
- **`sharp` is now an explicit dependency.** It was already present as a transitive dependency of
  Next, which is not something to rely on for application code.

> **`.rotate()` is called before resizing, and `.withMetadata()` is deliberately never called.**
> Rotate applies the EXIF orientation flag, so a photo taken sideways is not stored sideways, and it
> has to come first because afterwards the dimensions are already swapped. Dropping metadata is the
> default and is wanted here for a privacy reason as well as a size one: a phone photo carries EXIF
> GPS coordinates, and section 9.3 forbids collecting a street address. Adding `withMetadata()`
> would quietly start storing the coordinates of a student's bedroom.

> **The `profiles_avatar_url_allowed` constraint is what makes the rest mean anything.**
> `avatar_url` is in the UPDATE grant for `authenticated`, so without it any signed-in user can
> `PATCH` the column to an arbitrary string through PostgREST: an offsite tracking pixel, a
> hotlinked image, anything. Restricting which folder someone may upload into is worth nothing while
> the column itself accepts any URL. The constraint allows exactly three things: NULL, a
> `googleusercontent.com` URL, or an object in this bucket. **If a new avatar source is ever added,
> widen the constraint in the same commit as the code that writes it.**

> **Removal is not a revert.** It sets `avatar_url` to NULL and renders initials; it does not restore
> the Google URL. Someone removing their photo is asking for no photo.

> **Google avatar URLs expire, so every avatar render site needs an `onError` fallback.** They stop
> resolving when someone changes their Google photo, and the profile row keeps the dead URL until
> that person next signs in. `src/components/Avatar.tsx` is the single component every avatar goes
> through for this reason: initials have to be reachable from a *load failure*, not only from a null
> `avatar_url`. Do not render an avatar with a bare `<img>` or `next/image`; phases 3 to 5 add
> bylines and comment avatars and they all go through `Avatar`.

> **Cache busting is load-bearing.** The public URL of a replaced object is the same string, and it
> is served with a one-year `cacheControl`, so `avatar_url` carries a `?v=<timestamp>`. Without it a
> new picture does not appear. The constraint matches on the prefix, so the query string is fine.

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
/our-mission            Why FLARE exists. In the nav for signed-out visitors only
/contribute             How to upload to YouTube and post here. In the nav for signed-in accounts only
/login                  Sign in or create an account: Google, or email and password
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
> **The privacy policy and the viewing gate have to move together, and both have now moved twice.**
> The "who can see what" table is the precise statement of who sees what, so it has to be edited in
> the same commit as the gate. Its history:
>
> | Date on the policy | Profile and content rows | Gate |
> |---|---|---|
> | 29 August | "Anyone" | off |
> | 30 August | "Anyone with an account" | on |
> | 3 September | "Anyone, including people without an account" | **off** |
>
> The current wording is deliberately explicit rather than just "Anyone", because the sentence a
> student needs to understand is that a stranger with no account can read their bio and watch their
> videos. The date bump is required by the policy's own Changes section, which promises a new date
> whenever who-can-see-what changes.
>
> **The prose elsewhere in both documents says "public"** in several places: "Username and display
> name. These are public", "Bio and profile picture ... public if you provide them", "Comments are
> public", and clause 3 of the terms. Under the gate that was arguably loose. With viewing public it
> is simply correct, so it needed no edit this time. Re-gating would make it loose again.
>
> **One gap the gate change opens.** The terms say the reader agrees to them by creating an account.
> A signed-out visitor now uses the whole library without ever creating one, so nothing binds them
> to the terms. That is ordinary for a public website, and fixing it is a wording question for
> whoever reviews these documents, not a code change.

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

`/login`, `/onboarding`, `/auth/*`, and `/account-unavailable` render without the footer: it is a
site-wide navigation surface, and three columns of links plus a liability notice under a form asking
for a date of birth is noise. The list is in `ConditionalFooter`.

`/login` additionally has no header, being one task with one exit. The list is in
`ConditionalHeader`, which takes `SiteHeader` as children because that component is an async server
component and cannot read the pathname itself. A route group with its own bare layout is the cleaner
structure and would also remove the `4rem` header assumption baked into the root layout's `main`
height; worth doing if either list grows.

Because the header carries the only way home, any page that drops it has to provide one. `/login`
puts the lockup in its left panel above `lg`, and a wordmark above the form below it.

**The nav depends on the session.** Signed out it is Library, Our mission, Sign in; signed in it is
Library, Contribute, Sign out. `/our-mission` answers a question a member has already answered, and
`/contribute` is instructions for a thing a visitor cannot do yet, so neither appears in the other
state and the nav stays three items wide. `SiteFooter`'s second column follows the same split, which
is why it is an async server component now rather than a static one.

> **`ConditionalFooter` takes `SiteFooter` as children**, mirroring `ConditionalHeader`, and for the
> same reason. It imported it directly while the footer was static. The moment the footer needed the
> session it became an async server component reading `next/headers`, and a client component cannot
> render one of those: the build fails with "you are using it in the Pages Router", which is a
> confusing way to say the child was treated as client code.

> **Profile is no longer in the nav**, on the client's instruction, and the cost is worth recording:
> a signed-in member now has no route from the chrome to their own profile, which is where the
> picture upload lives. The header's username lookup was removed with it, since it existed only to
> build that link.

**Below `sm` the header is a centred wordmark and a three-line button.** `MobileNav` opens a
full-height `paper` panel holding every nav link, Profile, and the sign-in or sign-out control. It
exists because the narrow header had room for one nav link and had already dropped `/contribute` and
Profile to fit, which meant the two links a signed-in contributor most needs were the two that
disappeared. From `sm` up nothing changes: the wordmark goes back to the left and the inline nav
returns.

> **The panel is portalled to `document.body`, and it has to be.** The header carries
> `backdrop-blur-sm`, and `backdrop-filter` makes an element a containing block for fixed-position
> descendants exactly the way `transform` does. Rendered inside the header, the panel's `fixed`
> resolved against the `4rem` header instead of the viewport, so `top-16 bottom-0` collapsed it to a
> strip across the top of the page with the content still visible underneath. This is worth
> remembering before adding any other fixed overlay: the header is not a neutral ancestor.

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
--ember      #F0B429   accent and focus states
--hot        #E8622C   the hottest accent
```

**The difficulty ramp**, one hue per level, cool to hot:

```
--level-1    #17726A   teal      Spark
--level-2    #3F7D2E   green     Ember
--level-3    #9C7A0E   gold      Blaze
--level-4    #D2701A   orange    Torch
--level-5    #C2371B   red       Flare
```

> **Changed after phase 2.** This section originally read "ember ONLY on difficulty 4-5 markers and
> focus states, hot difficulty 5 only", which meant levels 1 to 3 were all drawn in ink and looked
> identical. The client asked for five distinguishable levels reading novice to advanced, so the
> ramp above replaces that rule.
>
> The ramp values are deepened relative to `--ember` and `--hot` deliberately. Those two are accent
> colours for marks and fills; as *text* on `--paper-deep`, `#F0B429` sits near 1.9:1 and is
> illegible. Every ramp value clears 3:1, the threshold at this size and weight.
>
> `difficultyAccent()` in `src/lib/taxonomy.ts` is the single place this mapping lives. Numeral and
> level name take the colour; the audience and description stay in ink, since they are prose and
> want legibility rather than identity.

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

   **Decided: watching is public. An account is only needed in order to contribute.**
   `REQUIRE_ACCOUNT_TO_VIEW` in `src/proxy.ts` is `false`, and `20260903000000` restores the anon
   grant on `public_profiles` that the gate required. `/library`, `/v/[id]` and `/u/[username]` are
   open; `/dashboard` and everything under it still requires an account, as does posting or
   commenting, both of which need an onboarded profile.

   This replaces the previous arrangement, which gated all three and is described below only because
   the reasoning still applies if it is ever reinstated. Under it, an under-13 could not pass the age
   screen, so could not hold an account, so could not watch anything, including Spark, the level
   written for the youngest readers. That was recorded as the open question. It is now answered: a
   free financial literacy library for a public school district should not be behind a login.

   **Under-13 visitors can watch, and still cannot participate.** They cannot pass the age screen,
   so they cannot hold an account, so they cannot post or comment. Nothing is collected from them,
   because nothing is collected from anyone who is only reading.

   **Loose end from the reversal.** Level 1 is currently labelled "Ages 13–14" in section 3 and in
   `DIFFICULTY_LEVELS`, and it was relabelled to that specifically because no one younger could
   reach it. They can now. The label is client copy deck wording, so it has been left alone rather
   than changed unasked, but it is now describing a restriction that no longer exists.

   **Re-gating means two edits, not one.** The constant, and revoking
   `grant select on public.public_profiles to anon`. Section 6 has the table of which state went
   with which gate. No page component contains an auth check of its own, deliberately, so those two
   are the whole mechanism.

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

   **This means the database will retain content written by accounts that no longer exist.** §4's
   deletion rule copies a deleted comment's body, the author's username and display name, the video
   title and the reason into `audit_log` as plain text, precisely so the evidence survives the
   account being deleted and the comment row cascading away. `audit_log.actor_id` does not cascade,
   so the log outlives the people in it.

   That is the right call for moderation and it is a real retention claim, so it cannot be left
   implicit:

   - **The privacy policy has to say so before comments ship.** Its retention section currently
     promises only that we keep an account "for as long as your account is open". A deleted comment
     quoted verbatim in a moderation log, still readable after the author's account is gone, is not
     covered by that sentence and contradicts the reasonable reading of it.
   - The retention is deliberately narrow: a comment that a moderator deleted, not every comment.
     Nothing is copied out of a comment that is simply sitting there, and nothing is copied when an
     author deletes their own.
   - Say who can read it, which is `can_moderate` only, and say that it is kept as a disciplinary
     record rather than as site content.

   Whoever reviews the legal documents needs this in front of them, since it is the one place where
   the site keeps a minor's words after that minor has asked to be gone.
7. **Profile pictures ship with a takedown path or they don't ship.** Uploading is open to every
   onboarded account as of `20260904010000`, which means the site now accepts arbitrary images from
   minors. That is only defensible because `can_moderate` can clear anyone's picture and the removal
   is audited. If the takedown path is ever removed, close uploads in the same commit. §6 has the
   mechanism.

   **Nothing about the uploader's device is kept.** Every upload is re-encoded, and `sharp` drops
   metadata unless asked to keep it, so EXIF does not survive. That is a privacy measure and not
   only a size one: a phone photo carries GPS coordinates, and rule 3 forbids collecting a street
   address. Storing a student's bedroom coordinates because nobody thought about EXIF would break
   that rule by accident. **Never add `withMetadata()`.**

   `.rotate()` is called before resizing, which reads the EXIF orientation flag and applies it, so
   dropping the rest of the metadata does not leave sideways photos.

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

Done, and deployed to Vercel at **https://ibflare.vercel.app**. Built: brand tokens and fonts,
`SiteHeader`, `SiteFooter`, a branded 404, the landing page (hero over background video, what FLARE
does, the five-level ladder), and `src/lib/taxonomy.ts` (the difficulty scale and topic list, which
phase 3 reads).

The CTA band this section used to list was removed in `75aac97`. The landing page ends on the
ladder.

Outstanding, to be cleared as later phases land:

- The header, footer, and CTAs link to `/library`, `/contribute`, and `/login`. All three now exist:
  `/login` landed in phase 2, `/contribute` was built at the phase 2/3 boundary ahead of its phase
  because it is static and had no dependencies, and `/library` landed with phase 3. The footer's
  `/library?difficulty=1` link works as a real filter now rather than a dead parameter.
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
| anon reads `public_profiles` | `200` at the time. Now `401`, see below |
| anon selects `grade` from the view | `42703 column does not exist` |
| `/dashboard` while signed out | redirects to `/login?next=/dashboard` |
| `/u/<unknown>` | `404` |
| Google handoff | correct `redirect_uri`, `scope=email profile` |

That `42703` is the point of the view: the private columns are not merely unrendered, they are
absent from the profile surface, rather than present and unrendered. That still holds for
`authenticated`, which is now the only role that can read the view at all.

The `200` on the fifth row was recorded as correct and later judged to be the phase 2 audit's
first finding. It is now `401`, and the note in section 6 explains why the row is left here rather
than quietly corrected: the check was right, the expectation was wrong.

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

### Phase 2 audit, and what it changed

An audit at the phase 2/3 boundary drove `20260902000000_close_profile_findings.sql`. Three findings,
one theme: each was a rule the application enforced and the database did not.

- **`public_profiles` was granted to anon.** The proxy gated the page; the grant left the data open.
  Fixed by revoking it, then deliberately restored a day later in `20260903000000` when the club
  decided viewing should be public, which makes the grant correct rather than a hole. The finding
  was still real: the two had to be made to agree, and they now do. Section 6 has the full table.
- **The reserved username list lived only in the server action**, so a test account was renamed to
  `flare` straight through PostgREST. It is now `is_reserved_username()` in the database, backing a
  check constraint on the column, and `src/app/onboarding/actions.ts` calls that function instead of
  keeping a second copy of the list. Two consequences worth knowing:
  - **The signup trigger consults the same function.** It derives a username from the email
    local-part, so without this an address like `admin@lamaracademy.org` would derive `admin`, fail
    the constraint, and roll back the `auth.users` insert that fired the trigger. That is signup
    failing outright for that person. Reserved candidates get a numeric suffix, exactly like a
    collision.
  - **Exact matches only.** Substring matching would reject the club's own `ibflare` account and
    every real name containing a reserved word. Same trade section 4 makes for the comment filter.
  - Editing the list changes the constraint without revalidating existing rows. Adding a name does
    not rename whoever already holds it.
- **`onboarded` implied the consent stamps and nothing else**, so `attest_age` then `accept_terms`
  then `PATCH onboarded=true` produced an onboarded account with a null `grade`. Phase 3 will read
  `onboarded` as meaning the profile is complete, so
  `profiles_onboarded_requires_profile` now requires `grade`, `city` and `school` to be present and
  non-blank. It is a second constraint rather than an edit to
  `profiles_onboarded_requires_consent`, so a violation says which half is missing.

> **`city` and `school` became required fields, which is a change in what we collect from minors.**
> They were optional in the onboarding form and are now mandatory, because the constraint above
> cannot be satisfied without them. Both are still private under rule 9.1, still city-only under
> rule 9.3, and the completeness requirement is what phase 3 wanted. But the honest description is
> that FLARE now requires two more pieces of information from every student before they can use the
> site, where before it asked. If that is the wrong trade, the lever is the constraint, not the
> form: drop `city` and `school` from `profiles_onboarded_requires_profile` and make the fields
> optional again in the same commit.

### Phase 3 status

Built: `supabase/migrations/20260904000000_videos.sql`, `src/lib/youtube.ts`,
`/api/youtube`, `/dashboard/upload`, `/library`, `/v/[id]`, `src/components/VideoCard.tsx`, and
`supabase/seeds/seed_videos.sql`.

Decisions worth knowing:

- **`public_videos` exists for the byline.** A card needs the owner's display name, the base
  `profiles` table is not readable by anon, and PostgREST cannot embed `public_profiles` because a
  view has no foreign key to follow. So the join is done once in a view, filtered to published and
  non-deleted, `security_invoker = false`, granted to anon. Same arrangement and same warning as
  `public_profiles`: a column added here is public.
- **A draft is invisible through that view, even to its owner.** Correct while nothing renders
  drafts. The phase 4 dashboard reads the base table, where the owner policy already allows it.
- **The resolver runs twice, and the second time is the one that counts.** `/api/youtube` resolves
  on paste to prefill the form; `createVideo` resolves again on submit. The id, thumbnail and
  duration all arrive in a request anyone can forge, and re-resolving is also the only way to know
  the video is still public and still embeddable at the moment of publishing rather than at the
  moment of pasting. The title is the one field taken from the form, because §5 says the
  contributor may edit it.
- **`/api/youtube` is gated on `can_post`.** It spends a unit of the 10,000 per day quota per call,
  so leaving it open would hand a stranger the ability to exhaust it.
- **There is no DELETE policy on `videos`.** Deletes are soft per §3, so nothing should ever issue
  `DELETE FROM videos` and no policy permits it. `deleted_at` and `deleted_by` are absent from the
  column grants too, so the soft delete has to go through the audited path phase 4 adds.
- **`view_count` has no writer.** Incrementing it on a public page needs a definer function and a
  write on every read; deferred rather than done badly.
- **The player mounts nothing until clicked.** §5's thumbnail-first rule, and the reason is weight:
  a YouTube embed pulls several hundred KB and sets cookies the moment it exists.

> **The upload form is at `/dashboard/upload` but `/dashboard` itself does not exist.** §7 puts it
> there and the proxy already gates the whole prefix, so the route is right; the index page around
> it is phase 4. Until then the form is reached from `/contribute` or by URL, and a visitor who
> types `/dashboard` gets a 404.

Deferred to phase 4 by design, not oversight: collaborators and the multi-name byline, the admin
surfaces, and the soft-delete path. Comments on `/v/[id]` are phase 5 and ship with the moderation
stack or not at all.

### Media assets

Masters live in `media-src/`, which is gitignored. Only encoded web versions belong in `public/`.

- **GitHub rejects any file over 100MB**, so a 4K master in `public/` breaks the first push.
- Background video is encoded to 1080p, 24fps, no audio (the element is muted, so an audio track is
  pure waste), H.264 CRF 32, `+faststart`. The 16s hero master went from 79MB to 4.7MB this way.
- Filenames in `public/` must be lowercase. Vercel serves from a case-sensitive filesystem, so
  `HERO.mp4` resolves locally on Windows and 404s in production.
- Generate a poster frame alongside any background video and set it on the element, so the first
  paint is not a black rectangle. Use frame 0 where the footage does not fade in, so the poster
  matches the first played frame instead of cutting to a different one. A poster sitting behind a
  scrim can be encoded well below the video's resolution, since no detail survives the scrim:
  `signinup-poster.jpg` is 854x480 at quality 62, and 81KB against the frame's 357KB at full size.

There are two background videos. The landing page uses `hero.mp4`; `/login` uses `signinup.mp4`,
which is its own footage rather than the hero reused, so it is a second download rather than a
cache hit.

### App icons

Next emits the `<link>` tags from the filenames alone, so there is no markup to maintain. Both
current files are built from the same client-supplied 180x180 artwork.

| File | Covers |
|---|---|
| `src/app/apple-icon.png` | 180x180, iOS home screen. The client's file unmodified. Opaque RGB, which iOS requires: it flattens a transparent icon onto black, and it applies its own rounding, so do not round this one |
| `src/app/favicon.ico` | 16, 32 and 48 packed, corners rounded. Tabs, legacy, the bare `/favicon.ico` request, and Google's "multiple of 48px square" rule |

**The favicon's corners are rounded at 20%, with transparency outside the curve.** A hard white
square reads as harsh against a dark tab strip. Transparency is fine here, unlike the Apple icon.

Two things about how it is generated, both of which matter if it is ever rebuilt:

- **Each size is masked at 8x and then reduced.** A 3px radius drawn directly at 16px is a
  staircase rather than a curve.
- **The inset varies by size: 0.90 at 16, 0.84 at 32, 0.80 at 48.** A fixed inset spends the same
  *fraction* on empty border at every size, and at 16px a 20% border is 3 of 16 pixels bought with
  the pixels that were making the F legible. Smaller tiles get a larger mark.

Still true, and not fixable by resampling: **at 16px the flame and the dollar sign collapse into
noise.** The small entries want a simplified drawing, the F alone or the flame alone. A favicon at
16px is a different piece of artwork, not the same one shrunk.

> **The artwork entering a corner box does not mean a rounded mask clips it.** The source runs to
> within 2px of the bottom edge, and a coarse "is there ink in the corner square" check said three
> of four corners would clip. Testing it properly, by applying a real 22% rounded mask and counting
> the dark pixels it actually removes, gives zero: the ink sits inside the curve. That is why
> `apple-icon.png` is the client's file untouched rather than an inset version of it. At a harsher
> 30% radius it loses 6 pixels, which is nothing.

Still missing: `icon.svg`, and `icon-192`/`icon-512`/a maskable variant in `public/icons/` with a
`src/app/manifest.ts` to reference them. Without a manifest the Android and PWA sizes do nothing,
and Android crops to the launcher's shape, so a maskable variant needs its artwork inside the
centre 80% circle.

### Link previews

Not the same thing as favicons, and not driven by them: iMessage, WhatsApp, Instagram, Discord and
Slack read Open Graph tags. `layout.tsx` sets them, with the share image at
`public/images/flare1200630.png`, 1200x630.

Referenced through `metadata.openGraph.images` rather than the `src/app/opengraph-image.png` file
convention, so the file the client uploaded stays the only copy. Both routes work; the convention
would mean a second 171KB binary in the repo to keep in step.

Three things worth knowing:

- **`metadataBase` has to be the real deployed origin.** Every relative URL in the metadata object
  resolves against it, so the share image becomes absolute from that value. It read
  `https://flare-rgv.vercel.app` until 3 September, which is not this site and answers 404, so a
  shared link pointed every scraper at a dead host. It is now `https://ibflare.vercel.app`, and it
  changes again when there is a real domain, in the same commit as the privacy policy's
  `flare.example.org` placeholder.
- **`twitter:card` is not implied by having an image.** Without `card: "summary_large_image"` X
  renders a small square thumbnail beside the text rather than the wide image. There is no separate
  `twitter-image` file, because X falls back to `og:image` and Next fills in `twitter:image` from it.
- **`og:image:width` and `og:image:height` are declared, not inferred.** A scraper that has not
  downloaded the file yet uses them to lay the card out, and some render nothing without them.

Two compromises in the current share image, both design choices rather than bugs:
- Its background is a bright green gradient, which is not in the `@theme` palette. `--ink` on
  `--paper` would match the rest of the site.
- The lockup runs close to the left and right edges. Clients that crop a share image toward square,
  which some chat apps do for small thumbnails, will cut the outer letters. Keeping the lockup
  inside the middle two thirds survives that crop.

> **`signinup.mp4` has not been through the encode recipe above.** It is 11.5MB against `hero.mp4`'s
> 4.9MB, is 25fps rather than 24, and still carries an AAC audio track that can never play because
> the element is muted. Re-encoding it to 1080p, no audio, CRF 32, `+faststart` should put it near
> 4MB. Outstanding.

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

> **Supabase Auth → URL Configuration is the other half of this, and getting it wrong looks like a
> code bug.** Two fields, and both matter once the site is deployed:
>
> | Field | Value |
> |---|---|
> | Site URL | the deployed origin, `https://ibflare.vercel.app` |
> | Redirect URLs | `https://ibflare.vercel.app/**` and `http://localhost:3000/**` |
>
> **Supabase substitutes the Site URL when a `redirectTo` is not in the allowlist. It does not
> error.** So a `redirectTo` of `<origin>/auth/callback` that is not allowlisted silently becomes
> the Site URL, and the visitor lands on `/?code=...` with nothing there to exchange the code. If
> the Site URL is still `http://localhost:3000` while the site is deployed, every signed-in visitor
> is sent to their own machine, where nothing is listening. That was the state after the first
> Vercel deploy.
>
> Both entries need the `/**` wildcard, because the app appends `?next=` to the callback and an
> exact-match entry will not cover it. Add the preview wildcard
> `https://ibflare-*.vercel.app/**` as well if branch deploys need to sign in.
>
> `src/proxy.ts` catches a stray `?code=` or `?token_hash=` on any non-`/auth` route and forwards it
> to the right handler, which covers the case where the fallback lands on the right host but the
> wrong path. It cannot cover a Site URL pointing at a different host, since the request never
> reaches the app.

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
