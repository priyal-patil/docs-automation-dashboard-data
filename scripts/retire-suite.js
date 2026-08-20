#!/usr/bin/env node
// Remove a suite that no longer publishes: deletes data/<project>/<suite>/
// and drops its data/index.json entry. Run from within a checkout of
// docs-automation-dashboard-data; does NOT commit/push.
//
// Usage: node scripts/retire-suite.js [--keep-data] <project> <suite> [more ...]
//
// --keep-data drops only the index.json entry, so the suite disappears from the
// dashboard but its historical run JSONs stay in this repo for reference.
//
// publish.js only ever upserts, so a suite that gets renamed or split (e.g.
// the aggregated "kickstart-automation" suite becoming one suite per kickstart
// guide) otherwise lingers on the dashboard forever, showing whatever stale
// numbers its last run left behind. The sync workflow mirrors this repo's
// data/ folder with `rm -rf` + `cp -R`, so a deletion here propagates.

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const keepData = args.includes('--keep-data');
const [project, ...suites] = args.filter(a => a !== '--keep-data');
if (!project || suites.length === 0) {
  console.error('Usage: node scripts/retire-suite.js [--keep-data] <project> <suite> [more suites ...]');
  process.exit(1);
}

const repoRoot = process.cwd();
const indexPath = path.join(repoRoot, 'data', 'index.json');
if (!fs.existsSync(indexPath)) {
  console.error(`No data/index.json in ${repoRoot} — run this from a checkout of docs-automation-dashboard-data`);
  process.exit(1);
}

const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
let changed = false;

for (const suite of suites) {
  const dir = path.join(repoRoot, 'data', project, suite);
  const hadDir = !keepData && fs.existsSync(dir);
  if (hadDir) fs.rmSync(dir, { recursive: true, force: true });

  const before = index.entries.length;
  index.entries = index.entries.filter(e => !(e.project === project && e.suite === suite));
  const hadEntry = index.entries.length < before;

  if (!hadDir && !hadEntry) {
    console.log(`${project}/${suite}: nothing to retire (no data dir, no index entry)`);
    continue;
  }
  changed = true;
  console.log(
    `Retired ${project}/${suite}${hadDir ? ' (removed data dir)' : ''}${hadEntry ? ' (removed index entry)' : ''}`
  );
}

if (changed) {
  index.generatedAt = new Date().toISOString();
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
}
