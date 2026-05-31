# Substack PDF Archiver

Bulk-saves a Substack publication's posts as **pixel-perfect PDFs**, named
`YYYY-MM-DD – Title.pdf` so the folder sorts chronologically. For personal,
offline archival of publications **you have a paid subscription to**.

## Setup

```bash
cd ~/Downloads/CLAUDE/Code/substack-pdf-archiver
npm install
npx playwright install chromium
```

## Dashboard (easiest)

```bash
npm run dashboard
```

Open <http://localhost:4321>. From there you can:

1. **Connect Substack account** — opens a browser, you sign in, click “I'm
   signed in”. One login covers every publication you subscribe to.
2. **Paste a publication URL** (full URL or just the slug).
3. **Download all posts** (checkbox, on by default) — or uncheck it and pick a
   **From / To date range**.
4. Hit **Download** and watch live progress; **Stop** cancels mid-run.

PDFs land in `pdfs/<publication-host>/`. Already-downloaded posts are skipped.

The command-line workflow below does the same thing if you prefer a terminal.

---

## 1. Log in (one time, per account)

```bash
npm run login
```

A browser window opens at Substack's sign-in page. Log into your account, then
press Enter in the terminal. The session is saved to `storageState.json`.

**One login covers every publication you subscribe to** — Substack uses a single
account sign-in, so you don't log in separately per publication.

## 2. Archive

```bash
# Default publication (set in config.js)
npm run archive

# Any publication — full URL, or just the slug
node archive.js https://foo.substack.com
node archive.js foo                    # shorthand for foo.substack.com
```

PDFs land in `pdfs/<publication-host>/`, so each publication gets its own folder.

## Incremental downloads (`--since` / `--until`)

To grab only new posts since you last ran it — no re-scanning the old ones:

```bash
node archive.js foo --since 2026-05-31
node archive.js foo --since 2026-05-31 --until 2026-06-15
```

Posts come newest-first, so `--since` stops paging the API as soon as it crosses
below the date — fast even on huge archives. Dates are `YYYY-MM-DD`.

> Even without `--since`, existing PDFs are skipped, so re-runs never re-render.
> `--since` is just faster because it doesn't even visit the old posts.

## Other behavior

- **Pixel-perfect**: screen styling + backgrounds, scrolls to load lazy images.
- **Throttled**: randomized 3–5s between posts.
- **Resumable**: stop/restart anytime; re-run to retry failures.

## Config

`config.js` holds defaults: the fallback publication, output base dir, throttle
range, and API page size.

## Notes

- Personal use only — don't redistribute paid content.
- If PDFs start showing paywalls, your session expired — re-run `npm run login`.
```
