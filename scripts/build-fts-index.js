// Build the DuckDB Full-Text Search index for the series table.
// Run: node scripts/build-fts-index.js [path-to-duckdb]

import { Database } from 'duckdb-async';

const dbPath = process.argv[2] || 'data/fred/fred.duckdb';
console.log(`Building FTS index on ${dbPath}...`);

const db = await Database.create(dbPath);

console.log('Installing FTS extension...');
await db.run('INSTALL fts');
await db.run('LOAD fts');

console.log('Creating FTS index on series (id, title, notes)...');
await db.run(`PRAGMA create_fts_index('series', 'id', 'title', 'notes', overwrite=1)`);

console.log('Testing FTS...');
const results = await db.all(`
  SELECT id, title, fts_main_series.match_bm25(id, 'unemployment rate') AS score
  FROM series WHERE score IS NOT NULL
  ORDER BY score DESC LIMIT 5
`);

for (const r of results) {
  console.log(`  ${r.id}: ${r.title} (score: ${Number(r.score).toFixed(4)})`);
}

console.log('\nFTS index built successfully.');
await db.close();
