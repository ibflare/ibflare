# FLARE

**Financial Literacy Advancement for RGV Equity.** A student-run video library from FLARE at Lamar
Academy in McAllen, Texas. Members publish videos explaining financial literacy, taxes and
economics, and every video carries a difficulty level, so the same question can be answered more
than once and pitched differently each time.

Live at **https://ibflare.vercel.app**

Watching is public. An account is only needed in order to contribute.

---

## Read this first

Two files govern how to work in this repo, and they are not optional reading:

- **[CLAUDE.md](CLAUDE.md)** is the source of truth for architecture, schema, brand and privacy
  rules. It carries a standing instruction: if a decision in it turns out to be wrong, correct the
  file in the same commit as the code. That has been exercised repeatedly, and the reversals are
  recorded rather than quietly edited out, so the reasoning survives.
- **[AGENTS.md](AGENTS.md)** is written by `next dev` and says that this version of Next has
  breaking changes against most training data. Read the guides in `node_modules/next/dist/docs/`
  before writing code against an unfamiliar API.

The single most important constraint: **most users are minors.** Section 9 of CLAUDE.md is headed
"non-negotiable" and drives more of the architecture than anything else. `grade`, `city`, `school`
and `birth_year` are private, enforced by a database view that does not contain those columns rather
than by a template that declines to render them.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16, App Router, TypeScript, Turbopack |
| Styling | Tailwind CSS v4, CSS-first. There is no `tailwind.config.ts` |
| Backend | Supabase: Postgres, Auth, row level security |
| Auth | Google OAuth, and email with password. Email confirmation required |
| Video | YouTube embeds. We store the video ID, never a file |
| Hosting | Vercel |

Do not add a state library, an ORM, or a component library. Server components plus the Supabase
client cover this app. The only runtime dependencies beyond the scaffold are the two Supabase
packages and `server-only`, which is a build-time guard.

---

## Running it

```bash
npm install
cp .env.example .env.local     # then fill in the values, see below
npm run dev                    # http://localhost:3000
```

Other scripts: `npm run build`, `npm start`, `npm run lint`. There is no test suite.

### Environment

All four go in `.env.local`, which is gitignored:

```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # safe in the browser by design
SUPABASE_SERVICE_ROLE_KEY=       # server only, never import into a client component
YOUTUBE_API_KEY=                 # server only, Data API v3
```

`SUPABASE_SERVICE_ROLE_KEY` is reached only through `src/lib/supabase/admin.ts`, which imports
`server-only`. Pulling that module into a client component is a build error rather than a leaked
key. Keep it that way.

The same four have to be set in the Vercel project, or sign-in fails in production while working
locally.

### Supabase configuration

Two things live in the dashboard rather than in this repo, and getting either wrong looks exactly
like a code bug:

**Authentication, URL Configuration.** Site URL must be the deployed origin
(`https://ibflare.vercel.app`), and Redirect URLs must include `https://ibflare.vercel.app/**` and
`http://localhost:3000/**`. Supabase silently substitutes the Site URL when a `redirectTo` is not
in the allowlist, so a wrong Site URL sends every signed-in visitor somewhere else with no error.
The `/**` wildcards are required because the app appends `?next=` to the callback.

**Email confirmation must stay on.** With it off, anyone can register an address they do not
control, and because Supabase links accounts by email, the real owner of that address is later
handed the attacker's account when they sign in with Google.

---

## Database

Schema changes are timestamped SQL files in `supabase/migrations/`, applied with `supabase db push`
against a linked project. **Never change schema only through the dashboard UI:** the migration file
is the record.

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

The migrations so far:

| File | What it does |
|---|---|
| `20260829000000_profiles_and_auth.sql` | `profiles`, `audit_log`, the `public_profiles` view, RLS, the capability functions, the signup trigger |
| `20260830000000_age_and_terms.sql` | `birth_year`, the consent stamps, `attest_age()`, `accept_terms()` |
| `20260830010000_restrict_profile_insert.sql` | Closes a privilege escalation: INSERT had been granted without a column list |
| `20260902000000_close_profile_findings.sql` | Reserved usernames as a constraint, `onboarded` requires a complete profile |
| `20260903000000_public_library.sql` | Restores the anon grant on `public_profiles` now that viewing is public |

