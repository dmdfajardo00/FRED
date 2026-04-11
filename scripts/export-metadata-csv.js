// scripts/export-metadata-csv.js
// Stream every data/fred/series/{ID}.json and emit ONE row per series with
// flat metadata columns plus JSON-encoded array fields (release_ids, category_ids, tags).
//
// Output: data/fred/export/series_metadata.csv
//
// Columns:
//   id, title, frequency, frequency_short, units, units_short,
//   seasonal_adjustment, seasonal_adjustment_short,
//   observation_start, observation_end, last_updated,
//   popularity, group_popularity, notes,
//   release_ids_json, category_ids_json, tags_json,
//   observation_count, observations_source
//
// Arrays are stored as JSON strings — DuckDB can parse them at read time with
// json_extract(). Alternatively, the convert-to-parquet.sh script converts
// them to native LIST types during the parquet write.

import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { DATA_DIR, ensureDir } from './lib/io.js';
import { SERIES_DIR } from './lib/series-path.js';

const EXPORT_DIR = path.join(DATA_DIR, 'export');
const OUT_FILE = path.join(EXPORT_DIR, 'series_metadata.csv');

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const COLUMNS = [
  'id',
  'title',
  'frequency',
  'frequency_short',
  'units',
  'units_short',
  'seasonal_adjustment',
  'seasonal_adjustment_short',
  'observation_start',
  'observation_end',
  'last_updated',
  'popularity',
  'group_popularity',
  'notes',
  'release_ids_json',
  'category_ids_json',
  'tags_json',
  'observation_count',
  'observations_source',
];

async function main() {
  await ensureDir(EXPORT_DIR);

  const out = createWriteStream(OUT_FILE, { highWaterMark: 1 << 20 });
  out.write(COLUMNS.join(',') + '\n');

  const startTime = Date.now();
  let count = 0;

  const dir = await fs.opendir(SERIES_DIR);
  for await (const entry of dir) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

    let d;
    try {
      d = JSON.parse(await fs.readFile(path.join(SERIES_DIR, entry.name), 'utf-8'));
    } catch {
      continue;
    }

    const row = [
      d.id,
      d.title,
      d.frequency,
      d.frequency_short,
      d.units,
      d.units_short,
      d.seasonal_adjustment,
      d.seasonal_adjustment_short,
      d.observation_start,
      d.observation_end,
      d.last_updated,
      d.popularity ?? 0,
      d.group_popularity ?? 0,
      d.notes ?? '',
      JSON.stringify(d.release_ids ?? []),
      JSON.stringify(d.category_ids ?? []),
      JSON.stringify(d.tags ?? []),
      d.observation_count ?? (Array.isArray(d.observations) ? d.observations.length : 0),
      d.observations_source ?? '',
    ].map(csvEscape);

    out.write(row.join(',') + '\n');
    count++;

    if (count % 25000 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (count / elapsed).toFixed(0);
      console.log(`${count} series · ${rate}/s · ${elapsed.toFixed(0)}s`);
    }
  }

  await new Promise((resolve) => out.end(resolve));

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`\n✔ ${count} series metadata rows → ${OUT_FILE} · ${elapsed.toFixed(0)}s`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
