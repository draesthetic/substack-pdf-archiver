// Shared archiving engine used by both the CLI (archive.js) and the web
// dashboard (server.js). All progress is reported through a `log(line)`
// callback so each caller can route it wherever it wants (stdout, SSE, …).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import {
  OUTPUT_BASE,
  STORAGE_STATE,
  THROTTLE_MIN_MS,
  THROTTLE_MAX_MS,
  PAGE_SIZE,
} from "./config.js";
import { normalizePublication } from "./lib.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () =>
  THROTTLE_MIN_MS + Math.floor(Math.random() * (THROTTLE_MAX_MS - THROTTLE_MIN_MS + 1));

const sanitize = (title) =>
  title
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

const MAX_ATTEMPTS = 3;

export const sessionExists = () => fs.existsSync(STORAGE_STATE);

// Load a post and print it to PDF. Throws on failure so the caller can retry.
// We deliberately avoid waitUntil:"networkidle" — Substack pages keep firing
// analytics/embed requests, so "idle" often never arrives. Instead we wait for
// the DOM, then for the article body to actually be present.
const renderPost = async (page, url, filepath) => {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page
    .waitForSelector("article, .available-content, .single-post, .post", { timeout: 30000 })
    .catch(() => {});
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = () => {
        window.scrollBy(0, window.innerHeight);
        y += window.innerHeight;
        if (y < document.body.scrollHeight) setTimeout(step, 200);
        else resolve();
      };
      step();
    });
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(1200);

  await page.pdf({
    path: filepath,
    format: "A4",
    printBackground: true,
    margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
  });
};

// Walk the archive API page by page. Posts come newest-first, so when `since`
// is set we can stop as soon as we cross below it instead of fetching everything.
const fetchPosts = async (origin, { since, until }, log) => {
  const posts = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = `${origin}/api/v1/archive?sort=new&offset=${offset}&limit=${PAGE_SIZE}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`Archive API ${res.status} at offset ${offset}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    let crossedSince = false;
    for (const post of batch) {
      const date = (post.post_date || "").slice(0, 10);
      if (since && date < since) {
        crossedSince = true;
        continue;
      }
      if (until && date > until) continue;
      posts.push(post);
    }
    log(`  …scanned to ${(batch.at(-1).post_date || "").slice(0, 10)}, kept ${posts.length}`);
    if (crossedSince) break;
    await sleep(500);
  }
  return posts;
};

// Run a full archive job. Options: { publication, since, until }.
// `since`/`until` are "YYYY-MM-DD" or undefined (undefined = no bound = "all").
// Returns a summary { saved, skipped, failed, total, outputDir }.
// `signal` (optional AbortSignal) lets a caller cancel mid-run.
export const archive = async ({ publication, since, until }, log, signal) => {
  if (!sessionExists()) {
    throw new Error(`No saved session. Run "npm run login" first.`);
  }
  const { origin, host } = normalizePublication(publication);
  const outputDir = path.join(OUTPUT_BASE, host);
  fs.mkdirSync(outputDir, { recursive: true });

  log(`Publication: ${origin}`);
  log(since || until ? `Date filter: ${since || "beginning"} … ${until || "now"}` : "Range: all posts");
  log("Fetching post list from the archive API…");
  const posts = await fetchPosts(origin, { since, until }, log);
  log(`Posts to process: ${posts.length}`);

  const summary = { saved: 0, skipped: 0, failed: 0, total: posts.length, outputDir };
  if (posts.length === 0) {
    log("Nothing matched. Done.");
    return summary;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await context.newPage();

  try {
    for (const [i, post] of posts.entries()) {
      if (signal?.aborted) {
        log("■ Stopped by user.");
        break;
      }
      const date = post.post_date ? post.post_date.slice(0, 10) : "0000-00-00";
      const title = sanitize(post.title || post.slug || `post-${post.id}`);
      const filename = `${date} – ${title}.pdf`;
      const filepath = path.join(outputDir, filename);
      const label = `[${i + 1}/${posts.length}] ${filename}`;

      if (fs.existsSync(filepath)) {
        log(`↷ skip (exists)  ${label}`);
        summary.skipped++;
        continue;
      }

      let lastErr;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (signal?.aborted) break;
        try {
          await renderPost(page, post.canonical_url, filepath);
          log(`✓ saved         ${label}${attempt > 1 ? `  (attempt ${attempt})` : ""}`);
          summary.saved++;
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (attempt < MAX_ATTEMPTS) {
            const backoff = attempt * 4000;
            log(`…retry ${attempt + 1}/${MAX_ATTEMPTS} in ${backoff / 1000}s  ${label}  — ${err.message.split("\n")[0]}`);
            await sleep(backoff);
          }
        }
      }
      if (lastErr) {
        log(`✗ FAILED        ${label}  — ${lastErr.message.split("\n")[0]}`);
        summary.failed++;
      }

      await sleep(jitter());
    }
  } finally {
    await browser.close();
  }

  log(`Done. ${summary.saved} saved, ${summary.skipped} skipped, ${summary.failed} failed → ${outputDir}/`);
  if (summary.failed > 0) log("Re-run to retry failures (existing PDFs are skipped).");
  return summary;
};
