<script lang="ts">
	import { cn } from '$lib/utils';

	type Variant = 'default' | 'secondary' | 'outline' | 'destructive';

	interface Props {
		variant?: Variant;
		class?: string;
		children?: import('svelte').Snippet;
	}
	let { variant = 'default', class: className = '', children }: Props = $props();

	const variantClasses: Record<Variant, string> = {
		default: 'bg-primary text-primary-foreground',
		secondary: 'bg-secondary text-secondary-foreground',
		outline: 'border-border border text-foreground bg-transparent',
		destructive: 'bg-destructive text-white'
	};
</script>

<span
	class={cn(
		'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
		variantClasses[variant],
		className
	)}
>
	{@render children?.()}
</span>
