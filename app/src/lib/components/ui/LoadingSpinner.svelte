<script lang="ts">
	interface Props {
		size?: number;
		class?: string;
	}
	let { size = 20, class: className = '' }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	class="animate-spin {className}"
	aria-label="Loading"
>
	<path d="M21 12a9 9 0 1 1-6.219-8.56" />
</svg>
