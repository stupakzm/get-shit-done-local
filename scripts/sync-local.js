#!/usr/bin/env node
/**
 * Sync local project files to the installed GSD location (~/.claude/get-shit-done/).
 *
 * Run after any edit to get-shit-done/bin/ or get-shit-done/workflows/ so the
 * running Claude Code instance reads the updated files immediately.
 *
 * Usage:
 *   node scripts/sync-local.js
 *   npm run sync
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT_ROOT = path.join(__dirname, '..');
const INSTALL_ROOT = path.join(os.homedir(), '.claude', 'get-shit-done');

const SYNC_PAIRS = [
  // bin runtime
  ['get-shit-done/bin/gsd-tools.cjs', 'bin/gsd-tools.cjs'],
  // lib modules
  ['get-shit-done/bin/lib/ollama.cjs', 'bin/lib/ollama.cjs'],
  // workflows (add new workflow files here as they are created)
  ['get-shit-done/workflows/set-model.md', 'workflows/set-model.md'],
];

// Also sync all .md files in workflows/ automatically
const WORKFLOWS_SRC = path.join(PROJECT_ROOT, 'get-shit-done', 'workflows');
const WORKFLOWS_DST = path.join(INSTALL_ROOT, 'workflows');
if (fs.existsSync(WORKFLOWS_SRC)) {
  for (const f of fs.readdirSync(WORKFLOWS_SRC)) {
    if (f.endsWith('.md')) {
      SYNC_PAIRS.push([`get-shit-done/workflows/${f}`, `workflows/${f}`]);
    }
  }
}

let synced = 0;
let skipped = 0;
let errors = 0;

for (const [relSrc, relDst] of SYNC_PAIRS) {
  const src = path.join(PROJECT_ROOT, relSrc);
  const dst = path.join(INSTALL_ROOT, relDst);

  if (!fs.existsSync(src)) {
    skipped++;
    continue;
  }

  try {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    console.log(`  synced  ${relSrc}`);
    synced++;
  } catch (err) {
    console.error(`  ERROR   ${relSrc}: ${err.message}`);
    errors++;
  }
}

// Deduplicate (workflows loop may double-count explicit entries)
console.log(`\nDone: ${synced} synced, ${skipped} skipped, ${errors} errors`);
if (errors > 0) process.exit(1);
