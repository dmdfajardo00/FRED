// scripts/select-top-popular.js
// Stream the data/fred/series/*.json directory and select the top N by
// popularity using a min-heap. Memory bounded: heap holds N entries.
//
// Usage:
//   node --env-file=.env scripts/select-top-popular.js [N]
//   default N = 5000
//
// Output:
//   data/fred/series-top-{N}.json  { count, generated_at, series_ids: [...], stats }

import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, writeJson } from './lib/io.js';
import { SERIES_DIR } from './lib/series-path.js';

// Tiny min-heap of fixed capacity N. Smallest popularity at root; we evict
// root when a larger candidate arrives.
class MinHeap {
  constructor(capacity) {
    this.capacity = capacity;
    this.heap = [];
  }
  cmp(a, b) {
    // Smaller popularity = "less"; tie-break by group_popularity, then id desc
    if (a.popularity !== b.popularity) return a.popularity - b.popularity;
    if (a.group_popularity !== b.group_popularity) return a.group_popularity - b.group_popularity;
    return a.id < b.id ? 1 : -1;
  }
  push(item) {
    if (this.heap.length < this.capacity) {
      this.heap.push(item);
      this._siftUp(this.heap.length - 1);
    } else if (this.cmp(item, this.heap[0]) > 0) {
      this.heap[0] = item;
      this._siftDown(0);
    }
  }
  _siftUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.cmp(this.heap[i], this.heap[parent]) < 0) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else break;
    }
  }
  _siftDown(i) {
    const n = this.heap.length;
    while (true) {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let smallest = i;
      if (l < n && this.cmp(this.heap[l], this.heap[smallest]) < 0) smallest = l;
      if (r < n && this.cmp(this.heap[r], this.heap[smallest]) < 0) smallest = r;
      if (smallest !== i) {
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
        i = smallest;
      } else break;
    }
  }
  toSortedDesc() {
    return [...this.heap].sort((a, b) => -this.cmp(a, b));
  }
}

async function main() {
  const N = Number(process.argv[2] || 5000);
  if (!Number.isFinite(N) || N <= 0) throw new Error(`Invalid N: ${process.argv[2]}`);

  console.log(`Streaming ${SERIES_DIR} to find top ${N} by popularity…`);
  const startTime = Date.now();

  let scanned = 0;
  const heap = new MinHeap(N);

  // Use a Dirent iterator to avoid loading the full file list
  const dir = await fs.opendir(SERIES_DIR);
  for await (const entry of dir) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(SERIES_DIR, entry.name);
    let data;
    try {
      data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    } catch (err) {
      console.warn(`[skip] ${entry.name}: ${err.message}`);
      continue;
    }
    heap.push({
      id: data.id,
      popularity: data.popularity ?? 0,
      group_popularity: data.group_popularity ?? 0,
      title: data.title,
    });
    scanned++;
    if (scanned % 25000 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const heapMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      console.log(`  scanned=${scanned} · heap_min_pop=${heap.heap[0]?.popularity ?? '-'} · proc_heap=${heapMB}MB · ${elapsed.toFixed(0)}s`);
    }
  }

  const top = heap.toSortedDesc();
  const outFile = path.join(DATA_DIR, `series-top-${N}.json`);
  await writeJson(outFile, {
    generated_at: new Date().toISOString(),
    n: N,
    count: top.length,
    scanned,
    popularity_min: top[top.length - 1]?.popularity ?? null,
    popularity_max: top[0]?.popularity ?? null,
    sample_top_10: top.slice(0, 10).map((s) => ({ id: s.id, popularity: s.popularity, title: s.title })),
    series_ids: top.map((s) => s.id),
  });

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`✔ Wrote ${top.length} of ${scanned} series to ${outFile} (${elapsed.toFixed(1)}s)`);
  console.log(`  Popularity range: ${top[top.length - 1]?.popularity} → ${top[0]?.popularity}`);
  console.log(`  Top 5: ${top.slice(0, 5).map((s) => s.id + ' (' + s.popularity + ')').join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
