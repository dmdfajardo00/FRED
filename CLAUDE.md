# FRED — Federal Reserve Economic Data Explorer

## What this is

A full-stack economic data visualization platform built on a local mirror of the FRED API (api.stlouisfed.org). Two apps in one repo:

1. **Frontend** (repo root) — SvelteKit SPA deployed to Vercel
2. **API** (`api/`) — SvelteKit + DuckDB server deployed to VPS via Dokploy

The data layer is a 3.8 GB DuckDB database containing 840K series and 147M observations scraped from FRED.

## Architecture

```
Browser → Vercel (static SPA) → VPS API (db-dataviz.dmdfajardo.pro) → DuckDB
```

- Frontend: SvelteKit with adapter-static, Tailwind v4, LayerCake charts, Svelte 5 runes
- API: SvelteKit with adapter-node, duckdb-async, FTS search, API key auth
- Database: DuckDB 3.8 GB at `/opt/fred-data/fred.duckdb` on VPS (read-only mode)
- Deploy: Dokploy project "FRED", application `fred-api-yoy0xd`

## Repository layout

```
FRED/
├── src/                    Frontend SvelteKit app (root)
│   ├── lib/
│   │   ├── api.ts          API client (uses VITE_API_URL + VITE_API_KEY)
│   │   ├── components/
│   │   │   ├── charts/     LayerCake chart layers (Line, Area, Bar, AxisX, AxisY, Crosshair, HoverTooltip, ChartOverlay, ChartWrapper)
│   │   │   ├── gallery/    SeriesCard, ChartCard, Sparkline
│   │   │   ├── navigation/ AppSidebar (icon rail, collapsible)
│   │   │   ├── shared/     SearchInput (debounced), InfiniteScroll
│   │   │   └── ui/         Badge, Divider, EmptyState, LoadingSpinner
│   │   ├── mock/           Mock FRED data (9 series, used for dev fallback only)
│   │   ├── stores/         sidebar, theme (Svelte stores with context)
│   │   ├── types/          fred.ts, chart.ts, nav.ts
│   │   └── utils/          cn(), date, format, scale helpers
│   └── routes/
│       ├── +layout.svelte  Shell: AppSidebar + main content area
│       ├── +page.svelte    Redirect to /gallery
│       ├── gallery/        Search + browse 840K series with sparkline thumbnails
│       ├── charts/[id]/    Full chart detail with metadata panel
│       ├── search/         Dedicated search page
│       └── settings/       Theme toggle
├── api/                    Backend SvelteKit app
│   ├── src/lib/db.ts       DuckDB connection singleton (FTS loaded)
│   ├── src/hooks.server.ts CORS + API key auth middleware
│   └── src/routes/api/
│       ├── observations/   GET ?ids=X,Y&start=&end= (batch, columnar response)
│       ├── series/         GET ?ids= or ?limit=&offset=&sort=
│       ├── series/search/  GET ?q=&limit=&offset=&category=&tag=&frequency= (FTS + ILIKE fallback)
│       ├── categories/     GET ?parent=
│       ├── releases/       GET (all 324)
│       ├── tags/           GET ?limit=&group=&sort=
│       └── stats/          GET (aggregate counts)
├── scripts/                FRED API scraping scripts (Node.js, zero deps)
├── data/fred/              Scraped data (mostly gitignored, see .gitignore)
├── docs/                   Architecture, scripts, journey, TODO documentation
└── api/Dockerfile          Multi-stage Docker build for VPS deployment
```

## Running locally

```bash
# Frontend (port 5173, proxies /api to VPS)
npm install
npm run dev

# API (port 5174, reads local DuckDB)
cd api && npm install
DUCKDB_PATH=../data/fred/fred.duckdb npm run dev
```

The Vite dev proxy in `vite.config.ts` forwards `/api/*` to `https://db-dataviz.dmdfajardo.pro` so the frontend works without running the API locally.

## Environment variables

