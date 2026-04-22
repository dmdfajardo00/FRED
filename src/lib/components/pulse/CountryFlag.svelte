<script lang="ts">
	interface Props {
		iso3: string;
		size?: number;
		round?: boolean;
		title?: string;
	}

	const { iso3, size = 16, round = true, title }: Props = $props();

	// ISO3 → ISO2 (lowercase, flagcdn format). ~210 entries.
	const ISO3_TO_ISO2: Record<string, string> = {
		AFG: 'af', ALB: 'al', DZA: 'dz', AND: 'ad', AGO: 'ao', ATG: 'ag', ARG: 'ar', ARM: 'am',
		AUS: 'au', AUT: 'at', AZE: 'az', BHS: 'bs', BHR: 'bh', BGD: 'bd', BRB: 'bb', BLR: 'by',
		BEL: 'be', BLZ: 'bz', BEN: 'bj', BTN: 'bt', BOL: 'bo', BIH: 'ba', BWA: 'bw', BRA: 'br',
		BRN: 'bn', BGR: 'bg', BFA: 'bf', BDI: 'bi', CPV: 'cv', KHM: 'kh', CMR: 'cm', CAN: 'ca',
		CAF: 'cf', TCD: 'td', CHL: 'cl', CHN: 'cn', COL: 'co', COM: 'km', COG: 'cg', COD: 'cd',
		CRI: 'cr', CIV: 'ci', HRV: 'hr', CUB: 'cu', CYP: 'cy', CZE: 'cz', DNK: 'dk', DJI: 'dj',
		DMA: 'dm', DOM: 'do', ECU: 'ec', EGY: 'eg', SLV: 'sv', GNQ: 'gq', ERI: 'er', EST: 'ee',
		SWZ: 'sz', ETH: 'et', FJI: 'fj', FIN: 'fi', FRA: 'fr', GAB: 'ga', GMB: 'gm', GEO: 'ge',
		DEU: 'de', GHA: 'gh', GRC: 'gr', GRD: 'gd', GTM: 'gt', GIN: 'gn', GNB: 'gw', GUY: 'gy',
		HTI: 'ht', HND: 'hn', HUN: 'hu', ISL: 'is', IND: 'in', IDN: 'id', IRN: 'ir', IRQ: 'iq',
		IRL: 'ie', ISR: 'il', ITA: 'it', JAM: 'jm', JPN: 'jp', JOR: 'jo', KAZ: 'kz', KEN: 'ke',
		KIR: 'ki', PRK: 'kp', KOR: 'kr', KWT: 'kw', KGZ: 'kg', LAO: 'la', LVA: 'lv', LBN: 'lb',
		LSO: 'ls', LBR: 'lr', LBY: 'ly', LIE: 'li', LTU: 'lt', LUX: 'lu', MDG: 'mg', MWI: 'mw',
		MYS: 'my', MDV: 'mv', MLI: 'ml', MLT: 'mt', MHL: 'mh', MRT: 'mr', MUS: 'mu', MEX: 'mx',
		FSM: 'fm', MDA: 'md', MCO: 'mc', MNG: 'mn', MNE: 'me', MAR: 'ma', MOZ: 'mz', MMR: 'mm',
		NAM: 'na', NRU: 'nr', NPL: 'np', NLD: 'nl', NZL: 'nz', NIC: 'ni', NER: 'ne', NGA: 'ng',
		MKD: 'mk', NOR: 'no', OMN: 'om', PAK: 'pk', PLW: 'pw', PSE: 'ps', PAN: 'pa', PNG: 'pg',
		PRY: 'py', PER: 'pe', PHL: 'ph', POL: 'pl', PRT: 'pt', QAT: 'qa', ROU: 'ro', RUS: 'ru',
		RWA: 'rw', KNA: 'kn', LCA: 'lc', VCT: 'vc', WSM: 'ws', SMR: 'sm', STP: 'st', SAU: 'sa',
		SEN: 'sn', SRB: 'rs', SYC: 'sc', SLE: 'sl', SGP: 'sg', SVK: 'sk', SVN: 'si', SLB: 'sb',
		SOM: 'so', ZAF: 'za', SSD: 'ss', ESP: 'es', LKA: 'lk', SDN: 'sd', SUR: 'sr', SWE: 'se',
		CHE: 'ch', SYR: 'sy', TWN: 'tw', TJK: 'tj', TZA: 'tz', THA: 'th', TLS: 'tl', TGO: 'tg',
		TON: 'to', TTO: 'tt', TUN: 'tn', TUR: 'tr', TKM: 'tm', TUV: 'tv', UGA: 'ug', UKR: 'ua',
		ARE: 'ae', GBR: 'gb', USA: 'us', URY: 'uy', UZB: 'uz', VUT: 'vu', VAT: 'va', VEN: 've',
		VNM: 'vn', YEM: 'ye', ZMB: 'zm', ZWE: 'zw', HKG: 'hk', MAC: 'mo', PRI: 'pr', GRL: 'gl',
		FRO: 'fo', GIB: 'gi', GGY: 'gg', JEY: 'je', IMN: 'im', BMU: 'bm', CYM: 'ky', VGB: 'vg',
		TCA: 'tc', AIA: 'ai', MSR: 'ms', FLK: 'fk', SHN: 'sh', NCL: 'nc', PYF: 'pf', WLF: 'wf',
		COK: 'ck', NIU: 'nu', TKL: 'tk', ASM: 'as', GUM: 'gu', MNP: 'mp', VIR: 'vi', REU: 're',
		MYT: 'yt', MTQ: 'mq', GLP: 'gp', GUF: 'gf', BLM: 'bl', MAF: 'mf', SPM: 'pm', ATF: 'tf',
		CCK: 'cc', CXR: 'cx', NFK: 'nf', SJM: 'sj', ALA: 'ax', ABW: 'aw', CUW: 'cw', SXM: 'sx',
		BES: 'bq', BVT: 'bv', HMD: 'hm', UMI: 'um', IOT: 'io', ESH: 'eh', ATA: 'aq'
	};

	const iso2 = $derived(ISO3_TO_ISO2[iso3?.toUpperCase?.() ?? '']);
	const width = $derived(Math.round(size * 4 / 3));
	const monogram = $derived((iso3 ?? '').slice(0, 2).toUpperCase());
	const tooltipText = $derived(title ?? iso3);
	const radius = $derived(round ? 2 : 0);
</script>

<span
	class="flag-wrap"
	title={tooltipText}
	style:width="{width}px"
	style:height="{size}px"
	style:border-radius="{radius}px"
>
	{#if iso2}
		<img
			src="https://flagcdn.com/{iso2}.svg"
			alt="{iso3} flag"
			loading="lazy"
			decoding="async"
			width={width}
			height={size}
			style:border-radius="{radius}px"
			onload={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = '1')}
		/>
	{:else}
		<span class="monogram" style:font-size="{Math.max(7, size - 8)}px">{monogram}</span>
	{/if}
</span>

<style>
	.flag-wrap {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		background: var(--bg-soft);
		border: 1px solid var(--border);
		box-sizing: border-box;
		vertical-align: middle;
		flex-shrink: 0;
	}
	.flag-wrap img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		opacity: 0;
		transition: opacity 180ms ease-out;
	}
	.monogram {
		font-family: var(--font-mono);
		color: var(--ink-3);
		font-weight: 500;
		letter-spacing: -0.02em;
		line-height: 1;
	}
</style>
