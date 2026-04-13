import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

export const theme = writable<Theme>('dark');

export function initTheme() {
	if (!browser) return;
	const stored = localStorage.getItem('theme') as Theme | null;
	const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	const resolved = stored || (prefersDark ? 'dark' : 'light');
	theme.set(resolved);
	document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function toggleTheme() {
	if (!browser) return;
	theme.update((current) => {
		const next = current === 'dark' ? 'light' : 'dark';
		localStorage.setItem('theme', next);
		document.documentElement.classList.toggle('dark', next === 'dark');
		return next;
	});
}
