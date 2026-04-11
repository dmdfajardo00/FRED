// scripts/reshape-bulk-to-series.js
// Read raw bulk observations from data/fred/raw-bulk/release-*/page-*.json and
// merge into the existing flat per-series files at data/fred/series/{ID}.json.
//
// MEMORY-BOUNDED REWRITE: processes ONE PAGE AT A TIME. For each page:
//   1. Load page JSON
//   2. Accumulate series in a tiny per-page map
//   3. Flush each series to disk (read existing file, merge, dedup by date, write back)
//   4. Discard the page and move on
//
// This bounds peak memory to ~one page (~100 MB for 500K observations) instead
// of the previous "one release" approach which could balloon to multi-GB for
// releases like "Main Economic Indicators" (13M observations).
//
// The merge is idempotent: re-running this script is safe and will not duplicate
// observations.  Observations are deduped by date with existing-values preserved
// for duplicate dates from step 4's per-series fetch.

import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, ensureDir, readJson, writeJson } from './lib/io.js';
import { SERIES_DIR, pathForSeries } from './lib/series-path.js';

const BULK_DIR = path.join(DATA_DIR, 'raw-bulk');

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await ensureDir(SERIES_DIR);

  const dirEntries = await fs.readdir(BULK_DIR, { withFileTypes: true });
  const releaseDirs = dirEntries
    .filter((d) => d.isDirectory() && d.name.startsWith('release-'))
    .map((d) => path.join(BULK_DIR, d.name))
    .sort();

  console.log(`Reshape (per-page, memory-bounded) — ${releaseDirs.length} release dirs`);

  let totalSeries = 0;
  let totalObs = 0;
  let createdNew = 0;
  let mergedExisting = 0;
  const startTime = Date.now();

  for (const relDir of releaseDirs) {
    const relName = path.basename(relDir);
    const pages = (await fs.readdir(relDir))
      .filter((f) => f.startsWith('page-') && f.endsWith('.json'))
      .sort();
    if (pages.length === 0) continue;

    let releaseSeries = 0;
    let releaseObs = 0;
    let releaseMeta = null;

    for (const pageFile of pages) {
      const data = await readJson(path.join(relDir, pageFile));
      if (!data) continue;
      if (!releaseMeta && data.release) releaseMeta = data.release;

      // Accumulate series in a per-PAGE map (not per-release) — bounded memory
      const pageMap = new Map(); // series_id → { meta, observations[] }
      for (const s of data.series || []) {
        let entry = pageMap.get(s.series_id);
        if (!entry) {
          entry = {
            meta: {
              id: s.series_id,
              title: s.title,
              frequency: s.frequency,
              units: s.units,
              seasonal_adjustment: s.seasonal_adjustment,
              last_updated: s.last_updated,
              copyright_id: s.copyright_id,
              notes: s.notes,
            },
            observations: [],
          };
          pageMap.set(s.series_id, entry);
        }
        // Push raw observations — dedup+sort happens at flush time
        for (const obs of s.observations || []) {
          entry.observations.push({ date: obs.date, value: obs.value });
        }
      }

      // Flush the page's series to disk one at a time
      for (const [seriesId, entry] of pageMap) {
        const filePath = pathForSeries(seriesId);
        const existing = (await exists(filePath)) ? await readJson(filePath) : null;

        // Build observation set: existing + new, deduped by date
        // Existing values win for conflicting dates (they came from authoritative
        // step 4 per-series fetch).
        const byDate = new Map();
        for (const o of entry.observations) {
          byDate.set(o.date, o.value);
        }
        if (existing && Array.isArray(existing.observations)) {
          for (const o of existing.observations) {
            byDate.set(o.date, o.value); // existing overrides bulk if dates collide
          }
        }
        const sortedObs = Array.from(byDate, ([date, value]) => ({ date, value }))
          .sort((a, b) => (a.date < b.date ? -1 : 1));

        const out = existing
          ? {
              ...existing,
              observations: sortedObs,
              observation_count: sortedObs.length,
              observations_fetched_at:
                existing.observations_fetched_at || new Date().toISOString(),
              observations_source: existing.observations_source || 'bulk-release',
            }
          : {
              ...entry.meta,
              release_ids: releaseMeta ? [releaseMeta.release_id] : [],
              built_at: new Date().toISOString(),
              observations: sortedObs,
              observation_count: sortedObs.length,
              observations_fetched_at: new Date().toISOString(),
              observations_source: 'bulk-release',
            };

        await writeJson(filePath, out);
        if (existing) mergedExisting++;
        else createdNew++;
        releaseSeries++;
        releaseObs += sortedObs.length;
      }

      // pageMap goes out of scope here — GC reclaims memory
    }

    totalSeries += releaseSeries;
    totalObs += releaseObs;
    const elapsed = (Date.now() - startTime) / 1000;
    const heap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const rate = (totalSeries / Math.max(elapsed, 1)).toFixed(0);
    console.log(
      `[${relName}] pg=${pages.length} series=${releaseSeries} obs=${releaseObs} · cumul_series=${totalSeries} cumul_obs=${totalObs} · new=${createdNew} merged=${mergedExisting} · heap=${heap}MB · ${rate}/s · ${elapsed.toFixed(0)}s`
    );
  }

  console.log(
    `\n✔ Reshape done. ${totalSeries} series · ${totalObs} observations · ${mergedExisting} merged · ${createdNew} created`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
