// scripts/fetch-tags.js
// Fetch the full list of FRED tags and organize by tag_group.
// Output: data/fred/taxonomy/tags.json

import path from 'node:path';
import { paginateFred } from './lib/fred-client.js';
import { TAXONOMY_DIR, writeJson } from './lib/io.js';

const TAG_GROUPS = {
  freq: 'Frequency',
  gen: 'General / Concept',
  geo: 'Geography',
  geot: 'Geography Type',
  rls: 'Release',
  seas: 'Seasonal Adjustment',
  src: 'Source',
};

async function main() {
  console.log('Fetching all FRED tags...');
  const tags = await paginateFred('/fred/tags', {}, 'tags', 1000);

  // Group by tag_group
  const by_group = {};
  for (const g of Object.keys(TAG_GROUPS)) by_group[g] = [];
  for (const t of tags) {
    const g = t.group_id || 'unknown';
    (by_group[g] ||= []).push(t);
  }

  const out = {
    fetched_at: new Date().toISOString(),
    count: tags.length,
    tag_groups: TAG_GROUPS,
    by_group_counts: Object.fromEntries(
      Object.entries(by_group).map(([k, v]) => [k, v.length])
    ),
    tags,
  };

  const file = path.join(TAXONOMY_DIR, 'tags.json');
  await writeJson(file, out);
  console.log(`✔ Wrote ${tags.length} tags to ${file}`);
  console.log('  By group:', out.by_group_counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
