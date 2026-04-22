import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const KEY = 'meridian.pinned';
const DEFAULT = ['UNRATE', 'CPIAUCSL'];

function readInitial(): string[] {
	if (!browser) return DEFAULT;
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return DEFAULT;
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : DEFAULT;
	} catch {
		return DEFAULT;
	}
}

export const pinned = writable<string[]>(readInitial());

if (browser) {
	pinned.subscribe((v) => {
		try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
	});
}

export function togglePin(id: string) {
	pinned.update((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
}

export function isPinned(list: string[], id: string) {
	return list.includes(id);
}
