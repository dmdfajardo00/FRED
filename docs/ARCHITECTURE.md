# Architecture

## The goal

Build a portable, local-first mirror of FRED so that `getSeries('UNRATE')` returns the full history instantly, without hitting the FRED API at runtime. The data should land in multiple forms — per-series JSON for fidelity, parquet for analytics, DuckDB for queries — all derived from the same authoritative source.

## Data flow

```
                            FRED API (api.stlouisfed.org)
                                      │
                                      ▼
                  ┌───────────────────┴──────────────────┐
                  │                                      │
        taxonomy walk                          release walk
    ──────────────────                      ──────────────────
     /fred/sources            /fred/release/series
     /fred/releases           /fred/v2/release/observations
     /fred/tags               (BULK — 500K obs/request)
     /fred/category/children
                  │                                      │
                  ▼                                      ▼
        data/fred/taxonomy/                data/fred/series/{ID}.json
        (categories, releases,              (840K flat per-series files
         sources, tags)                      with metadata + observations)
                  │                                      │
                  └──────────┬───────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  CSV exports         │
                  │  (long-format,       │
                  │   streamable)        │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  DuckDB CLI          │
                  │  CSV → parquet       │
                  │    + ingest to .db   │
                  │    + build index     │
                  └──────────┬───────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
 parquet/observations.parquet  fred.duckdb    parquet/series.parquet
 (10x compressed, universal)   (indexed)      (metadata + arrays)
```

## Tables (DuckDB schema)

### `observations` — 147,177,612 rows

| Column | Type | Notes |
|-|-|-|
| `series_id` | VARCHAR | PK component, indexed |
| `date` | DATE | PK component |
| `value` | DOUBLE | Nullable — FRED uses `.` for missing; cast to NULL at ingest |

Long-format. Sorted by (series_id, date) at write time for maximum dictionary+delta compression. ~3 bytes/row in parquet.

**Index:** `CREATE INDEX idx_obs_series ON observations (series_id)` — makes point lookups O(log n).

### `series` — 840,454 rows

| Column | Type | Notes |
|-|-|-|
| `id` | VARCHAR | PK |
| `title` | VARCHAR | |
| `frequency` | VARCHAR | e.g. "Monthly" |
| `frequency_short` | VARCHAR | e.g. "M" |
| `units` | VARCHAR | e.g. "Percent" |
| `units_short` | VARCHAR | |
| `seasonal_adjustment` | VARCHAR | |
| `seasonal_adjustment_short` | VARCHAR | |
| `observation_start` | DATE | First data point |
| `observation_end` | DATE | Last data point |
| `last_updated` | VARCHAR | ISO 8601-ish string |
| `popularity` | INTEGER | 0–100 |
| `group_popularity` | INTEGER | 0–100 |
| `notes` | VARCHAR | |
| `release_ids` | INTEGER[] | From release walk |
| `category_ids` | INTEGER[] | From category link walk (100% coverage) |
| `tags` | VARCHAR[] | From tag link walk (partial — ~28% coverage) |
| `observation_count` | INTEGER | |
| `observations_source` | VARCHAR | `bulk-release` \| `per-series` |

### `categories` — 5,186 rows

| Column | Type |
|-|-|
| `id` | INTEGER |
| `name` | VARCHAR |
| `parent_id` | INTEGER (nullable) |
| `notes` | VARCHAR |

Hierarchical. Root is id=0 ("ROOT" placeholder). The `category-tree.json` file in `data/fred/taxonomy/` has the pre-computed tree.

### `releases` — 324 rows

| Column | Type |
|-|-|
| `id` | INTEGER |
| `name` | VARCHAR |
| `press_release` | VARCHAR |
| `link` | VARCHAR |
| `notes` | VARCHAR |

### `sources` — 119 rows

| Column | Type |
|-|-|
| `id` | INTEGER |
| `name` | VARCHAR |
| `link` | VARCHAR |
| `notes` | VARCHAR |

### `tags` — 5,954 rows

| Column | Type |
|-|-|
| `name` | VARCHAR (PK) |
| `group_id` | VARCHAR — one of `freq`, `gen`, `geo`, `geot`, `rls`, `seas`, `src`, `cc` |
| `notes` | VARCHAR |
| `popularity` | INTEGER |
| `series_count` | INTEGER |
| `created` | VARCHAR |

## Key design decisions

### 1. Walk by release, not by category, for the main scrape

- Categories: 5,186 nodes × deep pagination = ~8K API calls
- Releases: 324 endpoints × shallow pagination = ~1K API calls
- The `/fred/v2/release/observations` (v2) endpoint returns **up to 500,000 observations per request** — batched by release. A single call to CPI release covers 1.3 million data points.

Release-based walks are **~500× faster** for bulk observations. Category walks are still used for populating `category_ids[]` on each series (the taxonomy connectivity pass).

### 2. Flat file layout, not sharded

