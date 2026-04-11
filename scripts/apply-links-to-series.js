// scripts/apply-links-to-series.js
// Load both interim maps (category-series-map.json, tag-series-map.json) and
// update each data/fred/series/{ID}.json file with category_ids[] and tags[]
// fields. Also writes inverse indexes for fast taxonomy-first lookups:
//   data/fred/category-to-series.json
//   data/fred/tag-to-series.json
//
// Memory-bounded: interim maps stay in memory (~100-150 MB combined), but the
// series-file update pass processes one file at a time.
//
// Idempotent: re-running overwrites category_ids/tags fields. Observations and
// other fields are preserved.

import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, ensureDir, readJson, writeJson } from './lib/io.js';
import { SERIES_DIR, pathForSeries } from './lib/series-path.js';

const INTERIM_DIR = path.join(DATA_DIR, '_interim');
const CAT_MAP_FILE = path.join(INTERIM_DIR, 'category-series-map.json');
const TAG_MAP_FILE = path.join(INTERIM_DIR, 'tag-series-map.json');

const INVERSE_CAT_FILE = path.join(DATA_DIR, 'category-to-series.json');
const INVERSE_TAG_FILE = path.join(DATA_DIR, 'tag-to-series.json');

async function main() {
  const catMap = await readJson(CAT_MAP_FILE);
  if (!catMap) throw new Error('category-series-map.json not found — run walk-category-links.js first');
  const tagMap = await readJson(TAG_MAP_FILE);
  if (!tagMap) throw new Error('tag-series-map.json not found — run walk-tag-links.js first');

  const seriesToCategories = catMap.series_to_categories || {};
  const seriesToTags = tagMap.series_to_tags || {};

  console.log(
    `Loaded interim maps: ${Object.keys(seriesToCategories).length} series→categories, ${Object.keys(seriesToTags).length} series→tags`
  );

  // Union of all series IDs we need to update
  const allSeries = new Set([
    ...Object.keys(seriesToCategories),
    ...Object.keys(seriesToTags),
  ]);
  console.log(`Updating ${allSeries.size} series files...`);

  const startTime = Date.now();
  let updated = 0;
  let missing = 0;
  let errors = 0;

  for (const seriesId of allSeries) {
    const filePath = pathForSeries(seriesId);
    try {
      const existing = await readJson(filePath);
      if (!existing) {
        missing++;
        continue;
      }
      const categoryIds = (seriesToCategories[seriesId] || []).slice().sort((a, b) => a - b);
      const tags = (seriesToTags[seriesId] || []).slice().sort();
      existing.category_ids = categoryIds;
      existing.tags = tags;
      await writeJson(filePath, existing);
      updated++;

      if (updated % 10000 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = (updated / Math.max(elapsed, 1)).toFixed(0);
        const heap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        console.log(
          `[${updated}/${allSeries.size}] · missing=${missing} errors=${errors} · ${rate}/s · heap=${heap}MB · ${elapsed.toFixed(0)}s`
        );
      }
    } catch (err) {
      errors++;
      if (errors < 10) console.warn(`[err] ${seriesId}: ${err.message}`);
    }
  }

  console.log(
    `\n✔ Series update pass: ${updated} updated · ${missing} missing (not in series/) · ${errors} errors`
  );

  // Build and save inverse indexes
  console.log('\nBuilding inverse indexes...');

  const categoryToSeries = {};
  for (const [seriesId, cats] of Object.entries(seriesToCategories)) {
    for (const catId of cats) {
      (categoryToSeries[catId] ||= []).push(seriesId);
    }
  }
  for (const catId of Object.keys(categoryToSeries)) {
    categoryToSeries[catId].sort();
  }
  await writeJson(INVERSE_CAT_FILE, {
    generated_at: new Date().toISOString(),
    category_count: Object.keys(categoryToSeries).length,
    total_series_occurrences: Object.values(categoryToSeries).reduce((n, a) => n + a.length, 0),
    categories: categoryToSeries,
  });
  console.log(
    `  category-to-series.json: ${Object.keys(categoryToSeries).length} categories`
  );

  const tagToSeries = {};
  for (const [seriesId, tags] of Object.entries(seriesToTags)) {
    for (const tagName of tags) {
      (tagToSeries[tagName] ||= []).push(seriesId);
    }
  }
  for (const tagName of Object.keys(tagToSeries)) {
    tagToSeries[tagName].sort();
  }
  await writeJson(INVERSE_TAG_FILE, {
    generated_at: new Date().toISOString(),
    tag_count: Object.keys(tagToSeries).length,
    total_series_occurrences: Object.values(tagToSeries).reduce((n, a) => n + a.length, 0),
    tags: tagToSeries,
  });
  console.log(
    `  tag-to-series.json: ${Object.keys(tagToSeries).length} tags`
  );

  const totalElapsed = (Date.now() - startTime) / 1000;
  console.log(`\n✔ All done. ${totalElapsed.toFixed(0)}s total.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
