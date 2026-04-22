# FRED — Federal Reserve Economic Data Explorer

## What this is

A full-stack economic data visualization platform built on a local mirror of the FRED API (`api.stlouisfed.org`). Two apps in one repo:

1. **Frontend** (repo root) — SvelteKit 5 SPA deployed to Vercel
2. **API** (`api/`) — SvelteKit + DuckDB server deployed to a Hostinger VPS via Dokploy

Data layer is a ~4 GB DuckDB file containing **840,454 series** / **147,177,612 observations** / 5,186 categories / 324 releases scraped from FRED.

The product identity is **"Meridian"** — an editorial / cartographic aesthetic. Zero-hue greys, cobalt accent, IBM Plex Sans + Mono, 1 px borders over drop shadows.

## Operating rules for AI agents

1. **Never `git commit`, `git push`, or trigger a production deploy (Dokploy MCP, `docker service update` on shared services, Vercel redeploy) unless the user explicitly authorises it in the current message.** Dave reviews diffs before they go live. "Commit", "push", "deploy", "ship it" are the authorizing verbs — in their absence, stop at `svelte-check` / local build and ask.
2. **No Co-Authored-By, no Claude attribution in git messages.** Dave's commits are Dave's.
3. The frontend and the API are independent deploys. Changing an `/api/*` endpoint means Dokploy has to rebuild AND the DuckDB bind-mount must be re-added (see Deployment below). Don't ship a frontend change that depends on a new API endpoint without deploying the API first.
4. **`+server.ts` files can only export HTTP verbs (`GET`, `POST`, …), the SvelteKit config names, or names prefixed with `_`.** Anything else fails the Dokploy build with `Invalid export` during analyse. Shared helpers in an endpoint file must start with `_`.

## Architecture

```
  Browser (Vercel static build)
       │
       │  HTTPS  + X-API-Key
       ▼
  db-dataviz.dmdfajardo.pro  ← Traefik, Let's Encrypt
       │
       ▼
  fred-api-yoy0xd container  ← SvelteKit (adapter-node) on port 3000
       │
       │  read-only bind mount  /data → /opt/fred-data  (duckdb-async)
       ▼
  fred.duckdb  (≈4 GB, NBER-dated FTS-indexed Parquet-backed DuckDB)
```

- Frontend: SvelteKit with `@sveltejs/adapter-static`, Tailwind v4, LayerCake charts, Svelte 5 runes, d3-geo for the world choropleth
- API: SvelteKit `adapter-node`, `duckdb-async`, FTS extension, API-key middleware in `hooks.server.ts`
- Database: DuckDB at `/opt/fred-data/fred.duckdb` on the VPS, READ_ONLY mode, FTS index on `series`
- Deploy: Dokploy project "FRED", application `fred-api-yoy0xd`

## Repository layout

