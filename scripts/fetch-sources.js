// scripts/fetch-sources.js
// Fetch the full list of FRED data sources (flat, paginated).
// Output: data/fred/taxonomy/sources.json

import path from 'node:path';
import { paginateFred } from './lib/fred-client.js';
import { TAXONOMY_DIR, writeJson } from './lib/io.js';

async function main() {
  console.log('Fetching all FRED sources...');
  const sources = await paginateFred('/fred/sources', {}, 'sources', 1000);

  const out = {
    fetched_at: new Date().toISOString(),
    count: sources.length,
    sources,
  };

  const file = path.join(TAXONOMY_DIR, 'sources.json');
  await writeJson(file, out);
  console.log(`✔ Wrote ${sources.length} sources to ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
