<script lang="ts">
	import {
		getCountry,
		fetchObservations,
		type CountryDetail,
		type SeriesSummary,
		type CountryHeadline
	} from '$lib/api';
	import CountryFlag from './CountryFlag.svelte';
	import CountrySeriesList from './CountrySeriesList.svelte';
	import { formatValue } from '$lib/utils/format';
	import { goto } from '$app/navigation';

	interface Props {
		iso3: string | null;
		name?: string;
		onClose: () => void;
	}

	const { iso3, name, onClose }: Props = $props();

	let detail = $state<CountryDetail | null>(null);
	let loading = $state(false);
	let errored = $state(false);
	let sparklines = $state<Record<string, (number | null)[]>>({});

	// Request tracking
	let requestId = 0;
	let currentController: AbortController | null = null;

	// Filters
	let searchQuery = $state('');
	let activeFrequency = $state<string>('all');

	// Close button ref
	let closeBtn: HTMLButtonElement | null = $state(null);

	const isOpen = $derived(iso3 !== null);
	const displayName = $derived(detail?.name ?? name ?? iso3 ?? '');

	// Load detail when iso3 changes
	$effect(() => {
		const currentIso3 = iso3;
		if (!currentIso3) {
			// Reset state on close
			detail = null;
			sparklines = {};
			loading = false;
			errored = false;
			searchQuery = '';
			activeFrequency = 'all';
			if (currentController) {
				currentController.abort();
				currentController = null;
			}
			return;
		}

		// Abort any in-flight request
		if (currentController) currentController.abort();
		const controller = new AbortController();
		currentController = controller;
		const myId = ++requestId;

		detail = null;
		sparklines = {};
		errored = false;
		loading = true;
		searchQuery = '';
		activeFrequency = 'all';

		(async () => {
			try {
				const d = await getCountry(currentIso3, 30);
				if (myId !== requestId || controller.signal.aborted) return;
				detail = d;
				loading = false;

				// Load sparklines (5y window)
				if (d.series.length > 0) {
					const now = new Date();
					const start = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
						.toISOString()
						.slice(0, 10);
					try {
						const obs = await fetchObservations(
							d.series.map((s) => s.id),
							start
						);
						if (myId !== requestId || controller.signal.aborted) return;
						const next: Record<string, (number | null)[]> = {};
						for (const id of Object.keys(obs)) {
							next[id] = obs[id].values;
						}
						sparklines = next;
					} catch {
						// Silent — sparklines are enhancement, not critical
					}
				}
			} catch (e) {
				if (myId !== requestId || controller.signal.aborted) return;
				loading = false;
				errored = true;
			}
		})();
	});

	// Body scroll lock + Escape key
	$effect(() => {
		if (!isOpen) return;

		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);

		// Autofocus close button after mount
		requestAnimationFrame(() => {
			closeBtn?.focus();
		});

		return () => {
			document.body.style.overflow = prevOverflow;
			window.removeEventListener('keydown', onKey);
		};
	});

	// Frequency grouping
	const freqGroups = $derived.by(() => {
		if (!detail) return [] as { key: string; label: string; count: number }[];
		const order = [
			{ key: 'A', label: 'Annual' },
			{ key: 'Q', label: 'Quarterly' },
			{ key: 'M', label: 'Monthly' },
			{ key: 'W', label: 'Weekly' },
			{ key: 'D', label: 'Daily' }
		];
		const counts: Record<string, number> = {};
		for (const s of detail.series) {
			const k = (s.frequency_short || '').toUpperCase();
			counts[k] = (counts[k] || 0) + 1;
		}
		return order
			.filter((g) => counts[g.key] > 0)
			.map((g) => ({ key: g.key, label: g.label, count: counts[g.key] }));
	});

	// Filtered series
	const filteredSeries = $derived.by<SeriesSummary[]>(() => {
		if (!detail) return [];
		let list = detail.series;
		if (activeFrequency !== 'all') {
			list = list.filter(
				(s) => (s.frequency_short || '').toUpperCase() === activeFrequency
			);
		}
		const q = searchQuery.trim().toLowerCase();
		if (q) {
			list = list.filter(
				(s) =>
					s.title.toLowerCase().includes(q) ||
					s.id.toLowerCase().startsWith(q)
			);
		}
		return list;
	});

	function onSelectSeries(id: string) {
		onClose();
		goto(`/charts/${encodeURIComponent(id)}`);
	}

	function onHeadlineClick(h: CountryHeadline | null) {
		if (!h || h.value == null || !h.seriesId) return;
		onClose();
		goto(`/charts/${encodeURIComponent(h.seriesId)}`);
	}

	function onViewAll() {
		if (!detail) return;
		onClose();
		goto(`/gallery?category=${detail.categoryId}`);
	}

	function onRetry() {
		// Re-trigger by nudging the effect — simplest is to re-invoke loader inline
		if (!iso3) return;
		errored = false;
		loading = true;
		const myId = ++requestId;
		(async () => {
			try {
				const d = await getCountry(iso3, 30);
				if (myId !== requestId) return;
				detail = d;
				loading = false;
			} catch {
				if (myId !== requestId) return;
				loading = false;
				errored = true;
			}
		})();
	}

	// --- Headline formatters ---
	function fmtGdp(v: number | null): string {
		if (v == null) return '—';
		return '$' + formatValue(v);
	}
	function fmtPop(v: number | null): string {
		if (v == null) return '—';
		const abs = Math.abs(v);
		if (abs >= 1e9) return (v / 1e9).toFixed(2) + 'B';
		if (abs >= 1e6) return (v / 1e6).toFixed(0) + 'M';
		if (abs >= 1e3) return (v / 1e3).toFixed(0) + 'k';
		return v.toFixed(0);
	}
	function fmtInfl(v: number | null): string {
		if (v == null) return '—';
		return v.toFixed(2) + '%';
	}
	function fmtLife(v: number | null): string {
		if (v == null) return '—';
		return v.toFixed(1) + 'yr';
	}
	function yearFrom(d: string | null | undefined): string {
		if (!d) return '';
		return d.slice(0, 4);
	}
