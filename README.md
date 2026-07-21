# Activities Feed

Web app for sharing with your friend circle. Runs entirely in the browser via a
link — nobody has to install anything.

**Stack:** Next.js (React, generates the web interface) + Supabase (Postgres
database + login + realtime updates, free at this scale) + Vercel (hosting,
free, gives you a real link).

Why this stack: it's web-standard, needs no server of your own to manage, and
both services (Supabase, Vercel) have a web interface where you do almost
everything by clicking instead of on the command line. That fits well with you
coming more from Python/C++/Julia — the actual app logic in this repo is
already written; you mainly need to click through two web interfaces and paste
in environment variables.

## 1. Create a Supabase project (database + login)

1. Sign up for free at https://supabase.com, click "New Project".
2. Wait until the project is ready (~2 min).
3. In the left menu go to **SQL Editor** → **New query** → paste in the
   contents of `sql/schema.sql` → **Run**. This creates all tables, the
   auto-profile trigger, and the access rules.
4. In the left menu go to **Project Settings → API**. There you'll find:
   - **Project URL** → goes into `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** (or, on newer projects, the **publishable key**,
     starting with `sb_publishable_...`) → goes into
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   ⚠️ **Use the plain Project URL** (`https://xxxxxxxx.supabase.co`), *not*
   the REST/data API URL some pages show with `/rest/v1/` appended. The
   Supabase client adds its own paths, so a URL that already ends in
   `/rest/v1/` breaks every request the app makes — including login. This is
   the single most common reason login silently fails.
5. The login page offers two ways in: a magic link (email, no password —
   on by default, nothing to change) or a classic email+password sign
   up/log in. For the password option, go to **Authentication → Sign In /
   Providers → Email** and consider turning **"Confirm email" off**: with it
   off, signing up with a password logs you in immediately with no email
   round-trip at all — handy for creating throwaway test accounts (even
   with made-up addresses, since no email is ever sent for them) when you
   want to sign in as multiple people. Leave it on for a more standard,
   production-like setup. This toggle doesn't affect the magic-link flow,
   which is its own confirmation step either way.
6. **If you already ran an earlier version of `schema.sql`**, also run, in
   this order (same SQL editor):
   - `sql/migration_edit_delete_location.sql` — adds the optional `location`
     column and the policies that let authors edit/delete their own
     activities.
   - `sql/migration_bugfixes.sql` — tightens a couple of overly-permissive
     access rules (see below) and fixes an avatar-initials edge case.
   - `sql/migration_friend_requests.sql` — adds the friend request/accept
     flow. Adding someone to a circle, or sharing an activity with them
     individually, now requires an accepted friend request first.
   - `sql/migration_activity_expiry.sql` — adds self-expiring activities
     (see below). This one enables the **`pg_cron`** Postgres extension; if
     the `create extension pg_cron` line errors with a permissions message,
     enable it first under **Database → Extensions → pg_cron** in the
     dashboard, then re-run just the last two statements of that file.
   - `sql/migration_merge_activities.sql` — fixes "Merge" on overlapping
     activities so it actually consolidates them instead of creating a
     duplicate. **Easy to miss** — it's just a SQL function, nothing to
     configure, but Merge silently does nothing without it.
   - `sql/migration_visibility_rls.sql` — enforces activity visibility
     (circles/individual people) at the database level, not just in the
     browser. No app behavior changes; this only matters if someone calls
     the Supabase API directly instead of using the app.
   - `sql/migration_fix_visibility_recursion.sql` — **only needed if you
     already ran `migration_visibility_rls.sql` before 2026-07-21 and are
     now stuck on a loading screen**, or seeing "infinite recursion
     detected in policy for relation activities." An earlier version of
     that migration had a circular policy bug; this fixes it. If you're
     running the migrations fresh/in order, `migration_visibility_rls.sql`
     is already correct and you can skip this one.
   - `sql/migration_activity_tags.sql` — adds optional interest tags
     (separate from category) for browsing/filtering the feed, and updates
     the merge function so tags carry over when activities are merged.
   - `sql/migration_profile_fields.sql` — adds optional `city` and `bio`
     fields to your profile, editable on the new Profile page. City doubles
     as a feed filter ("same city as me").
   - `sql/migration_expiry_hours.sql` — switches auto-delete timing from
     days to hours (renames the column and multiplies existing values by
     24, so nothing already posted changes its actual delete time) and
     adds an optional exact event date/time (Advanced settings in the
     activity form) that overrides the fuzzy When-chip-based calculation.
   - `sql/migration_usernames.sql` — adds a unique, required-at-signup
     username (existing accounts keep it blank until set via Profile).
     Friend-adding is now exact-username search only — the Friends page no
     longer lists everyone. Also adds the function behind "see a friend's
     friends" on their profile page.
   - `sql/migration_availability.sql` — **superseded, skip this one** —
     see `migration_availability_slots.sql` below instead, even if you
     already ran this.
   - `sql/migration_subscribed_tags.sql` — adds tag subscriptions
     ("recurring interests"), set on your Profile page. Matching activities
     get a badge and sort to the top of your feed.
   - `sql/migration_availability_slots.sql` — replaces the single-status
     availability bar with a weekly calendar (up to one slot per day,
     each shareable with specific circles or people) on a new `/calendar`
     page. Also adds circle membership management (add/remove people from
     an existing circle, not just at creation) — `circle_members` had no
     delete policy at all until this migration, so removal genuinely
     wasn't possible before, not just missing from the UI.

   On a brand-new project you can skip all thirteen (the sixth is a hotfix,
   not needed at all on a fresh project) — the full `schema.sql` already
   includes the correct version of those changes (`schema.sql` itself also
   enables `pg_cron` the same way, so the note above applies there too).

