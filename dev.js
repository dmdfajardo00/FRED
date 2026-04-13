/**
 * Custom dev server that pre-warms SSR modules before accepting connections.
 *
 * On Windows, Vite's SSR module loading deadlocks when triggered by an HTTP
 * request (the event loop is occupied by the request handler). Pre-loading
 * the modules before listen() avoids this entirely.
 */
import { createServer } from 'vite';

const server = await createServer({
	server: { port: 4817, host: '127.0.0.1' }
});

console.log('Warming up SSR modules...');
const start = Date.now();

try {
	// Load the SvelteKit server runtime (biggest module graph)
	await server.ssrLoadModule(
		'node_modules/@sveltejs/kit/src/runtime/server/index.js'
	);
	console.log(`  SSR runtime ready (${((Date.now() - start) / 1000).toFixed(1)}s)`);
} catch (e) {
	console.log(`  SSR warmup skipped: ${e.message.slice(0, 80)}`);
}

await server.listen();
console.log(`Ready in ${((Date.now() - start) / 1000).toFixed(1)}s`);
server.printUrls();
