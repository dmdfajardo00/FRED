import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
	// Read local .env (gitignored). VITE_DEV_API_KEY lives only on dev machines;
	// the proxy attaches it server-side so the key never reaches the browser.
	const env = loadEnv(mode, process.cwd(), '');
	const devKey = env.VITE_DEV_API_KEY ?? '';

	return {
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
					secure: true,
					configure: (proxy) => {
						// Strip any browser-set Origin (so localhost can't piggy-back on
						// the allowlist) and attach the server-side key. The API's
						// key path is the ONLY thing that authorizes local dev.
						proxy.on('proxyReq', (proxyReq) => {
							proxyReq.removeHeader('origin');
							if (devKey) proxyReq.setHeader('x-api-key', devKey);
						});
					}
				}
			}
		}
	};
});
