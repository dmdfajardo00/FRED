# Build Journey — what actually happened

This is the honest, chronological story of building the FRED platform in one session. It's long because the build hit several real failures that required in-flight fixes. The final outcome is clean but the path wasn't.

Keep this around as the "scar tissue" — future you will appreciate knowing which mistakes were made so they don't happen again.

---

## Phase 0 — API study & scaffolding

**What:** Studied the FRED API via Context7 docs, cataloged all 31 endpoints into `data/fred/endpoints.json` as a static reference. Created repo structure, `.gitignore`, `.env` with the API key, `package.json` (ESM, Node 20+, zero dependencies).

**Verified:** API key works via direct curl test.

**Time:** ~15 min.

---

## Phase 1 — Taxonomy walks

**Ran in order:**
1. `fetch-sources.js` — 119 sources in <10 sec
2. `fetch-releases.js` — 324 releases in <10 sec
3. `fetch-tags.js` — 5,954 tags in ~1 min (paginated through 6K tags at 1000/page)
4. `fetch-categories.js` — recursive BFS from id=0

### Category walk — first surprise

- **Planned:** ~1.5–2K categories, ~30 min
- **Actual:** **5,186 categories, ~50 min**

The geographic subtree dominates — US counties alone account for ~4K leaf categories. Final tree shape: 385 internal nodes, 4,801 leaves, max depth 9.

Breakdown of the top-level:
- Money, Banking, & Finance (180)
- Population, Employment, & Labor Markets (82)
- National Accounts (95)
- Production & Business Activity (33)
- Prices (105)
- International Data (464)
- **U.S. Regional Data (4,161)** ← 80% of the tree
- Academic Data (65)

**First lesson learned:** FRED's category tree is 80% geography. The "interesting" economic taxonomy is only ~1,000 nodes.

**Errors:** Zero (though a few transient FRED 500s were recovered by the retry loop).

---

## Phase 2 — Series discovery: category walk → abandoned → release walk

### Attempt 1: `fetch-series-index.js` (category-based)

**Plan:** Walk `/fred/category/series` for all 5,186 categories, build one giant `series-index.json` with metadata for every series.

**What went wrong:**
- The index file grew to **273 MB at only 10% complete** — projected final size 2.5–3 GB
- That would crash Node's default 4 GB heap when later scripts tried to `JSON.parse` it
- User correctly pointed out: "we only have 8 GB of RAM"

**Decision:** Kill the run, redesign.

### The "index file considered harmful" redesign

Switched approach to **walk by release instead**:
- 324 releases vs 5,186 categories = 16× fewer requests
- Each series file is written **directly** during discovery — no unified index
- Memory footprint bounded to one release at a time

### `fetch-by-release.js` + `build-series-from-cache.js`

1. Walk `/fred/release/series` × 324 releases → raw cache files
2. Stream cache → dedupe by series_id → write one flat `data/fred/series/{ID}.json` per unique series

**Discovered:** **840,454 total unique series** — every series belongs to exactly ONE release (zero multi-release duplicates). That simplifies the data model significantly.

**Second lesson learned:** The `series_count` totals on each release are **the best available inventory** for FRED's universe of series. You don't need to walk categories for discovery.

**Runtime:**
- fetch-by-release: ~25 min
- build-series-from-cache: **~58 min** (filesystem-bound — 840K synchronous small-file writes)

The build step was the first filesystem-bound slowdown. Heap stayed <200 MB (good), but disk I/O was the new bottleneck.

---

## Phase 3 — Observations: top 5K via per-series, then all via bulk

### `select-top-popular.js 5000`

Min-heap scan across 840K files to pick the top 5K by popularity. Took ~4 min (streaming file reads).

**Top 5 by popularity:**
1. `BAMLH0A0HYM2` (100) — ICE BofA US High Yield Index Option-Adjusted Spread
2. `CPIAUCSL` (100) — Consumer Price Index
3. `DGS10` (99) — 10-Year Treasury Yield
4. `MORTGAGE30US` (99) — 30-Year Fixed Mortgage Rate
5. `T10Y2Y` (99) — 10-Year minus 2-Year Treasury Spread

### `fetch-observations.js --list series-top-5000.json`

Per-series observations fetch via `/fred/series/observations`. Ran for ~90 min at an effective rate of 60-100 req/min (FRED hit some 500s that triggered retries).

**Observed:** Heap stayed tiny (<30 MB), errors were all transient and recovered on retry. Completed: 5000/5000, zero hard errors.

### Then: `fetch-bulk-by-release.js` — AUTH FAILURE on v2

**First attempt:** 401 errors on EVERY single release. `Missing or invalid credentials.`

