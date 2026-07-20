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
5. Login runs via magic link (email) — that's on by default in Supabase, you
   don't need to change anything.

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

## What's intentionally kept simple for testing among friends

- **Access rights (RLS):** Currently all signed-in users may read all
  records (writing only to their own entries). That's fine for a trusted
  friend circle for testing, but should be tightened before a larger or
  less-trusted group gets access.
- **"Merge" on overlaps** currently creates a new, combined activity instead
  of technically merging the original two. That's functionally fine for
  trying it out, but it's a point we can clean up later.
- **Friend circles** only consist of people who have already signed up (no
  address-book import). That's enough for the first test run among friends.

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
  Next.js dev mode) and `sharp` (image processing). Both are legitimate,
  widely used packages. If the warning bothers you, run
  `npm approve-scripts --allow-scripts-pending` and approve both; otherwise
  it's safe to ignore.

## Continuing development

Just tell me what you want to change based on feedback from your friends —
I'll write the matching code, and all you need to do afterward is run
`git add . && git commit -m "..." && git push`; Vercel takes care of the rest
automatically.
