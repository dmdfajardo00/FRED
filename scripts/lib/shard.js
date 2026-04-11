// scripts/lib/shard.js
// Sharded path resolution for per-series JSON files.
//
// Layout: data/fred/series/{first}/{second}/{ID}.json
//   UNRATE  → series/U/N/UNRATE.json
//   GDP     → series/G/D/GDP.json
//   M2SL    → series/M/2/M2SL.json
//   A       → series/A/_/A.json   (single-char fallback uses '_')
//
// Two-character sharding gives ~26*26 = 676 first/second buckets, plus digits.
// At 830K series that's ~1230 files per leaf dir — comfortable for any FS.

import path from 'node:path';
import { DATA_DIR } from './io.js';

export const SERIES_DIR = path.join(DATA_DIR, 'series');

export function shardForId(id) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`Invalid series id: ${id}`);
  }
  const first = id[0].toUpperCase();
  const second = id.length > 1 ? id[1].toUpperCase() : '_';
  return path.join(first, second);
}

export function pathForSeries(id) {
  return path.join(SERIES_DIR, shardForId(id), `${id}.json`);
}
