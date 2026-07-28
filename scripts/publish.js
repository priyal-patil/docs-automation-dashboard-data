#!/usr/bin/env node
// Shared publisher: writes normalized report JSON files into this repo's
// data/ folder (latest.json + history/) and upserts data/index.json.
// Usage: node scripts/publish.js <path-to-normalized-report.json> [more.json ...]
// Run from within a checkout of docs-automation-dashboard-data. Does NOT
// commit/push -- the calling workflow step does that (so it can retry on
// push conflicts from other projects publishing concurrently).

const fs = require('fs');
const path = require('path');

const REQUIRED = ['project', 'suite', 'timestamp', 'totals'];

function safeTimestamp(iso) {
  return iso.replace(/[:.]/g, '-');
}

function loadIndex(repoRoot) {
  const p = path.join(repoRoot, 'data', 'index.json');
  if (!fs.existsSync(p)) return { generatedAt: null, entries: [] };
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return { generatedAt: null, entries: [] };
  }
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Usage: node scripts/publish.js <report.json> [more.json ...]');
    process.exit(1);
  }

  const repoRoot = process.cwd();
  const index = loadIndex(repoRoot);

  for (const file of files) {
    const report = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const key of REQUIRED) {
      if (!(key in report)) {
        throw new Error(`${file} is missing required field "${key}"`);
      }
    }

    const dir = path.join(repoRoot, 'data', report.project, report.suite);
    fs.mkdirSync(path.join(dir, 'history'), { recursive: true });

    fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(report, null, 2));

    const runId = report.runId || 'unknown';
    const historyFile = path.join(dir, 'history', `${safeTimestamp(report.timestamp)}__${runId}.json`);
    fs.writeFileSync(historyFile, JSON.stringify(report, null, 2));

    const relPath = `data/${report.project}/${report.suite}/latest.json`;
    const existingIdx = index.entries.findIndex(
      e => e.project === report.project && e.suite === report.suite
    );
    const entry = {
      project: report.project,
      projectLabel: report.projectLabel || report.project,
      suite: report.suite,
      suiteLabel: report.suiteLabel || report.suite,
      path: relPath,
      lastUpdated: report.timestamp,
    };
    if (existingIdx >= 0) index.entries[existingIdx] = entry;
    else index.entries.push(entry);

    console.log(`Published ${report.project}/${report.suite} (${report.totals.passed}/${report.totals.total} passed)`);
  }

  index.generatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(repoRoot, 'data', 'index.json'), JSON.stringify(index, null, 2));
}

main();
