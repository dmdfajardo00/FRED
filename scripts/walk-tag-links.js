// scripts/walk-tag-links.js
// Walk /fred/tags/series for every tag in the taxonomy and build a map of
// { series_id → tag_names[] }. Saves to an interim file for later application
// to per-series files.
//
// Inputs:
//   data/fred/taxonomy/tags.json
//
// Outputs:
//   data/fred/_interim/tag-series-map.json
//     {
//       fetched_at: ISO,
//       total_tags: 5954,
//       completed_tags: ["usa", "bls", ...],  // for resume
//       series_count: N,
//       series_to_tags: { "UNRATE": ["bls", "monthly", "nation", "sa", ...], ... }
//     }
//
// Resumable: completed tags are skipped on restart.
// Memory: ~70-100 MB for the in-memory map.

import path from 'node:path';
import { fetchFred } from './lib/fred-client.js';
import { DATA_DIR, TAXONOMY_DIR, ensureDir, readJson, writeJson } from './lib/io.js';

const INTERIM_DIR = path.join(DATA_DIR, '_interim');
const OUT_FILE = path.join(INTERIM_DIR, 'tag-series-map.json');
const SAVE_EVERY = 50;
const PAGE_SIZE = 1000;

async function main() {
  await ensureDir(INTERIM_DIR);

  const tagsData = await readJson(path.join(TAXONOMY_DIR, 'tags.json'));
  if (!tagsData) throw new Error('tags.json not found');
  const tagNames = (tagsData.tags || [])
    .map((t) => t.name)
    .filter((n) => typeof n === 'string' && n.length > 0)
    .sort();

  const state = (await readJson(OUT_FILE)) || {
    fetched_at: null,
    total_tags: tagNames.length,
    completed_tags: [],
    series_count: 0,
    series_to_tags: {},
  };
  const completed = new Set(state.completed_tags);
  const pending = tagNames.filter((n) => !completed.has(n));

  console.log(
    `Tags: ${tagNames.length} total · ${completed.size} done · ${pending.length} pending`
  );
  console.log(`Starting with ${Object.keys(state.series_to_tags).length} series in map`);

  const startTime = Date.now();
  let processed = 0;
  let errors = 0;

  for (const tagName of pending) {
    try {
      let offset = 0;
      let got = 0;
      while (true) {
        const res = await fetchFred('/fred/tags/series', {
          tag_names: tagName,
          limit: PAGE_SIZE,
          offset,
        });
        const page = res.seriess || [];
        for (const s of page) {
          const existing = state.series_to_tags[s.id];
          if (!existing) {
            state.series_to_tags[s.id] = [tagName];
          } else if (!existing.includes(tagName)) {
            existing.push(tagName);
          }
          got++;
        }
        const total = res.count ?? page.length;
        if (page.length === 0) break;
        if (offset + page.length >= total) break;
        offset += PAGE_SIZE;
      }

      completed.add(tagName);
      processed++;

      if (processed % SAVE_EVERY === 0 || processed === pending.length) {
        state.fetched_at = new Date().toISOString();
        state.completed_tags = Array.from(completed);
        state.series_count = Object.keys(state.series_to_tags).length;
        await writeJson(OUT_FILE, state);

        const elapsed = (Date.now() - startTime) / 1000;
        const rate = ((processed / elapsed) * 60).toFixed(1);
        const remaining = pending.length - processed;
        const etaMin = (remaining / Math.max(processed, 1)) * (elapsed / 60);
        const heap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        console.log(
          `[${processed}/${pending.length}] tag="${tagName}" (+${got}) · uniq_series=${state.series_count} · ${rate}/min · eta=${etaMin.toFixed(1)}min · heap=${heap}MB`
        );
      }
    } catch (err) {
      errors++;
      console.warn(`[err] tag="${tagName}": ${err.message}`);
    }
  }

  state.fetched_at = new Date().toISOString();
  state.completed_tags = Array.from(completed);
  state.series_count = Object.keys(state.series_to_tags).length;
  state.errors = errors;
  state.completed_at = new Date().toISOString();
  await writeJson(OUT_FILE, state);

  console.log(
    `\n✔ Done. ${completed.size}/${tagNames.length} tags walked · ${state.series_count} unique series linked · ${errors} errors`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
