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
| Auth | Supabase Auth → Google OAuth only | No password auth, no email/password fallback |
| Video | YouTube embeds, resolved automatically | We store the video ID, never the file. See §5 |
| Hosting | Vercel | Preview deploys on every branch |

**Do not** add a state library, an ORM, or a component library. Server components plus the Supabase
client cover this app.

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

| Level | Name | Audience | Assumes |
|---|---|---|---|
| 1 | Spark | Ages 11–14 | Nothing. What a paycheck is, what a bank does |
| 2 | Ember | Ages 14–16 | You have a job or are about to. Pay stubs, simple returns, credit |
| 3 | Blaze | Ages 16–18 | You have money to decide about. Index funds, 1099s, FAFSA |
| 4 | Torch | 18+ | College level. Macro policy, filings, valuation |
| 5 | Flare | College and up | Research depth. One niche question, ~20 minutes |

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
/privacy                Privacy Policy. Linked from the footer. NOT YET WRITTEN
/terms                  Terms of Service. Linked from the footer. NOT YET WRITTEN
```

> **The footer links to `/privacy` and `/terms` as of phase 1, and neither page
> exists.** They 404. Both must exist before launch, and neither should be
> drafted casually: this site collects `grade`, `city`, and `school` from
> minors, so the privacy policy has to describe that accurately and match the
> §9 constraints. Get an adult with authority over the club to review both.

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

Voice: **formal register.** Specific, never salesy, and never chatty. Prefer "Contributors upload
their video to YouTube as an unlisted entry" over "You upload it to YouTube as unlisted". Third
person and full constructions; avoid contractions, rhetorical questions, and second-person address
in body copy. Sentence case except the tracked-out label style. Errors state what occurred and what
the reader may do next, without implying reader error. This is a nonprofit teaching young people
about money, not a fintech startup.

**No em dashes anywhere.** Use a comma, a colon, a semicolon, or a full stop. This applies to code
comments as well as copy, so the rule holds repo-wide and greps clean.

> **Corrected after phase 1.** This section originally called for plain, conversational copy, and
> phase 1 was first written that way. It read as too informal for the subject and was rewritten in a
> formal register at the client's direction. The em dash prohibition was added at the same time.
> Note that the formal register applies to site copy; the liability disclaimer in the footer is
> formal for a different reason and is more heavily so.

---

## 9. Privacy rules — non-negotiable

Most users are minors. Hard constraints, not preferences.

1. `grade`, `city`, and `school` are **never** rendered on a public page. Visible only to accounts
   with `can_manage_users`.
2. Public identity is username, display name, and title. Encourage first name + last initial.
3. Never collect a street address, phone number, or date of birth.
4. Google sign-in only, which puts age gating on Google's side. No under-13 signup path.
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
