<script lang="ts">
	import { onMount } from 'svelte';
	import { geoEqualEarth, geoPath, geoGraticule10, type GeoProjection } from 'd3-geo';
	import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
	import { select } from 'd3-selection';
	import { feature } from 'topojson-client';
	import type { Feature, FeatureCollection, Geometry } from 'geojson';

	type CountryDatum = { value: number | null; seriesId: string; date: string | null };

	let {
		data,
		metric,
		min,
		max,
		unit,
		higherIsBetter,
		logScale,
		onSelect
	}: {
		data: Record<string, CountryDatum>;
		metric: string;
		min: number;
		max: number;
		unit: string;
		higherIsBetter: boolean;
		logScale: boolean;
		onSelect: (countryIso3: string, seriesId: string) => void;
	} = $props();

	// ISO 3166-1 numeric -> ISO3 alpha. world-atlas 110m topojson keys features by numeric.
	const ISO_NUMERIC_TO_ISO3: Record<string, string> = {
		'004': 'AFG', '008': 'ALB', '010': 'ATA', '012': 'DZA', '016': 'ASM', '020': 'AND',
		'024': 'AGO', '028': 'ATG', '031': 'AZE', '032': 'ARG', '036': 'AUS', '040': 'AUT',
		'044': 'BHS', '048': 'BHR', '050': 'BGD', '051': 'ARM', '052': 'BRB', '056': 'BEL',
		'060': 'BMU', '064': 'BTN', '068': 'BOL', '070': 'BIH', '072': 'BWA', '074': 'BVT',
		'076': 'BRA', '084': 'BLZ', '086': 'IOT', '090': 'SLB', '092': 'VGB', '096': 'BRN',
		'100': 'BGR', '104': 'MMR', '108': 'BDI', '112': 'BLR', '116': 'KHM', '120': 'CMR',
		'124': 'CAN', '132': 'CPV', '136': 'CYM', '140': 'CAF', '144': 'LKA', '148': 'TCD',
		'152': 'CHL', '156': 'CHN', '158': 'TWN', '162': 'CXR', '166': 'CCK', '170': 'COL',
		'174': 'COM', '175': 'MYT', '178': 'COG', '180': 'COD', '184': 'COK', '188': 'CRI',
		'191': 'HRV', '192': 'CUB', '196': 'CYP', '203': 'CZE', '204': 'BEN', '208': 'DNK',
		'212': 'DMA', '214': 'DOM', '218': 'ECU', '222': 'SLV', '226': 'GNQ', '231': 'ETH',
		'232': 'ERI', '233': 'EST', '234': 'FRO', '238': 'FLK', '239': 'SGS', '242': 'FJI',
		'246': 'FIN', '248': 'ALA', '250': 'FRA', '254': 'GUF', '258': 'PYF', '260': 'ATF',
		'262': 'DJI', '266': 'GAB', '268': 'GEO', '270': 'GMB', '275': 'PSE', '276': 'DEU',
		'288': 'GHA', '292': 'GIB', '296': 'KIR', '300': 'GRC', '304': 'GRL', '308': 'GRD',
		'312': 'GLP', '316': 'GUM', '320': 'GTM', '324': 'GIN', '328': 'GUY', '332': 'HTI',
		'334': 'HMD', '336': 'VAT', '340': 'HND', '344': 'HKG', '348': 'HUN', '352': 'ISL',
		'356': 'IND', '360': 'IDN', '364': 'IRN', '368': 'IRQ', '372': 'IRL', '376': 'ISR',
		'380': 'ITA', '384': 'CIV', '388': 'JAM', '392': 'JPN', '398': 'KAZ', '400': 'JOR',
		'404': 'KEN', '408': 'PRK', '410': 'KOR', '414': 'KWT', '417': 'KGZ', '418': 'LAO',
		'422': 'LBN', '426': 'LSO', '428': 'LVA', '430': 'LBR', '434': 'LBY', '438': 'LIE',
		'440': 'LTU', '442': 'LUX', '446': 'MAC', '450': 'MDG', '454': 'MWI', '458': 'MYS',
		'462': 'MDV', '466': 'MLI', '470': 'MLT', '474': 'MTQ', '478': 'MRT', '480': 'MUS',
		'484': 'MEX', '492': 'MCO', '496': 'MNG', '498': 'MDA', '499': 'MNE', '500': 'MSR',
		'504': 'MAR', '508': 'MOZ', '512': 'OMN', '516': 'NAM', '520': 'NRU', '524': 'NPL',
		'528': 'NLD', '531': 'CUW', '533': 'ABW', '534': 'SXM', '535': 'BES', '540': 'NCL',
		'548': 'VUT', '554': 'NZL', '558': 'NIC', '562': 'NER', '566': 'NGA', '570': 'NIU',
		'574': 'NFK', '578': 'NOR', '580': 'MNP', '581': 'UMI', '583': 'FSM', '584': 'MHL',
		'585': 'PLW', '586': 'PAK', '591': 'PAN', '598': 'PNG', '600': 'PRY', '604': 'PER',
		'608': 'PHL', '612': 'PCN', '616': 'POL', '620': 'PRT', '624': 'GNB', '626': 'TLS',
		'630': 'PRI', '634': 'QAT', '638': 'REU', '642': 'ROU', '643': 'RUS', '646': 'RWA',
		'652': 'BLM', '654': 'SHN', '659': 'KNA', '660': 'AIA', '662': 'LCA', '663': 'MAF',
		'666': 'SPM', '670': 'VCT', '674': 'SMR', '678': 'STP', '682': 'SAU', '686': 'SEN',
		'688': 'SRB', '690': 'SYC', '694': 'SLE', '702': 'SGP', '703': 'SVK', '704': 'VNM',
		'705': 'SVN', '706': 'SOM', '710': 'ZAF', '716': 'ZWE', '724': 'ESP', '728': 'SSD',
		'729': 'SDN', '732': 'ESH', '740': 'SUR', '744': 'SJM', '748': 'SWZ', '752': 'SWE',
		'756': 'CHE', '760': 'SYR', '762': 'TJK', '764': 'THA', '768': 'TGO', '772': 'TKL',
		'776': 'TON', '780': 'TTO', '784': 'ARE', '788': 'TUN', '792': 'TUR', '795': 'TKM',
		'796': 'TCA', '798': 'TUV', '800': 'UGA', '804': 'UKR', '807': 'MKD', '818': 'EGY',
		'826': 'GBR', '831': 'GGY', '832': 'JEY', '833': 'IMN', '834': 'TZA', '840': 'USA',
		'850': 'VIR', '854': 'BFA', '858': 'URY', '860': 'UZB', '862': 'VEN', '876': 'WLF',
		'882': 'WSM', '887': 'YEM', '894': 'ZMB'
	};

	function toIso3(numericId: string | number): string | null {
		const key = String(numericId).padStart(3, '0');
		return ISO_NUMERIC_TO_ISO3[key] ?? null;
	}

	let features = $state<Feature<Geometry, { name: string }>[]>([]);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);

	const VW = 960;
	const VH = 500;

	let svgEl: SVGSVGElement | null = $state(null);
	let zoomTransform = $state({ k: 1, x: 0, y: 0 });
	let zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> | null = null;
	let isPanning = $state(false);

	let hover = $state<{ iso3: string; name: string; value: number | null; date: string | null; cx: number; cy: number } | null>(null);

	const projection: GeoProjection = geoEqualEarth().fitSize([VW, VH], { type: 'Sphere' } as never);
	const pathGen = geoPath(projection);
	const graticulePath = geoPath(projection)(geoGraticule10()) ?? '';
	const spherePath = geoPath(projection)({ type: 'Sphere' } as never) ?? '';

	onMount(async () => {
		try {
			const res = await fetch('/countries-110m.json');
			if (!res.ok) throw new Error(`topojson ${res.status}`);
			const topo = await res.json();
			const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>;
			features = fc.features;
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'failed to load map';
		} finally {
			loading = false;
		}
	});

	// Attach zoom/pan once the SVG exists (happens after `loading` flips).
	$effect(() => {
		if (!svgEl || zoomBehavior) return;
		const zb = zoom<SVGSVGElement, unknown>()
			.scaleExtent([1, 10])
			.translateExtent([[-VW * 0.2, -VH * 0.2], [VW * 1.2, VH * 1.2]])
			.filter((event) => {
				// Allow wheel + all pointer drags including on country paths.
				if (event.type === 'wheel') return !event.ctrlKey;
				if (event.type === 'mousedown' || event.type === 'touchstart') return event.button === 0 || event.type === 'touchstart';
				return !event.ctrlKey && !event.button;
			})
			.on('start', () => { isPanning = true; hover = null; })
			.on('zoom', (event) => {
				zoomTransform = { k: event.transform.k, x: event.transform.x, y: event.transform.y };
			})
			.on('end', () => { isPanning = false; });
		zoomBehavior = zb;
		select(svgEl).call(zb);
	});

	function resetZoom() {
		if (svgEl && zoomBehavior) {
			select(svgEl).call(zoomBehavior.transform, zoomIdentity);
		}
	}

	function zoomBy(factor: number) {
		if (svgEl && zoomBehavior) {
			select(svgEl).call(zoomBehavior.scaleBy, factor);
		}
	}

	function normalize(v: number): number {
		if (logScale) {
			const lmin = Math.log10(Math.max(1e-9, Math.abs(min) || 1e-9));
			const lmax = Math.log10(Math.max(1e-9, Math.abs(max) || 1e-9));
			const lv = Math.log10(Math.max(1e-9, Math.abs(v) || 1e-9));
			const range = lmax - lmin || 1;
			return (lv - lmin) / range;
		}
		const range = max - min || 1;
		return (v - min) / range;
	}

	function colorFor(v: number | null): string {
		if (v == null || !isFinite(v)) return 'url(#nodata-hatch)';
		const t = Math.max(0, Math.min(1, normalize(v)));
		const hue = higherIsBetter ? 250 : 25;
		const intensity = Math.max(0.08, t);
		// Lightness 94% → 42%, chroma 0.02 → 0.16 — desaturated at low end, single-hue editorial.
		const L = (94 - intensity * 52).toFixed(1);
		const C = (0.02 + intensity * 0.14).toFixed(3);
		return `oklch(${L}% ${C} ${hue})`;
	}

	function formatMetric(v: number | null): string {
		if (v == null) return '—';
		if (unit === '$') {
			if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'k';
			return '$' + Math.round(v).toLocaleString();
		}
		if (unit === 'people') {
			if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
			if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
			if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k';
			return Math.round(v).toLocaleString();
		}
		if (unit === '%') return v.toFixed(2) + '%';
		return v.toFixed(2);
	}

	function yearOf(date: string | null): string {
		if (!date) return '';
		return date.slice(0, 4);
	}

	const rendered = $derived.by(() =>
		features.map((f) => {
			const iso3 = toIso3(f.id as string | number);
			const datum = iso3 ? data[iso3] ?? null : null;
			const name = f.properties?.name ?? iso3 ?? '';
			const d = pathGen(f) ?? '';
			return { feature: f, iso3, datum, name, d };
		})
	);