**Diagnosis via direct curl:**
- `GET /fred/v2/release/observations?api_key=...` → 401 ❌
- `GET /fred/v2/release/observations` with `Authorization: Bearer <key>` header → 200 ✅

**Third lesson learned:** **FRED v2 endpoints use Bearer auth, not `api_key` query parameter.** The v1 endpoints all use `?api_key=...`. FRED's docs don't explicitly flag this difference. Patched `fred-client.js` to auto-detect `/fred/v2/` prefix and set the Authorization header.

### `fetch-bulk-by-release.js` — take 2, success

**All 324 releases in ~15 min, 0 errors.** The bulk endpoint is the fast path — each request can return up to 500K observations, and big releases like CPI (release 10) return **1.3 million observations in 3 pages**.

Cumulative observations collected (still in raw cache at this point): ~180 million.

---

## Phase 4 — Reshape: OOM crash + memory-bounded rewrite

### `reshape-bulk-to-series.js` — first version

**Plan:** For each release, load all pages, group observations by series_id in memory, flush to per-series files at the end.

**What happened:** Got through ~77% (~640K series merged, ~14M observations in-flight) when **Node crashed with "Ineffective mark-compacts near heap limit — JavaScript heap out of memory"** (exit code 134 = SIGABRT).

**Root cause:** One release — probably "Main Economic Indicators" (13M observations across 27 pages) — accumulated its entire dataset in memory before flushing. That's multi-GB in V8 heap overhead.

### Rewrite: per-page memory bounding

**Fix:** Process one page at a time, flush a small `pageMap` to disk, let V8 GC before loading the next page. Read existing series files to merge observations (keep existing values from step 4 when dates collide, add new dates from bulk).

**Second run:** Completed in **8 minutes**, heap peaked at ~540 MB. 773,720 series got observations merged, zero errors.

**Fourth lesson learned:** Any "read everything, process, write everything" pattern is a memory time bomb. Stream + flush + GC.

---

## Phase 5 — Link population: categories fine, tags cursed

Initial goal: populate `category_ids[]` and `tags[]` fields on every `series/{ID}.json` file so the taxonomy is wired up end-to-end.

### `walk-category-links.js` — success

**72 minutes, 5,186 categories walked, all 840,454 unique series linked, 0 errors.**

Notably the walker hit the geographic subtree around cat=27000+ and added thousands of series per call (county × indicator combos). Heap peaked at ~200 MB — the in-memory `{series_id → category_ids[]}` map. Fine.

### `walk-tag-links.js` — attempt 1: silent hang

Started fast at ~50-60 tags/min. Around tag 230 (`amarillo`, alphabetically) the process **silently stopped making progress**. CPU dropped to near-zero, disk writes stopped, but the process didn't exit or error.

**Diagnosis:** Node's `fetch()` (which uses undici's HTTP/2 keep-alive under the hood) had a connection pool that entered a bad state after repeated FRED 5xx responses. Subsequent requests on the same keep-alive connection hung indefinitely. The 30-second `AbortController` timeout fired the first few times but then the process got stuck waiting on a socket that would never produce data.

**User intervention flagged it.** Killed the process, saved the interim map (230 tags done).

### Attempt 2: `Connection: close` header — didn't help

Added `Connection: close` header, a curl-like User-Agent. Tested manually: 5/5 calls succeeded. Restarted the chain. **Same hang within minutes.**

**Why it didn't work:** HTTP/2 multiplexes everything on one persistent connection — the `Connection: close` header is a **HTTP/1.1-only semantic**. Node's undici happily ignored it and kept using its stuck HTTP/2 connection.

### Attempt 3: `node:https` with `agent: false`

Replaced `fetch()` entirely with a hand-rolled `https.request()` call. `agent: false` forces a fresh HTTP/1.1 TCP connection per request — no pool, no reuse, no HTTP/2. Slightly slower per call (extra handshake) but **immune to the class of bug** that killed attempts 1 and 2.

**Smoke test:** 10/10 calls in ~10 seconds. Restarted chain.

**Third hang:** After ~20 minutes, still at 230 tags. But this time ps showed process alive, CPU slowly ticking, TCP connections being opened fresh. What was wrong?

### Root cause: FRED Akamai sustained-load rate limiting

Tested with curl directly on the same machine. **Curl succeeds in <1 sec, every time.** But from the same IP, sustained Node load triggered Akamai's rate limiter, which returned 502 Bad Gateway on nearly every request. The retry logic was recovering them but at ~1 successful request per 10-15 seconds. Effective rate: **~12 tags/min**, not the 60/min I expected.

At 12 tags/min × 5,724 remaining tags = **~8 hours**.

### Decision: cut losses, apply what we have

