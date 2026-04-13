import { writable, get } from 'svelte/store';
import { getContext, setContext } from 'svelte';

const SIDEBAR_KEY = 'fred-sidebar';

export function createSidebarContext(defaultOpen = false) {
	const open = writable(defaultOpen);

	return {
		open,
		toggleSidebar: () => open.update((v) => !v),
		isCollapsed: () => !get(open)
	};
}

export function setSidebarContext(ctx: ReturnType<typeof createSidebarContext>) {
	setContext(SIDEBAR_KEY, ctx);
}

export function getSidebarContext() {
	return getContext<ReturnType<typeof createSidebarContext>>(SIDEBAR_KEY);
}
