// scripts/fetch-observations.js
// Fetch full observation history for a list of series and append to the
// existing flat per-series file: data/fred/series/{ID}.json
//
// Usage:
//   node --env-file=.env scripts/fetch-observations.js --list data/fred/series-top-5000.json
//   node --env-file=.env scripts/fetch-observations.js --all
//
// --all enumerates the data/fred/series/ directory and fetches obs for any
// file whose `observations` field is null (i.e. metadata-only).
//
// Resumable: a series with non-null observations is skipped on restart.
// Memory footprint: tiny — one series in flight.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchFred } from './lib/fred-client.js';
import { DATA_DIR, ensureDir, readJson, writeJson } from './lib/io.js';
import { SERIES_DIR, pathForSeries } from './lib/series-path.js';

const SAVE_PROGRESS_EVERY = 25;
const OBS_LIMIT = 100000;

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { listFile: null, all: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--list') out.listFile = args[++i];
    else if (args[i] === '--all') out.all = true;
  }
  if (!out.listFile && !out.all) {
    throw new Error('Pass --list <file> or --all');
  }
  return out;
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// Stream the series directory yielding ids that still need observations.
async function* iterMetadataOnly() {
  const dir = await fs.opendir(SERIES_DIR);
  for await (const entry of dir) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const id = entry.name.slice(0, -5);
    yield id;
  }
}

async function loadIds({ listFile, all }) {
  if (all) return null; // streaming
  const list = await readJson(listFile);
  if (!list || !Array.isArray(list.series_ids)) {
    throw new Error(`Invalid list file: ${listFile}`);
  }
  return list.series_ids;
}

async function main() {
  const args = parseArgs();
  const tag = args.all ? 'all' : path.basename(args.listFile, '.json');

  await ensureDir(SERIES_DIR);

  const progressFile = path.join(DATA_DIR, `obs-progress-${tag}.json`);
  const progress = (await readJson(progressFile)) || {
    started_at: new Date().toISOString(),
    completed: 0,
    skipped: 0,
    errors: 0,
  };

  console.log(`Mode: ${args.all ? '--all (streaming directory)' : '--list ' + args.listFile}`);

  const startTime = Date.now();
  let processed = 0;
  let fetched = 0;
  let skipped = 0;
  let errors = 0;
  let totalToShow = '?';

  // Source of IDs
  let idIter;
  if (args.all) {
    idIter = iterMetadataOnly();
  } else {
    const ids = await loadIds(args);
    totalToShow = ids.length;
    idIter = (async function* () { for (const id of ids) yield id; })();
  }

  for await (const id of idIter) {
    const filePath = pathForSeries(id);

    // Load existing metadata file (must exist — it's the source of truth)
    let existing;
    try {
      existing = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    } catch (err) {
      // File doesn't exist — for --list mode, this is unexpected (top-N came
      // from a previous build). Create a stub and proceed.
      existing = { id };
    }

    // Skip if already populated
    if (Array.isArray(existing.observations) && existing.observations.length > 0) {
      skipped++;
      processed++;
      continue;
    }

    try {
      const observations = [];
      let offset = 0;
      while (true) {
        const res = await fetchFred('/fred/series/observations', {
          series_id: id,
          limit: OBS_LIMIT,
          offset,
          sort_order: 'asc',
        });
        const page = res.observations || [];
        for (const obs of page) {
          observations.push({ date: obs.date, value: obs.value });
        }
        const total = res.count ?? page.length;
        if (page.length === 0 || offset + page.length >= total) break;
        offset += OBS_LIMIT;
      }

      const out = {
        ...existing,
        observations,
        observation_count: observations.length,
        observations_fetched_at: new Date().toISOString(),
      };
      await writeJson(filePath, out);
      fetched++;
      processed++;

      if (processed % SAVE_PROGRESS_EVERY === 0) {
        progress.completed = processed;
        progress.fetched = fetched;
        progress.skipped = skipped;
        progress.errors = errors;
        progress.updated_at = new Date().toISOString();
        await writeJson(progressFile, progress);
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = ((fetched / Math.max(elapsed, 1)) * 60).toFixed(1);
        const heap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        console.log(
          `[${processed}/${totalToShow}] ${id} obs=${observations.length} · fetched=${fetched} skipped=${skipped} · ${rate}/min · heap=${heap}MB`
        );
      }
    } catch (err) {
      errors++;
      console.warn(`[err] ${id}: ${err.message}`);
    }
  }

  // Final save
  progress.completed = processed;
  progress.fetched = fetched;
  progress.skipped = skipped;
  progress.errors = errors;
  progress.completed_at = new Date().toISOString();
  await writeJson(progressFile, progress);

  console.log(
    `\n✔ Done. processed=${processed} fetched=${fetched} skipped=${skipped} errors=${errors}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
