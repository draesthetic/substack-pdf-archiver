# Setup on a new machine (instructions for Claude Code)

> Goal: get substack-pdf-archiver running after a fresh `git clone`, on **any**
> machine and from **any** directory. Nothing here assumes a fixed path.
>
> **Read this first:** a fresh clone contains the **scraper only**. Two things
> are gitignored and therefore NOT on GitHub — the archive itself and the login
> session. Both are re-generatable; see §3 and §4. Neither should ever be
> committed (the archive is 3+ GB of paywalled content; the session is auth
> state that expires).

## 0. Orient yourself (never hardcode paths)

```bash
cd "$(git rev-parse --show-toplevel)"
```

`config.js` uses repo-relative paths (`OUTPUT_BASE = "./pdfs"`,
`STORAGE_STATE = "./storageState.json"`), so as long as commands run from the
repo root, the tool works wherever you clone it. (Ignore the hardcoded
`cd ~/Downloads/...` line in `README.md` — it predates the move.)

## 1. Install

Requires Node.js (recent LTS). One dependency, Playwright, plus its browser:

```bash
npm install
npx playwright install chromium
```

## 2. Log in to Substack (regenerates `storageState.json`)

The old session file did not come across (gitignored). Just make a new one —
one login covers every publication you subscribe to:

```bash
npm run login          # opens a browser → sign in → press Enter in terminal
```

This writes a fresh `storageState.json` in the repo root. If PDFs later start
showing paywalls, the session expired — re-run this.

> Optional shortcut: if you'd rather not re-login, the old `storageState.json`
> is a tiny (~7 KB) file you can copy from the MacBook into the repo root
> instead of running `npm run login`. It works until it expires. Re-login is
> cleaner and recommended.

## 3. Get the archive back — pick ONE

The 3.3 GB `pdfs/` folder is not in git. Two ways to restore it:

**Option A — re-scrape (nothing to copy; recommended for a fresh machine):**
Re-download each publication. The tool **skips already-downloaded posts** and is
**resumable**, so this is safe to stop/restart. Requires an active paid
subscription to each publication.
```bash
npm run dashboard                       # http://localhost:4321 — paste pub URLs, click Download
# or CLI, per publication:
node archive.js thewolfofharcourtstreet
node archive.js michaeljburry
# incremental (only new posts since a date):
node archive.js foo --since 2026-05-31
```
Downloading ~3 GB fresh takes a while (throttled 3–5 s/post by design), but it's
fully automated and unattended.

**Option B — copy the existing archive (avoids re-downloading):**
If you want the exact current archive without re-scraping, copy the folder over
once (Mac-to-Mac). From the OLD machine:
```bash
rsync -av --progress \
  ~/Downloads/CLAUDE/Code/substack-pdf-archiver/pdfs/ \
  <user>@<mac-mini>.local:"$(: path to the cloned repo)"/pdfs/
```
Point the destination at `pdfs/` **inside wherever you cloned the repo on the
mini**. After copying, future runs still skip existing files — you'd only be
fetching genuinely new posts.

> Which to choose: Option A if you're fine re-downloading and want zero manual
> steps; Option B if you want to preserve the exact archive (or don't want to
> re-hit paywalls / subscriptions). Either way the end state is identical PDFs
> under `pdfs/<publication-host>/`.

## 4. Run

```bash
npm run dashboard      # http://localhost:4321  (easiest — GUI)
# or
npm run archive        # CLI, uses default publication in config.js
```

## Notes

- **What's inside `pdfs/`**: besides the PDFs, some publication folders contain
  an `.llmwiki/` index (`index.db`) used by your separate LLM-wiki projects.
  Those indexes rebuild from the PDFs; they are not needed to run the archiver.
- **Personal use only** — the archive is paid content; don't redistribute. This
  is also exactly why `pdfs/` stays out of git.
- `config.js` defaults (fallback publication, throttle, page size) are fine as-is;
  publications are normally passed per-run via the dashboard or CLI.
