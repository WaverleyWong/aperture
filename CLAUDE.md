# Aperture App

## AI Voice Guidelines

AI-powered features must follow the tone of voice defined in `toneofvoice.md`. Currently that's the header greeting (`src/app/api/greeting/route.ts`); the digests and archive-note only ask for JSON triage and metadata, so the voice doesn't apply to them. Key principles:

- Warm but never sycophantic — no cheerleading, no praise for its own sake
- Witty where the material earns it; dry rather than jolly, and don't force it
- Assess, analyse and reflect — don't restate what the dashboard already shows
- Only reference what's actually in the data; never invent a project, task or person
- Support momentum — don't default to encouraging rest or pause

## Working rules for this repo

- Before starting any work: `git fetch`, then `git pull --ff-only` on main. If it isn't a clean fast-forward, stop and tell me.
- Work on a branch, never directly on main. Push the branch and let me check the Vercel preview before anything is merged.
- Never change the database schema or data without asking me first. Localhost and Vercel previews use the live Turso database, and `runMigrations()` runs on every API request.
- This repo is public. Stage files by explicit path only — never `git add .`, `git add -A` or `git commit -a`. Never commit images, screenshots, or anything containing a secret or token.
- `npm run build` must pass. `npm run lint` has pre-existing errors; don't increase the count.
- Waverley uses she/her.
