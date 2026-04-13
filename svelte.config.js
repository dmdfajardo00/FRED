import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: false
		})
	},
	vitePlugin: {
		inspector: {
			toggleKeyCombo: 'control-shift',
			holdMode: true,
			showToggleButton: 'active'
		}
	}
};

export default config;
