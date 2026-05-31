// Shared helpers: argument parsing and publication-URL normalizing.
import { PUBLICATION } from "./config.js";

// Normalize whatever the user passes ("tscsw", "tscsw.substack.com",
// "https://tscsw.substack.com/p/foo") into "https://host" + the bare host.
export const normalizePublication = (input) => {
  let raw = (input || PUBLICATION).trim();
  if (!/^https?:\/\//i.test(raw)) {
    // Bare slug like "tscsw" → assume *.substack.com
    raw = raw.includes(".") ? `https://${raw}` : `https://${raw}.substack.com`;
  }
  const host = new URL(raw).host;
  return { origin: `https://${host}`, host };
};

// Parse: node script.js [publicationUrl] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
// The first non-flag argument is the publication. Flags can appear anywhere.
export const parseArgs = (argv) => {
  const args = argv.slice(2);
  const opts = { publication: undefined, since: undefined, until: undefined };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--since") opts.since = args[++i];
    else if (a === "--until") opts.until = args[++i];
    else if (a.startsWith("--since=")) opts.since = a.slice(8);
    else if (a.startsWith("--until=")) opts.until = a.slice(8);
    else if (!a.startsWith("--") && opts.publication === undefined) opts.publication = a;
  }
  for (const key of ["since", "until"]) {
    if (opts[key] && !/^\d{4}-\d{2}-\d{2}$/.test(opts[key])) {
      throw new Error(`--${key} must be YYYY-MM-DD, got "${opts[key]}"`);
    }
  }
  return opts;
};
