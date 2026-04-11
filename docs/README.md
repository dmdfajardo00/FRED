# FRED Scraper & Data Platform — Documentation

A complete local mirror of the Federal Reserve Economic Data (FRED) API. Built from scratch in one session on April 11, 2026.

**What's here:**
- `840,454` series metadata files
- `147,177,612` observations
- Full taxonomy: 5,186 categories · 324 releases · 119 sources · 5,954 tags
- DuckDB database (3.5 GB) for sub-10ms queries
- Parquet bundle (533 MB) for portable analytics

**Query in <10 ms:**
```bash
duckdb data/fred/fred.duckdb \
  "SELECT date, value FROM observations WHERE series_id='UNRATE' ORDER BY date"
```

## Documentation index

| Doc | Purpose |
|-|-|
| **[ARCHITECTURE.md](./ARCHITECTURE.md)** | Data flow, schema, design decisions, trade-offs |
| **[SCRIPTS.md](./SCRIPTS.md)** | Every script: what it does, how to run, memory profile |
| **[JOURNEY.md](./JOURNEY.md)** | Chronological build story — what worked, what failed, how it was fixed |
| **[TODO.md](./TODO.md)** | Remaining action items and future work |

## Directory layout

```
FRED/
├── .env                          FRED_API_KEY (gitignored)
├── package.json                  npm scripts, no dependencies (Node 20+ built-ins only)
├── data/fred/
│   ├── taxonomy/                 5,186 cats + 324 rels + 119 srcs + 5,954 tags
│   ├── series/                   840K flat per-series JSON files (12 GB)
│   ├── _interim/                 in-flight link-walk maps (resumable state)
│   ├── export/                   CSV exports (derivation artifacts, ~5.5 GB, deletable)
│   ├── parquet/                  6 parquet files (533 MB compressed)
│   ├── fred.duckdb               single-file queryable database (3.5 GB)
│   ├── category-to-series.json   inverse index
│   ├── tag-to-series.json        inverse index (partial — 230/5,954 tags)
│   ├── series-top-5000.json      top 5K most-popular series IDs
│   └── endpoints.json            catalog of all 31 FRED API endpoints
└── scripts/                      all executable code (docs/SCRIPTS.md reference)
```

## Quickstart

```bash
# Query the DuckDB database
duckdb data/fred/fred.duckdb

# Or read example queries
duckdb data/fred/fred.duckdb
D> .read scripts/example-queries.sql
```

## Final scrape stats

| | |
|-|-|
| Total series in FRED | 840,454 |
| Series with observations | 773,476 |
| Total observations | 147,177,612 |
| Series file directory size | 12 GB |
| DuckDB database | 3.5 GB |
| Parquet bundle | 533 MB |
| Source of truth | per-series JSON files in `data/fred/series/` |
| Peak wall time for full scrape | ~3 hours |
| Peak memory used | ~540 MB (reshape step) |
| Rate-limit ceiling | 109 req/min (under FRED's 120/min) |
| Errors in final state | 0 |

## Key design decisions

- **Walk by release, not by category** for the main scrape — 324 releases is 16× fewer API calls than 5,186 categories, and the bulk observations endpoint is ~500× faster than per-series fetching
- **Flat file layout** (`series/UNRATE.json`) over sharded — optimizes for direct lookup at the cost of slow directory enumeration (which we only do once at CSV export time)
- **node:https with `agent: false`** for the HTTP client — bypasses Node's HTTP/2 keep-alive pool which has a known hang bug under sustained FRED load
- **Per-page memory bounding** in reshape — processes one bulk response page at a time to keep heap under 200 MB even with 147M observations
- **DuckDB + Parquet** as the query layer — sub-10ms point lookups, universal format, zero vendor lock-in, no backend server needed

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full rationale.
