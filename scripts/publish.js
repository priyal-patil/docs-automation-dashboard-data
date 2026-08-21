#!/usr/bin/env node
// Shared publisher: writes normalized report JSON files into this repo's
// data/ folder (latest.json + history/) and upserts data/index.json.
// Usage: node scripts/publish.js <report.json>[:<reports-dir>] [more ...]
// The optional `:<reports-dir>` suffix on any argument points at a local
// directory of per-item HTML report files to copy into
// data/<project>/<suite>/reports/ (overwritten every run -- NOT kept in
// history, see SCHEMA.md). Omit it if the report has no reportUrl fields.
// Run from within a checkout of docs-automation-dashboard-data. Does NOT
// commit/push -- the calling workflow step does that (so it can retry on
// push conflicts from other projects publishing concurrently).

const fs = require('fs');
const path = require('path');

const REQUIRED = ['project', 'suite', 'timestamp', 'totals'];
const HISTORY_INDEX_LIMIT = 30; // dashboard UI only shows the last few days of this, but keep some slack

function safeTimestamp(iso) {
  return iso.replace(/[:.]/g, '-');
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
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

  for (const arg of files) {
    const [file, reportsDir] = arg.split(':');
    const report = JSON.parse(fs.readFileSync(file, 'utf-8'));
    for (const key of REQUIRED) {
      if (!(key in report)) {
        throw new Error(`${file} is missing required field "${key}"`);
      }
    }

    const dir = path.join(repoRoot, 'data', report.project, report.suite);
    fs.mkdirSync(path.join(dir, 'history'), { recursive: true });

    if (reportsDir) {
      const reportsDest = path.join(dir, 'reports');
      fs.rmSync(reportsDest, { recursive: true, force: true }); // latest-run only, never accumulates
      copyDirRecursive(reportsDir, reportsDest);
      console.log(`Copied per-item reports from ${reportsDir} -> ${reportsDest}`);
    }

    fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(report, null, 2));

    const runId = report.runId || 'unknown';
    const historyFileName = `${safeTimestamp(report.timestamp)}__${runId}.json`;
    const historyFile = path.join(dir, 'history', historyFileName);
    fs.writeFileSync(historyFile, JSON.stringify(report, null, 2));

    // Maintain a small index of recent runs for this suite, newest first, so
    // the dashboard can render a "recent runs" strip without needing
    // directory-listing support (static hosting can't list directories).
    const historyIndexPath = path.join(dir, 'history-index.json');
    let historyIndex = [];
    if (fs.existsSync(historyIndexPath)) {
      try { historyIndex = JSON.parse(fs.readFileSync(historyIndexPath, 'utf-8')); } catch { historyIndex = []; }
    }
    historyIndex = historyIndex.filter(h => h.runId !== runId);
    historyIndex.unshift({
      timestamp: report.timestamp,
      runId,
      path: `data/${report.project}/${report.suite}/history/${historyFileName}`,
      totals: report.totals,
    });
    historyIndex.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    historyIndex = historyIndex.slice(0, HISTORY_INDEX_LIMIT);
    fs.writeFileSync(historyIndexPath, JSON.stringify(historyIndex, null, 2));

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
      // Optional folder within the project (e.g. "kickstart-guides"). Omitted
      // entirely when a report doesn't set one, so the dashboard lists that
      // suite directly under its project as before.
      ...(report.group ? { group: report.group, groupLabel: report.groupLabel || report.group } : {}),
    };
    if (existingIdx >= 0) index.entries[existingIdx] = entry;
    else index.entries.push(entry);

    console.log(`Published ${report.project}/${report.suite} (${report.totals.passed}/${report.totals.total} passed)`);
  }

  index.generatedAt = new Date().toISOString();
  fs.writeFileSync(path.join(repoRoot, 'data', 'index.json'), JSON.stringify(index, null, 2));
}

main();
