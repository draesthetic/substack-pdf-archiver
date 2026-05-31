// Local dashboard server. Serves the UI and drives core.archive(), streaming
// live progress to the browser over Server-Sent Events. No external deps.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { archive, sessionExists } from "./core.js";
import { STORAGE_STATE, OUTPUT_BASE } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4321;

let jobRunning = false; // only one archive job at a time
let loginCtx = null; // holds the headed browser/context between login steps

const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "Content-Type": type });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // ── Static: the dashboard page ──
  if (req.method === "GET" && url.pathname === "/") {
    return send(res, 200, fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8"), "text/html");
  }

  // ── Is a saved login session present? ──
  if (req.method === "GET" && url.pathname === "/api/session") {
    return send(res, 200, { ready: sessionExists() });
  }

  // ── Login step 1: open a real browser at Substack's sign-in page ──
  if (req.method === "POST" && url.pathname === "/api/login/start") {
    try {
      if (loginCtx) await loginCtx.browser.close().catch(() => {});
      const browser = await chromium.launch({ headless: false });
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto("https://substack.com/sign-in", { waitUntil: "domcontentloaded" });
      loginCtx = { browser, context };
      return send(res, 200, { ok: true });
    } catch (err) {
      return send(res, 500, { error: err.message });
    }
  }

  // ── Login step 2: save the session from the open browser, then close it ──
  if (req.method === "POST" && url.pathname === "/api/login/finish") {
    if (!loginCtx) return send(res, 400, { error: "Login was not started." });
    try {
      await loginCtx.context.storageState({ path: STORAGE_STATE });
      await loginCtx.browser.close().catch(() => {});
      loginCtx = null;
      return send(res, 200, { ok: true });
    } catch (err) {
      return send(res, 500, { error: err.message });
    }
  }

  // ── Archive run: stream progress as Server-Sent Events ──
  if (req.method === "GET" && url.pathname === "/api/archive") {
    if (jobRunning) return send(res, 409, { error: "A job is already running." });
    if (!sessionExists()) return send(res, 400, { error: "Not logged in. Click “Connect Substack account” first." });

    const publication = url.searchParams.get("publication")?.trim();
    if (!publication) return send(res, 400, { error: "Publication URL is required." });
    const all = url.searchParams.get("all") === "true";
    const since = all ? undefined : url.searchParams.get("since") || undefined;
    const until = all ? undefined : url.searchParams.get("until") || undefined;
    for (const [k, v] of Object.entries({ since, until })) {
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return send(res, 400, { error: `${k} must be YYYY-MM-DD` });
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const event = (name, payload) => res.write(`event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`);
    const controller = new AbortController();
    req.on("close", () => controller.abort()); // browser closed/stopped → cancel

    jobRunning = true;
    try {
      const summary = await archive({ publication, since, until }, (line) => event("log", line), controller.signal);
      event("done", summary);
    } catch (err) {
      event("error", err.message);
    } finally {
      jobRunning = false;
      res.end();
    }
    return;
  }

  send(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`\n  Substack PDF Archiver dashboard`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  PDFs save under ${OUTPUT_BASE}/<publication-host>/`);
  console.log(`  Press Ctrl-C to stop the server.\n`);
});
