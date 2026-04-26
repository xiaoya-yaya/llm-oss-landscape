## Why

The current weekly update pipeline (`weekly_update.py`) has three gaps: (1) the agentic project filter produces significant false positives due to substring matching and overly broad keywords, (2) the post-generation workflow is purely manual — no automated publishing to Yuque or DingTalk with links, and no structured PR-based review process, and (3) the classification taxonomy (`classify_projects.py`) is a disconnected manual step that drifts from the evolving project landscape. These gaps mean extra manual work each week and inconsistent data quality.

## What Changes

- **Fix project filter**: Replace substring `kw in text` matching with word-boundary regex. Split `AGENTIC_KEYWORDS` into "agentic core" and "ML general" tiers — require at least one core keyword match. Raise collection-keyword override threshold. Add exclusion patterns for non-project repos (docs-only, CLAUDE.md skills, spec repos). Expand `COLLECTION_KEYWORDS` with "best practices", "skill", "skills", "guide", "handbook" etc.
- **Yuque auto-publish**: After report generation, create a reader-facing document in Yuque book 211551637 with title "Agentic 每周推送 YYYY-MM-DD" via Yuque MCP. Remove "Action Required" section; reformat for readers.
- **DingTalk card upgrade**: Keep DingTalk Webhook but redesign card to highlight recommended projects and include the Yuque document link.
- **GitHub PR confirmation**: Auto-create a PR (branch `weekly/YYYY-MM-DD`) with report + pending data. PR body uses `- [ ]` checklist per project. User selects projects via checklist. PR merge triggers local CSV update with only selected projects. **BREAKING**: removes `new_projects_pending.json` local file — pending data lives in the PR branch.
- **Classification evolution**: On CSV update, fetch latest info + README for top 100 projects by OpenRank and all newly added projects. Reclassify against current taxonomy. Analyze uncovered keyword clusters to suggest new categories. Consolidate `classify_projects.py` logic into the main flow, merging `agentic-ai-projects.csv` and `agentic-ai-projects-classified.csv` into a single source of truth.

## Capabilities

### New Capabilities
- `agentic-filter`: Robust agentic AI project detection with word-boundary matching, tiered keywords (core vs general), collection/exclusion filtering
- `publish-pipeline`: Automated post-generation publishing to Yuque + DingTalk + GitHub PR with reader-facing formatting
- `taxonomy-evolution`: Automated classification of top projects, keyword coverage analysis for taxonomy suggestions, single-source CSV management

### Modified Capabilities

## Impact

- **`scripts/weekly_update.py`**: Major refactor — new filter logic, new `--check` post-steps (Yuque/DingTalk/PR), new `--post-merge` step, removal of `--confirm` direct mode
- **`scripts/classify_projects.py`**: Logic absorbed into main flow; file may be removed or converted to a utility module
- **`data/agentic-ai-projects.csv`**: Schema may change (merge classified columns)
- **`data/agentic-ai-projects-classified.csv`**: Removed (consolidated into main CSV)
- **`data/new_projects_pending.json`**: Removed
- **Dependencies**: `gh` CLI (for PR creation/merge detection), Yuque MCP server, DingTalk webhook (existing)
- **`.env`**: May need `YUQUE_BOOK_ID` variable (though book 211551637 is hardcoded in the Yuque URL)
