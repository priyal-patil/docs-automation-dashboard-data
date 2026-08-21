# Normalized report schema (v1)

Every project's GHA workflow writes one file per suite/run conforming to this
shape, then pushes it to this repo. The dashboard only ever reads this shape —
it never parses Playwright JSON, Newman JSON, or any project-native format
directly.

```jsonc
{
  "schemaVersion": 1,
  "project": "api-docs-automation",            // stable slug, one of the 3 source repos
  "projectLabel": "API Docs Automation",        // human-readable, shown on the dashboard
  "suite": "cma",                                // stable slug for this workflow/module
  "suiteLabel": "Content Management API",        // human-readable
  "runId": "30314712488",                        // GitHub Actions run id
  "runUrl": "https://github.com/priyal-patil/api-docs-automation/actions/runs/30314712488",
  "artifactsUrl": "https://github.com/priyal-patil/api-docs-automation/actions/runs/30314712488#artifacts",
  "timestamp": "2026-07-28T10:34:26.000Z",        // ISO 8601, when the report was generated
  "durationSeconds": 2148,                        // null if unknown
  "totals": {
    "total": 35,
    "passed": 18,
    "failed": 17,
    "skipped": 0,
    "warnings": 14,
    "timedOut": 2,
    "interrupted": 0
  },
  "failedItems": [
    {
      "name": "Delete Environment",
      "detail": "Expected 200, got 404 — environment param removed from doc example",
      "docLink": "https://www.contentstack.com/docs/developers/apis/content-management-api#delete-environment"
    }
  ],
  "docLinks": [
    "https://www.contentstack.com/docs/developers/apis/content-management-api"
  ],
  "items": [
    {
      "name": "Delete Environment",
      "status": "pass",                              // "pass" | "fail" | "warning" | "skipped"
      "detail": null,                                 // failure/warning reason, null for clean passes
      "docLink": "https://www.contentstack.com/docs/developers/apis/content-management-api#delete-environment",
      "reportUrl": "data/api-docs-automation/cma/reports/run-report.html#delete-environment"
    }
  ],
  "warnings": [
    {
      "name": "Edit an Environment",
      "detail": "Position verification mismatch — doc container mismatch",
      "docLink": "https://www.contentstack.com/docs/developers/set-up-environments/edit-an-environment",
      "reportUrl": "data/contentstack-docs-automation-suite/cms-batch2/reports/edit-an-environment.html"
    }
  ]
}
```

### `items` and `warnings` (optional, additive — v1.1)

`items` covers **every** checked item, pass or fail (superset of `failedItems`,
which stays for backward compatibility — the dashboard prefers `items` when
present and falls back to `failedItems`-only rendering otherwise). `warnings`
is a flat list of non-blocking issues found, independent of pass/fail status.

`reportUrl` is a repo-relative path (resolved the same way `index.json`'s
`path` field is — relative to the `docs-automation-dashboard` repo root),
optionally with a `#fragment` anchor into a shared multi-item report file.
Both fields are optional per item — omit `reportUrl` entirely if no
viewable report exists for that item.

### `group` / `groupLabel` (optional, additive — v1.1)

Folder the suite is filed under within its project, e.g.
`"group": "kickstart-guides", "groupLabel": "Kickstart Guides"`. The dashboard
shows one card per folder on the project page and lists that folder's suites
one level down. A suite that sets no group is listed directly under the
project, so projects that never set one are unaffected. `publish.js` copies
both fields onto the suite's `index.json` entry; `scripts/set-group.js`
backfills them for suites that haven't re-run since a folder was introduced.

### `itemsLabel` (optional, additive — v1.1)

Heading the dashboard puts above the `items` table. Defaults to "Checked
URLs", which is wrong for suites whose unit of work isn't a URL —
kickstart-automation suites check doc *steps* and send
`"itemsLabel": "Checked steps"`.

## `reports/` folder (per-item HTML reports, latest run only)

```
data/
  <project>/
    <suite>/
      latest.json
      history/...
      history-index.json
      reports/                    <- OPTIONAL, overwritten every run (NOT kept in history —
        run-report.html              unbounded HTML accumulation across every historical run
        <flow-slug>.html             would blow up repo size, so only the latest run's
        ...                          reports are ever kept)
```

Two supported shapes, pick whichever fits the source project's own report
generator:
- **One shared file, many anchors** (used when the project already emits a
  single HTML report per run with one row/section per item): copy that one
  file to `reports/run-report.html`, and give each item's `reportUrl` a
  `#<anchor>` fragment matching an `id` added to that item's row/section in
  the generator.
- **One file per item** (used when the project already emits one file per
  URL/flow/doc, e.g. Playwright's per-flow reports or SDK per-doc reports):
  copy each into `reports/<slug>.html`, one per item, no anchor needed.

Publishing workflows that want this: after writing the normalized JSON,
also assemble a local directory of the report HTML file(s) and pass it to
`scripts/publish.js` as a second argument — see `PUBLISHING.md`.

## File layout in this repo

```
data/
  <project>/
    <suite>/
      latest.json                  <- overwritten every run, dashboard's primary read
      history/
        <ISO-timestamp>__<runId>.json   <- append-only, one per run, for trend history
  index.json                       <- manifest: flat list of every known {project, suite}
                                       pair + pointer to its latest.json + lastUpdated,
                                       so the dashboard can build its project list without
                                       doing a directory listing via the GitHub API.
```

`index.json` shape:

```json
{
  "generatedAt": "2026-07-28T10:34:30.000Z",
  "entries": [
    {
      "project": "api-docs-automation",
      "projectLabel": "API Docs Automation",
      "suite": "cma",
      "suiteLabel": "Content Management API",
      "path": "data/api-docs-automation/cma/latest.json",
      "lastUpdated": "2026-07-28T10:34:26.000Z"
    }
  ]
}
```

Each publishing workflow step should:
1. Write/overwrite `data/<project>/<suite>/latest.json`.
2. Write a new `data/<project>/<suite>/history/<timestamp>__<runId>.json` (never overwritten).
3. Update its own entry in `data/index.json` (add if missing, replace if present — match on `project`+`suite`).
4. Commit and push. Use `git pull --rebase` before push (or retry-on-conflict) since multiple
   projects/suites push independently and pushes can race.

## `history-index.json` (added for the calendar/recent-runs view)

Each `data/<project>/<suite>/history-index.json` is maintained automatically
by `scripts/publish.js` — nothing else needs to write it. It's an array,
newest first, capped at the last 30 runs:

```json
[
  {
    "timestamp": "2026-07-30T05:39:18.725Z",
    "runId": "30499925084",
    "path": "data/contentstack-docs-automation-suite/cms-batch3/history/2026-07-30T05-39-18-725Z__30499925084.json",
    "totals": { "total": 35, "passed": 18, "failed": 17, "skipped": 0, "warnings": 13, "timedOut": 2, "interrupted": 0 }
  }
]
```

The dashboard fetches this alongside `latest.json` to render a short
"recent runs" strip on each suite page, so gaps in the schedule or a run
history stay visible instead of only ever showing the single latest result.
