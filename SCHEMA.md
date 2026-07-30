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
  ]
}
```

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
    "path": "data/docs-contentstack-ai-automation/cms-batch3/history/2026-07-30T05-39-18-725Z__30499925084.json",
    "totals": { "total": 35, "passed": 18, "failed": 17, "skipped": 0, "warnings": 13, "timedOut": 2, "interrupted": 0 }
  }
]
```

The dashboard fetches this alongside `latest.json` to render a short
"recent runs" strip on each suite page, so gaps in the schedule or a run
history stay visible instead of only ever showing the single latest result.
