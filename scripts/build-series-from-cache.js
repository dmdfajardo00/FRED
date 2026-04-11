// scripts/build-series-from-cache.js
// Read all release-series-raw/release-*.json files, dedupe by series_id, and
// write one flat per-series metadata file: data/fred/series/{ID}.json
//
// Memory footprint: holds a Map<series_id, {release_ids[], popularity}> for
// dedup tracking only — metadata is streamed straight to disk on first sight.
// Estimated peak: ~50–100 MB for ~830K series.
//
// Per-series file format (metadata only — observations added later):
// {
//   id, title, observation_start, observation_end, frequency, frequency_short,
//   units, units_short, seasonal_adjustment, seasonal_adjustment_short,
//   last_updated, popularity, group_popularity, notes,
//   release_ids: [int],
//   built_at: ISO8601,
//   observations: null  ← filled in by fetch-observations.js
// }

import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, ensureDir, readJson, writeJson } from './lib/io.js';
import { SERIES_DIR, pathForSeries } from './lib/series-path.js';

const CACHE_DIR = path.join(DATA_DIR, 'release-series-raw');

function compactMeta(s) {
  return {
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
  };
}

async function main() {
  await ensureDir(SERIES_DIR);

  // Discover release cache files
  const cacheFiles = (await fs.readdir(CACHE_DIR))
    .filter((f) => f.startsWith('release-') && f.endsWith('.json'))
    .sort();

  console.log(`Reading ${cacheFiles.length} release cache files.`);

  // Dedup map — series_id → release_ids[]. Metadata goes to disk on first sight.
  const releaseIdsBySeries = new Map();
  let firstSightCount = 0;
  let totalSeen = 0;
  const startTime = Date.now();

  for (let i = 0; i < cacheFiles.length; i++) {
    const file = cacheFiles[i];
    const data = await readJson(path.join(CACHE_DIR, file));
    if (!data || !Array.isArray(data.pages)) continue;
    const relId = data.release_id;

    for (const page of data.pages) {
      const series = page.seriess || [];
      for (const s of series) {
        totalSeen++;
        const known = releaseIdsBySeries.get(s.id);
        if (!known) {
          // First sight — write the metadata file fresh
          releaseIdsBySeries.set(s.id, [relId]);
          firstSightCount++;
          const out = {
            ...compactMeta(s),
            release_ids: [relId],
            built_at: new Date().toISOString(),
            observations: null,
            observation_count: null,
          };
          await writeJson(pathForSeries(s.id), out);
        } else if (!known.includes(relId)) {
          known.push(relId);
        }
      }
    }

    if ((i + 1) % 25 === 0 || i === cacheFiles.length - 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      const heap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      console.log(
        `[${i + 1}/${cacheFiles.length}] ${file} · unique=${firstSightCount} · seen=${totalSeen} · heap=${heap}MB · elapsed=${elapsed.toFixed(0)}s`
      );
    }
  }

  // Second pass: update files for series that ended up in multiple releases
  console.log(`\nSecond pass: updating release_ids for series in multiple releases…`);
  let updated = 0;
  for (const [seriesId, releaseIds] of releaseIdsBySeries) {
    if (releaseIds.length <= 1) continue;
    const file = pathForSeries(seriesId);
    const existing = await readJson(file);
    if (!existing) continue;
    existing.release_ids = releaseIds;
    await writeJson(file, existing);
    updated++;
    if (updated % 5000 === 0) {
      console.log(`  updated ${updated} multi-release series…`);
    }
  }

  console.log(
    `\n✔ Built ${firstSightCount} unique series files · ${totalSeen} occurrences seen · ${updated} multi-release updates`
  );
  console.log(`   Output: ${SERIES_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
