// scripts/fetch-series-index.js
// Build the master FRED series index by walking /fred/category/series for every
// category in the taxonomy. Deduplicates series by id and tracks which categories
// each series belongs to.
//
// Inputs:
//   data/fred/taxonomy/categories.json   (from fetch-categories.js)
//
// Outputs:
//   data/fred/series-index.json          flat: { count, series: { [id]: {...} } }
//   data/fred/series-index-progress.json resume cursor
//
// Resumable: re-running picks up from the last persisted progress.

import path from 'node:path';
import { fetchFred } from './lib/fred-client.js';
import { DATA_DIR, TAXONOMY_DIR, readJson, writeJson } from './lib/io.js';

const INDEX_FILE = path.join(DATA_DIR, 'series-index.json');
const PROGRESS_FILE = path.join(DATA_DIR, 'series-index-progress.json');
const SAVE_EVERY = 50; // categories
const PAGE_SIZE = 1000;

async function main() {
  // Load category list
  const catsData = await readJson(path.join(TAXONOMY_DIR, 'categories.json'));
  if (!catsData) {
    throw new Error('categories.json not found — run fetch-categories.js first');
  }
  const catIds = Object.keys(catsData.categories)
    .map(Number)
    .filter((id) => id !== 0) // skip ROOT placeholder
    .sort((a, b) => a - b);

  // Load prior state
  const indexState = (await readJson(INDEX_FILE)) || {
    fetched_at: null,
    count: 0,
    series: {},
  };
  const progress = (await readJson(PROGRESS_FILE)) || {
    completed_categories: [],
    errors: [],
  };

  const completed = new Set(progress.completed_categories);
  const pending = catIds.filter((id) => !completed.has(id));

  console.log(
    `${catIds.length} categories total · ${completed.size} done · ${pending.length} pending`
  );
  console.log(`${Object.keys(indexState.series).length} unique series so far`);

  const startTime = Date.now();
  let processed = 0;
  let errors = 0;

  for (const catId of pending) {
    try {
      let offset = 0;
      let totalForCat = 0;
      while (true) {
        const res = await fetchFred('/fred/category/series', {
          category_id: catId,
          limit: PAGE_SIZE,
          offset,
        });
        // Note: FRED returns the array under the key 'seriess' (their typo)
        const page = res.seriess || [];
        for (const s of page) {
          let entry = indexState.series[s.id];
          if (!entry) {
            entry = indexState.series[s.id] = {
              id: s.id,
              title: s.title,
              observation_start: s.observation_start,
              observation_end: s.observation_end,
              frequency: s.frequency,
              frequency_short: s.frequency_short,
              units: s.units,
              units_short: s.units_short,
              seasonal_adjustment: s.seasonal_adjustment,
              seasonal_adjustment_short: s.seasonal_adjustment_short,
              last_updated: s.last_updated,
              popularity: s.popularity ?? 0,
              group_popularity: s.group_popularity ?? 0,
              notes: s.notes || null,
              category_ids: [],
            };
          } else {
            // Refresh metadata if it changed (last_updated, popularity)
            entry.last_updated = s.last_updated;
            entry.popularity = s.popularity ?? entry.popularity;
            entry.group_popularity = s.group_popularity ?? entry.group_popularity;
            entry.observation_end = s.observation_end || entry.observation_end;
          }
          if (!entry.category_ids.includes(catId)) {
            entry.category_ids.push(catId);
          }
          totalForCat++;
        }
        const reported = res.count ?? page.length;
        if (page.length === 0) break;
        if (offset + page.length >= reported) break;
        offset += PAGE_SIZE;
      }

      completed.add(catId);
      processed++;

      if (processed % SAVE_EVERY === 0 || processed === pending.length) {
        await persist(indexState, completed, errors);
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = ((processed / elapsed) * 60).toFixed(1);
        const remaining = pending.length - processed;
        const etaMin = (remaining / Math.max(processed, 1)) * (elapsed / 60);
        console.log(
          `[${processed}/${pending.length}] cat=${catId} (+${totalForCat}) · unique_series=${Object.keys(indexState.series).length} · ${rate}/min · eta=${etaMin.toFixed(1)}min`
        );
      }
    } catch (err) {
      errors++;
      progress.errors.push({ category_id: catId, error: err.message });
      console.warn(`[err] cat ${catId}: ${err.message}`);
    }
  }

  // Final persist
  await persist(indexState, completed, errors, true);

  console.log(
    `\n✔ Done. ${Object.keys(indexState.series).length} unique series across ${completed.size} categories. ${errors} errors.`
  );
}

async function persist(indexState, completed, errors, finalize = false) {
  indexState.count = Object.keys(indexState.series).length;
  indexState.fetched_at = new Date().toISOString();
  await writeJson(INDEX_FILE, indexState);
  await writeJson(PROGRESS_FILE, {
    updated_at: new Date().toISOString(),
    completed_categories: Array.from(completed),
    errors,
    ...(finalize ? { completed_at: new Date().toISOString() } : {}),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
