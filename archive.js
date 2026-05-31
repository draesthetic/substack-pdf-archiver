// CLI front-end. The actual work lives in core.js (shared with the dashboard).
//
// Usage:
//   node archive.js                                  (uses default pub from config.js)
//   node archive.js https://foo.substack.com         (a specific publication)
//   node archive.js foo                              (shorthand for foo.substack.com)
//   node archive.js foo --since 2026-05-31           (only posts on/after that date)
//   node archive.js foo --since 2026-05-31 --until 2026-06-15
import { parseArgs } from "./lib.js";
import { archive } from "./core.js";

const run = async () => {
  const opts = parseArgs(process.argv);
  await archive(
    { publication: opts.publication, since: opts.since, until: opts.until },
    (line) => console.log(line),
  );
  process.exit(0);
};

run().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
