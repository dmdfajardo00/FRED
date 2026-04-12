<script lang="ts">
	interface Props {
		y: number;
		width: number;
		label?: string;
		color?: string;
		dashed?: boolean;
	}
	let { y, width, label, color = 'var(--muted-foreground)', dashed = true }: Props = $props();
</script>

{#if y >= 0}
	<line
		x1={0}
		y1={y}
		x2={width}
		y2={y}
		stroke={color}
		stroke-width="1"
		stroke-dasharray={dashed ? '4 3' : undefined}
		opacity="0.5"
	/>
	{#if label}
		<text x={width - 4} y={y - 4} text-anchor="end" font-size="10" fill={color} opacity="0.7">
			{label}
		</text>
	{/if}
{/if}
