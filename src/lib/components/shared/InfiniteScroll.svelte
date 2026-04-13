<script lang="ts">
	import { onMount } from 'svelte';

	let {
		onloadmore = () => {},
		hasMore = true,
		loading = false,
		threshold = 200
	}: {
		onloadmore?: () => void;
		hasMore?: boolean;
		loading?: boolean;
		threshold?: number;
	} = $props();

	let sentinel: HTMLDivElement | undefined = $state();

	onMount(() => {
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasMore && !loading) {
					onloadmore();
				}
			},
			{ rootMargin: `${threshold}px` }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});
</script>

<div bind:this={sentinel} class="w-full py-4 flex justify-center">
	{#if loading}
		<div class="flex items-center gap-2 text-xs text-muted-foreground">
			<div class="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
			Loading more...
		</div>
	{:else if !hasMore}
		<p class="text-xs text-muted-foreground/50">No more results</p>
	{/if}
</div>
