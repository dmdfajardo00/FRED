<script lang="ts">
	import { theme, toggleTheme } from '$lib/stores/theme';
</script>

<div class="flex h-full flex-col gap-6 overflow-auto p-6">
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
		<p class="text-muted-foreground text-sm">Customize your FRED dashboard experience.</p>
	</div>

	<section class="border-border bg-card flex flex-col gap-4 rounded-xl border p-5">
		<h2 class="text-sm font-semibold uppercase tracking-widest opacity-60">Appearance</h2>

		<div class="flex items-center justify-between">
			<div class="flex flex-col gap-0.5">
				<span class="text-sm font-medium">Color Theme</span>
				<span class="text-muted-foreground text-xs">Switch between light and dark mode.</span>
			</div>
			<button
				onclick={toggleTheme}
				class="border-border bg-secondary text-secondary-foreground hover:bg-accent rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
			>
				{$theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
			</button>
		</div>
	</section>

	<section class="border-border bg-card flex flex-col gap-4 rounded-xl border p-5">
		<h2 class="text-sm font-semibold uppercase tracking-widest opacity-60">About</h2>
		<div class="text-muted-foreground flex flex-col gap-1 text-sm">
			<p>FRED Dashboard — built with SvelteKit + Tailwind v4.</p>
			<p>Data sourced from the Federal Reserve Bank of St. Louis.</p>
		</div>
	</section>
</div>