</script>

{#if isOpen}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="cd-backdrop"
		onclick={onClose}
		aria-hidden="true"
	></div>

	<!-- Drawer -->
	<aside
		class="cd-drawer scrollbar-thin"
		role="dialog"
		aria-modal="true"
		aria-labelledby="country-drawer-title"
	>
		<!-- Top bar -->
		<div class="cd-topbar">
			<button
				bind:this={closeBtn}
				type="button"
				onclick={onClose}
				class="cd-close"
				aria-label="Close country browser"
			>
				<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
					<path d="M2.5,2.5 L11.5,11.5 M11.5,2.5 L2.5,11.5" />
				</svg>
			</button>
			<span class="cd-iso3">{iso3 ?? ''}</span>
		</div>

		<div class="cd-body">
			{#if loading && !detail}
				<!-- Skeleton -->
				<div class="cd-skel-hero">
					<div class="cd-shimmer" style:width="40px" style:height="40px" style:border-radius="2px"></div>
					<div class="flex-1 flex flex-col gap-[6px]">
						<div class="cd-shimmer" style:height="16px" style:width="60%"></div>
						<div class="cd-shimmer" style:height="12px" style:width="80%"></div>
					</div>
				</div>
				<div class="cd-eyebrow">— SNAPSHOT —</div>
				<div class="cd-snapshot-skel">
					{#each [0, 1, 2, 3] as i (i)}
						<div class="cd-shimmer" style:height="60px"></div>
					{/each}
				</div>
				<div class="cd-eyebrow">— TOP SERIES —</div>
				<div class="flex flex-col gap-[6px]">
					{#each [0, 1, 2, 3, 4, 5, 6, 7] as i (i)}
						<div class="cd-shimmer" style:height="52px"></div>
					{/each}
				</div>
			{:else if errored}
				<div class="cd-centered">
					<div class="text-[13px]" style:color="var(--ink-2)">
						Couldn't load country data.
					</div>
					<button type="button" onclick={onRetry} class="cd-retry">Retry</button>
				</div>
			{:else if detail && detail.seriesCount === 0}
				<div class="cd-centered">
					<div class="text-[13px] mb-[8px]" style:color="var(--ink-2)">
						No FRED series indexed for {displayName}.
					</div>
					<button
						type="button"
						onclick={() => { onClose(); goto('/gallery'); }}
						class="cd-link-btn"
					>
						Open Command Center ▸
					</button>
				</div>
			{:else if detail}
				<!-- Hero -->
				<section class="cd-hero cd-fade" style:animation-delay="0ms">
					<div class="cd-flag-wrap">
						<CountryFlag iso3={detail.iso3} size={24} round={false} title={detail.name} />
					</div>
					<div class="min-w-0 flex-1">
						<h2
							id="country-drawer-title"
							class="cd-title"
						>
							{detail.name}
						</h2>
						<div class="cd-meta">
							{detail.seriesCount.toLocaleString()} series indexed
						</div>
					</div>
				</section>

				<!-- Snapshot -->
				<div class="cd-eyebrow cd-fade" style:animation-delay="80ms">— SNAPSHOT —</div>
				<section class="cd-snapshot cd-fade" style:animation-delay="80ms">
					{#snippet headlineCell(label: string, value: string, yr: string, data: CountryHeadline | null)}
						{#if data && data.value != null && data.seriesId}
							<button
								type="button"
								class="cd-cell cd-cell-btn"
								onclick={() => onHeadlineClick(data)}
								aria-label={`${label}: ${value}`}
							>
								<div class="cd-cell-label">{label}</div>
								<div class="cd-cell-value">{value}</div>
								<div class="cd-cell-year">{yr}</div>
							</button>
						{:else}
							<div class="cd-cell">
								<div class="cd-cell-label">{label}</div>
								<div class="cd-cell-value" style:color="var(--ink-3)">—</div>
								<div class="cd-cell-year"></div>
							</div>
						{/if}
					{/snippet}
					{@render headlineCell('GDP/CAP', fmtGdp(detail.headline.gdp_per_capita?.value ?? null), yearFrom(detail.headline.gdp_per_capita?.date), detail.headline.gdp_per_capita)}
					{@render headlineCell('POPULATION', fmtPop(detail.headline.population?.value ?? null), yearFrom(detail.headline.population?.date), detail.headline.population)}
					{@render headlineCell('INFLATION', fmtInfl(detail.headline.inflation?.value ?? null), yearFrom(detail.headline.inflation?.date), detail.headline.inflation)}
					{@render headlineCell('LIFE EXP', fmtLife(detail.headline.life_expectancy?.value ?? null), yearFrom(detail.headline.life_expectancy?.date), detail.headline.life_expectancy)}
				</section>

				<!-- Search + filter pills -->
				<section class="cd-fade" style:animation-delay="160ms">
					<div class="cd-search-wrap">
						<svg class="cd-search-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3">
							<circle cx="5" cy="5" r="3.5" />
							<path d="M7.5,7.5 L10.5,10.5" stroke-linecap="round" />
						</svg>
						<input
							type="text"
							placeholder="Search series…"
							class="cd-search-input"
							bind:value={searchQuery}
						/>
					</div>

					<div class="cd-pills">
						<button
							type="button"
							class="cd-pill"
							class:active={activeFrequency === 'all'}
							onclick={() => (activeFrequency = 'all')}
						>
							All <span class="cd-pill-count">{detail.series.length}</span>
							{#if searchQuery && activeFrequency === 'all'}
								<span class="cd-pill-filter">· {filteredSeries.length}</span>
							{/if}
						</button>
						{#each freqGroups as g (g.key)}
							<button
								type="button"
								class="cd-pill"
								class:active={activeFrequency === g.key}
								onclick={() => (activeFrequency = g.key)}
							>
								{g.label} <span class="cd-pill-count">{g.count}</span>
							</button>
						{/each}
					</div>

					<div class="cd-eyebrow cd-eyebrow-inline">— TOP SERIES —</div>

					{#if filteredSeries.length === 0}
						<div class="cd-empty-list">No series match your filter.</div>
					{:else}
						<CountrySeriesList
							series={filteredSeries}
							{sparklines}
							onSelect={onSelectSeries}
							maxShown={50}
						/>
					{/if}

					<button type="button" onclick={onViewAll} class="cd-view-all">
						View all in Command Center ▸
					</button>
				</section>
			{/if}
		</div>
	</aside>
{/if}

<style>
	.cd-backdrop {
		position: fixed;
		inset: 0;
		z-index: 80;
		background: rgba(20, 22, 24, 0.22);
		backdrop-filter: blur(2px);
		-webkit-backdrop-filter: blur(2px);
		animation: cd-fade-in 200ms ease-out;
	}

	.cd-drawer {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		width: 440px;
		max-width: 92vw;
		z-index: 90;
		background: var(--bg);
		border-left: 1px solid var(--border);
		overflow-y: auto;
		overflow-x: hidden;
		animation: cd-slide-in 260ms cubic-bezier(0.16, 1, 0.3, 1);
		box-shadow: -4px 0 24px rgba(0, 0, 0, 0.06);
	}

	@keyframes cd-fade-in {
		from { opacity: 0; }
		to   { opacity: 1; }
	}
	@keyframes cd-slide-in {
		from { transform: translateX(100%); }
		to   { transform: translateX(0); }
	}

	.cd-topbar {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 20px;
		background: var(--bg);
		border-bottom: 1px solid var(--border-faint);
	}
	.cd-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		background: transparent;
		border: 1px solid var(--border-faint);
		border-radius: 3px;
		color: var(--ink-2);
		cursor: pointer;
		transition: all 120ms ease-out;
	}
	.cd-close:hover {
		color: var(--ink-0);
		border-color: var(--ink-3);
	}
	.cd-iso3 {
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: var(--ink-3);
	}

	.cd-body {
		padding: 24px 28px 32px;
	}

	.cd-hero {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		margin-bottom: 22px;
	}
	.cd-flag-wrap {
		flex-shrink: 0;
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-soft);
		border: 1px solid var(--border-faint);
		border-radius: 2px;
		overflow: hidden;
	}
	.cd-title {
		font-size: 22px;
		font-weight: 500;
		line-height: 1.2;
		letter-spacing: -0.01em;
		color: var(--ink-0);
		margin: 0 0 4px;
	}
	.cd-meta {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-3);
		letter-spacing: 0.02em;
	}

	.cd-eyebrow {
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.14em;
		color: var(--ink-3);
		margin: 18px 0 10px;
		text-align: center;
	}
	.cd-eyebrow-inline { margin-top: 22px; }

	.cd-snapshot,
	.cd-snapshot-skel {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
		margin-bottom: 18px;
	}

	.cd-cell {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: space-between;
		gap: 4px;
		padding: 10px 8px;
		background: var(--bg-soft);
		border: 1px solid var(--border-faint);
		border-radius: 3px;
		text-align: left;
		min-height: 68px;
	}
	.cd-cell-btn {
		cursor: pointer;
		transition: all 120ms ease-out;
		font-family: inherit;
	}
	.cd-cell-btn:hover {
		border-color: var(--accent);
		background: var(--bg);
	}
	.cd-cell-label {
		font-family: var(--font-mono);
		font-size: 9px;
		letter-spacing: 0.08em;
		color: var(--ink-3);
	}
	.cd-cell-value {
		font-family: var(--font-mono);
		font-size: 15px;
		font-weight: 500;
		letter-spacing: -0.01em;
		color: var(--ink-0);
		line-height: 1;
	}
	.cd-cell-year {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--ink-3);
		min-height: 10px;
	}

	.cd-search-wrap {
		position: relative;
		margin-bottom: 10px;
	}
	.cd-search-icon {
		position: absolute;
		top: 50%;
		left: 10px;
		transform: translateY(-50%);
		color: var(--ink-3);
		pointer-events: none;
	}
	.cd-search-input {
		width: 100%;
		padding: 8px 10px 8px 28px;
		background: var(--bg-soft);
		border: 1px solid var(--border-faint);
		border-radius: 3px;
		font-family: inherit;
		font-size: 12px;
		color: var(--ink-1);
		outline: none;
		transition: border-color 120ms ease-out;
	}
	.cd-search-input:focus {
		border-color: var(--accent);
	}
	.cd-search-input::placeholder { color: var(--ink-3); }

	.cd-pills {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-bottom: 4px;
	}
	.cd-pill {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 9px;
		background: transparent;
		border: 1px solid var(--border-faint);
		border-radius: 999px;
		font-family: var(--font-mono);
		font-size: 10px;
		letter-spacing: 0.02em;
		color: var(--ink-2);
		cursor: pointer;
		transition: all 120ms ease-out;
	}
	.cd-pill:hover {
		border-color: var(--ink-3);
		color: var(--ink-1);
	}
	.cd-pill.active {
		background: var(--ink-0);
		border-color: var(--ink-0);
		color: var(--bg);
	}
	.cd-pill-count {
		font-size: 9px;
		opacity: 0.7;
	}
	.cd-pill-filter {
		font-size: 9px;
		color: var(--accent);
	}

	.cd-empty-list {
		padding: 20px 0;
		text-align: center;
		font-size: 12px;
		color: var(--ink-3);
	}

	.cd-view-all {
		display: block;
		width: 100%;
		margin-top: 18px;
		padding: 10px 12px;
		background: var(--bg);
		border: 1px solid var(--border);
		border-radius: 3px;
		font-family: var(--font-mono);
		font-size: 11px;
		letter-spacing: 0.04em;
		color: var(--ink-1);
		cursor: pointer;
		transition: all 120ms ease-out;
	}
	.cd-view-all:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.cd-centered {
		padding: 60px 16px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
	}
	.cd-retry {
		margin-top: 10px;
		padding: 6px 14px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: 3px;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-1);
		cursor: pointer;
	}
	.cd-retry:hover { border-color: var(--accent); color: var(--accent); }
	.cd-link-btn {
		background: transparent;
		border: none;
		padding: 0;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--accent);
		cursor: pointer;
		letter-spacing: 0.04em;
	}
	.cd-link-btn:hover { text-decoration: underline; }

	/* Skeletons */
	.cd-skel-hero {
		display: flex;
		gap: 14px;
		align-items: flex-start;
		margin-bottom: 22px;
	}
	.cd-shimmer {
		background: linear-gradient(
			90deg,
			var(--bg-soft) 0%,
			var(--border-faint) 50%,
			var(--bg-soft) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 2.5s ease-in-out infinite;
		border-radius: 2px;
	}

	/* Staggered fade-rise */
	.cd-fade {
		opacity: 0;
		animation: cd-fade-rise 320ms ease-out forwards;
	}
	@keyframes cd-fade-rise {
		from { transform: translateY(6px); opacity: 0; }
		to   { transform: translateY(0); opacity: 1; }
	}
</style>
