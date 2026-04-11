// scripts/fetch-releases.js
// Fetch the full list of FRED releases (flat, paginated).
// Output: data/fred/taxonomy/releases.json

import path from 'node:path';
import { paginateFred } from './lib/fred-client.js';
import { TAXONOMY_DIR, writeJson } from './lib/io.js';

async function main() {
  console.log('Fetching all FRED releases...');
  const releases = await paginateFred('/fred/releases', {}, 'releases', 1000);

  const out = {
    fetched_at: new Date().toISOString(),
    count: releases.length,
    releases,
  };

  const file = path.join(TAXONOMY_DIR, 'releases.json');
  await writeJson(file, out);
  console.log(`✔ Wrote ${releases.length} releases to ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