Two things about this schema that are easy to get wrong:

- **Column grants, not RLS, are what stop self-promotion.** `role`, the capability flags and the
  suspension columns are simply absent from the grants for `authenticated`, so Postgres rejects the
  write before RLS is consulted. `set_user_permissions()` runs as owner and is the only path in. If
  you add a column a user may write, add it to **both** the INSERT and UPDATE grants.
- **Do not use PostgREST upsert on `profiles`.** It compiles to `INSERT ... ON CONFLICT DO UPDATE`,
  which needs UPDATE privilege on every column in the payload including `id`, and `id` is
  deliberately not grantable. Update first, insert only if nothing matched.

The first sponsor is created by hand in the SQL editor. There is no self-serve path to sponsor.

---

## Layout

```
src/app/           routes, App Router
src/components/    shared UI
src/lib/           taxonomy, profile helpers, the three Supabase clients
src/proxy.ts       session refresh and route guards
supabase/          migrations
public/            web-ready assets only
media-src/         video masters, gitignored
```

`src/proxy.ts` is the middleware. Next 16 deprecated the `middleware` file convention and renamed
it, so a file called `middleware.ts` is silently ignored. It also refreshes the Supabase session on
every request: server components cannot write cookies, so without it sessions expire on their own.

### Assets

Masters go in `media-src/`, which is gitignored. Only encoded web versions belong in `public/`.

- GitHub rejects any file over 100MB, so a 4K master in `public/` breaks the push.
- **Filenames in `public/` must be lowercase.** Vercel serves from a case-sensitive filesystem, so
  `HERO.mp4` resolves on Windows and 404s in production.
- Background video: 1080p, 24fps, no audio (the element is muted, so an audio track is pure waste),
  H.264 CRF 32, `+faststart`. Always ship a poster frame.

---

## Conventions

- **No em dashes in UI copy or code comments.** Use commas, colons, or a new sentence. A `grep` for
  the character over `src/` comes back empty and is meant to stay a usable check. CLAUDE.md is
  exempt, and en dashes in numeric ranges are a different character and are fine.
- **Do not explain the UI.** No reassurance copy, no explaining why a choice was made. Label the
  thing and move on. Teaching copy about money is the exception: that is the product.
- **Voice is plain and direct, addressed to the reader.** Second person and contractions are
  correct. What is banned is salesy, jokey or padded writing. CLAUDE.md §8 has been wrong about this
  twice in opposite directions; the client copy deck is the authority, not that paragraph.
- **Deletes are soft.** Set `deleted_at` and `deleted_by`, and write an `audit_log` row. Never
  `DELETE FROM videos`.
- **Gate features on capabilities, never on the role string.** `role` is for display.

---

## Build status

Five phases, each deploying before the next begins. See CLAUDE.md §10.

| Phase | State |
|---|---|
| 1. Scaffold, brand, landing page | Done, deployed |
| 2. Auth and people | Done, deployed and audited |
| 3. Library: `videos`, the YouTube resolver, upload, `/library`, `/v/[id]` | **Not started** |
| 4. Collaboration and admin | Not started |
| 5. Comments and moderation | Not started |

`/contribute` was built early, at the phase 2/3 boundary, because it is static and had no
dependencies.

Known launch blockers that are not code:

- **Transactional email.** Confirmation mail goes through Supabase's shared sender, rate limited to
  a handful per hour. A club meeting where thirty students sign up will silently fail for most.
  Wire up Resend or another SMTP provider before launch.
- **Legal review.** `/privacy` and `/terms` describe collecting `grade`, `city`, `school` and
  `birth_year` from minors, and neither has been reviewed by an adult with authority over the club.
- **The real domain.** The privacy policy still says `flare.example.org`. When that changes,
  `metadataBase` in `src/app/layout.tsx` changes in the same commit.
