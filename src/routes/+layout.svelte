<script lang="ts">
	import '../app.css';
	import { initTheme } from '$lib/stores/theme';
	import TopNav from '$lib/components/navigation/TopNav.svelte';
	import CommandPalette from '$lib/components/navigation/CommandPalette.svelte';

	const { children } = $props();

	let cmdOpen = $state(false);

	$effect(() => {
		initTheme();

		function onKey(e: KeyboardEvent) {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				cmdOpen = !cmdOpen;
			}
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

<div class="min-h-screen" style:background="var(--bg)">
	<TopNav onCmd={() => (cmdOpen = true)} />
	<main style:padding-top="52px">
		{@render children?.()}
	</main>
	<CommandPalette bind:open={cmdOpen} />
</div>

<style>
	:global(html, body) {
		overflow: auto;
		height: auto;
		position: static;
		width: auto;
	}
</style>
