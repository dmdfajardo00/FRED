<script lang="ts">
	// Renders long FRED notes with:
	//   - auto-linked URLs (opens in a new tab)
	//   - sentence-group paragraphs for readability
	//   - collapsed height w/ "Show more" toggle
	//
	// FRED's notes field is one long line; we break it into paragraphs by
	// grouping sentences and splitting at natural section markers.

	let {
		text = '',
		collapsedMaxPx = 180
	}: {
		text?: string | null;
		collapsedMaxPx?: number;
	} = $props();

	let expanded = $state(false);
	let contentEl: HTMLElement | null = $state(null);
	let needsToggle = $state(false);

	// Section-starter phrases that indicate a new paragraph when followed by one
	const SECTION_MARKERS = [
		'Source:', 'Notes:', 'Note:', 'Additional information', 'For more information',
		'For additional information', 'For a more detailed', 'Copyright',
		'The data is', 'This series is', 'For further', 'See the',
		'Users are strongly encouraged', 'For questions', 'Suggested citation',
		'ICE BofA Explains', 'ICE Data Indices', 'DISCLAIMER', 'Disclaimer',
		'Description of the survey', 'Beginning', 'Starting'
	];

	type Token = { kind: 'text' | 'url'; value: string };

	function tokenize(s: string): Token[] {
		// Matches http(s)://... or www.... up to whitespace or trailing punctuation we don't want in the URL.
		const re = /\b((?:https?:\/\/|www\.)[^\s<>()]+)/gi;
		const tokens: Token[] = [];
		let i = 0;
		let m: RegExpExecArray | null;
		while ((m = re.exec(s)) !== null) {
			if (m.index > i) tokens.push({ kind: 'text', value: s.slice(i, m.index) });
			let url = m[1];
			// Trim trailing punctuation that's probably sentence punctuation, not part of the URL.
			const trailing = url.match(/[),.;:!?]+$/);
			let trailText = '';
			if (trailing) {
				trailText = trailing[0];
				url = url.slice(0, url.length - trailText.length);
			}
			tokens.push({ kind: 'url', value: url });
			if (trailText) tokens.push({ kind: 'text', value: trailText });
			i = m.index + m[0].length;
		}
		if (i < s.length) tokens.push({ kind: 'text', value: s.slice(i) });
		return tokens;
	}

	function hrefFor(url: string): string {
		return /^https?:\/\//i.test(url) ? url : 'https://' + url;
	}

	function splitSentences(input: string): string[] {
		// Keep the terminal punctuation with the sentence; avoid splitting on common abbreviations.
		// Simple heuristic: split on ". ", "? ", "! " when followed by a capital letter or quote.
		const out: string[] = [];
		let buf = '';
		const ABBR = new Set(['U.S', 'U.K', 'e.g', 'i.e', 'vs', 'Mr', 'Mrs', 'Ms', 'Dr', 'St', 'No', 'Inc', 'Ltd', 'Co', 'Corp']);
		for (let i = 0; i < input.length; i++) {
			const ch = input[i];
			buf += ch;
			if ((ch === '.' || ch === '?' || ch === '!') && i + 1 < input.length) {
				const next = input[i + 1];
				const after = input[i + 2] || '';
				// Check abbreviation: look back at last word
				const trail = buf.slice(0, -1).match(/(\w+)$/)?.[1] ?? '';
				const isAbbr = ABBR.has(trail);
				if (!isAbbr && next === ' ' && (/[A-Z"(]/.test(after) || after === '')) {
					out.push(buf.trim());
					buf = '';
					i++; // skip the space
				}
			}
		}
		if (buf.trim()) out.push(buf.trim());
		return out;
	}

	function paragraphize(input: string): string[] {
		// If the text already has explicit paragraph breaks, honor them.
		const hardParas = input.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
		if (hardParas.length > 1) return hardParas;

		const sentences = splitSentences(input.replace(/\s+/g, ' ').trim());
		const paras: string[] = [];
		let cur: string[] = [];

		for (const s of sentences) {
			const startsSection = SECTION_MARKERS.some((m) => s.startsWith(m));
			if (startsSection && cur.length > 0) {
				paras.push(cur.join(' '));
				cur = [];
			}
			cur.push(s);
			if (cur.length >= 3) {
				paras.push(cur.join(' '));
				cur = [];
			}
		}
		if (cur.length) paras.push(cur.join(' '));
		return paras;
	}

	function looksLikeHeading(para: string): boolean {
		// Treat paragraphs that start with a "Label:" preamble as having a mini-header.
		return /^[A-Z][A-Za-z &/]{2,40}:\s/.test(para) || /^[A-Z][A-Z &/-]{3,40}$/.test(para.split(' ').slice(0, 6).join(' '));
	}

	function splitLeadHeading(para: string): { heading: string | null; rest: string } {
		const m = para.match(/^([A-Z][A-Za-z &/]{2,40}):\s+(.*)$/);
		if (m) return { heading: m[1], rest: m[2] };
		return { heading: null, rest: para };
	}

	const paragraphs = $derived.by(() => paragraphize(text ?? ''));

	$effect(() => {
		// Re-evaluate overflow when content or text changes.
		const _ = paragraphs;
		if (!contentEl) return;
		queueMicrotask(() => {
			if (!contentEl) return;
			needsToggle = contentEl.scrollHeight > collapsedMaxPx + 8;
		});
	});
</script>

{#if text && text.trim()}
	<div class="rich-notes relative text-[13px] leading-[1.65]" style:color="var(--ink-2)">
		<div
			bind:this={contentEl}
			class="overflow-hidden relative"
			style:max-height={expanded ? 'none' : collapsedMaxPx + 'px'}
		>
			{#each paragraphs as para, i (i)}
				{@const split = splitLeadHeading(para)}
				{#if split.heading}
					<div class="font-mono text-[10px] tracking-[0.06em] uppercase mt-4 first:mt-0 mb-1" style:color="var(--ink-3)">
						{split.heading}
					</div>
				{/if}
				<p class="m-0 mb-3 last:mb-0">
					{#each tokenize(split.rest) as tok}
						{#if tok.kind === 'url'}
							<a
								href={hrefFor(tok.value)}
								target="_blank"
								rel="noopener noreferrer"
								class="break-all"
								style:color="var(--accent)"
								style:text-decoration="underline"
								style:text-decoration-color="color-mix(in oklch, var(--accent) 40%, transparent)"
								style:text-underline-offset="2px"
							>{tok.value}</a>
						{:else}{tok.value}{/if}
					{/each}
				</p>
			{/each}
		</div>

		{#if !expanded && needsToggle}
			<div
				class="pointer-events-none absolute left-0 right-0 h-10"
				style:bottom="26px"
				style:background="linear-gradient(to bottom, transparent, var(--bg) 80%)"
			></div>
		{/if}

		{#if needsToggle}
			<button
				type="button"
				onclick={() => (expanded = !expanded)}
				class="mt-2 bg-transparent border-0 cursor-pointer font-mono text-[11px] tracking-[0.05em] uppercase inline-flex items-center gap-1"
				style:color="var(--accent)"
			>
				{expanded ? 'Show less ↑' : 'Show more ↓'}
			</button>
		{/if}
	</div>
{/if}

<style>
	.rich-notes :global(a:hover) {
		text-decoration-color: var(--accent) !important;
	}
</style>
