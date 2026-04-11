// scripts/fetch-by-release.js
// Walk /fred/release/series for every release. Save the raw API response per
// release to a cache file — no in-memory accumulation, no giant index.
//
// Output: data/fred/release-series-raw/release-{id}.json
//   { release_id, fetched_at, pages: [ <raw API response>, ... ] }
//
// Resumable: existing release files are skipped on restart.
// Memory footprint: ~one page in flight at a time (<5 MB).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchFred } from './lib/fred-client.js';
import { DATA_DIR, TAXONOMY_DIR, ensureDir, readJson, writeJson } from './lib/io.js';

const CACHE_DIR = path.join(DATA_DIR, 'release-series-raw');
const PAGE_SIZE = 1000;

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const releasesData = await readJson(path.join(TAXONOMY_DIR, 'releases.json'));
  if (!releasesData) throw new Error('releases.json not found — run fetch-releases.js first');
  const releases = releasesData.releases;

  await ensureDir(CACHE_DIR);

  console.log(`Walking ${releases.length} releases via /fred/release/series.`);
  const startTime = Date.now();
  let processed = 0;
  let skipped = 0;
  let errors = 0;
  let totalSeries = 0;

  for (const rel of releases) {
    const relId = rel.id;
    const cacheFile = path.join(CACHE_DIR, `release-${relId}.json`);

    if (await exists(cacheFile)) {
      skipped++;
      processed++;
      continue;
    }

    try {
      const pages = [];
      let offset = 0;
      let countForRel = 0;
      while (true) {
        const res = await fetchFred('/fred/release/series', {
          release_id: relId,
          limit: PAGE_SIZE,
          offset,
        });
        pages.push(res);
        const page = res.seriess || [];
        countForRel += page.length;
        const total = res.count ?? page.length;
        if (page.length === 0) break;
        if (offset + page.length >= total) break;
        offset += PAGE_SIZE;
      }

      await writeJson(cacheFile, {
        release_id: relId,
        release_name: rel.name,
        fetched_at: new Date().toISOString(),
        series_count: countForRel,
        pages,
      });

      totalSeries += countForRel;
      processed++;

      const elapsed = (Date.now() - startTime) / 1000;
      const rate = ((processed - skipped) / Math.max(elapsed, 1) * 60).toFixed(1);
      const remaining = releases.length - processed;
      const etaMin = (remaining / Math.max((processed - skipped) / Math.max(elapsed, 1), 0.001)) / 60;
      console.log(
        `[${processed}/${releases.length}] release=${relId} (${rel.name}) · series=${countForRel} · cumulative=${totalSeries} · ${rate}/min · eta=${etaMin.toFixed(1)}min`
      );
    } catch (err) {
      errors++;
      console.warn(`[err] release ${relId}: ${err.message}`);
    }
  }

  console.log(
    `\n✔ Done. ${processed - errors}/${releases.length} releases cached · ${skipped} skipped · ${totalSeries} series-occurrences (with duplicates) · ${errors} errors`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
