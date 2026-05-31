// ─── Defaults. Most can be overridden per-run from the command line. ───

// Default publication if you don't pass one on the command line.
// Always use the *.substack.com host (works even for custom-domain pubs).
export const PUBLICATION = "https://example.substack.com";

// PDFs go to <OUTPUT_BASE>/<publication-host>/ so each pub gets its own folder.
export const OUTPUT_BASE = "./pdfs";

// Saved login session. One login covers every pub on your Substack account.
export const STORAGE_STATE = "./storageState.json";

// Throttle between posts (ms). Randomized in [min, max] for a human-ish cadence.
export const THROTTLE_MIN_MS = 3000;
export const THROTTLE_MAX_MS = 5000;

// How many posts the archive API returns per page request.
export const PAGE_SIZE = 50;
