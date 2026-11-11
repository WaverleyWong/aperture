# Aperture App

## Working rules for this repo

- Before starting any work: `git fetch`, then `git pull --ff-only` on main. If it isn't a clean fast-forward, stop and tell me.
- Work on a branch, never directly on main. Push the branch and let me check the Vercel preview before anything is merged.
- Never change the database schema or data without asking me first. Localhost and Vercel previews use the live Turso database, and `runMigrations()` runs on every API request.
- This repo is public. Stage files by explicit path only — never `git add .`, `git add -A` or `git commit -a`. Never commit images, screenshots, or anything containing a secret or token.
- `npm run build` must pass. `npm run lint` has pre-existing errors; don't increase the count.
- Waverley uses she/her.
