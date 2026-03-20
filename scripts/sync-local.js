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
const COMMANDS_DST = path.join(os.homedir(), '.claude', 'commands', 'gsd');

const SYNC_PAIRS = [
  // bin runtime
  ['get-shit-done/bin/gsd-tools.cjs', 'bin/gsd-tools.cjs'],
];

// Sync all .cjs files in bin/lib/ automatically
const LIB_SRC = path.join(PROJECT_ROOT, 'get-shit-done', 'bin', 'lib');
if (fs.existsSync(LIB_SRC)) {
  for (const f of fs.readdirSync(LIB_SRC)) {
    if (f.endsWith('.cjs')) {
      SYNC_PAIRS.push([`get-shit-done/bin/lib/${f}`, `bin/lib/${f}`]);
    }
  }
}

// Sync all .md files in workflows/ → ~/.claude/get-shit-done/workflows/
const WORKFLOWS_SRC = path.join(PROJECT_ROOT, 'get-shit-done', 'workflows');
if (fs.existsSync(WORKFLOWS_SRC)) {
  for (const f of fs.readdirSync(WORKFLOWS_SRC)) {
    if (f.endsWith('.md')) {
      SYNC_PAIRS.push([`get-shit-done/workflows/${f}`, `workflows/${f}`]);
    }
  }
}

// Sync all .md files in commands/ → ~/.claude/commands/gsd/
// These are the skill definition wrappers Claude Code reads as /gsd:* commands.
const COMMANDS_SRC = path.join(PROJECT_ROOT, 'get-shit-done', 'commands');
const COMMANDS_DST_PAIRS = [];
if (fs.existsSync(COMMANDS_SRC)) {
  for (const f of fs.readdirSync(COMMANDS_SRC)) {
    if (f.endsWith('.md')) {
      COMMANDS_DST_PAIRS.push([path.join(COMMANDS_SRC, f), path.join(COMMANDS_DST, f)]);
    }
  }
}

let synced = 0;
let skipped = 0;
let errors = 0;

function syncFile(src, dst, label) {
  if (!fs.existsSync(src)) {
    skipped++;
    return;
  }
  try {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    console.log(`  synced  ${label}`);
    synced++;
  } catch (err) {
    console.error(`  ERROR   ${label}: ${err.message}`);
    errors++;
  }
}

// Sync bin + workflows → ~/.claude/get-shit-done/
for (const [relSrc, relDst] of SYNC_PAIRS) {
  syncFile(
    path.join(PROJECT_ROOT, relSrc),
    path.join(INSTALL_ROOT, relDst),
    relSrc
  );
}

// Sync commands → ~/.claude/commands/gsd/
for (const [src, dst] of COMMANDS_DST_PAIRS) {
  syncFile(src, dst, `commands/${path.basename(src)}`);
}

console.log(`\nDone: ${synced} synced, ${skipped} skipped, ${errors} errors`);
if (errors > 0) process.exit(1);
