<script lang="ts">
	interface Props {
		points: Array<{ x: number; y: number }>;
		color?: string;
		strokeWidth?: number;
		opacity?: number;
	}
	let {
		points,
		color = 'var(--chart-1)',
		strokeWidth = 2,
		opacity = 1
	}: Props = $props();

	const path = $derived(() => {
		if (points.length < 2) return '';
		let d = `M ${points[0].x},${points[0].y}`;
		for (let i = 1; i < points.length; i++) {
			// Step-after: horizontal then vertical
			d += ` H ${points[i].x} V ${points[i].y}`;
		}
		return d;
	});
</script>

{#if points.length >= 2}
	<path
		d={path()}
		fill="none"
		stroke={color}
		stroke-width={strokeWidth}
		stroke-linejoin="round"
		{opacity}
		vector-effect="non-scaling-stroke"
	/>
{/if}
