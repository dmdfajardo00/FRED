// scripts/export-observations-csv.js
// Stream every data/fred/series/{ID}.json and emit observations as a flat CSV:
//   series_id,date,value
//
// Output: data/fred/export/observations.csv
//
// Memory: one series in flight at a time. Node ~80 MB peak.
// Expected output size: ~4–5 GB CSV (compressible ~10x when converted to parquet).
//
// FRED uses "." for missing values — we emit them as empty strings so DuckDB
// can cast the column to DOUBLE with nullable handling.

import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { DATA_DIR, ensureDir } from './lib/io.js';
import { SERIES_DIR } from './lib/series-path.js';

const EXPORT_DIR = path.join(DATA_DIR, 'export');
const OUT_FILE = path.join(EXPORT_DIR, 'observations.csv');

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  await ensureDir(EXPORT_DIR);

  const out = createWriteStream(OUT_FILE, { highWaterMark: 1 << 20 });
  out.write('series_id,date,value\n');

  const startTime = Date.now();
  let seriesCount = 0;
  let obsCount = 0;
  let skippedEmpty = 0;

  const dir = await fs.opendir(SERIES_DIR);
  for await (const entry of dir) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(SERIES_DIR, entry.name);

    let data;
    try {
      data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    } catch {
      continue;
    }

    if (!Array.isArray(data.observations) || data.observations.length === 0) {
      skippedEmpty++;
      seriesCount++;
      continue;
    }

    const id = csvEscape(data.id);
    const buffer = [];
    for (const obs of data.observations) {
      // FRED missing value sentinel is "." — emit empty for DuckDB NULL
      const value = obs.value === '.' ? '' : obs.value;
      buffer.push(`${id},${obs.date},${value}`);
    }

    // Write all rows for this series in one call (fewer syscalls)
    out.write(buffer.join('\n') + '\n');

    obsCount += data.observations.length;
    seriesCount++;

    if (seriesCount % 10000 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (seriesCount / elapsed).toFixed(0);
      const heap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      console.log(
        `${seriesCount} series · ${obsCount} obs · ${rate}/s · heap=${heap}MB · ${elapsed.toFixed(0)}s`
      );
    }
  }

  await new Promise((resolve) => out.end(resolve));

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(
    `\n✔ ${seriesCount} series scanned (${skippedEmpty} empty) · ${obsCount} observations · ${OUT_FILE} · ${elapsed.toFixed(0)}s`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