**Frontend (.env at root):**
- `VITE_API_URL` — API base URL (empty = use Vite proxy, or full URL for production)
- `VITE_API_KEY` — API key sent as `X-API-Key` header

**API (api/.env):**
- `DUCKDB_PATH` — path to fred.duckdb file
- `PORT` — server port (default 3000 in prod, 5174 in dev)
- `ORIGIN` — SvelteKit origin for CSRF
- `CORS_ORIGINS` — comma-separated allowed origins (or `*`)
- `API_KEY` — required key for all /api/* routes
- `NODE_ENV` — production/development

**Scraping (.env at root):**
- `FRED_API_KEY` — FRED API key for scraping scripts

## Key conventions

- **Svelte 5 runes only**: `$state()`, `$derived()`, `$effect()`, `$props()`. No legacy `let x` exports.
- **No `on:click`**: use `onclick`. No `handle*` wrapper functions — inline handlers.
- **Tailwind v4**: `@theme inline` in app.css, oklch color system, CSS variable tokens.
- **Icons**: `@iconify/svelte` with `material-symbols:*` icon set. Import as `import Icon from '@iconify/svelte'`.
- **Chart layers**: LayerCake components use `getContext('LayerCake')` with `$` store access.
- **API responses**: BigInt values auto-converted to Number in `db.ts`. Dates cast to VARCHAR in SQL.
- **Search**: DuckDB FTS (BM25) with ILIKE fallback. Exact ID match short-circuits FTS.
- **URL state**: Gallery search/filters driven by URL query params (`?q=&category=&tag=&frequency=`).
- **Auth**: All `/api/*` routes require `X-API-Key` header. Health check at `/` is public.

## Deployment

**Frontend → Vercel:**
- Repo: `dmdfajardo00/FRED`
- Build: `npm run build` → `build/` directory
- Env: `VITE_API_URL`, `VITE_API_KEY`
- Vercel project: `dave-fajardos-projects/app`

**API → VPS (Dokploy):**
- Domain: `db-dataviz.dmdfajardo.pro` (Let's Encrypt SSL)
- Dokploy project: "FRED", app: `fred-api-yoy0xd`
- Source: git `https://github.com/dmdfajardo00/FRED.git`, branch `main`, build path `./api`
- Build: Dockerfile (multi-stage, node:22-slim)
- Volume: `/opt/fred-data` → `/data` (bind mount, read-only) — contains `fred.duckdb`
- **After each Dokploy redeploy**, re-add the bind mount:
  ```bash
  docker service update --mount-add type=bind,source=/opt/fred-data,target=/data,readonly fred-api-yoy0xd
  ```

**DuckDB on VPS:**
- Path: `/opt/fred-data/fred.duckdb` (3.8 GB, with FTS index)
- DuckDB CLI installed at `/usr/local/bin/duckdb` (v1.5.1)
- FTS index: `PRAGMA create_fts_index('series', 'id', 'title', 'notes', overwrite=1)`

## Database schema (DuckDB)

- `observations` (147M rows): `series_id VARCHAR`, `date DATE`, `value DOUBLE` — indexed on `series_id`
- `series` (840K rows): `id`, `title`, `frequency`, `units`, `popularity`, `category_ids INTEGER[]`, `tags VARCHAR[]`, etc.
- `categories` (5,186 rows): `id`, `name`, `parent_id`, `notes`
- `releases` (324 rows): `id`, `name`, `press_release`, `link`, `notes`
- `sources` (119 rows): `id`, `name`, `link`, `notes`
- `tags` (5,954 rows): `name`, `group_id`, `popularity`, `series_count`

## Data refresh

Not yet automated. Manual process:
1. Run scraping scripts locally (see `docs/SCRIPTS.md`)
2. Rebuild DuckDB: `./scripts/convert-to-parquet.sh`
3. Build FTS index: `node scripts/build-fts-index.js`
4. Upload: `rsync -avPz data/fred/fred.duckdb root@31.97.190.82:/opt/fred-data/`
5. Restart API: `docker restart` the fred container