```
FRED/
├── src/                              Frontend SvelteKit app
│   ├── app.css                       Meridian design tokens (see "Design system")
│   ├── lib/
│   │   ├── api.ts                    Client for every /api/* route + types
│   │   ├── us-tile-grid.ts           Abstract US state tile grid (for Pulse US view)
│   │   ├── pulse-format.ts           Shared value formatter for pulse/ranking/drawer
│   │   ├── components/
│   │   │   ├── charts/               LayerCake layers used inside ChartWrapper:
│   │   │   │                           Area Bar Line StepLine AxisX AxisY
│   │   │   │                           Crosshair HoverTooltip ChartOverlay
│   │   │   │                           ChartWrapper ChartTitle ReferenceLine
│   │   │   │                           RecessionBands ZoomReset Legend
│   │   │   ├── gallery/              SeriesCard, Sparkline, FilterSidebar, ChartCard
│   │   │   ├── navigation/           TopNav (position: fixed), CommandPalette (⌘K)
│   │   │   ├── pulse/                World map + US tile map + country drawer:
│   │   │   │                           WorldMap           d3-geo Equal Earth choropleth
│   │   │   │                           StatesTileMap       US abstract tile view
│   │   │   │                           PulseHeader         h1 + subtitle + scope toggle
│   │   │   │                           PulseToolbar        metric pills + year + log
│   │   │   │                           RankingsPanel       Highest/Lowest + summary
│   │   │   │                           CountryFlag         flagcdn.com SVG
│   │   │   │                           CountryDrawer       440 px right drawer
│   │   │   │                           CountrySeriesList   drawer inner series list
│   │   │   └── shared/               SearchInput, InfiniteScroll, RichNotes
│   │   ├── stores/                   pinned.ts, theme.ts, sidebar.ts
│   │   ├── types/                    fred.ts (Series, ChartConfig), chart.ts, nav.ts
│   │   └── utils/                    format.ts, seriesColor.ts, recessions.ts,
│   │                                 scale.ts, date.ts
│   └── routes/
│       ├── +layout.svelte            Shell: TopNav (fixed top-0) + main(pt-52)
│       ├── +page.svelte              Redirect to /pulse (NOT /gallery)
│       ├── pulse/                    Landing page: Global Pulse world choropleth
│       ├── gallery/                  Command Center: 840K series browser
│       ├── charts/[id]/              Workstation: editorial series detail
│       ├── library/                  Pinned series + collections
│       ├── releases/                 324 FRED releases + indexed series
│       └── settings/                 Theme
├── api/                              Backend SvelteKit app
│   ├── Dockerfile                    Multi-stage build, node:22-slim
│   ├── src/
│   │   ├── app.html                  Server SSR shell (ignored by frontend)
│   │   ├── hooks.server.ts           CORS + X-API-Key middleware
│   │   └── lib/db.ts                 DuckDB singleton: INSTALL fts → LOAD fts
│   └── src/routes/api/
│       ├── stats/               GET  aggregate counts
│       ├── series/              GET  ?ids=  OR  ?limit=&offset=&sort=&category=&tag=&frequency=&release=&popMin=
│       ├── series/search/       GET  ?q=&limit=&offset=&category=&tag=&frequency=  (FTS + ILIKE fallback)
│       ├── observations/        GET  ?ids=X,Y&start=&end=  (columnar, bigints→Number)
│       ├── categories/          GET  ?parent=
│       ├── releases/            GET  list all
│       ├── releases/[id]/       GET  release metadata + top-N indexed series
│       ├── tags/                GET  ?limit=&group=&sort=
│       ├── pulse/states/        GET  ?metric=unemployment|employment|income  (state-level, 50 US)
│       ├── pulse/countries/     GET  ?metric=gdp_per_capita|life_expectancy|inflation|internet_users|population|unemployment&year=
│       ├── countries/           GET  ISO3 → FRED category_id index  (cached in-module)
│       └── countries/[iso3]/    GET  per-country top series + 4 headline stats
├── scripts/                          FRED scraping scripts (Node, zero deps)
├── data/fred/                        Scraped + gitignored
├── static/                           Frontend static assets (see countries-110m.json)
└── .vercelignore                     Excludes api/ + data/ + scripts/ from Vercel
```

## Design system (Meridian)

Tokens live in `src/app.css`. The philosophy is editorial cartography.

**Palette (zero hue, light mode default; dark mode just inverts L):**
- `--bg`, `--bg-soft`  surfaces
- `--border`, `--border-faint`  1 px hairlines
- `--ink-0 .. --ink-4`  text hierarchy (0 strongest, 4 weakest)
- `--accent` cobalt (`oklch(48% 0.19 250)`). One accent only.
- `--c-cobalt --c-maroon --c-ochre --c-moss --c-plum`  chart palette (5 desaturated hues)
- `--pos --neg` semantic deltas

**Typography:**
- Sans: **IBM Plex Sans** (300/400/500/600) — `var(--font-sans)`
- Mono: **IBM Plex Mono** (400/500) — `var(--font-mono)`
- Numbers always `font-mono tabular-nums`
- Eyebrow labels: `font-mono text-[10px] tracking-[0.06em] uppercase` in `--ink-3`

