<script lang="ts">
  import '../app.css';
  import { createSidebarContext, setSidebarContext } from '$lib/stores/sidebar';
  import { initTheme } from '$lib/stores/theme';
  import AppSidebar from '$lib/components/navigation/AppSidebar.svelte';

  const { children } = $props();

  const sidebarCtx = createSidebarContext(false);
  setSidebarContext(sidebarCtx);

  const { open } = sidebarCtx;

  $effect(() => {
    initTheme();
  });
</script>

<div class="h-screen overflow-hidden flex">
  <AppSidebar />

  <main
    class={[
      'flex-1 overflow-y-auto bg-background transition-all duration-200',
      $open ? 'ml-[260px]' : 'ml-14'
    ].join(' ')}
  >
    <div class="max-w-[1400px] mx-auto px-6 py-6">
      {@render children?.()}
    </div>
  </main>
</div>
