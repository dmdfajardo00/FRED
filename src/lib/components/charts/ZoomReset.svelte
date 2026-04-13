<script lang="ts">
	interface Props {
		visible: boolean;
		onreset: () => void;
	}
	let { visible, onreset }: Props = $props();
</script>

{#if visible}
	<button
		onclick={onreset}
		class="border-border bg-card/80 hover:bg-card text-muted-foreground hover:text-foreground absolute right-3 top-3 flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium backdrop-blur-sm transition-colors"
	>
		<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
			<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
			<path d="M3 3v5h5" />
		</svg>
		Reset zoom
	</button>
{/if}
