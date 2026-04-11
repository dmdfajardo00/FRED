# Remaining Action Items

Current state: **fully queryable dataset**. All items below are optional enhancements or polish.

## Immediate / quick wins

### 1. Delete `export/` CSVs to free 5.5 GB
```bash
rm -rf data/fred/export/
```

The CSVs are derivable from `series/` — they were only needed to feed DuckDB during `convert-to-parquet.sh`. Now that `fred.duckdb` and `parquet/` exist, the CSVs are dead weight.

**Trade-off:** If you ever want to re-run the parquet conversion (to change schema, compression, sorting), you'll need to re-run `export-observations-csv.js` + `export-metadata-csv.js` first — which takes ~10 min.

### 2. Commit docs to git
The `docs/` directory is new. `.gitignore` already excludes `data/fred/` properly, so the docs will be the main new check-in.

```bash
cd ~/Documents/GitHub/FRED
git add docs/ scripts/ .gitignore package.json
git commit -m "docs: add architecture, scripts, journey, and todo"
```

---

## Data completeness

### 3. Retry the tag walk (highest value)
**Current coverage:** 230 of 5,954 tags (~4% walked → ~28% of series have `tags[]` populated)
**Why it matters:** Tag-based filtering (`list_contains(tags, 'monthly')`) doesn't work for 72% of series yet.

**Approach options:**

**A. Wait + retry at a slower rate** — run `walk-tag-links.js` overnight when Akamai is less loaded. Lower the `MIN_INTERVAL_MS` in `fred-client.js` to 2000ms (~30 req/min) to avoid triggering the 502 storm. Estimated 8–12 hours but should succeed.

