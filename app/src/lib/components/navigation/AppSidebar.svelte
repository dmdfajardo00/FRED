<script lang="ts">
  import { page } from '$app/stores';
  import Icon from '@iconify/svelte';
  import { getSidebarContext } from '$lib/stores/sidebar';
  import { theme, toggleTheme } from '$lib/stores/theme';
  import { cn } from '$lib/utils';

  const sidebar = getSidebarContext();
  const { open, toggleSidebar } = sidebar;

  type NavItem = {
    label: string;
    href: string;
    icon: string;
  };

  const mainNav: NavItem[] = [
    { label: 'Gallery', href: '/gallery', icon: 'material-symbols:grid-view-outline' }
  ];

  function isActive(href: string): boolean {
    const pathname = $page.url.pathname;
    return pathname === href || (href === '/gallery' && pathname === '/');
  }
</script>

<aside
  class={cn(
    'fixed left-0 top-0 z-40 flex h-screen flex-col',
    'bg-sidebar text-sidebar-foreground border-r border-sidebar-border',
    'overflow-y-auto scrollbar-hide transition-width',
    $open ? 'w-[260px]' : 'w-14'
  )}
>
  <!-- Logo / header area -->
  <div class="flex h-14 shrink-0 items-center justify-center border-b border-sidebar-border px-3">
    {#if $open}
      <span class="text-primary font-semibold tracking-tight text-sm truncate">FRED</span>
    {:else}
      <Icon icon="material-symbols:finance-mode" class="text-primary" width="20" height="20" />
    {/if}
  </div>

  <!-- Main nav group -->
  <nav class="flex-1 px-2 py-2">
    <ul class="flex flex-col gap-0.5">
      {#each mainNav as item}
        <li>
          <a
            href={item.href}
            class={cn(
              'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
              'hover:bg-muted/50',
              isActive(item.href)
                ? 'bg-primary/10 text-primary'
                : 'text-sidebar-foreground'
            )}
            title={$open ? undefined : item.label}
          >
            <span class="shrink-0">
              <Icon icon={item.icon} width="20" height="20" />
            </span>
            {#if $open}
              <span class="truncate">{item.label}</span>
            {/if}
          </a>
        </li>
      {/each}
    </ul>

  </nav>

  <!-- Bottom controls -->
  <div class="shrink-0 border-t border-sidebar-border px-2 py-2 flex flex-col gap-0.5">
    <!-- Theme toggle -->
    <button
      onclick={toggleTheme}
      class="flex items-center gap-3 w-full rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-muted/50 transition-colors"
      title={$open ? undefined : ($theme === 'dark' ? 'Light mode' : 'Dark mode')}
    >
      <span class="shrink-0">
        {#if $theme === 'dark'}
          <Icon icon="material-symbols:light-mode-outline" width="20" height="20" />
        {:else}
          <Icon icon="material-symbols:dark-mode-outline" width="20" height="20" />
        {/if}
      </span>
      {#if $open}
        <span>{$theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
      {/if}
    </button>

    <!-- Collapse / expand toggle -->
    <button
      onclick={toggleSidebar}
      class="flex items-center gap-3 w-full rounded-md px-2 py-2 text-sm text-sidebar-foreground hover:bg-muted/50 transition-colors"
      title={$open ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      <span class="shrink-0">
        {#if $open}
          <Icon icon="material-symbols:chevron-left" width="20" height="20" />
        {:else}
          <Icon icon="material-symbols:chevron-right" width="20" height="20" />
        {/if}
      </span>
      {#if $open}
        <span>Collapse</span>
      {/if}
    </button>
  </div>
</aside>
