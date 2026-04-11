// scripts/export-taxonomy-csv.js
// Export the taxonomy JSON files to flat CSVs for clean DuckDB ingestion.
//
// Inputs:
//   data/fred/taxonomy/{categories,releases,sources,tags}.json
//
// Outputs:
//   data/fred/export/categories.csv    id, name, parent_id, notes
//   data/fred/export/releases.csv      id, name, press_release, link, notes
//   data/fred/export/sources.csv       id, name, link, notes
//   data/fred/export/tags.csv          name, group_id, notes, popularity, series_count, created

import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { DATA_DIR, TAXONOMY_DIR, ensureDir, readJson } from './lib/io.js';

const EXPORT_DIR = path.join(DATA_DIR, 'export');

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function writeCsv(file, headers, rows) {
  const out = createWriteStream(file, { highWaterMark: 1 << 20 });
  out.write(headers.join(',') + '\n');
  for (const row of rows) {
    out.write(headers.map((h) => csvEscape(row[h])).join(',') + '\n');
  }
  await new Promise((resolve) => out.end(resolve));
}

async function main() {
  await ensureDir(EXPORT_DIR);

  // Categories — keyed by id in the JSON, flatten to an array of rows
  const catsData = await readJson(path.join(TAXONOMY_DIR, 'categories.json'));
  const catRows = Object.values(catsData.categories || {}).map((c) => ({
    id: c.id,
    name: c.name,
    parent_id: c.parent_id ?? '',
    notes: c.notes ?? '',
  }));
  await writeCsv(
    path.join(EXPORT_DIR, 'categories.csv'),
    ['id', 'name', 'parent_id', 'notes'],
    catRows
  );
  console.log(`✔ categories.csv — ${catRows.length} rows`);

  // Releases — already an array in the JSON
  const relData = await readJson(path.join(TAXONOMY_DIR, 'releases.json'));
  const relRows = (relData.releases || []).map((r) => ({
    id: r.id,
    name: r.name,
    press_release: r.press_release ?? '',
    link: r.link ?? '',
    notes: r.notes ?? '',
  }));
  await writeCsv(
    path.join(EXPORT_DIR, 'releases.csv'),
    ['id', 'name', 'press_release', 'link', 'notes'],
    relRows
  );
  console.log(`✔ releases.csv — ${relRows.length} rows`);

  // Sources
  const srcData = await readJson(path.join(TAXONOMY_DIR, 'sources.json'));
  const srcRows = (srcData.sources || []).map((s) => ({
    id: s.id,
    name: s.name,
    link: s.link ?? '',
    notes: s.notes ?? '',
  }));
  await writeCsv(
    path.join(EXPORT_DIR, 'sources.csv'),
    ['id', 'name', 'link', 'notes'],
    srcRows
  );
  console.log(`✔ sources.csv — ${srcRows.length} rows`);

  // Tags
  const tagData = await readJson(path.join(TAXONOMY_DIR, 'tags.json'));
  const tagRows = (tagData.tags || []).map((t) => ({
    name: t.name,
    group_id: t.group_id ?? '',
    notes: t.notes ?? '',
    popularity: t.popularity ?? 0,
    series_count: t.series_count ?? 0,
    created: t.created ?? '',
  }));
  await writeCsv(
    path.join(EXPORT_DIR, 'tags.csv'),
    ['name', 'group_id', 'notes', 'popularity', 'series_count', 'created'],
    tagRows
  );
  console.log(`✔ tags.csv — ${tagRows.length} rows`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