User chose to stop the tag walk and apply the **230 completed tags** to the series files. This populates `tags: [...]` on ~28% of series (235K of 840K), plus `tags: []` on the other 72%. Idempotent — re-running the tag walk later would backfill the rest.

**Fifth lesson learned:** FRED's Akamai rate limiter is **much stricter than their documented 120 req/min**. Specifically for `/fred/tags/series`, sustained load triggers 502 storms that effectively cap throughput at ~12 req/min. This is undocumented and only manifests after hours of load — not caught by smoke tests.

---

## Phase 6 — Export + parquet: disk full crash

Ran the pipeline:
1. `apply-links-to-series.js` — 11 min, 840K files updated, 0 errors
2. `export-taxonomy-csv.js` — seconds
3. `export-metadata-csv.js` — 5 min
4. `export-observations-csv.js` — **5 min** for 147M rows ← much faster than estimated
5. `convert-to-parquet.sh` — started, then exploded

**The crash:**
```
TransactionContext Error: Failed to commit:
Could not write file "fred.duckdb.wal": No space left on device
```

**Disk state at crash:** 228 GB total, **204 GB used, 71 MB free**. The FRED project alone was 31 GB:
- `series/` — 12 GB
- `raw-bulk/` — 12 GB (derivation cache, now redundant)
- `release-series-raw/` — 1.2 GB (derivation cache, redundant)
- `export/*.csv` — 5.5 GB

DuckDB's sort-by-(series_id,date) for the observations table needs several GB of temp space. With only 71 MB free, the commit failed.

### Fix: delete derivation caches

`raw-bulk/` and `release-series-raw/` are raw API response caches — everything useful has already been incorporated into `series/`. Deleting them freed **13 GB**.

### Take 2: clean conversion

```
observations  147,177,612 rows
series            840,454 rows
tags                5,954 rows
categories          5,186 rows
releases              324 rows
sources               119 rows
```

`fred.duckdb` final size: **3.5 GB**. `parquet/observations.parquet`: **482 MB** (10× compressed from the 5 GB CSV).

**UNRATE sanity check:**
```
obs_count: 939
first_date: 1948-01-01
last_date: 2026-03-01

2026-03-01 | 4.3
2026-02-01 | 4.4
2026-01-01 | 4.3
2025-12-01 | 4.4
2025-11-01 | 4.5
```

**Sixth lesson learned:** Always leave headroom. 5+ GB of CSV → parquet conversion needs **at least 15 GB scratch space** for DuckDB to sort.

---

## Final state

| | |
|-|-|
| Series with observations | 773,720 |
| Total observations | 147,177,612 |
| DuckDB file | 3.5 GB |
| Parquet bundle | 533 MB |
| Peak memory used | 540 MB (reshape step) |
| Total API calls made | ~15,000 |
| Total wall time | ~5 hours across retries |
| Errors in final data | 0 |

## Summary of fixes in flight

| Problem | Root cause | Fix |
|-|-|-|
| 2.5 GB in-memory index would crash 8 GB Mac | "Read everything into one JSON" pattern | Redesign: walk by release, write per-series files directly |
| 401 on all v2 endpoints | v2 uses Bearer auth, not api_key param | Auto-detect `/fred/v2/` in client, set Authorization header |
| Reshape OOM at 77% (exit 134) | Accumulating whole-release data in memory | Per-page flush + explicit GC cycle |
| Tag walk silent hang at tag 230 | Node undici HTTP/2 keep-alive stuck after 5xx storm | Replace `fetch()` with `node:https.request({agent: false})` |
| Tag walk still slow with node:https | FRED Akamai rate-limits sustained load with 502s | Accept partial coverage, apply what we have |
| DuckDB commit "No space left on device" | 204 GB used / 228 GB disk | Delete 13 GB of derivation caches |

## Things that just worked

- Taxonomy walks — zero drama
- Release-based discovery — clean, fast, dedupe was free
- Top 5K per-series observations — finished cleanly after OOM fixes
- Bulk observations via v2 endpoint — 500× faster than per-series
- Category link walk — 5,186 calls, zero errors
- DuckDB ingest + parquet compression (after freeing disk) — clean one-shot
- UNRATE/GDP final sanity checks — matched expectations exactly

## What this taught me about FRED

- **Real series count: 840,454** (not the "830K" rough estimate in older sources)
- Every series belongs to exactly **one release**
- **67K series are metadata-only** (no observations — discontinued or empty)
- **The category tree is 80% geography** — economic taxonomy is only ~1,000 nodes
- **Bulk `/fred/v2/release/observations`** is the killer feature — use it over per-series fetch whenever possible
- **FRED's rate limit is opaque** — documented 120 req/min is the ceiling, but Akamai throttles specific endpoints (especially `/fred/tags/series`) much harder under sustained load
