// scripts/fetch-bulk-by-release.js
// Bulk-fetch observations for every series in every release using
// /fred/v2/release/observations. This is the fast path: each request can return
// up to 500K observations and covers many series at once.
//
// Output: data/fred/raw-bulk/release-{id}/page-{N}.json (raw API responses)
// Each release becomes a directory of paginated raw responses; we don't reshape
// here. The reshape pass is a separate script.
//
// Resumable: existing pages are skipped; cursor stored in
// data/fred/raw-bulk/release-{id}/cursor.json

import fs from 'node:fs/promises';
import path from 'node:path';
import { fetchFred } from './lib/fred-client.js';
import { DATA_DIR, TAXONOMY_DIR, ensureDir, readJson, writeJson } from './lib/io.js';

const BULK_DIR = path.join(DATA_DIR, 'raw-bulk');
const PAGE_LIMIT = 500000; // FRED v2 max observations per request

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const releasesData = await readJson(path.join(TAXONOMY_DIR, 'releases.json'));
  if (!releasesData) {
    throw new Error('releases.json not found — run fetch-releases.js first');
  }
  const releases = releasesData.releases;
  console.log(`Bulk-fetching observations for ${releases.length} releases.`);

  await ensureDir(BULK_DIR);

  const startTime = Date.now();
  let releasesDone = 0;
  let totalObs = 0;
  let totalRequests = 0;
  let totalErrors = 0;

  for (const rel of releases) {
    const relId = rel.id;
    const relDir = path.join(BULK_DIR, `release-${relId}`);
    const cursorFile = path.join(relDir, 'cursor.json');
    await ensureDir(relDir);

    // Resume cursor
    let cursorState = (await readJson(cursorFile)) || {
      release_id: relId,
      next_cursor: null,
      page: 0,
      observations: 0,
      completed: false,
      started_at: new Date().toISOString(),
    };

    if (cursorState.completed) {
      releasesDone++;
      continue;
    }

    let pageNum = cursorState.page;
    let nextCursor = cursorState.next_cursor;

    try {
      while (true) {
        const params = {
          release_id: relId,
          format: 'json',
          limit: PAGE_LIMIT,
        };
        if (nextCursor) params.next_cursor = nextCursor;

        const res = await fetchFred('/fred/v2/release/observations', params);
        totalRequests++;

        const pageFile = path.join(relDir, `page-${String(pageNum).padStart(4, '0')}.json`);
        await writeJson(pageFile, res);

        // Count observations across all series in this page
        let pageObs = 0;
        for (const s of res.series || []) {
          pageObs += (s.observations || []).length;
        }
        cursorState.observations += pageObs;
        totalObs += pageObs;

        pageNum++;
        cursorState.page = pageNum;

        if (res.has_more && res.next_cursor) {
          nextCursor = res.next_cursor;
          cursorState.next_cursor = nextCursor;
          await writeJson(cursorFile, cursorState);
        } else {
          cursorState.next_cursor = null;
          cursorState.completed = true;
          cursorState.completed_at = new Date().toISOString();
          await writeJson(cursorFile, cursorState);
          break;
        }
      }

      releasesDone++;
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = ((totalRequests / elapsed) * 60).toFixed(1);
      const eta = ((releases.length - releasesDone) / Math.max(releasesDone, 1)) * elapsed / 60;
      console.log(
        `[${releasesDone}/${releases.length}] release=${relId} (${rel.name}) · pages=${pageNum} · obs=${cursorState.observations} · total_obs=${totalObs} · ${rate}/min · eta=${eta.toFixed(1)}min`
      );
    } catch (err) {
      totalErrors++;
      console.warn(`[err] release ${relId}: ${err.message}`);
      cursorState.last_error = err.message;
      await writeJson(cursorFile, cursorState);
    }
  }

  console.log(
    `\n✔ Done. ${releasesDone}/${releases.length} releases · ${totalObs} observations · ${totalRequests} requests · ${totalErrors} errors`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
