#!/usr/bin/env node
// Backfill a suite's dashboard folder (see SCHEMA.md "group") without waiting
// for its next run to publish one. Updates data/index.json and each matched
// suite's latest.json, so the folder survives until the publisher's own
// `group` field takes over. Run from within a checkout of
// docs-automation-dashboard-data; does NOT commit/push.
//
// Usage:
//   node scripts/set-group.js <project> <group> "<Group Label>" <suite|prefix*> ...
//
// Example:
//   node scripts/set-group.js developer-resources-docs-automation \
//     kickstart-guides "Kickstart Guides" 'kickstart-*'

const fs = require('fs');
const path = require('path');

const [project, group, groupLabel, ...patterns] = process.argv.slice(2);
if (!project || !group || !groupLabel || patterns.length === 0) {
  console.error('Usage: node scripts/set-group.js <project> <group> "<Group Label>" <suite|prefix*> ...');
  process.exit(1);
}

const matches = (suite) =>
  patterns.some(p => (p.endsWith('*') ? suite.startsWith(p.slice(0, -1)) : suite === p));

const repoRoot = process.cwd();
const indexPath = path.join(repoRoot, 'data', 'index.json');
if (!fs.existsSync(indexPath)) {
  console.error(`No data/index.json in ${repoRoot} — run this from a checkout of docs-automation-dashboard-data`);
  process.exit(1);
}

const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
let changed = 0;

for (const entry of index.entries) {
  if (entry.project !== project || !matches(entry.suite)) continue;
  entry.group = group;
  entry.groupLabel = groupLabel;
  changed++;

  // Keep latest.json in step so a re-publish of the same report, or anything
  // else reading the report directly, agrees with the index.
  const latestPath = path.join(repoRoot, 'data', project, entry.suite, 'latest.json');
  if (fs.existsSync(latestPath)) {
    const report = JSON.parse(fs.readFileSync(latestPath, 'utf-8'));
    report.group = group;
    report.groupLabel = groupLabel;
    fs.writeFileSync(latestPath, JSON.stringify(report, null, 2));
  }
  console.log(`  ${entry.suite} -> ${group}`);
}

if (changed === 0) {
  console.log(`No suites in ${project} matched ${patterns.join(', ')}`);
  process.exit(0);
}

index.generatedAt = new Date().toISOString();
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
console.log(`Filed ${changed} suite(s) under "${groupLabel}"`);
