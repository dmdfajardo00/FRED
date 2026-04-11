// scripts/walk-category-links.js
// Walk /fred/category/series for every category in the taxonomy and build a
// map of { series_id → category_ids[] }. Saves to an interim file for later
// application to per-series files.
//
// Inputs:
//   data/fred/taxonomy/categories.json
//
// Outputs:
//   data/fred/_interim/category-series-map.json
//     {
//       fetched_at: ISO,
//       total_categories: 5186,
//       completed_categories: [1, 2, 3, ...],  // for resume
//       series_count: N,
//       series_to_categories: { "UNRATE": [12, 32447], ... }
//     }
//
// Resumable: existing completed_categories are skipped on restart.
// Memory: ~30-50 MB for the in-memory map.

import path from 'node:path';
import { fetchFred } from './lib/fred-client.js';
import { DATA_DIR, TAXONOMY_DIR, ensureDir, readJson, writeJson } from './lib/io.js';

const INTERIM_DIR = path.join(DATA_DIR, '_interim');
const OUT_FILE = path.join(INTERIM_DIR, 'category-series-map.json');
const SAVE_EVERY = 25; // categories
const PAGE_SIZE = 1000;

async function main() {
  await ensureDir(INTERIM_DIR);

  const catsData = await readJson(path.join(TAXONOMY_DIR, 'categories.json'));
  if (!catsData) throw new Error('categories.json not found');
  const catIds = Object.keys(catsData.categories)
    .map(Number)
    .filter((id) => id !== 0)
    .sort((a, b) => a - b);

  // Load prior state — the map lives as a plain object for JSON serialization
  const state = (await readJson(OUT_FILE)) || {
    fetched_at: null,
    total_categories: catIds.length,
    completed_categories: [],
    series_count: 0,
    series_to_categories: {},
  };
  const completed = new Set(state.completed_categories);
  const pending = catIds.filter((id) => !completed.has(id));

  console.log(
    `Categories: ${catIds.length} total · ${completed.size} done · ${pending.length} pending`
  );
  console.log(`Starting with ${Object.keys(state.series_to_categories).length} series in map`);

  const startTime = Date.now();
  let processed = 0;
  let errors = 0;

  for (const catId of pending) {
    try {
      let offset = 0;
      let got = 0;
      while (true) {
        const res = await fetchFred('/fred/category/series', {
          category_id: catId,
          limit: PAGE_SIZE,
          offset,
        });
        const page = res.seriess || [];
        for (const s of page) {
          const existing = state.series_to_categories[s.id];
          if (!existing) {
            state.series_to_categories[s.id] = [catId];
          } else if (!existing.includes(catId)) {
            existing.push(catId);
          }
          got++;
        }
        const total = res.count ?? page.length;
        if (page.length === 0) break;
        if (offset + page.length >= total) break;
        offset += PAGE_SIZE;
      }

      completed.add(catId);
      processed++;

      if (processed % SAVE_EVERY === 0 || processed === pending.length) {
        state.fetched_at = new Date().toISOString();
        state.completed_categories = Array.from(completed);
        state.series_count = Object.keys(state.series_to_categories).length;
        await writeJson(OUT_FILE, state);

        const elapsed = (Date.now() - startTime) / 1000;
        const rate = ((processed / elapsed) * 60).toFixed(1);
        const remaining = pending.length - processed;
        const etaMin = (remaining / Math.max(processed, 1)) * (elapsed / 60);
        const heap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        console.log(
          `[${processed}/${pending.length}] cat=${catId} (+${got}) · uniq_series=${state.series_count} · ${rate}/min · eta=${etaMin.toFixed(1)}min · heap=${heap}MB`
        );
      }
    } catch (err) {
      errors++;
      console.warn(`[err] cat ${catId}: ${err.message}`);
    }
  }

  // Final save
  state.fetched_at = new Date().toISOString();
  state.completed_categories = Array.from(completed);
  state.series_count = Object.keys(state.series_to_categories).length;
  state.errors = errors;
  state.completed_at = new Date().toISOString();
  await writeJson(OUT_FILE, state);

  console.log(
    `\n✔ Done. ${completed.size}/${catIds.length} categories walked · ${state.series_count} unique series linked · ${errors} errors`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