```
# WHAT WE DID
data/fred/series/UNRATE.json    ← direct path, 840K files in one directory

# NOT THIS
data/fred/series/U/N/UNRATE.json  ← sharded by first 2 chars
```

| | Flat | Sharded |
|-|-|-|
| Lookup speed | O(1) — same | O(1) — same |
| `ls` / Finder / Spotlight | Slow / hangs | Fine |
| Git `.gitignore`d | yes | yes |
| Programmatic iteration | Slow (one `readdir` enumerates all) | Same total |
| Human navigation | Impossible | Tolerable |

We chose flat because the only consumers are scripts and DuckDB — both access files by known path, not by directory enumeration. The one place enumeration matters is `export-observations-csv.js`, which we run rarely.

### 3. Per-page memory bounding in reshape

The first `reshape-bulk-to-series.js` implementation loaded **an entire release's observations** into memory before flushing to per-series files. This worked for small releases but OOM'd on "Main Economic Indicators" (13M observations across 27 pages) — Node's default 4 GB heap couldn't hold it.

The fix: process one page at a time, flush a small `pageMap` to disk per page, let V8 GC the page before loading the next. Peak heap dropped from 4 GB → ~540 MB, and total wall time dropped from ~58 min → ~8 min (warm cache).

### 4. `node:https` with `agent: false` instead of `fetch()`

Node's built-in `fetch()` uses undici with aggressive HTTP/2 keep-alive. When FRED returns 5xx errors under sustained load, the keep-alive connection enters a bad state and every subsequent request on that connection also fails — but the process doesn't realize the connection is dead and hangs indefinitely.

Fix: switched to `node:https.request()` with `agent: false`, which forces a fresh HTTP/1.1 TCP connection per request. Slightly slower than keep-alive (adds TCP+TLS handshake per call, ~100 ms overhead), but **immune** to the class of bug that killed the tag walk twice.

This is a real-world example of "premium DX can have worse failure modes than the boring path."

### 5. DuckDB + Parquet as the query layer

After scraping we have 840K JSON files. Without a query layer, every analytical question requires reading ~all of them. DuckDB fixes this:

- **Sort observations by (series_id, date)** at ingest time → dictionary encoding compresses `series_id` to ~3 bytes/row
- **ZSTD compression** on the parquet file → 5 GB CSV → 482 MB parquet (10× compression)
- **Index on observations.series_id** → point lookups in <10 ms on a single machine
- **No server required** — DuckDB is a single binary / embedded library

Parquet is also the bridge to other tools: DuckDB-Wasm in a browser, BigQuery, Polars, Snowflake, Python/pandas all read parquet natively. Zero lock-in.

## Schema & file formats

### `series/{ID}.json`

```json
{
  "id": "UNRATE",
  "title": "Unemployment Rate",
  "observation_start": "1948-01-01",
  "observation_end": "2026-03-01",
  "frequency": "Monthly",
  "frequency_short": "M",
  "units": "Percent",
  "units_short": "%",
  "seasonal_adjustment": "Seasonally Adjusted",
  "seasonal_adjustment_short": "SA",
  "last_updated": "2026-04-04 07:46:02-05",
  "popularity": 94,
  "group_popularity": 94,
  "notes": "...",
  "release_ids": [50],
  "category_ids": [12, 32447],
  "tags": ["bls", "monthly", "nation", "sa", "unemployment", "usa"],
  "built_at": "2026-04-11T11:21:00Z",
  "observation_count": 939,
  "observations_fetched_at": "2026-04-11T19:15:00Z",
  "observations_source": "bulk-release",
  "observations": [
    { "date": "1948-01-01", "value": "3.4" },
    { "date": "1948-02-01", "value": "3.8" },
    ...
  ]
}
```

**Note:** `tags[]` is populated for ~28% of series only — the tag walk hit FRED backend instability and was stopped at 230/5954 tags. The field is always present as an array (empty `[]` if no tag data).

### Taxonomy shapes

- `categories.json` — object keyed by id: `{ "1": {...}, "2": {...}, ... }` plus metadata wrapper
- `releases.json` — array: `{ "releases": [...], "count": 324 }`
- `sources.json` — array: `{ "sources": [...], "count": 119 }`
- `tags.json` — array: `{ "tags": [...], "count": 5954 }`

Categories is the odd one (keyed object) because it's emitted by `fetch-categories.js` which stores categories by numeric id for O(1) lookup during the recursive walk. The other three were paginated flat lists from the start.

## What's NOT in the data

- **Per-series tag coverage** — only 230/5954 tags walked (about 28% of series have tag data). See [TODO.md](./TODO.md).
- **`fred.duckdb.wal`** — the WAL file is not committed; any changes to fred.duckdb should checkpoint before backup
- **ALFRED point-in-time data** — we used default real-time (today's date). Historical vintages / revisions not captured.
- **Release tables** — `/fred/release/tables` not walked; rarely used in charting apps
- **Full-text search index** — can be added via DuckDB `fts` extension when needed
