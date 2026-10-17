# Spend Plan

Minimal personal money planner. React + Vite. Accounts are handled by Supabase Auth (free tier: 50,000 monthly active users); plan data stays in your browser's localStorage, scoped per account.

## Set up Supabase (one time)
1. Create a free project at https://supabase.com/dashboard.
2. In **Authentication → Sign In / Providers → Email**, turn **Confirm email** off so users are signed in right after signup (leave it on if you prefer email confirmation — the app handles both).
3. Copy the project URL and anon key from **Settings → API** into `.env` (below).

## Run locally
```
npm install
cp .env.example .env   # then paste your Supabase URL and anon key
npm run dev
```

## Deploy free (GitHub + Netlify/Cloudflare Pages/Vercel)
1. Push this folder to a GitHub repo (`.env` is git-ignored).
2. Import the repo on Netlify, Cloudflare Pages or Vercel.
   Build command: `npm run build`   Output: `dist`
3. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the host's settings, then deploy.
4. Add your deploy domain (e.g. `yourname.netlify.app`) to Supabase **Authentication → URL Configuration → Redirect URLs**.
5. Use the free `yourname.netlify.app` / `.pages.dev` / `.vercel.app` domain.

## Notes
- Plans are stored in localStorage under a key that includes the account id, so two accounts on the same browser keep separate plans. Data saved before accounts existed is migrated automatically on first sign-in.
- Spending log (`v6`): the floating note taker records what you bought (or plan to buy) with an optional source and date. It filters by day/week/month/year or a custom range and flags yellow at 99% of your money sources, red once past them. In the note options you can switch between using your plan's sources and keeping notes fully separate.
- Supabase's anon key is public by design; it only gates sign-in here. No plan data is sent to Supabase.
- Free Supabase projects pause after ~1 week of inactivity — visiting the dashboard and unpausing restores sign-in.
- localStorage is per browser and per device. Use Summary > Export backup to move data.
