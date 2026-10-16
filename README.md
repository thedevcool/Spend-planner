# Spend Plan

Minimal personal money planner. React + Vite. Data lives in your browser's localStorage. Login uses an email and password from environment variables.

## Run locally
```
npm install
cp .env.example .env   # then edit email and password
npm run dev
```

## Deploy free (GitHub + Netlify/Cloudflare Pages/Vercel)
1. Push this folder to a GitHub repo (`.env` is git-ignored).
2. Import the repo on Netlify, Cloudflare Pages or Vercel.
   Build command: `npm run build`   Output: `dist`
3. Add environment variables `VITE_AUTH_EMAIL` and `VITE_AUTH_PASSWORD` in the host's settings, then deploy.
4. Use the free `yourname.netlify.app` / `.pages.dev` / `.vercel.app` domain.

## Notes
- Vite bakes env vars into the built JS, so the login is a convenience lock, not strong security. Don't reuse a real password.
- localStorage is per browser and per device. Use Summary > Export backup to move data.