## 2. Test locally (optional, but recommended before going live)

```bash
# Install Node.js if needed (one-time)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts

cd extro
cp .env.local.example .env.local
# open .env.local and fill in the two values from step 1.4

npm install
npm run dev
```

Then open `http://localhost:3000` in your browser, log in with your own email
(the magic link lands in your inbox), and try it out.

### Testing as multiple people in one browser

Regular tabs/windows share the same login — Supabase keeps your session in
that site's storage, so signing in as someone else in a new tab logs out
your other tabs too. To have several people logged in at once:

- **Different ports, no extra tooling (local only).** Storage is isolated
  per origin, and a port counts as part of the origin — run a second dev
  server (`npm run dev -- -p 3001`) and open `localhost:3000` and
  `localhost:3001` as two plain tabs, each with its own login. Doesn't work
  against the deployed Vercel URL, since that's a single fixed domain.
- **Different browsers.** Each browser (Chrome, Firefox, Safari, Edge, …)
  keeps its own storage, so signing in as a different person in each one
  gives every account its own persistent, isolated session — works locally
  and against the deployed link, and scales to as many accounts as you have
  browsers.

Password sign-up with "Confirm email" off (step 1.5) makes creating these
test accounts instant, even with made-up email addresses.

**Or skip creating accounts by hand:** `npm run seed:test-users` creates
three mock accounts — `mock-alice@extro.test`, `mock-bob@extro.test`, and
`mock-carol@extro.test`, all with password `testpass123` — friends them
with each other, shares a "Mock Squad" circle, and posts two overlapping
Sport/Today activities — so there's an overlap banner ready to test Merge
on immediately after it runs. Safe to re-run, though it'll add a fresh
duplicate circle/activities each time.

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create extro --private --source=. --push
# if you don't have the GitHub CLI (gh), you can instead create an empty repo
# the normal way on github.com and use the git commands shown there
```

## 4. Deploy to Vercel (→ real link)

1. Log in to https://vercel.com with your GitHub account.
2. **Add New → Project** → select your `extro` repo.
3. Under **Environment Variables**, enter the same two values as in
   `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Click **Deploy**. After ~1 minute you'll get a link like
   `https://extro-xyz.vercel.app`.
5. You can send that link directly to friends. Everyone signs up with their
   own email and lands in the same feed.

Every change you commit and push later gets redeployed automatically — no
manual re-upload needed.

> ⚠️ **Changing an environment variable in Vercel does NOT take effect until you
> redeploy.** The `NEXT_PUBLIC_*` values are baked into the build, so an old
> value stays live until a new build runs. If you fix `NEXT_PUBLIC_SUPABASE_URL`
> in the Vercel dashboard but still see errors like *"invalid path specified in
> request URL"*, go to **Deployments → ⋯ on the latest one → Redeploy**. That
> error specifically means a `/rest/v1/`-style URL is still in the live build —
> use the plain `https://xxxx.supabase.co` Project URL (see step 1.4).

## What's intentionally kept simple for testing among friends

- **Access rights (RLS):** Currently all signed-in users may read all
  records (writing only to their own entries). That's fine for a trusted
  friend circle for testing, but should be tightened before a larger or
  less-trusted group gets access.
- **Friend circles** only consist of people who have already signed up (no
  address-book import). That's enough for the first test run among friends.
- **Auto-delete timing** is approximate: the "When" chip (Today/Tomorrow/
  Weekend) is a vibe, not an exact date, so the auto-delete countdown is
  based on that approximation (e.g. "Weekend" resolves to the coming
  Saturday) plus however many days you set, not a precise event timestamp.
  An hourly `pg_cron` job does the actual deleting, so an activity can
  briefly outlive its expiry by up to that hour (the feed hides it
  immediately regardless).

## About the `npm install` warnings

- `npm audit`: the moderate PostCSS advisory comes from a copy of `postcss`
  bundled *inside* `next`'s own dependencies, not a package this app uses
  directly. `npm audit fix --force` would downgrade Next.js to a very old
  canary release to "fix" it — don't run that; it would break the app. This
  advisory is about Next's internal build tooling, not something reachable
  through this app's code, so it's safe to ignore until Next.js ships an
  update with a newer bundled postcss.
- `npm warn allow-scripts`: this comes from your npm/pnpm install-scripts
  allowlist config (likely global, from another project) asking you to
  approve install scripts for `fsevents` (macOS file watching, used by
  Next.js dev mode), `sharp` (image processing), and `unrs-resolver` (a
  native module resolver used by the linter). All three are legitimate,
  widely used packages. If the warning bothers you, run
  `npm approve-scripts --allow-scripts-pending` and approve them; otherwise
  it's safe to ignore.

## Continuing development

Just tell me what you want to change based on feedback from your friends —
I'll write the matching code, and all you need to do afterward is run
`git add . && git commit -m "..." && git push`; Vercel takes care of the rest
automatically.