**B. Cap to "meaningful" tags only** — skip tags with `series_count > 10000` (structural tags like `usa`, `nation`, `monthly` that don't add navigation value). Walk only the ~4,500 remaining small/medium tags. Estimated 2–3 hours.

**C. Use existing series' release_ids + release tags** — every series has a primary release, and we have `/fred/release/tags` for each release. Walk 324 releases instead of 5,954 tags. Gives you "release-level" tags per series (source, frequency, seasonal adjustment). Takes ~10 minutes. **Probably the pragmatic winner.**

The walk-tag-links.js script is already **resumable** — it loads `_interim/tag-series-map.json` and picks up from `completed_tags[]`.

### 4. Backfill the 67K metadata-only series
These are series that FRED lists in a release but returned no observations via `/fred/v2/release/observations`. Most are discontinued. Worth checking a few manually to see if `/fred/series/observations` (per-series) returns data where bulk didn't.

```bash
# Find them
duckdb data/fred/fred.duckdb \
  "SELECT id FROM series WHERE observation_count = 0 OR observation_count IS NULL LIMIT 20"

# Try re-fetching
node --env-file=.env scripts/fetch-observations.js --all
# (skips series with existing observations, so only hits the 67K orphans)
```

---

## Query layer polish

### 5. Add full-text search index to `series.title`
DuckDB has an `fts` extension for BM25-style search.

```sql
INSTALL fts;
LOAD fts;
PRAGMA create_fts_index('series', 'id', 'title', 'notes');
SELECT * FROM (
  SELECT *, fts_main_series.match_bm25(id, 'unemployment rate') AS score
  FROM series
) WHERE score IS NOT NULL ORDER BY score DESC LIMIT 20;
```

### 6. Build a small Node/TypeScript wrapper library
Something like `@fred-local/client` that wraps the DuckDB file:

```typescript
import { getSeries, searchSeries, getCategories } from '@fred-local/client';

const unrate = await getSeries('UNRATE');              // read from DuckDB
const results = await searchSeries('inflation', { limit: 20 });
const tree = await getCategories({ parentId: 0 });
```

Reuses across any app that wants to query the local FRED mirror.

### 7. Incremental updates (nightly refresh)
FRED updates most series daily. A refresh script should:
1. Fetch `/fred/series/updates?filter_value=all&start_time=<yesterday>` (paginated)
2. For each updated series, re-fetch `/fred/series/observations`
3. Overwrite `series/{ID}.json`
4. Re-run `export-observations-csv.js` + `convert-to-parquet.sh` (or, more efficient, patch the parquet file incrementally using DuckDB's `INSERT` + `ALTER`)

**Not written yet.** The sticky part is updating the parquet/DuckDB without rebuilding from scratch. DuckDB supports `INSERT INTO observations` and then `COPY observations TO 'obs.parquet'`, but a full rewrite is 5 min anyway — might just schedule a full rebuild nightly.

---

## Storage & deployment

### 8. Upload to VPS (the portfolio piece)
Decide on layout:
- **parquet-only** behind a static file server (Caddy/nginx) → DuckDB Wasm in the browser queries directly via HTTP byte-range requests. No backend needed. 🔥
- **parquet + Node/Hono API** on VPS → `/api/series?ids=UNRATE,GDP` serves JSON, backed by DuckDB reading the parquet files in-process. ~30 lines of code.
- **Both** — parquet served publicly for Wasm demos, API for server-side use.

### 9. DuckDB-Wasm browser demo
Single-page app that embeds duckdb-wasm and queries parquet files served from the VPS via HTTP range requests. The killer portfolio demo.

Code sketch:
```typescript
import * as duckdb from '@duckdb/duckdb-wasm';

const db = new duckdb.AsyncDuckDB(logger, worker);
await db.instantiate('https://fred-data.yourdomain.com/observations.parquet');
const conn = await db.connect();
const result = await conn.query(`
  SELECT date, value FROM parquet_scan('obs.parquet')
  WHERE series_id='UNRATE' ORDER BY date DESC LIMIT 10
`);
```

Pitch: "I scraped 147M economic observations from FRED and serve them from a static-file host. Queries run in your browser."

### 10. Optional: BigQuery / Neon / Supabase mirror
If a specific hosted DB makes sense for a use case, upload the parquet files. DuckDB, BigQuery, Neon/Postgres, Snowflake all read parquet natively. Keep `fred.duckdb` as the local source of truth.

---

## Repo hygiene

### 11. Remove legacy `scripts/lib/shard.js`
Written during the early "shard by first 2 chars" design, unused since we switched to flat layout.

```bash
rm scripts/lib/shard.js
grep -r "shard.js" scripts/ || echo "no references — safe to delete"
```

### 12. Remove `_interim/` once tag walk is complete (item 3)
The `_interim/` directory stores resumable state for the link walks. Once walk-tag-links.js finishes, the interim files are superseded by the inverse index files (`category-to-series.json`, `tag-to-series.json`). Safe to delete to free ~52 MB.

### 13. `fetch-series-index.js` — now obsolete, remove?
Superseded by `fetch-by-release.js` + `build-series-from-cache.js`. Kept so far because it's referenced in [JOURNEY.md](./JOURNEY.md) as the first-attempt approach. Consider moving to `scripts/_archive/` or deleting outright.

---

## Non-trivial future work

### 14. Point-in-time / ALFRED data
FRED has ALFRED for historical revisions ("what did GDP look like on 2020-05-01 before the later revisions?"). We default to today's real-time period. Adding a `vintage_date` column to observations would enable proper backtesting but roughly **triples the data size** and requires using `output_type=2` on `/fred/series/observations`.

### 15. Relational observations → time-series-optimized storage
For 147M rows, DuckDB + parquet is fine. If the data grows to billions (e.g., by including ALFRED vintages), consider TimescaleDB, QuestDB, or ClickHouse.

### 16. Release tables (`/fred/release/tables`)
We didn't walk `/fred/release/tables` — it's the hierarchical table structure within a release (e.g., "Table 1.1: Real GDP by component"). Useful for building FRED-style dashboards that group related series.

### 17. Vector embeddings on series titles
For "find series similar to UNRATE" semantic search, embed each series' `title + notes` with an embedding model and store the vectors alongside the series metadata. DuckDB has a `vss` extension for cosine similarity lookups.

---

## Cleanup summary (one command)

If you want to reclaim disk + tighten the repo right now:

```bash
cd ~/Documents/GitHub/FRED

# Free ~5.5 GB of CSV exports
rm -rf data/fred/export/

# Free ~52 MB of interim walk state (after tag walk retry if you want to backfill)
# rm -rf data/fred/_interim/

# Optional: remove legacy shard helper
rm scripts/lib/shard.js

# Check current size
du -sh data/fred/
```

After this: `data/fred/` should be ~16 GB (series/ 12 GB + fred.duckdb 3.5 GB + parquet/ 533 MB + taxonomy/ tiny).