**Surfaces:**
- Cards: `1px solid var(--border)`, `rounded-[6px]`, no drop shadows except on elevated floats (drawer, tooltip)
- Tooltips: `box-shadow: 0 12px 32px -12px color-mix(in oklch, var(--ink-0) 28%, transparent)`
- Filter sidebar: `position: fixed; left:0; top:52px; bottom:0; width:240px` — never scrolls with page
- Top nav: `position: fixed; top:0; z-index: 30; height: 52px`. Layout adds `padding-top: 52px` to `<main>`.

**Svelte 5 rules (strict):**
- Runes only: `$state`, `$derived`, `$effect`, `$props`. No legacy store subscriptions in new components.
- Inline handlers: `onclick={() => …}` — **not** `handle*` wrappers.
- `on:click` deprecated — use `onclick`. Same for `oninput`, `onchange`, etc.
- Two-way binding with `$bindable()` where needed; most state flows via callback props.

**Tailwind v4 rules:**
- `@theme inline` in `src/app.css` declares `--color-*` aliases bound to the Meridian tokens.
- Prefer `style:color="var(--ink-1)"` over Tailwind arbitrary colors — keeps the design tokens the single source of truth.
- Utilities are allowed for layout (`flex`, `grid`, `gap-[N]`, `px-N`); avoid arbitrary colors (`text-[#…]`).

## Running locally

```bash
# Frontend on :4817 (proxies /api/* to production)
npm install
npm run dev

# API locally, pointed at a local DuckDB copy, on :5174
cd api && npm install
DUCKDB_PATH=../data/fred/fred.duckdb npm run dev
```

**Dev auth — why localhost is NOT in the prod allowlist.** The API's `hooks.server.ts` only trusts `dmdfajardo.pro` + `*.vercel.app` origins. Local dev reaches the API through the Vite proxy defined in `vite.config.ts`: the proxy runs server-side (Node, not browser), rewrites `Origin` to `https://dmdfajardo.pro`, and attaches `X-API-Key: $VITE_DEV_API_KEY` before forwarding. The key lives only in `.env` on your laptop — never in the browser bundle, never in git. A stranger who clones the repo and runs `npm run dev` without a `.env` gets 403s.

`vite.config.ts` proxies `/api/*` to `https://db-dataviz.dmdfajardo.pro`, so the frontend works without a local API as long as the VPS is up. Spinning up the API locally requires the DuckDB file — 4 GB, not in git.

## Environment variables

**Frontend (`.env` at repo root):**
- `VITE_API_URL` — API base URL. Empty → use the Vite proxy (dev). Set to `https://db-dataviz.dmdfajardo.pro` in Vercel.
- `VITE_API_KEY` — sent as `X-API-Key` header on every request.

**API (`api/.env`):**
- `DUCKDB_PATH` — path to `fred.duckdb`. In prod it's `/data/fred.duckdb` (the bind mount).
- `PORT` — 3000 in prod, 5174 in dev.
- `ORIGIN` — SvelteKit origin for CSRF.
- `CORS_ORIGINS` — comma-separated list or `*`.
- `API_KEY` — required match for `X-API-Key` on every `/api/*`.
- `NODE_ENV` — `production` in prod.

**Scraping (`.env` at root):**
- `FRED_API_KEY` — for `scripts/*.js` that pull from `api.stlouisfed.org`.

## Production deployment

**Frontend → Vercel**
- Repo: `dmdfajardo00/FRED`, branch `main`
- Build: `npm run build` → `build/` (static, `adapter-static`)
- `.vercelignore` excludes `api/`, `data/`, `scripts/`, `docs/` so Vercel doesn't try to type-check the API
- Env vars live in the Vercel dashboard

