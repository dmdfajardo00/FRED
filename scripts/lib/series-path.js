// scripts/lib/series-path.js
// Flat path resolution for per-series JSON files.
// Layout: data/fred/series/{ID}.json
//
// Yes, ~830K files in one directory is a lot. Trade-offs accepted by design:
//   - Direct lookup: fs.readFile('series/UNRATE.json')  ← dead simple
//   - macOS Finder will hate this dir, that's expected
//   - Git: gitignored (see .gitignore)

import path from 'node:path';
import { DATA_DIR } from './io.js';

export const SERIES_DIR = path.join(DATA_DIR, 'series');

export function pathForSeries(id) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`Invalid series id: ${id}`);
  }
  return path.join(SERIES_DIR, `${id}.json`);
}
