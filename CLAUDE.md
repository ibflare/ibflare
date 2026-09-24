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
>    verification. An email/password signup asks nobody's age. That was answered with the app's own
>    age screen, and then that screen was removed too on 16 September, so the statement is once
>    again simply true: nothing anywhere asks how old a visitor is. See §9.4.

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

> **Known bug, not yet fixed: `/auth/confirm` verifies the token but cannot sign anybody in.**
> It is a server component page, and a server component cannot write cookies, so the session that
> `verifyOtp` (or `exchangeCodeForSession`) returns is swallowed by the `try/catch` in
> `src/lib/supabase/server.ts`. That catch is correct everywhere else, and its comment says the
> write is "redundant rather than load-bearing" because `proxy.ts` refreshes the session on every
> request. On this one route it is load-bearing: the proxy refreshes an *existing* session, and
> there is none yet.
>
> The visible effect is bounded, which is why it has not been treated as urgent: the account really
> is confirmed at Supabase, and the visitor lands on `/login?next=/onboarding` instead of being
> carried into onboarding. They sign in with their password and continue. For a passwordless
> magic-link flow it would be a total failure, and FLARE does not use one.
>
> The fix is structural rather than a patch: the `token_hash` and `code` branches belong in a route
> handler, which may set cookies, leaving a page behind only for the fragment case that has to be
> finished in the browser.

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

Suspend is reversible and is the default response. Deleting an account is not offered in the UI. For
a regular account it happens in the SQL editor with a sponsor present, and it works normally.

### An account that has written to `audit_log` cannot be deleted, and that is intentional

`audit_log.actor_id` references `profiles` with no `ON DELETE` clause. Deleting the `auth.users` row
cascades to `profiles` and is then refused with `23503`, "key is still referenced from table
audit_log". `profiles.suspended_by` and `videos.deleted_by` are the same by the same decision.

**`site_settings.updated_by` is the one exception, and it is `ON DELETE SET NULL`.** It was the
fourth column with this shape, found by a delete failing with `23503` after a verification run. It
is not a record of anything: it says who touched the settings row most recently, and the accountable
version of that fact is already an `audit_log` row. Keeping a whole account undeletable to preserve
a duplicate pointer is the tail wagging the dog. Changed in `20260907000000`.

**The log itself does not depend on that pointer, or on any live account.** `audit_log` carries
`actor_username` and `actor_display_name` as text, stamped by a `before insert` trigger at write
time. "Aryan N. turned comments off" reads that way permanently, whether or not that account still
exists.

> **This was not true until `20260907000000`.** `read_audit_log` resolved the actor by joining
> `profiles` on `actor_id`, so the log read a live account on every request. Three ways that goes
> wrong, and only the third is about deletion:
>
> - **A display name is editable.** Somebody who acts as "Aryan N." and later renames themselves
>   rewrote the entire history of what they did, because a live join shows the current name rather
>   than the name they acted under. This is the one that would have bitten first and silently.
> - **A null `actor_id`** from any future path loses the actor completely instead of degrading to a
>   name.
> - **It made the log's correctness rest on a foreign key kept for a different reason.** Two
>   unrelated requirements leaning on one constraint is how one of them quietly breaks when the
>   constraint is revisited for the other.
>
> The join is now gone entirely rather than kept as a fallback. A fallback would mean the log still
> resolves a live account under some conditions, and "under some conditions" is not something anyone
> can reason about a year later.
>
> **It is stamped by a trigger rather than by each function.** There were seven `audit_log` inserts
> across three migrations and phase 5 adds at least one more for `comment.delete`. Editing each is
> seven chances to forget and no cover for the eighth. Stamping at the table means every writer is
> covered, including the ones that do not exist yet.

**Decided, not inherited.** The alternative was `on delete set null`, which keeps the log entry and
drops the actor. That was rejected: a moderation record that says something was deleted but not who
deleted it is most of the way to no record at all, and the moment it matters most is exactly the
moment someone would want the name gone. So the log stays fully attributed and the accounts named in
it stay put.

What follows from it:

- **Officers and sponsors are suspended and retitled, never deleted.** §2 already prefers that: the
  end-of-term path is unticking the capability boxes and setting the title to "Former Vice
  President", which keeps the person, their account, and the attribution on everything they did.
- **A regular account deletes normally.** Viewers and members never write to `audit_log`, so nothing
  references them and the cascade completes. The constraint only bites once someone has acted as a
  moderator.
- **Granting `can_moderate` is therefore a one-way door in practice.** The first moderation action
  that account takes makes it permanent.

> **Built in phase 4.** `/dashboard/admin/people` says this at the moment of granting: ticking "Can
> edit and delete other people's videos" reveals a line under the checkbox saying that once this
> person moderates anything their account can be suspended but not deleted, so the record of what
> they did stays attributed.
>
> It appears only on the transition, when the box is being ticked and was not already ticked. A
> warning that is always on screen is furniture; one that appears in response to the click is about
> the decision being made. It belongs at the point of the decision rather than in a help page,
> because the sponsor doing this is a teacher who will not read a help page and should not have to.

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
> than 11 because an account was required to watch and the age screen blocked under-13 signups, so
> nobody younger could reach it. Viewing is public now, so a 12-year-old can watch Spark and the
> bracket no longer describes an access rule. The client's decision was to keep it, and it reads as
> what the level is pitched at, which is what the column means for every other row.
>
> Both halves of that reasoning have since lapsed: the gate went on 3 September and the age screen
> itself went on 16 September, so "Ages 13–14" now describes nothing but the pitch. Which is what it
> always meant for rows 2 to 5, so the label is finally consistent rather than newly wrong.

