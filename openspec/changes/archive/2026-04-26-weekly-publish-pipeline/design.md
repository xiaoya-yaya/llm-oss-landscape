## Context

The current `weekly_update.py` is a monolithic script that handles the entire weekly workflow: querying ClickHouse for star-growth projects, filtering for agentic relevance via keyword matching, generating a markdown report, and optionally confirming additions to the CSV. Downstream steps (Yuque publishing, DingTalk notification, GitHub PR creation) are either missing or rudimentary.

The project filter uses `kw in text` (substring match) which causes false positives like "rag" matching "leverage". Keywords are a flat list mixing agentic-core terms ("agent", "autonomous") with general ML terms ("inference", "memory"), so any ML project mentioning inference passes. Classification (`classify_projects.py`) is a separate script that produces a second CSV file which drifts from the main data.

The Yuque target is book_id 211551637 (namespace: open-source/slxp7g). DingTalk notification uses a webhook with HMAC signing. GitHub interaction is via `gh` CLI.

## Goals / Non-Goals

**Goals:**
- Zero false positives for non-agentic projects in the weekly filter (awesome lists, tutorial repos, spec docs, pure documentation)
- Automated end-to-end flow: check → filter → report → publish Yuque → notify DingTalk → create PR
- PR-based confirmation with checklist selection; merge triggers local CSV update
- Taxonomy evolves based on keyword coverage gaps; classification runs inline on CSV update
- Single CSV source of truth (no separate `-classified.csv`)

**Non-Goals:**
- LLM-based project classification or embedding clustering (future consideration)
- Fully automated PR merge without human review
- Web UI or scheduled cron execution (manual trigger via `--check` / `--post-merge`)
- Retroactive re-classification of all historical projects beyond top 100

## Decisions

### D1: Three-tier keyword matching for agentic filter

Replace the flat keyword list with three tiers:
1. **Agentic Core** (e.g., "agent", "autonomous", "multi-agent", "tool calling", "mcp", "agentic workflow") — at least 1 MUST match
2. **ML General** (e.g., "inference", "fine-tuning", "embedding", "vector database") — contributes to score but insufficient alone
3. **Exclusion** (e.g., "awesome list", "best practices", "cheat sheet", "skill file", "CLAUDE.md") — any match triggers rejection unless overridden

All matching uses `re.search(r'\b' + re.escape(kw) + r'\b', text)` with word boundaries.

**Alternative considered**: Pure ML classifier — more accurate but adds model dependency, training data requirement, and non-determinism. Keyword approach is auditable and predictable.

### D2: Report format split

Generate two report variants:
- **Internal report** (`data/weekly_report.md`): Full table with sparklines, recommendation scores, kept as local artifact
- **Reader report**: Reformatted for Yuque — removes "Action Required", adds narrative intro, formats recommendations as readable highlights instead of tables

The Yuque document body is assembled in Python and posted via `skylark_doc_create` MCP call.

### D3: PR-based confirmation with checklist

Use `gh pr create` with a body containing `- [ ] owner/repo — Description ⭐Xk` lines. User checks items in the GitHub UI. On `--post-merge`, the script:
1. Detects the merged PR via `gh pr list --state merged --head weekly/YYYY-MM-DD`
2. Reads the PR body to parse checked vs unchecked items
3. Updates CSV with only checked projects

**Alternative considered**: PR comments for selection — more flexible but harder to parse reliably, and writing 60 items in a comment is tedious.

**Alternative considered**: Editing `pending.json` in the PR — precise but requires JSON editing in GitHub web UI.

### D4: Taxonomy evolution via keyword coverage analysis

After classification, extract keywords from projects that scored low or fell into "Other". Group by co-occurrence frequency. If a cluster of ≥3 projects shares ≥2 keywords not covered by existing taxonomy, emit a suggestion to add a new category. Suggestions are printed to stdout for human review — not auto-applied.

**Alternative considered**: Embedding-based clustering — deferred as the user prefers simple keyword analysis first.

### D5: Consolidate to single CSV

Merge `agentic-ai-projects-classified.csv` columns into `agentic-ai-projects.csv`. The `categories` column (pipe-separated) is maintained inline. `classify_projects.py` logic becomes a function imported by `weekly_update.py`.

### D6: Execution model

The script keeps its CLI interface but restructures commands:
- `--check`: Query → filter → generate report → publish Yuque → send DingTalk → create PR
- `--post-merge`: Read merged PR → update CSV → reclassify top 100 → suggest taxonomy changes
- `--full`: `--check` + immediate confirm all (legacy, for non-interactive use)

## Risks / Trade-offs

- **[PR body size limit]** GitHub truncates PR bodies over ~65K characters. With 60 projects, each line ~80 chars, this is well within limits (~5KB). But if the batch grows significantly, may need to split into multiple PRs. → Mitigation: cap at 100 projects per PR, which is the ClickHouse query limit anyway.

- **[Word boundary matching with compound terms]** Terms like "agentic workflow" or "tool calling" need multi-word boundary matching. `re.search(r'\bagentic workflow\b', text)` works but requires careful regex construction for phrases with special chars. → Mitigation: use `re.escape(kw)` inside the boundary pattern.

- **[Yuque API rate limits or failures]** If Yuque publish fails mid-flow, the DingTalk card won't have a link. → Mitigation: publish Yuque first, capture doc URL, then send DingTalk with link. If Yuque fails, send DingTalk without link and log warning.

- **[Taxonomy suggestion noise]** Keyword co-occurrence analysis may produce spurious suggestions. → Mitigation: require ≥3 projects and ≥2 shared keywords as threshold. Print suggestions as advisory, never auto-apply.

- **[Classification drift]** Merging classify logic into main script means the TAXONOMY dict lives in one file. → Mitigation: keep TAXONOMY as a clearly separated top-level constant, easy to edit manually.
