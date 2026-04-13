<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
	<span class="text-6xl font-bold opacity-10">{page.status}</span>
	<h1 class="text-xl font-semibold">{page.error?.message ?? 'Something went wrong'}</h1>
	<p class="text-muted-foreground max-w-sm text-sm">
		{#if page.status === 404}
			The page you're looking for doesn't exist.
		{:else}
			An unexpected error occurred. Please try again.
		{/if}
	</p>
	<a
		href="/gallery"
		class="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
	>
		Back to Gallery
	</a>
</div>
