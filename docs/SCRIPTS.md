# Scripts Reference

All scripts are in `scripts/`, written in Node.js with **zero npm dependencies** — only Node 20+ built-ins plus the DuckDB CLI (for conversion only).

Run any script with:

```bash
cd ~/Documents/GitHub/FRED
node --env-file=.env scripts/<script>.js
```

The `--env-file=.env` flag loads `FRED_API_KEY` from the root `.env` file.

## Shared library — `scripts/lib/`

### `fred-client.js`

Core HTTP client for all FRED API calls. Uses `node:https.request()` with `agent: false` to force fresh HTTP/1.1 TCP connections per request (see [ARCHITECTURE.md](./ARCHITECTURE.md#4-nodehttps-with-agent-false-instead-of-fetch) for why).

**Exports:**
- `fetchFred(endpoint, params)` — makes one GET, returns parsed JSON. Handles rate limit throttling (550 ms minimum between requests), exponential backoff retries (2/4/8/16s), 30s request timeout, and v1-vs-v2 auth (query param vs Bearer header).
- `paginateFred(endpoint, params, arrayKey, pageSize)` — auto-paginates a flat list endpoint. Stops when page is empty OR reported total is reached.

**Configuration constants:**
- `MIN_INTERVAL_MS = 550` — min delay between requests (~109 req/min, under FRED's 120/min ceiling)
- `MAX_RETRIES = 4` — then throws
- `REQUEST_TIMEOUT_MS = 30000` — hard abort if request takes >30s

### `io.js`

Atomic JSON read/write helpers. `writeJson()` writes to a `.tmp` file then renames for atomicity. Also exports `DATA_DIR`, `TAXONOMY_DIR`, `RAW_DIR`, `ensureDir`.

### `series-path.js`

Path resolver for the flat series directory: `pathForSeries('UNRATE')` → `data/fred/series/UNRATE.json`.

### `shard.js` *(legacy)*

Earlier sharded-path helper that was abandoned in favor of the flat layout. Kept for reference but unused.

---

## Taxonomy scripts (one-off discovery)

### `fetch-sources.js`
**API:** `GET /fred/sources` (paginated)
**Output:** `data/fred/taxonomy/sources.json`
**Runtime:** <10 sec
**What:** Dumps all 119 FRED data sources with name, link, notes.

### `fetch-releases.js`
**API:** `GET /fred/releases` (paginated)
**Output:** `data/fred/taxonomy/releases.json`
**Runtime:** <10 sec
**What:** Dumps all 324 releases.

### `fetch-tags.js`
**API:** `GET /fred/tags` (paginated)
**Output:** `data/fred/taxonomy/tags.json`
**Runtime:** ~1 min
**What:** Dumps all 5,954 tags with group_id, popularity, series_count.

### `fetch-categories.js`
**API:** `GET /fred/category/children` (recursive BFS from id=0)
**Output:** `data/fred/taxonomy/categories.json`, `category-tree.json`, `categories-progress.json`
**Runtime:** ~50 min (5,186 API calls at ~100/min)
**What:** Walks the entire category tree by BFS. **Resumable** — re-running picks up from `categories-progress.json`.

---

## Main scrape scripts

### `fetch-by-release.js` ⭐
**API:** `GET /fred/release/series` × 324 releases
**Output:** `data/fred/release-series-raw/release-{id}.json` (now deleted to free disk)
**Runtime:** ~25 min
**What:** Caches the raw per-release series lists. This is the **primary series discovery mechanism** — all 840K series are found through these 324 API calls.

### `build-series-from-cache.js`
**Input:** `data/fred/release-series-raw/*.json`
**Output:** `data/fred/series/{ID}.json` × 840K files (metadata only, no observations)
**Runtime:** ~58 min (filesystem-bound, cold cache)
**Memory:** ~100 MB peak (in-memory dedup map)
**What:** Streams cache files, dedupes series by id, writes one flat metadata file per unique series. Each file includes `release_ids: [primary_release_id]`.

### `select-top-popular.js [N=5000]`
**Input:** `data/fred/series/*.json`
**Output:** `data/fred/series-top-{N}.json`
**Runtime:** ~4 min (streams 840K files via `fs.opendir`)
**Memory:** min-heap of N entries — <20 MB
**What:** Picks the top N series by popularity. Uses a min-heap to avoid loading all 840K into memory.

**Example:**
```bash
node --env-file=.env scripts/select-top-popular.js 5000
```

### `fetch-observations.js --list <file> | --all` ⭐
**API:** `GET /fred/series/observations` per series
**Input:** `--list data/fred/series-top-5000.json` OR `--all` (every series in `series/`)
**Output:** Appends `observations[]` to each `data/fred/series/{ID}.json`
**Runtime:** ~45 min for 5K series (rate limited at ~109 req/min)
**Memory:** tiny — one series in flight
**What:** Fetches full observation history for a list of series. **Resumable** — skips series whose file already has `observations` populated.

### `fetch-bulk-by-release.js` ⭐
**API:** `GET /fred/v2/release/observations` × 324 releases (uses Bearer auth!)
**Output:** `data/fred/raw-bulk/release-{id}/page-{N}.json` (now deleted)
**Runtime:** ~10-15 min for all 324 releases
**Memory:** one page in flight (~100 MB max for 500K obs)
**What:** **The fast path.** Each request returns up to 500,000 observations for every series in a release. This is how we got 147M observations in under 15 minutes.

**Important:** v2 endpoints use `Authorization: Bearer <key>` header, NOT the `api_key` query parameter. The shared client auto-detects `/fred/v2/` prefix.

### `reshape-bulk-to-series.js` ⭐
**Input:** `data/fred/raw-bulk/release-*/page-*.json`
**Output:** Merges observations into existing `data/fred/series/{ID}.json` files
**Runtime:** ~8 min (warm filesystem cache)
**Memory:** **per-page bounded** — ~540 MB peak (see below)
**What:** Regroups bulk release responses (shaped as {release → series → observations}) into per-series files (shaped as {series → observations}).

**Memory design:** loads ONE page at a time, flushes to disk, lets V8 GC before loading the next page. An earlier version that loaded an entire release in memory OOM'd on the 13M-observation "Main Economic Indicators" release.

---

## Link population scripts (taxonomy connectivity)

### `walk-category-links.js`
**API:** `GET /fred/category/series` × 5,186 categories
**Output:** `data/fred/_interim/category-series-map.json` — `{series_id → category_ids[]}`
**Runtime:** ~72 min
**Memory:** ~200 MB peak (in-memory map of 840K series)
**Resumable:** yes, via `completed_categories[]`
**What:** For each category, fetches all series in it and records the link in memory. No per-series file writes until `apply-links-to-series.js` runs.

### `walk-tag-links.js`
**API:** `GET /fred/tags/series` × 5,954 tags (tag_names param)
**Output:** `data/fred/_interim/tag-series-map.json` — `{series_id → tag_names[]}`
**Runtime:** Estimated 8 hours — but **only 230/5954 tags completed** before FRED Akamai started returning sustained 502s. See [JOURNEY.md](./JOURNEY.md) for the full story.
**Memory:** <100 MB
**Resumable:** yes, via `completed_tags[]` — re-running picks up where it left off

### `apply-links-to-series.js`
**Input:** Both interim maps above
**Output:**
- Updates every `data/fred/series/{ID}.json` with `category_ids[]` and `tags[]` fields
- Writes `data/fred/category-to-series.json` (inverse index)
- Writes `data/fred/tag-to-series.json` (inverse index)
**Runtime:** ~11 min (840K file reads + writes)
**Memory:** ~300 MB peak
**Idempotent:** yes — safe to re-run

---

## Export + conversion scripts

### `export-taxonomy-csv.js`
**Input:** `data/fred/taxonomy/*.json`
**Output:**
- `data/fred/export/categories.csv` — 5,186 rows
- `data/fred/export/releases.csv` — 324 rows
- `data/fred/export/sources.csv` — 119 rows
- `data/fred/export/tags.csv` — 5,954 rows
**Runtime:** <5 sec
**What:** Flattens the taxonomy JSONs into uniform CSVs for DuckDB ingest.

### `export-metadata-csv.js`
**Input:** `data/fred/series/*.json`
**Output:** `data/fred/export/series_metadata.csv` — 840,454 rows
**Runtime:** ~5 min
**What:** One row per series. Array fields (release_ids, category_ids, tags) are serialized as JSON strings in the CSV — parsed back into LIST types during parquet conversion.

### `export-observations-csv.js`
**Input:** `data/fred/series/*.json`
**Output:** `data/fred/export/observations.csv` — 147,177,612 rows (~5 GB)
**Runtime:** ~5 min
**Memory:** <100 MB (streaming)
**What:** Flattens nested observations arrays into long-format `series_id, date, value`. FRED's `.` missing-value sentinel is written as empty string so DuckDB can TRY_CAST to DOUBLE with NULL handling.

### `convert-to-parquet.sh`
**Input:** All CSVs in `data/fred/export/`
**Output:**
- `data/fred/fred.duckdb` — 3.5 GB single-file database, indexed on `observations.series_id`
- `data/fred/parquet/{observations,series,categories,releases,sources,tags}.parquet` — ZSTD-compressed parquet bundle (533 MB total)
**Runtime:** ~5 min
**What:** DuckDB CLI reads CSVs → sorts observations by (series_id, date) → writes parquet files with ZSTD → builds index. Prints table counts and UNRATE/GDP sanity checks at the end.

**Requires:** `duckdb` CLI in PATH. Install via `brew install duckdb`.

---

## Query / example script

### `example-queries.sql`

A reference collection of 10 DuckDB queries showing common use cases:
1. Single series full history
2. Multi-line chart data
3. Series metadata lookups
4. Full-text search on title
5. Browse by category
6. Filter by tags
7. Tag frequency histogram
8. Join observations with metadata
9. CPI year-over-year (with window functions)
10. Correlation discovery (commented, expensive)

**Run:**
```bash
duckdb data/fred/fred.duckdb
D> .read scripts/example-queries.sql
```

---

## npm scripts

Defined in `package.json`:

```bash
npm run taxonomy:sources      # fetch-sources.js
npm run taxonomy:releases     # fetch-releases.js
npm run taxonomy:tags         # fetch-tags.js
npm run taxonomy:categories   # fetch-categories.js
npm run taxonomy:all          # sequential run of all four
```

The later scripts (release walks, link walks, exports, conversion) are not aliased — run them directly with `node --env-file=.env scripts/<file>.js`.

## Script execution order (canonical build)

If you nuked the data directory and wanted to rebuild from scratch, the minimal chain is:

```bash
# 1. Taxonomy (parallelizable among themselves)
node --env-file=.env scripts/fetch-sources.js
node --env-file=.env scripts/fetch-releases.js
node --env-file=.env scripts/fetch-tags.js
node --env-file=.env scripts/fetch-categories.js  # ~50 min

# 2. Primary scrape — release walk → metadata → bulk obs → reshape
node --env-file=.env scripts/fetch-by-release.js            # ~25 min
node --env-file=.env scripts/build-series-from-cache.js     # ~58 min
node --env-file=.env scripts/fetch-bulk-by-release.js       # ~15 min
node --env-file=.env scripts/reshape-bulk-to-series.js      # ~8 min

# 3. Optional: top 5K verification via per-series endpoint
node --env-file=.env scripts/select-top-popular.js 5000
node --env-file=.env scripts/fetch-observations.js --list data/fred/series-top-5000.json

# 4. Taxonomy link walks
node --env-file=.env scripts/walk-category-links.js         # ~72 min
node --env-file=.env scripts/walk-tag-links.js              # needs overnight + retry logic
node --env-file=.env scripts/apply-links-to-series.js       # ~11 min

# 5. Export + convert
node --env-file=.env scripts/export-taxonomy-csv.js
node --env-file=.env scripts/export-metadata-csv.js         # ~5 min
node --env-file=.env scripts/export-observations-csv.js     # ~5 min
./scripts/convert-to-parquet.sh                             # ~5 min
```

**Total rebuild time:** ~4 hours (assuming tag walk doesn't hang). See [JOURNEY.md](./JOURNEY.md) for what actually happened.