Topics (enum): `taxes`, `banking`, `credit`, `investing`, `career`, `macro`, `micro`, `corporate`,
`other`.

> **`other` was added 24 September**, on the client's instruction. Without it a contributor whose
> piece fits none of the eight has to file it under the nearest wrong one, and a reader filtering by
> "banking" is worse served by something that is not about banking than by an honest "Other".
>
> **The list lives in three places and they have to move together:** `TOPICS` in
> `src/lib/taxonomy.ts` is what the form offers, and `videos_topic_valid` and `articles_topic_valid`
> are what the database accepts. Widening only the first puts an option in the select box that every
> insert then refuses with `23514`, at the moment of publishing. `20260924000000` does the other two.
> `TOPIC_LABELS` is the fourth: a key missing there renders as a blank filter pill.

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
  city              text,      -- PRIVATE. City only, never an address. Optional
  school            text,      -- PRIVATE. Optional
  -- birth_year and age_attested_at were dropped with the age screen, see §9.4
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

-- Written explainers, added 23 September. Mirrors videos deliberately: same
-- difficulty ladder, same topic enum, same draft/published/hidden, same soft
-- delete. See the articles status section for the three decisions behind it.
articles (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,               -- the summary shown on a card
  body          text not null,      -- PLAIN TEXT. Never markdown, never HTML
  difficulty    smallint not null check (difficulty between 1 and 5),
  topic         text not null,
  owner_id      uuid not null references profiles on delete cascade,
  status        text not null default 'published',  -- draft|published|hidden
  view_count    integer not null default 0,
  created_at    timestamptz not null default now(),
  published_at  timestamptz,
  edited_at     timestamptz,
  deleted_at    timestamptz,
  deleted_by    uuid references profiles,
  search_tsv    tsvector generated always as (
                  to_tsvector('english', coalesce(title,'') || ' ' ||
                    coalesce(description,'') || ' ' || coalesce(body,''))
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
  edited_at   timestamptz,            -- set by the 5-minute edit; renders ", edited"
  deleted_at  timestamptz,
  deleted_by  uuid references profiles
)

reports (
  id           uuid primary key default gen_random_uuid(),
  comment_id   uuid references comments on delete cascade,
  reporter_id  uuid not null references profiles,
  reason       text,
  status       text not null default 'open',   -- open|resolved|dismissed
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,           -- set by resolve_report and by a moderator delete
  resolved_by  uuid references profiles
)

audit_log (
  id                 bigserial primary key,
  actor_id           uuid references profiles,   -- no ON DELETE: pins the account, see §2
  actor_username     text,      -- stamped by trigger at write time, never resolved live
  actor_display_name text,      -- ditto. A display name is editable; history is not
  action             text not null,  -- 'video.delete', 'user.permissions', 'comment.delete', ...
  target             text,      -- id or username of the thing acted on
  detail             jsonb,     -- before/after for permission changes
  created_at         timestamptz not null default now()
)

-- exactly one row, id = 1. The kill switches live here so they can be flipped
-- from the admin panel without a deploy.
site_settings (
  id                 smallint primary key default 1 check (id = 1),
  comments_enabled   boolean not null default true,
  signups_enabled    boolean not null default true,
  updated_by         uuid references profiles on delete set null,  -- the exception, see §2
  updated_at         timestamptz not null default now()
)
```

Indexes: GIN on `videos.search_tsv`; btree on `videos(difficulty)`, `videos(topic)`,
`videos(owner_id)`, `videos(status, published_at desc)`, `comments(video_id, created_at)`.

**Deletes are soft.** Set `deleted_at` and `deleted_by`; never `DELETE FROM videos`. Deleted rows
disappear from every public query but stay recoverable, and moderators can see them in the admin
panel. Write an `audit_log` row for every delete, permission change, and role change.

> **`videos_delete_complete` enforces that the two columns move together.** Setting `deleted_at`
> without `deleted_by` is refused with `23514`. Worth knowing before writing a fixture or a repair
> by hand: a soft delete is both columns or neither, so there is no such thing as a video that is
> deleted by nobody.

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
  it describes. That is a decision rather than an oversight, and §2 records what it costs: an
  account that has written to the log cannot be deleted at all.

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
  role`, for onboarded accounts only. The base table is readable by its owner and by
  `can_manage_users` holders only. Users update their own row but **cannot** touch `role`, `title`,
  any capability flag, or `onboarded`; those go through definer functions
  (`set_user_permissions`, `complete_onboarding`) that check what they need to and write `audit_log`
  where a record is owed.

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
- **articles** — `status='published' AND deleted_at IS NULL` readable by anon. Insert and update both
  require `auth.uid() = owner_id AND can_post AND NOT suspended`, **and the body, title and
  summary must all pass `comment_is_clean()`**, because an article is user-submitted text in
  exactly the sense a comment is. Moderators may update any. No DELETE policy: `soft_delete_article`
  and `restore_article` are the path, both audited.
- **video_collaborators** — readable when the parent video is public and the row is `accepted`, or
  by the owner, the invitee, or a moderator. **No write policies and no write grants:** insert,
  accept, decline and untag all go through the definer functions in `20260906000000`. See the phase
  4 status note for why relationship rules do not fit column grants.
- **comments** — non-deleted comments on published videos readable by anon. Insert by any onboarded
  user, and the body must pass `comment_is_clean()`. Update own within 5 minutes, same body check;
  delete own, or any with `can_moderate`.
- **reports / audit_log** — readable only with `can_moderate`. Insert on `reports` by any signed-in user.
- **site_settings** — readable by anon (the app needs to know if comments are on). **No update
  policy and no update grant:** `set_site_settings` is the only path, so every flip is audited and
  `updated_by` cannot be forged. A kill switch nobody can attribute is a kill switch nobody is
  accountable for.
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
`comments`, and `video_collaborators` also requires `suspended_at IS NULL` on the acting profile.
Hiding a button is not enforcement. Likewise, the comments insert policy checks
`site_settings.comments_enabled` — the kill switch has to hold even if someone hits the API directly.

> **`reports` is the exception, and this sentence used to include it wrongly.** There is no insert
> policy on `reports` at all, and no insert grant: `report_comment` is the only path. So there was
> nothing to carry the suspension requirement, and the function did not check it either. A suspended
> account could file reports until `20260914000000`, which is exactly the spam channel suspension is
> meant to close, since §2 calls it "the fast lever for a spammer".
>
> **The general shape of the mistake is worth more than the bug.** Where a write goes through a
> definer function rather than a policy, prose about "every insert policy" describes nothing. Two
> functions had drifted this way, and `flag_blocked_comment` was the worse of the two: it checked
> only that the caller was signed in, so any authenticated account, onboarded or not, suspended or
> not, could write arbitrary text into `audit_log` and into the officer queue's "Blocked before
> posting" panel. Both were found by calling them from a real session, not by reading the policies,
> which is the only way this class of gap shows up.
>
> **When a table's writes move behind a definer function, the guards move with them.** The function
> is then the whole enforcement surface; there is no policy standing behind it.

---

## 7. Routes

```
/                       Landing. Mission, what FLARE does at Lamar Academy, difficulty ladder, CTA
/library                Browse. Search + difficulty + topic filters. Server-rendered, paginated
/v/[id]                 Video page. Embed, byline with collaborators, comments
/a/[id]                 Article page. Plain-text body, byline. No comments yet, see below
/u/[username]           Public profile. Name, title, bio, their videos. No grade/city/school
/our-mission            Why FLARE exists. In the nav for signed-out visitors only
/contribute             How to upload to YouTube and post here. In the nav for signed-in accounts only
/login                  Sign in or create an account: Google, or email and password
/onboarding             First run: username, display name, grade, birth date. School and city optional
/dashboard              Own videos, drafts, pending collaboration invites
/dashboard/upload       Gated on can_post
/dashboard/write        Gated on can_post. Write an article
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
>   `grade`, `city` and `school` from minors, so that review matters. **The same review has to add a
>   13-and-over requirement**, because the age screen was removed on 16 September and nothing in the
>   product states the rule any more. §9.4 has what the wording needs to cover.
> - Both documents still describe a birth date being collected. They do not collect one now.
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

`/login`, `/onboarding`, and `/auth/*` render without the footer: it is a site-wide navigation
surface, and three columns of links plus a liability notice under a sign-up form is noise. The list
is in `ConditionalFooter`. `/account-unavailable` was a fourth entry until 16 September; the page
existed only for someone deleted by the age screen and went with it.

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

> **Profile was dropped from the nav and is back as of phase 4**, as a fourth item for signed-in
> accounts only. Dropping it left a member with no route from the chrome to their own profile, which
> is where the picture upload lives and where the moderator takedown control sits, so the only way
> there was typing the URL. The header pays for one profile lookup per signed-in request again, and
> reads `suspended_at` from the same row rather than querying twice.

> **The suspension banner lives in the header.** Section 2 says a suspended user sees a banner
> explaining what happened and who to talk to. Nothing redirects them: they can still sign in and
> watch, so the notice has to travel with them across every page, which means the chrome rather than
> a page. It sits inside the sticky header so it cannot be scrolled past.

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
   ~~Superseded. The app now runs its own age screen.~~
   **Superseded twice. There is no age screen. The site does not ask anybody's age.**

   Removed on the client's instruction, 16 September, in `20260916000000`. Gone: the birth month
   and year selects, `attest_age()`, `birth_year`, `age_attested_at`, the `/account-unavailable`
   page, and `src/lib/supabase/admin.ts`, which existed only to delete the account of someone who
   failed. `terms_accepted_at` stays and is now the only consent stamp;
   `profiles_onboarded_requires_consent` requires it alone.

   **This is the largest single reduction in what FLARE collects from minors, and it removes the
   only mechanism that kept under-13s out.** Both halves are true and neither cancels the other.
   Nothing near a date of birth is collected from anybody now, which rule 3 has always wanted. And
   a twelve-year-old can create an account, give a name and a grade, and comment.

   **The requirement did not go away with the mechanism.** A site collecting a name, a grade and
   comments from children under 13 is the thing COPPA is about. What replaces the form control is a
   stated rule in `/privacy` and `/terms`, which **is pending in the client's legal review with the
   faculty sponsor**. Until that lands the site asks for less and promises nothing about who may
   sign up, and that gap is real: it is a documentation gap, not a code one, and it cannot be closed
   from here.

   Whoever writes that wording needs three things in front of them:
   - The site is for ages 13 and over, stated somewhere a student and a parent will both see.
   - Nothing verifies it. The rule is a term of service, not a gate, and the honest version says so.
   - What happens when an officer learns an account holder is under 13. Suspension is the existing
     lever and §2 makes it reversible; deletion is available for an account that has never
     moderated anything.

   **What was removed, kept here because it is the argument for putting something back.** The old
   screen asked for a birth month and year with neither pre-selected and no text naming a threshold,
   because the FTC treats "I am 13 or older" as a leading design: it tells the reader which answer
   opens the door. It computed the age in Postgres, stored only the year, resolved an ambiguous
   month downward, and wrote nothing at all for an under-13 so that no data about a child was kept.
   A failure deleted the `auth.users` row, because signup had already captured an email address.
   Retry was deliberately not blocked, since recording the failure would have meant keeping the very
   data the deletion avoided. That reasoning still holds if an age screen is ever reinstated; it is
   not an argument that this one should not have been removed, which was the client's call.

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

   **Anyone can watch, and nothing is collected from a visitor who only reads.** That half is
   unchanged and is the point of the public library.

   ~~**Under-13 visitors can watch, and still cannot participate.** They cannot pass the age screen,
   so they cannot hold an account.~~ **No longer true.** The age screen was the entire reason
   under-13s could not hold an account, and it is gone. Participation is now open to anyone who can
   receive a confirmation email, which is the gap the legal review has to close in words.

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

   **And a second retention the same review has to cover: `flag_blocked_comment` stores text that
   was never accepted onto the site.** Section 4's second tier refuses a comment containing a slur
   *and* writes it verbatim into `audit_log` as `comment.blocked`, attributed to the account that
   tried. Nothing was published and nobody reported it, so this is the site keeping a record of
   something a student typed and was told no about.

   It is deliberate and it is narrow. The point of the tier is the pattern: one slip is a
   fifteen-year-old being stupid, three in a week from one account is a thing an officer has to
   act on, and there is no comment row to point at because the comment was refused. Ordinary
   swearing writes nothing at all, which is the line between the two tiers.

   The honest description is still that FLARE stores words a minor was prevented from publishing.
   Only `can_moderate` can read them, they are a disciplinary record rather than site content, and
   the privacy policy says nothing about them today.

   **A second thing for the same review: `/terms` promises a deletion right the site will not
   honour for officers.** It currently says an account can be deleted on request by emailing us.
   §2's decision means that is untrue for anyone who has ever moderated anything: their account can
   be suspended and retitled but not removed, because `audit_log` keeps the moderation record fully
   attributed and references them.

   The gap is narrow and the reasoning is defensible, but the sentence as written is a promise to
   every reader. Wording is **pending a review the client is doing with the faculty sponsor**, so it
   has deliberately not been rewritten here. Whatever it becomes has to be true of officers as well
   as of viewers, and the honest version says who is affected rather than burying it: someone
   agreeing to moderate should understand it before they accept the role, not when they ask to
   leave.
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

**All five phases are built.** What remains before launch is not a phase: transactional email, the
legal review section 9 asks for, a real domain, and deleting the fifteen `[SEED]` rows.

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
  `profiles_onboarded_requires_profile` now requires `grade` to be present and non-blank. It
  originally required `city` and `school` as well; see the note below. It is a second constraint
  rather than an edit to `profiles_onboarded_requires_consent`, so a violation says which half is
  missing.

> **`city` and `school` became required fields, and on 9 September they were made optional again.**
> Requiring them was a change in what we collect from minors, recorded here at the time with the
> lever for undoing it: "drop `city` and `school` from `profiles_onboarded_requires_profile` and
> make the fields optional again in the same commit." That is what `20260909000000` does.
>
> **It was the wrong trade, and the reason is section 9's first line.** Most users are minors, and
> requiring a student to name their school and their city before they can watch a video collects two
> more identifying facts about a child than the site has a use for. `grade` is the one of the three
> the product actually consumes: it is what the difficulty ladder is pitched at. The completeness
> requirement phase 3 wanted is satisfied by `grade` alone, because nothing reads the other two.
>
> **What did not change:** all three stay private under rule 9.1, absent from `public_profiles` by
> construction rather than merely unrendered, and `city` stays city-only under rule 9.3. This
> narrows what is asked for; it moves nothing into public view. Existing values are untouched, so
> accounts that already gave a city and a school keep them.
>
> **Three places had to move together**, and this is the shape of that kind of change: the
> constraint, the server action (which rejected blanks before the constraint ever saw them, and now
> writes `null` rather than `''` so an unanswered field does not look answered), and the form labels,
> which say "optional" rather than silently dropping `required`. The privacy policy was the fourth:
> its Changes section promises a new date whenever what we collect changes, so it is dated
> 9 September and its collection list now separates `grade` from the two optional fields.

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

### Phase 4 status

Built: `supabase/migrations/20260906000000_collaboration_and_admin.sql`, `src/lib/byline.ts`,
`/dashboard` with its layout, `/dashboard/admin`, `/dashboard/admin/people`,
`/dashboard/admin/log`, `/dashboard/admin/settings`, and `/suspended`.

**Every write in this phase goes through a definer function.** `invite_collaborator`,
`respond_to_invite`, `remove_collaborator`, `suspend_user`, `unsuspend_user`, `set_site_settings`,
`soft_delete_video` and `restore_video`. `video_collaborators` and `site_settings` have SELECT
policies and SELECT grants and nothing else.

> That is a departure from the profiles pattern, where writes are restricted by column grant, and
> the reason is what the rules are about. On `profiles` they are about columns: `role` is writable
> or it is not. Here they are about relationships and transitions: who owns the parent video,
> whether the target is the owner themselves, whether an invitation is still pending, whether the
> target of a suspension is an officer. None of that is expressible as a column privilege, and
> expressing it as a policy would mean trusting the client to send a sensible `status`. A function
> with no write grant behind it is the smaller surface, and it is also the only way to guarantee the
> `audit_log` row is written in the same transaction as the thing it records.

Decisions worth knowing:

- **Three definer helpers exist to break RLS recursion, not to save typing.** An invitee has to be
  able to read a video they were tagged on, including a draft, so `videos` needs a policy that
  consults `video_collaborators`; that table needs policies that consult `videos` for ownership and
  publication. Written directly, the two policy sets recurse into each other. `owns_video`,
  `video_is_public` and `is_collaborator` run outside the caller's RLS and break the cycle, exactly
  as `has_capability` does for `profiles`.
- **`public_videos` now aggregates the byline.** `collaborators` is a jsonb array of accepted
  collaborators, built by a correlated subquery in the view. Aggregated there rather than fetched
  per card, because `/library` renders twelve at a time and a query per card is the N+1 that makes
  a list page slow.
- **The card counts, the video page names.** A library card shows `Maya R. + 2 others` per section
  3; `/v/[id]` lists every accepted collaborator with a link to each profile. A co-author who is
  only ever "+ 2 others" is not really credited, and the page has the room. The card cannot link
  them anyway: the whole card is one link, and a link inside a link is invalid.
- **Names on the dashboard come from a second query, not an embed.** The base `profiles` table is
  readable only for your own row, so `videos(..., profiles(display_name))` returns null for
  everyone else. Names live in `public_profiles`, and a view has no foreign key for PostgREST to
  follow, so the join happens in the page.
- **`search_people` and `read_audit_log` are definer functions for the same kind of reason.** The
  people page has to match on email, which lives in `auth.users` and is readable by no client role
  at all; the log has to show the actor's name, and a moderator without `can_manage_users` cannot
  read another person's profile row. Without these two functions the sponsor's search cannot use the
  one identifier a teacher reliably knows, and the log reads "somebody did something".
- **`search_people` is gated on `can_manage_users`, not `can_moderate`.** Section 9's table puts
  email in reach of officers too. This is deliberately the tighter of the two: an email list of
  minors is worth handing to fewer people rather than more.
- **The admin pages `notFound()` rather than explaining.** A member who guesses `/dashboard/admin`
  learns nothing from a 404. "You do not have permission to moderate" confirms the page exists and
  tells them what to ask for.
- **Deleting a video requires a reason from a moderator and not from the owner.** An owner removing
  their own video is editing; a moderator removing someone else's is a decision that has to be
  legible in the log six months later, so the button stays disabled until the field is filled.
- **Restore is moderator-only.** An owner who deletes their own video asks an officer to put it
  back, which leaves a record of both halves rather than letting a video flicker in and out of the
  library unlogged.
- **A suspended moderator can still clear an avatar and lift nothing.** Suspension stops
  contributing, and taking a bad image down is not contributing. Suspending is still gated on the
  capability, and lifting a suspension needs `can_manage_users` whoever applied it, so a moderator
  can stop a spammer but cannot undo a sponsor's call.
- **Nobody can suspend themselves.** For a sole sponsor that would lock the club out of its own
  profile editing, and it is never the intent.

> **`signups_enabled` is enforced in the signup trigger, and it has to be.** An account is created
> through the auth API rather than through PostgREST, so there is no policy and no grant standing in
> front of it and an app-layer check is one the client could skip. `handle_new_user` now raises when
> the switch is off, which rolls back the `auth.users` insert, so no account is created at all. The
> cost is the message: Supabase reports a trigger exception as a generic signup failure, so
> `signUpWithEmail` also reads the switch in order to say something useful. That read is the
> courtesy; the trigger is the gate.
>
> `comments_enabled` will be enforced by the comments insert policy in phase 5, which can be a
> policy because a comment is an ordinary table write.

> **Profile editing was the one part of suspension that was never enforced.** Section 2 says a
> suspended user cannot edit their profile, and the owner update policy checked only that the row
> belonged to the caller. It now checks `is_suspended()` as well. `accept_terms`,
> `complete_onboarding` and `clear_avatar` are unaffected, being definer functions, so a suspended
> account can still finish onboarding and a moderator can still clear a suspended person's picture.
> (`attest_age` was the fourth name in this list until the age screen was removed.)

> **`/suspended` is not a wall and nothing redirects to it.** Section 2 is explicit that a suspended
> user can still sign in and watch. The proxy knows nothing about suspension; the page is reached
> from the header banner, and the restrictions are enforced in the database rather than by routing.

Deferred to phase 5, by design: comments, the moderation filter, the report button, the officer
queue at `/dashboard/admin/reports`, and the comment rate limit. `/dashboard/admin` leaves a place
for reported comments to land.

### Phase 5 status

Built: `supabase/migrations/20260908000000_comments.sql`, `src/lib/moderation/` (`index.ts` and
`wordlist.ts`), `public_comments`, the comment section on `/v/[id]`, and
`/dashboard/admin/reports`.

**Every condition in section 4 is enforced by the insert policy, and only the wordlist is not.**
The policy requires the author to be themselves, the video to be public, the account to be
onboarded and unsuspended, `comments_enabled` to be on, and `recent_comment_count() < 5`. The
filter runs in the server action, because that is where the wordlist lives.

> **The application re-checks those same conditions before inserting, and that is not redundancy.**
> A policy that refuses says only "new row violates row-level security policy for table comments",
> which is true and useless to a fifteen-year-old who needs to be told to wait a minute. `whyNot()`
> reads the same conditions in order to choose a sentence. The policy is still what enforces them.

Decisions worth knowing:

- **Deleting is soft and the moderator branch writes the evidence out as text**, per section 4.
  `soft_delete_comment` sets `deleted_at`/`deleted_by`, and *only when a moderator deletes somebody
  else's comment* also writes an `audit_log` row carrying the body, the author's username and
  display name, the video title, and the reason, then resolves any open report on that comment. One
  transaction, one definer function, so a delete cannot land without its record. Somebody deleting
  their own comment writes nothing: there is no decision to justify.
- **`detail` does not carry `deleted_by`, and section 4's sketch of the row says it should.** The
  actor is in `actor_id`, `actor_username` and `actor_display_name`, which `20260907000000` added
  after that sketch was written and which survive the actor's account being deleted. Copying it a
  fourth time into `detail` would be the only field in the row with two sources of truth.
- **The filter's second tier writes `comment.blocked` through `flag_blocked_comment`.** The refused
  text is stored verbatim, because "this account has tried three times this week" is the thing an
  officer needs and there is no comment row to point at. Tier one, ordinary swearing, is refused
  with no record at all. Section 9 records what that retention means.
- **Runs of three or more are collapsed, not runs of two.** `fuuuck` normalises to `fuck`; `book`
  and `soon` have to survive, and collapsing doubles turns them into `bok` and `son`.
- **The queue shows the author's history only when there is something to say.** A first offence
  listed beside three zeroes reads as an accusation rather than as context.
- **A moderator sees Delete and Report on somebody else's comment, and no Edit.** The five-minute
  edit window is for the author fixing a typo; a moderator rewriting somebody else's words is not a
  power the site should have, and there is no path to it.

> **A form closes because its action succeeded, never because its submit button was clicked.**
> The report button carried `onClick={() => setOpen(null)}`, which unmounted the form before the
> submit event fired. The browser then cancels the submission with "Form submission canceled
> because the form is not connected", the action never runs, and *nothing surfaces*: there is no
> action result, so there is no error to render. Every report submitted that way was silently
> discarded, and the only trace was a console warning. `CommentControls` and `ReportRow` now derive
> whether a form is open from the action state instead.

> **React resets an uncontrolled form after any action submits, success or failure.** A comment
> refused by the filter therefore lost everything the person had typed, which is the worst moment
> to lose it, and an effect that clears on success cannot fix it because the reset happens either
> way. `CommentState` echoes the submitted body back on failure with a fresh `token`, and the
> textarea is keyed on that token: keying is what makes the new `defaultValue` apply, since
> changing `defaultValue` does nothing to an input that is already mounted. The edit box is
> controlled for the same reason.

Verified in a browser rather than by calling the functions, which is the distinction that matters:
phase 4 was checked by calling its RPCs, and that proved the database was right and nothing about
the pages. Both bugs above were invisible to `tsc`, `eslint` and `next build`, and one of them was
invisible to the database as well.

| Check | Result |
|---|---|
| Ordinary comment posts and renders | yes |
| Profanity refused, section 4's wording, text preserved | yes, no log row |
| Slur refused and logged as `comment.blocked` with the body | yes |
| Sixth comment inside a minute | "You are posting a bit fast. Wait a minute and try again." |
| Report reaches the queue | yes, after the form-not-connected fix |
| Moderator delete copies all five fields into `audit_log` | yes, same timestamp as `deleted_at` |
| Open report auto-resolved by that delete | yes |
| Deleted comment gone from `/v/[id]` | yes |
| Inline suspend from the queue | yes, with its `user.suspend` audit row |
| Suspended author: banner, no form, no Report, comments stay up | yes |
| `comments_enabled` off hides the whole section | yes |
| `comments_enabled` off refuses a direct PostgREST insert | `42501` |

### The 14 September audit

A full pass over the live project and the running app: 23 security-boundary probes, 14 row-visibility
probes, the behavioural rules from sections 2, 4 and 6, every route signed out and signed in, and
the static checks. Everything was exercised against the deployed database from a real authenticated
session rather than read out of the migrations.

**Two findings, both the same shape**, fixed in `20260914000000`: the two write paths that feed the
officer queue had drifted out from under the guards every other write path has. `report_comment`
never checked suspension, and `flag_blocked_comment` checked only that the caller was signed in.
Section 6 now records why prose about "every insert policy" could not have caught either one.

**What held.** Self-promotion is refused on every capability column (`42501`); the suspension
columns are equally ungrantable; `avatar_url` refuses an offsite URL (`23514`); all eight reserved
usernames are refused; a plain member reading `audit_log`, `reports` or another person's `profiles`
row gets `[]` rather than data; every privileged RPC refuses a plain member; drafts, `hidden`, and
soft-deleted videos are invisible to anon through both the base table and the view, as are deleted
comments and comments on non-public videos; the rate limit, the kill switch and suspension all
refuse at the API and not merely in the UI; the filter refuses profanity and `sh1t` while accepting
Scunthorpe, Dickinson and assassin; and a refused comment still keeps the text the person typed.

**Three things the audit got wrong before it got them right**, all the same error in different
clothes, and all worth remembering because each one looked like a finding:

- **A 200 is not a leak.** `audit_log` and `reports` answer `200` to a plain member and return `[]`.
  RLS filters rather than denies, so asserting on the status code tests nothing. Assert on the body.
- **A fixture that fails to insert is not a passing test.** The soft-deleted video fixture was
  rejected by `videos_delete_complete`, and the visibility check downstream then "failed" on an
  empty response rather than on a real row.
- **A string match is not a leak either.** "Lamar Academy" appears on `/u/[username]` because it is
  in the site footer of every page, and the profile uuid appears because the avatar object path is
  `avatars/<uid>/avatar.webp` and `id` is a deliberate column of `public_profiles`.

### The 16 September hardening

Eight fixes from the audit, all client-approved, in `20260916010000`. Seven of the eight are the
same move: a rule the application enforced and the database did not, pushed down into Postgres so a
direct PostgREST call meets it too.

| # | Was | Now |
|---|---|---|
| 1 | `thumbnail_url` accepted any URL | `videos_thumbnail_url_allowed`, YouTube hosts only |
| 2 | Video UPDATE checked ownership alone | also `can_post` and not suspended, matching INSERT |
| 3 | Word filter ran only in the server action | `comment_is_clean()` in the insert **and** update policies |
| 4 | `public_profiles` listed every half-signup | onboarded accounts only |
| 5 | Any filename inside your own avatar folder | exactly `<uid>/avatar.webp` |
| 6 | `avatar_url` accepted any Supabase project | this project's ref only |
| 7 | `onboarded` was in the client grants | `complete_onboarding()` is the only writer |
| 8 | `flag_blocked_comment` had no volume limit | five a minute |

Four of these are worth more than their one-line summary:

> **The word filter in the database is a mirror, not a move.** `src/lib/moderation/` stays exactly
> where it was and still produces the sentence a person reads, because a policy can only refuse and
> "new row violates row-level security policy" is not a thing to show a fifteen-year-old. What
> changed is that the rule is now *true* of a write that never touches the form.
>
> The list lives in `moderation_terms`, which has **no grants to any client role at all**: only
> `comment_is_clean()` reads it, and that is a definer function. §4 says the list is not worth
> publishing, and a table a client can select from is a published list. `normalize_for_moderation()`
> mirrors `normalize()` in `index.ts` and the two have to be kept in step; the migration generates
> its wordlist rows directly from `wordlist.ts` for that reason, rather than being typed twice.
>
> **The update policy gets the check as well as the insert policy**, because editing a clean comment
> into a dirty one is the obvious way past a check that only runs once.

> **`onboarded` leaving the grants is what makes the username lock real.**
> `enforce_username_immutable()` refuses a rename when `old.onboarded` is true, and `onboarded` was
> itself writable by the client, so the lock was opt-out: `PATCH onboarded=false`, rename, `PATCH
> onboarded=true`. Three ordinary requests and the key behind every `/u/<username>` link has moved.
> A guard whose own precondition is client-writable is not a guard.

> **Pinning the avatar object name closes a gap the folder check never covered.** The old policy
> stopped you writing into somebody else's folder and permitted anything inside your own: any name,
> any number of objects. §6 already described one object per user at a fixed name, which was true of
> what the app uploaded and not of what the bucket accepted.
>
> The delete policy deliberately still matches on the *folder* rather than the fixed name, so
> objects left behind by the looser policy can still be removed.

> **The avatar URL constraint now hardcodes the project ref.** `[a-z0-9]+\.supabase\.co` accepted
> storage on anybody's Supabase project, which is an offsite URL wearing a familiar hostname. The
> cost is a migration that is no longer portable: **if the project is ever moved or restored under a
> new ref, this constraint rejects every avatar until it is edited.**

The open redirect fix is the one that is not a database change. `safePath()` moved to
`src/lib/safe-path.ts` and is shared by `auth/actions.ts`, `auth/callback/route.ts` and
`login/page.tsx`, which held three copies of it.

> **`startsWith("/") && !startsWith("//")` reads as "same-site path" and is not one.** Browsers
> normalise a backslash to a forward slash in the authority position, so `/\evil.example` passes a
> check written that way and is then resolved as `//evil.example`, which is protocol-relative to
> somebody else's host. One character walks the whole test. The shared version rejects a backslash
> anywhere, and control characters too, since a tab or newline inside an authority is ignored during
> URL parsing. It rejects rather than repairs: a validator that fixes its input invites you to find
> the input it fixes into something else.

### Articles, added 23 September

Client request. FLARE was a video library and nothing else; `20260923000000` adds a second kind of
thing a contributor can publish. Built: the `articles` table, `public_articles`, `public_library`,
`soft_delete_article` / `restore_article`, `/dashboard/write`, `/a/[id]`, `ArticleCard`, and a Kind
filter on `/library`.

**It mirrors `videos` rather than inventing a parallel world**, and that is the point rather than
laziness: difficulty and topic are the site's organising idea, and an article that could not be
filtered to "level 2, credit" would not be findable in the one way this site expects anything to be
findable.

Three decisions worth arguing with later:

> **The body is plain text.** Not markdown, not HTML. §7 already records that `/privacy` and
> `/terms` are written as markup rather than pulled through a markdown dependency, so adding one
> here would reverse that on purpose. The stronger reason is §9: this is arbitrary text submitted by
> minors, and rendering user-supplied HTML is an XSS surface. A hand-rolled markdown parser that
> emits HTML is the same surface with extra steps. `/a/[id]` splits on blank lines and lets React
> escape each paragraph, exactly as a comment body is handled. Verified: an article whose body
> contains `<script>` and an `onerror` image renders both as visible text, executes nothing, and
> injects no elements.

> **Articles have no comments.** `comments.video_id` is `not null references videos`, so comments on
> articles means a polymorphic column, which touches the phase 5 insert policy, `public_comments`,
> `read_report_queue`, and the evidence copy in `soft_delete_comment` that §9.6 turns into a
> retention claim about a minor's words. That is its own piece of work, not a rider on a new content
> type.

> **No media release checkbox, unlike videos.** §9.5 exists because a video contains faces and
> voices that need a signed release. Prose does not. Asking anyway would train contributors to tick
> a release box that means nothing, which makes the real one on the upload form mean less.

> **`20260923000000` granted columns on `articles` without revoking first, and column grants mean
> nothing until you do.** Supabase hands `anon` and `authenticated` ALL on every new table in the
> public schema through default privileges, and a table-level grant covers every column. So the
> careful `grant insert (...)` / `grant update (...)` lists sat next to a privilege that ignored
> them, and the migration's own comment claiming `deleted_at`, `deleted_by` and `view_count` were
> unwritable was false.
>
> Measured before it was fixed: an ordinary contributor editing their own article could PATCH
> `view_count` to 99999, backdate `edited_at` to 2020, and rewrite `created_at`. `deleted_at` was
> refused only because `articles_delete_complete` rejects a half-set pair; sent with `deleted_by` it
> would have soft-deleted the row without the `audit_log` entry `soft_delete_article` exists to
> guarantee. The same PATCHes against `videos` return `42501`.
>
> `20260904000000` opens with `revoke all on public.videos from anon, authenticated;` and
> `20260829000000` does the same for `profiles`. That line is the reason their column grants work.
> Fixed in `20260925010000`.
>
> **The rule for any new table: revoke before you grant.** A rule written in a comment is not a
> rule, which §6 keeps relearning. This one was written in a `GRANT`, which looks far more like
> enforcement than a comment does, and still was not.

**`/library` reads `public_library`, a union view, and that is load-bearing.** Two queries merged in
the page would make "page 2 of the library" meaningless, and merging full result sets in JS to slice
them is the thing §7 forbids in the same breath as client-side filtering. The view also computes
`preview` and `reading_minutes` in SQL and omits the body, so twelve cards do not ship up to a
megabyte of prose.

Verified against the live project from a real contributor session: publish through the form, the
wordlist refusing a dirty title and a dirty body at the **policy** (not just the action), an edit
from clean to dirty refused, the 200-character floor, drafts invisible to anon through the base
table and both views, the union carrying videos and articles with the right `kind`, owner soft
delete with its audit row, and restore refused for a non-moderator.

### Media assets

Masters live in `media-src/`, which is gitignored. Only encoded web versions belong in `public/`.

- **GitHub rejects any file over 100MB**, so a 4K master in `public/` breaks the first push.
- Background video is encoded to 1080p, 24fps, no audio (the element is muted, so an audio track is
  pure waste), H.264 CRF 32, `+faststart`. The 16s hero master went from 79MB to 4.7MB this way.
- Filenames in `public/` must be lowercase. Vercel serves from a case-sensitive filesystem, so
  `HERO.mp4` resolves locally on Windows and 404s in production.

  > **The real invariant is that the reference matches the file exactly; lowercase is the habit that
  > makes that automatic.** Five files break the letter of this rule and are fine:
  > `FLARE_LOGO.png`, `FLARE_LOGO_MIST.png`, `FLARE_WORDMARK.png`, `FLARE_WORDMARK_MIST.png` and
  > the untracked `Favicon180180.png`. The four referenced ones are spelled the same way in `src/`
  > as on disk and all answer 200 in production, checked 14 September. Renaming them means editing
  > every reference in the same commit, so the rule is worth keeping for *new* files rather than
  > worth a rename.
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

**A `"use server"` file may only export async functions, and Next checks it at runtime.** Phase 4
exported `EMPTY_ACTION`, a plain object, from `src/app/dashboard/actions.ts`. Every `useActionState`
in the dashboard read its initial state from that export, so every form on every admin page returned
a 500 the first time anybody submitted one. The message, thrown from
`next-flight-loader/action-validate`, is:

```
A "use server" file can only export async functions, found object.
```

What makes this worth writing down is what did *not* catch it: `tsc --noEmit` passed, `eslint`
passed, `next build` passed, and all 23 routes rendered. The validator runs when the action module
is loaded, not when it is compiled, so the failure only exists at the moment a form is submitted.
Nothing short of clicking the button finds it.

A `type` export from an actions file is fine, since types are erased before the validator sees
anything. A `const` is not. **Actions files export async functions and nothing else**; shared
constants live in an ordinary module, which is now `src/lib/action-state.ts`.

The general lesson, which applies past this one bug: verifying the phase 4 write paths by calling
the RPCs directly with a token proved the database was right and proved nothing at all about the
pages. The two halves need exercising separately.



**`create-next-app` overwrites `CLAUDE.md`.** Next 16's scaffolder writes its own agent files and
replaced this spec with a one-line `@AGENTS.md` stub during phase 1. It does this *before* running
`git init`, so the initial commit captured the stub, not the spec — there was no git copy to restore
from. The spec was restored by hand. If the scaffolder is ever re-run in this directory, back this
file up first. The `@AGENTS.md` import is kept on line 1 so the Next.js agent rules still load.
