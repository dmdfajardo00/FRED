// scripts/fetch-categories.js
// Recursive BFS walk of the FRED category tree.
// Starts at category_id=0 (root) and walks /fred/category/children until every
// node has been expanded. Resumable — on restart, re-queues any un-expanded node.
//
// Outputs:
//   data/fred/taxonomy/categories.json       — flat index { id: {id, name, parent_id, notes, children_ids, expanded} }
//   data/fred/taxonomy/category-tree.json    — hierarchical tree rooted at id 0
//   data/fred/taxonomy/categories-progress.json — cursor/state for resuming

import path from 'node:path';
import { fetchFred } from './lib/fred-client.js';
import { TAXONOMY_DIR, readJson, writeJson } from './lib/io.js';

const CATS_FILE = path.join(TAXONOMY_DIR, 'categories.json');
const TREE_FILE = path.join(TAXONOMY_DIR, 'category-tree.json');
const PROGRESS_FILE = path.join(TAXONOMY_DIR, 'categories-progress.json');

const SAVE_EVERY = 25; // persist index every N expansions

async function main() {
  // Load any prior state
  const state = (await readJson(CATS_FILE)) || {
    fetched_at: null,
    categories: {},
  };

  /** @type {Record<string, any>} */
  const categories = state.categories;

  // Seed root
  if (!categories[0]) {
    categories[0] = {
      id: 0,
      name: 'ROOT',
      parent_id: null,
      notes: null,
      children_ids: [],
      expanded: false,
    };
  }

  // Build the queue of unexpanded nodes
  const queue = [];
  for (const [id, c] of Object.entries(categories)) {
    if (!c.expanded) queue.push(Number(id));
  }

  const startTime = Date.now();
  let expanded = 0;
  let errors = 0;

  console.log(
    `Resuming with ${Object.keys(categories).length} known categories, ${queue.length} unexpanded.`
  );

  while (queue.length > 0) {
    const id = queue.shift();
    const cat = categories[id];
    if (!cat || cat.expanded) continue;

    try {
      const res = await fetchFred('/fred/category/children', { category_id: id });
      const children = res.categories || [];

      cat.children_ids = children.map((c) => c.id);
      cat.expanded = true;

      for (const child of children) {
        if (!categories[child.id]) {
          categories[child.id] = {
            id: child.id,
            name: child.name,
            parent_id: child.parent_id,
            notes: child.notes || null,
            children_ids: [],
            expanded: false,
          };
          queue.push(child.id);
        }
      }

      expanded++;

      if (expanded % SAVE_EVERY === 0) {
        await persist(categories, {
          expanded,
          errors,
          remaining: queue.length,
          known: Object.keys(categories).length,
        });
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = ((expanded / elapsed) * 60).toFixed(1);
        const etaMin = ((queue.length / Math.max(expanded, 1)) * elapsed) / 60;
        console.log(
          `[${expanded}] last=${id} (${cat.name}) · known=${Object.keys(categories).length} · queue=${queue.length} · ${rate}/min · eta=${etaMin.toFixed(1)}min`
        );
      }
    } catch (err) {
      errors++;
      cat.error = err.message;
      cat.expanded = true; // don't retry broken nodes forever
      console.warn(`[err] category ${id}: ${err.message}`);
    }
  }

  // Final persist + build tree
  await persist(categories, {
    expanded,
    errors,
    remaining: 0,
    known: Object.keys(categories).length,
    completed_at: new Date().toISOString(),
  });

  const tree = buildTree(categories, 0);
  await writeJson(TREE_FILE, {
    fetched_at: new Date().toISOString(),
    total_categories: Object.keys(categories).length,
    tree,
  });

  console.log(
    `\n✔ Done. ${Object.keys(categories).length} categories, ${expanded} expanded this run, ${errors} errors.`
  );
}

async function persist(categories, progress) {
  await writeJson(CATS_FILE, {
    fetched_at: new Date().toISOString(),
    count: Object.keys(categories).length,
    categories,
  });
  await writeJson(PROGRESS_FILE, {
    updated_at: new Date().toISOString(),
    ...progress,
  });
}

function buildTree(cats, rootId) {
  const cat = cats[rootId];
  if (!cat) return null;
  return {
    id: cat.id,
    name: cat.name,
    ...(cat.notes ? { notes: cat.notes } : {}),
    children: (cat.children_ids || [])
      .map((id) => buildTree(cats, id))
      .filter(Boolean),
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
