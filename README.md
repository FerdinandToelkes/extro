# Activities Feed

Web app for sharing with your friend group. Runs entirely in the browser via a
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
3. **Set up the database schema with the [Supabase CLI](https://supabase.com/docs/guides/cli).**
   This project keeps its whole schema as versioned migration files under
   `supabase/migrations/` instead of a script you paste by hand, so setting
   up (or later changing) the database is a couple of terminal commands:

   ```bash
   # Install the CLI (macOS/Homebrew; see the docs for Linux/Windows)
   brew install supabase/tap/supabase

   # Authenticate (opens a browser)
   supabase login

   # Link this repo to your project. The ref is the subdomain of your
   # Project URL — https://abcdxyz.supabase.co → abcdxyz.
   # (For the existing Extro project it's upcqsnclbkovtvmtxpcl.)
   supabase link --project-ref <your-project-ref>

   # Create every table, policy, trigger and the pg_cron cleanup job.
   supabase db push
   ```

   `supabase db push` connects straight to the linked project over the
   network — **no Docker required**. (Docker is only needed for the optional
   local-database stack, which this project doesn't use; everything runs
   against the hosted project directly.) If the `pg_cron` step errors with a
   permissions message, enable it once under **Database → Extensions →
   pg_cron** in the dashboard, then re-run `supabase db push`.
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
5. The login page uses email + password (sign up / log in). Go to
   **Authentication → Sign In / Providers → Email** and consider turning
   **"Confirm email" off**: with it off, signing up logs you in immediately
   with no email round-trip at all — handy for creating throwaway test
   accounts (even with made-up addresses, since no email is ever sent for
   them) when you want to sign in as multiple people. Leave it on for a
   more standard, production-like setup.

   Note: the **"Forgot password?"** flow sends a reset email, so it needs
   working email delivery. Supabase's built-in email works out of the box but
   is rate-limited (a few per hour) — fine for a friend group; configure your
   own SMTP under **Authentication → Emails** if you outgrow it. Account
   deletion is self-service from the Profile page and is immediate and
   irreversible (it wipes the account and everything tied to it).
6. **Making database changes later.** Don't edit the live database by hand.
   Create a migration, write the SQL, and push it:

   ```bash
   supabase migration new describe_your_change   # new timestamped .sql file
   #  …write your SQL in supabase/migrations/<timestamp>_describe_your_change.sql…
   supabase db push                              # applies it to the linked project
   ```

   The CLI records which migrations have already run in a history table on
   the database itself (`supabase migration list` shows local files vs.
   what's applied), so there's no checklist to keep in sync and no way to
   run the same change twice. The first file in `supabase/migrations/` is a
   baseline snapshot of the entire schema as of the switch to the CLI;
   every file after it is one incremental change. (This replaced an older
   flow of a hand-maintained `schema.sql` plus a long list of numbered
   migration files pasted into the SQL editor — all now folded into that
   baseline.)

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

Then open `http://localhost:3000` in your browser, sign up with an email and
password, and try it out.

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
with each other, shares a "Mock Squad" group, and posts two overlapping
Sport/Today activities — so there's an overlap banner ready to test Merge
on immediately after it runs. Safe to re-run, though it'll add a fresh
duplicate group/activities each time.

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

- **Access rights (RLS):** Visibility is enforced at the database level with
  Row Level Security, not just in the browser — you only see activities and
  availability shared with you (all-friends, a group you're in, or you
  individually), you only see groups you belong to, and notifications are
  private to their recipient. Writes are limited to your own records, and
  operations that need to reach beyond that (merging activities, the
  mutual-friend group rules, deleting your account) go through vetted
  `security definer` functions rather than broad table access.
- **Friend groups** only consist of people who have already signed up (no
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
automatically. If a change also touches the database, I'll add a new file
under `supabase/migrations/`; you then run `supabase db push` once to apply
it to your live project (see step 1.6).
