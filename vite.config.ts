import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	optimizeDeps: {
		include: [
			'd3-scale',
			'd3-shape',
			'd3-time-format',
			'layercake',
			'clsx',
			'tailwind-merge',
			'@iconify/svelte'
		]
	},
	server: {
		port: 4817,
		host: '127.0.0.1',
		fs: { strict: false },
		watch: { usePolling: true, interval: 150 },
		proxy: {
			'/api': {
				target: 'https://db-dataviz.dmdfajardo.pro',
				changeOrigin: true,
				secure: true
			}
		}
	}
});
