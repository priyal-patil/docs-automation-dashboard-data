# How a source project publishes to this repo

Each of the 3 source projects' GHA workflows adds ONE step, after their
existing report-generation step, that looks like this:

```yaml
      - name: Publish report to dashboard
        if: always()
        env:
          GH_TOKEN: ${{ secrets.DASHBOARD_DATA_TOKEN }}
        run: |
          git clone https://x-access-token:${GH_TOKEN}@github.com/priyal-patil/docs-automation-dashboard-data.git /tmp/dashboard-data
          node scripts/normalize-<suite>.js > /tmp/normalized-<suite>.json   # project-specific adapter
          cd /tmp/dashboard-data
          node scripts/publish.js /tmp/normalized-<suite>.json:/tmp/reports-<suite>   # ":<dir>" suffix optional, see below
          git config user.name "dashboard-publisher"
          git config user.email "actions@users.noreply.github.com"
          git add -A
          git commit -m "Publish <project>/<suite> report ($GITHUB_RUN_ID)" || exit 0
          for i in 1 2 3 4 5; do
            git push origin main && break
            git pull --rebase origin main
            sleep $((RANDOM % 5 + 1))
          done
```

`DASHBOARD_DATA_TOKEN` is a fine-grained GitHub PAT with **Contents: read/write**
on `docs-automation-dashboard-data`, added as a repo secret in each of the 3
source repos. See the main dashboard rollout notes for how to create it.

The retry loop exists because all 3 projects (and multiple suites within
api-docs-automation / contentstack-docs-automation-suite) push independently and
can race on `git push`.

## Per-item report links (optional)

If your adapter also produces `items[].reportUrl` / `warnings[].reportUrl`
(see SCHEMA.md), assemble the actual HTML report file(s) those URLs point to
in a local directory before calling `publish.js`, then append `:<that-dir>`
to the JSON path argument, e.g. `/tmp/normalized-cma.json:/tmp/reports-cma`.
`publish.js` copies that directory's contents into
`data/<project>/<suite>/reports/`, overwriting whatever was there from the
previous run (per-item HTML is latest-run-only, never kept in history — see
SCHEMA.md for why). Omit the `:<dir>` suffix entirely if the suite has no
viewable per-item reports yet.
