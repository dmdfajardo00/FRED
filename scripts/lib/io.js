// scripts/lib/io.js
// Small helpers for reading/writing JSON files atomically.

import fs from 'node:fs/promises';
import path from 'node:path';

export const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
export const DATA_DIR = path.join(ROOT, 'data', 'fred');
export const TAXONOMY_DIR = path.join(DATA_DIR, 'taxonomy');
export const RAW_DIR = path.join(DATA_DIR, 'raw');

export async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

export async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

export async function writeJson(file, data) {
  await ensureDir(path.dirname(file));
  const tmp = file + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, file);
}