</script>

<div class="world-map relative w-full select-none">
	{#if loading}
		<div class="world-map__skeleton" aria-busy="true" aria-label="Loading world map">
			<div class="skeleton-globe"></div>
			<div class="skeleton-label font-mono">PREPARING CARTOGRAPHIC SURFACE…</div>
		</div>
	{:else if errorMsg}
		<div class="py-16 text-center text-[13px]" style:color="var(--ink-3)">
			<div class="font-mono text-[10px] tracking-[0.08em] uppercase mb-2" style:color="var(--neg)">Map load failed</div>
			<div>{errorMsg}</div>
		</div>
	{:else}
		<!-- Zoom controls -->
		<div class="absolute top-3 right-3 z-10 flex flex-col gap-[2px] p-[2px] rounded-[6px]"
			style:background="var(--bg)"
			style:border="1px solid var(--border)"
			style:box-shadow="0 1px 2px rgba(0,0,0,0.04)">
			<button type="button" onclick={() => zoomBy(1.6)} aria-label="Zoom in" class="zoom-btn">
				<svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4">
					<line x1="7" y1="3" x2="7" y2="11" stroke-linecap="round" />
					<line x1="3" y1="7" x2="11" y2="7" stroke-linecap="round" />
				</svg>
			</button>
			<button type="button" onclick={() => zoomBy(0.625)} aria-label="Zoom out" class="zoom-btn">
				<svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4">
					<line x1="3" y1="7" x2="11" y2="7" stroke-linecap="round" />
				</svg>
			</button>
			<div class="h-px my-[1px]" style:background="var(--border-faint)"></div>
			<button type="button" onclick={resetZoom} aria-label="Reset view" class="zoom-btn">
				<svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4">
					<circle cx="7" cy="7" r="4" />
					<path d="M7 5 L7 7 L8.5 8" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
		</div>

		<!-- Zoom level indicator -->
		<div class="absolute top-3 left-3 z-10 flex items-center gap-2 px-[10px] h-7 rounded-[6px] font-mono text-[10px] tracking-[0.06em] uppercase tabular-nums"
			style:background="color-mix(in oklch, var(--bg) 85%, transparent)"
			style:backdrop-filter="blur(8px)"
			style:border="1px solid var(--border)"
			style:color="var(--ink-3)">
			<span class="pulse-dot"></span>
			Equal&nbsp;Earth · {zoomTransform.k.toFixed(1)}×
		</div>

		<svg
			bind:this={svgEl}
			viewBox="0 0 {VW} {VH}"
			width="100%"
			class="map-svg"
			class:panning={isPanning}
			aria-label="World choropleth"
		>
			<defs>
				<pattern id="nodata-hatch" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
					<rect width="5" height="5" fill="var(--bg-soft)" />
					<line x1="0" y1="0" x2="0" y2="5" stroke="var(--border)" stroke-width="0.8" />
				</pattern>
				<radialGradient id="ocean-grad" cx="50%" cy="50%" r="65%">
					<stop offset="0%" stop-color="var(--bg)" />
					<stop offset="100%" stop-color="var(--bg-soft)" />
				</radialGradient>
			</defs>

			<g transform="translate({zoomTransform.x},{zoomTransform.y}) scale({zoomTransform.k})">
				<!-- Ocean sphere + subtle graticule -->
				<path d={spherePath} fill="url(#ocean-grad)" stroke="var(--border)" stroke-width={0.8 / zoomTransform.k} />
				<path d={graticulePath} fill="none" stroke="var(--border-faint)" stroke-width={0.4 / zoomTransform.k} opacity="0.55" />

				<!-- Country fills -->
				<g>
					{#each rendered as r (r.iso3 ?? r.name)}
						{@const v = r.datum?.value ?? null}
						<path
							class="country-path"
							d={r.d}
							fill={colorFor(v)}
							stroke="var(--border-faint)"
							stroke-width={0.5 / zoomTransform.k}
							vector-effect="non-scaling-stroke"
							data-iso3={r.iso3 ?? ''}
							aria-label={r.name}
							onmouseenter={(e) => {
								if (isPanning) return;
								const [cx, cy] = pathGen.centroid(r.feature);
								hover = {
									iso3: r.iso3 ?? '',
									name: r.name,
									value: v,
									date: r.datum?.date ?? null,
									cx: isFinite(cx) ? cx : (e as MouseEvent).offsetX,
									cy: isFinite(cy) ? cy : (e as MouseEvent).offsetY
								};
							}}
							onmouseleave={() => (hover = null)}
							onclick={(e) => {
								e.stopPropagation();
								if (r.iso3 && r.datum?.seriesId) onSelect(r.iso3, r.datum.seriesId);
							}}
							onkeydown={(e) => {
								if ((e.key === 'Enter' || e.key === ' ') && r.iso3 && r.datum?.seriesId) {
									onSelect(r.iso3, r.datum.seriesId);
								}
							}}
						/>
					{/each}
				</g>

				<!-- Hover/select highlight overlay — a single extra path above all countries -->
				{#if hover}
					{@const hoveredFeature = rendered.find((r) => r.iso3 === hover?.iso3)}
					{#if hoveredFeature}
						<path
							d={hoveredFeature.d}
							fill="none"
							stroke="var(--ink-0)"
							stroke-width={1.6 / zoomTransform.k}
							stroke-linejoin="round"
							class="hover-outline"
							pointer-events="none"
						/>
					{/if}
				{/if}
			</g>
		</svg>

		{#if hover}
			{@const tx = hover.cx * zoomTransform.k + zoomTransform.x}
			{@const ty = hover.cy * zoomTransform.k + zoomTransform.y}
			{@const leftPct = Math.max(4, Math.min(82, (tx / VW) * 100))}
			{@const topPct = Math.max(4, Math.min(86, (ty / VH) * 100))}
			<div class="map-tooltip absolute px-[12px] py-[9px] rounded-[6px] z-10 pointer-events-none tabular-nums"
				style:background="var(--bg)"
				style:border="1px solid var(--border)"
				style:box-shadow="0 12px 32px -12px color-mix(in oklch, var(--ink-0) 28%, transparent), 0 2px 4px color-mix(in oklch, var(--ink-0) 4%, transparent)"
				style:left="{leftPct}%"
				style:top="{topPct}%"
				style:transform="translate(10px, -50%)">
				<div class="flex items-center gap-[6px] mb-[3px]">
					<span class="font-mono text-[10px] tracking-[0.06em]" style:color="var(--ink-3)">{hover.iso3 || '—'}</span>
					<span style:color="var(--ink-4)">·</span>
					<span class="text-[12px] font-medium" style:color="var(--ink-1)">{hover.name}</span>
				</div>
				<div class="font-mono text-[17px] leading-tight" style:color="var(--ink-0)" style:font-weight="500" style:letter-spacing="-0.01em">
					{formatMetric(hover.value)}
				</div>
				<div class="flex items-center gap-[6px] mt-[4px] font-mono text-[10px] tracking-[0.04em] uppercase" style:color="var(--ink-3)">
					<span>{metric}</span>
					{#if hover.date}
						<span style:color="var(--ink-4)">·</span>
						<span>{yearOf(hover.date)}</span>
					{/if}
				</div>
				{#if hover.value == null}
					<div class="mt-[6px] pt-[6px] border-t font-mono text-[10px] tracking-[0.04em] uppercase" style:border-color="var(--border-faint)" style:color="var(--ink-3)">
						No data
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.map-svg {
		display: block;
		cursor: grab;
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
	}
	.map-svg.panning { cursor: grabbing; }
	.map-svg :global(.country-path) {
		transition: fill 280ms cubic-bezier(0.16, 1, 0.3, 1);
		cursor: pointer;
		outline: none;
	}
	.map-svg.panning :global(.country-path) { cursor: grabbing; }
	.hover-outline {
		animation: hover-in 160ms cubic-bezier(0.16, 1, 0.3, 1);
		filter: drop-shadow(0 0 1px color-mix(in oklch, var(--ink-0) 35%, transparent));
	}
	@keyframes hover-in {
		from { opacity: 0; }
		to   { opacity: 1; }
	}

	.zoom-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 22px;
		background: transparent;
		border: none;
		border-radius: 3px;
		color: var(--ink-2);
		cursor: pointer;
		transition: background 160ms, color 160ms, transform 120ms;
	}
	.zoom-btn:hover {
		background: var(--bg-soft);
		color: var(--ink-0);
	}
	.zoom-btn:active {
		transform: scale(0.94);
	}

	.map-tooltip {
		animation: tooltip-in 220ms cubic-bezier(0.16, 1, 0.3, 1);
	}
	@keyframes tooltip-in {
		from { opacity: 0; transform: translate(4px, -50%) scale(0.96); }
		to   { opacity: 1; transform: translate(10px, -50%) scale(1); }
	}

	.pulse-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--pos);
		box-shadow: 0 0 0 0 color-mix(in oklch, var(--pos) 60%, transparent);
		animation: breath 2400ms ease-out infinite;
	}
	@keyframes breath {
		0%   { box-shadow: 0 0 0 0 color-mix(in oklch, var(--pos) 50%, transparent); }
		60%  { box-shadow: 0 0 0 6px color-mix(in oklch, var(--pos) 0%, transparent); }
		100% { box-shadow: 0 0 0 0 color-mix(in oklch, var(--pos) 0%, transparent); }
	}

	.world-map__skeleton {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 0;
		gap: 1.5rem;
	}
	.skeleton-globe {
		width: 180px;
		height: 180px;
		border-radius: 50%;
		background:
			radial-gradient(circle at 30% 30%, var(--bg) 0%, var(--bg-soft) 70%),
			linear-gradient(90deg, transparent 0%, color-mix(in oklch, var(--ink-0) 3%, transparent) 50%, transparent 100%);
		background-size: 100% 100%, 200% 100%;
		background-repeat: no-repeat;
		animation: shimmer 1600ms linear infinite;
		border: 1px solid var(--border-faint);
		position: relative;
	}
	.skeleton-globe::before,
	.skeleton-globe::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		border: 1px solid var(--border-faint);
		opacity: 0.6;
	}
	.skeleton-globe::before {
		transform: scaleX(0.35);
	}
	.skeleton-globe::after {
		transform: scaleY(0.35);
	}
	@keyframes shimmer {
		0%   { background-position: 0 0, -200% 0; }
		100% { background-position: 0 0,  200% 0; }
	}
	.skeleton-label {
		font-size: 10px;
		letter-spacing: 0.12em;
		color: var(--ink-3);
	}
</style>