**API → Dokploy on VPS `31.97.190.82`**
- Dokploy URL: `https://deploy.dmdfajardo.pro`
- Project: "FRED", application ID: `7yrZ_hCNsolJ1xK_7oHY_`, app name: `fred-api-yoy0xd`
- Domain: `db-dataviz.dmdfajardo.pro` (Traefik + Let's Encrypt)
- Build path: `./api`, Dockerfile multi-stage, `node:22-slim`
- Source: git clone from `main` on every deploy — **no volumes are preserved across rebuilds**

**Deploy sequence (only when authorized):**
1. `mcp__dokploy-mcp__application-deploy` on `applicationId: 7yrZ_hCNsolJ1xK_7oHY_` — triggers git-clone + `docker build`
2. Poll `docker images fred-api-yoy0xd --format "{{.CreatedSince}}"` until fresh (~45–90 s)
3. **Re-add the DuckDB bind mount** — Dokploy wipes mounts on rebuild:
   ```bash
   docker service update --mount-add type=bind,source=/opt/fred-data,target=/data,readonly fred-api-yoy0xd
   ```
4. Probe an endpoint to confirm: `curl -H "X-API-Key: ..." https://db-dataviz.dmdfajardo.pro/api/stats`

**Common build failures & fixes:**
- `Error: Invalid export 'X' in /api/...` — you exported a non-HTTP-verb name from a `+server.ts`. Rename to `_X` or move to a sibling module.
- `Extension "fts.duckdb_extension" not found` — `db.ts` must run `INSTALL fts` **before** `LOAD fts`. `duckdb-async`'s LOAD does not auto-install.

## DuckDB access

### From inside the running container

```bash
# Use the /vps-management skill — it has the SSH host, user, and password
# in its skill instructions (not committed to this repo). The skill also
# documents the firewall, auditing, and fail2ban setup so agents don't
# step on shared infrastructure.
#
# For ad-hoc one-liners, load the skill first; never hard-code VPS
# credentials in this repo or in generated Python snippets.
```

**Read-only query via the host's duckdb CLI (preferred for investigation):**

```bash
duckdb -readonly /opt/fred-data/fred.duckdb -ascii -c "
  SELECT COUNT(*) FROM series;
"
```

The host's `duckdb` CLI is at `/usr/local/bin/duckdb` (v1.5.1) and shares the same file as the API — opening it read-only while the API is running is safe.

**Programmatic from an API endpoint:**

```ts
import { query } from '$lib/db';

const rows = await query<{ id: string; title: string }>(
  `SELECT id, title FROM series WHERE popularity >= ? LIMIT ?`,
  80, 10
);
```

`query()` auto-converts `bigint` → `number`. Cast `DATE` columns to VARCHAR in SQL (`CAST(date AS VARCHAR)`) because the JSON layer doesn't serialize DuckDB `Date`s cleanly.

### Database schema

- **`observations`** (147 M rows): `series_id VARCHAR`, `date DATE`, `value DOUBLE`. Indexed on `series_id`. Query pattern: always filter by `series_id IN (…)` first.
- **`series`** (840 K rows): `id`, `title`, `frequency`, `frequency_short`, `units`, `units_short`, `seasonal_adjustment`, `seasonal_adjustment_short`, `observation_start DATE`, `observation_end DATE`, `last_updated VARCHAR`, `popularity INTEGER`, `group_popularity INTEGER`, `notes VARCHAR`, `release_ids INTEGER[]`, `category_ids INTEGER[]`, `tags VARCHAR[]`, `observation_count INTEGER`, `observations_source VARCHAR`. FTS-indexed on `id + title + notes`.
- **`categories`** (5,186 rows): `id`, `name`, `parent_id INTEGER`, `notes`. The "International → Countries" tree lives under `parent_id = 32264` (243 country sub-categories).
- **`releases`** (324 rows): `id`, `name`, `press_release BOOLEAN`, `link`, `notes`.
- **`sources`** (119 rows).
- **`tags`** (5,954 rows): `name`, `group_id`, `popularity`, `series_count`.

### Useful FRED series-ID patterns (verified)

| Indicator | Pattern | Coverage |
|-|-|-|
| GDP per capita (constant 2015 USD) | `NYGDPPCAPKD{ISO3}` | 233 countries |
| Population, total | `POPTOT{ISO2}A647NWDB` | ~200 countries |
| CPI % YoY (World Bank) | `FPCPITOTLZG{ISO3}` | 222 countries |
| Life expectancy at birth | `SPDYNLE00IN{ISO3}` | 239 countries |
| Internet users (% of pop) | `ITNETUSERP2{ISO3}` | 241 countries |
| OECD harmonised unemployment (monthly) | `LRHUTTTT{ISO2}M156S` | 36 OECD |
| US state unemployment rate | `{STATE}UR` | 50 states |
| US state nonfarm employment | `{STATE}NA` | 50 states |
| US state per-capita personal income | `{STATE}PCPI` | 50 states |
| NBER US recession indicator (monthly) | `USREC` | 1854–present |

Mind: the `POPTOT*` pattern uses **ISO2**, not ISO3 — an easy source of bugs.

## Frontend patterns

### Charts (`ChartWrapper`)

`ChartWrapper.svelte` is the canonical entry point. It wraps LayerCake, handles drag-to-zoom (see `ChartOverlay`), and accepts:

```ts
{
  config?: ChartConfig;                      // single series
  configs?: ChartConfig[];                   // multi-series compare
  height?: number;                           // default 400
  mini?: boolean;                            // no axes, no overlay, 120px
  recessionPeriods?: Array<[Date, Date]>;    // renders RecessionBands
}
```

Interactions that must keep working: drag-to-zoom on the plot area, double-click to reset zoom, crosshair + hover tooltip, compare overlay (up to 2 extra series). Don't replace `ChartWrapper` with a new ad-hoc SVG — restyle via CSS tokens instead.

For a new chart layer (e.g. recession bands, annotations, reference lines), write a component that reads `getContext<{xScale, yScale, width, height}>('LayerCake')`, renders SVG inside the existing `<Svg>` block of `ChartWrapper`, and opts in via a new prop.

### Country drawer

Clicking a country on the `WorldMap` opens `CountryDrawer` — a fixed 440 px right-side panel. It:
- Calls `getCountry(iso3)` from `api.ts`
- Shows a `CountryFlag` (flagcdn.com SVG) + headline quad (GDP/cap, pop, inflation, life expectancy)
- Lists the top-N series for that country via `CountrySeriesList` with sparklines
- Lets the user search within country and filter by frequency
- Esc or backdrop click to dismiss. Body scroll locked while open.

The drawer **preserves the map behind it** — don't turn it into a route.

### Rankings

`RankingsPanel.svelte` renders Highest + Lowest + optional summary card. Each `Item` is `{ code, value, seriesId, name? }`. For country rankings, `rankedCountries` in `/pulse/+page.svelte` populates `name` from the cached `listCountries()` response so rows show the full Title-Cased country name, with ISO3 as a small muted trailing label.

### Gallery filter sidebar

`FilterSidebar.svelte` is `position: fixed` — never sticky. The gallery page compensates with `padding-left: 240px` on the main container. Filters for frequency, category (live from DuckDB), popularity slider. All filter state is URL-driven (`?frequency=&category=&popMin=&sort=`) so back/forward navigation works.

## Commands worth knowing

```bash
# Type-check everything (frontend + api)
npx svelte-check --no-tsconfig --threshold error

# API only
cd api && npx svelte-check --no-tsconfig --threshold error

# API production build smoke test (before a Dokploy deploy)
cd api && npx vite build

# Dev server
npm run dev -- --port 7025
```

## MemPalace / reference material

Architecture decisions and incident notes from prior sessions should be saved to the per-project auto-memory under `.claude/projects/…/memory/`. Design-relevant knowledge that affects style choices (e.g. "Meridian is editorial cartographic, not generic dashboard") belongs in this `CLAUDE.md`.

## Data refresh (not automated)

1. Run scraping scripts locally (see `docs/SCRIPTS.md`).
2. Rebuild DuckDB: `./scripts/convert-to-parquet.sh`.
3. Build FTS index: `node scripts/build-fts-index.js`.
4. Upload: `rsync -avPz data/fred/fred.duckdb root@31.97.190.82:/opt/fred-data/`.
5. Restart the API container: `docker restart $(docker ps --filter name=fred-api-yoy0xd -q)`.
