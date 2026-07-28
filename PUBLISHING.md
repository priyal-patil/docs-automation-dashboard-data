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
          node scripts/publish.js /tmp/normalized-<suite>.json
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
api-docs-automation / docs-contentstack-ai-automation) push independently and
can race on `git push`.
