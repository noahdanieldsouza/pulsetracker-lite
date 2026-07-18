# PulseTracker Lite

A free, static, daily-refreshed sentiment tracker for 4 politicians: Nirav Shah, Shenna Bellows, Troy Jackson, and Jordan Wood. Pulls news (NewsData.io), social posts (Bluesky), and YouTube video comments (YouTube Data API v3) from the last 24 hours, scores them with sentiment analysis, and shows per-candidate news/social/YouTube/overall sentiment plus total mentions.

See `plan.md` for the full design rationale. This README is the practical setup guide.

## How it works

1. `scripts/build-data.js` runs once a day via GitHub Actions. It fetches every news article and social post mentioning each candidate from the last 24 hours (fully paginated — no fixed cap), scores each item, and writes `public/data.json`.
2. The React app (built with Vite) fetches `data.json` on load and renders it — no backend server involved.
3. GitHub Pages hosts the built static site for free.

**Note on news source:** this originally used NewsAPI.org, but its free "Developer" plan delays articles by ~24 hours (which made a strict last-24-hours filter return nothing) and explicitly restricts free-tier use to local development only — not something that can run unattended from a GitHub Actions runner. It's since been switched to [NewsData.io](https://newsdata.io), whose free tier allows non-localhost/production use with only a ~12 hour delay.

## Local development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in real credentials:
   ```bash
   cp .env.example .env
   ```
   - `NEWSDATA_API_KEY`: from [newsdata.io](https://newsdata.io) (free tier: 200 requests/day)
   - `BLUESKY_HANDLE` / `BLUESKY_APP_PASSWORD`: create an **app password** at bsky.app → Settings → App Passwords. Never use your real account password here.
   - `YOUTUBE_API_KEY`: from [Google Cloud Console](https://console.cloud.google.com/), enable "YouTube Data API v3" on a project, then create an API key (Credentials → Create Credentials → API key). No OAuth needed, just a plain key for public search/comment reads.
3. Sanity-check the news API key works:
   ```bash
   node --env-file=.env scripts/debug-newsdata.js
   ```
4. Generate a fresh `data.json` locally (Node 20.6+ loads `.env` natively):
   ```bash
   node --env-file=.env scripts/build-data.js
   ```
5. Run the app:
   ```bash
   npm run dev
   ```

A sample `public/data.json` is already committed so `npm run dev` works out of the box even before you run the pipeline.

## Deploying (GitHub Pages, free)

1. Push this repo to GitHub.
2. Add repo secrets (Settings → Secrets and variables → Actions):
   - `NEWSDATA_API_KEY`
   - `BLUESKY_HANDLE`
   - `BLUESKY_APP_PASSWORD`
   - `YOUTUBE_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `GH_PAT` (a personal access token with repo write access, used so the bot's data commits can trigger the deploy workflow)
3. Enable Pages: Settings → Pages → Source → **GitHub Actions**.
4. If your repo name isn't `pulsetracker-lite`, update the `base` path in `vite.config.js` to match.
5. Trigger the workflows once manually to confirm everything works (Actions tab → select workflow → Run workflow):
   - **Social refresh** — fetches/scores Bluesky data every 10 minutes, commits `public/data.json`.
   - **News refresh** — fetches/scores news data daily, commits `public/data.json`.
   - **YouTube refresh** — fetches/scores YouTube comment data daily, commits `public/data.json`.
   - **Deploy to GitHub Pages** — builds the React app and publishes it.

After that, all run automatically on their schedules, and every push to `main` (including the data-refresh commits) redeploys the site.

## Data point notes

- **Mentions**: total news + social + YouTube comment mentions in the last 24 hours, tracked as its own metric independent of sentiment — a candidate can be heavily discussed without that discussion being positive or negative.
- **Overall sentiment**: simple average of news, social, and YouTube sentiment. If one or more categories have no data, overall falls back to averaging whichever categories do.
- **Missing data**: shown as "No data" rather than treated as a neutral 0, so a quiet day doesn't look like a lukewarm one.

## Security notes

- Never commit `.env` (already gitignored) or hardcode API keys/passwords in scripts.
- Use a Bluesky app password, not your real login — if this repo is ever public, a leaked app password can be revoked without touching your main account.
- Rotate the NewsAPI key and Bluesky password if they were ever previously committed to source control (e.g. in the original Foundry transforms) — even though this project no longer uses NewsAPI.org, that key was exposed and should still be rotated/revoked.
