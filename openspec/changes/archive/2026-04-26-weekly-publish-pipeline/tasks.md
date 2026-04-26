## 1. Fix Agentic Project Filter

- [x] 1.1 Replace `kw in text` matching with `re.search(r'\b' + re.escape(kw) + r'\b', text)` in `is_agentic_project()`
- [x] 1.2 Split `AGENTIC_KEYWORDS` into `AGENTIC_CORE_KEYWORDS` (agent, autonomous, multi-agent, tool calling, mcp, agentic workflow, etc.) and `ML_GENERAL_KEYWORDS` (inference, fine-tuning, embedding, vector database, etc.)
- [x] 1.3 Update `is_agentic_project()` logic: require ≥1 core keyword match AND ≥2 total matches (core + general) to pass
- [x] 1.4 Expand `COLLECTION_KEYWORDS` with "best practices", "best-practices", "skill", "skills", "guide", "handbook", "cheat sheet", "cheatsheet", "design spec", "specification"
- [x] 1.5 Add `EXCLUSION_KEYWORDS` list for non-project repos (CLAUDE.md, skill file, .md-only, etc.) — reject on match unless ≥5 core keyword matches
- [x] 1.6 Raise collection override threshold from 3 to 5 core keyword matches
- [x] 1.7 Test filter against current batch in `new_projects_pending.json` — verify that `sindresorhus/awesome`, `codecrafters-io/build-your-own-x`, `Robbyant/lingbot-map`, `shiyu-coder/Kronos`, `forrestchang/andrej-karpathy-skills` are correctly rejected

## 2. Consolidate TAXONOMY and Classification Logic

- [x] 2.1 Move TAXONOMY dict from `classify_projects.py` into `weekly_update.py` as a top-level constant (or shared module)
- [x] 2.2 Port `classify_project()` function from `classify_projects.py` into `weekly_update.py`
- [x] 2.3 Add `categories` column to `agentic-ai-projects.csv` if not already present; ensure it stores pipe-separated labels
- [x] 2.4 Remove generation of `agentic-ai-projects-classified.csv`; mark `classify_projects.py` as deprecated or remove it

## 3. Restructure CLI Commands

- [x] 3.1 Remove `--confirm` command; add deprecation notice if called
- [x] 3.2 Add `--post-merge` command that reads merged PR checklist and updates CSV
- [x] 3.3 Remove creation of `data/new_projects_pending.json`; pending data committed to PR branch as `data/weekly_pending.json`

## 4. Implement Yuque Auto-Publish

- [x] 4.1 Create `generate_reader_report()` function that produces reader-facing markdown (no Action Required, no sparklines, narrative highlights for recommendations)
- [x] 4.2 Add `publish_to_yuque()` function that calls Yuque MCP `skylark_doc_create` with book_id 211551637, title "Agentic 每周推送 YYYY-MM-DD", and reader-facing body
- [x] 4.3 Handle Yuque publish failure gracefully: log warning, continue pipeline, return None for URL
- [x] 4.4 Integrate into `--check` flow: call after report generation, capture returned doc URL

## 5. Upgrade DingTalk Notification

- [x] 5.1 Update `send_dingtalk()` to highlight top 5 recommended projects with name, stars, and reason
- [x] 5.2 Add Yuque document link to the card ("📖 查看完整报告" with URL)
- [x] 5.3 Handle missing Yuque link: show "完整报告稍后发布" instead

## 6. Implement GitHub PR Confirmation

- [x] 6.1 Add `create_pr()` function: create branch `weekly/YYYY-MM-DD`, commit report + pending data, push, open PR
- [x] 6.2 Generate PR body with `- [ ] owner/repo — Description ⭐Xk (Language)` checklist for each project
- [x] 6.3 Add `post_merge_update()` function: find merged PR via `gh pr list --state merged --head weekly/`, parse checked items from PR body
- [x] 6.4 Update CSV with only checked projects in `--post-merge`
- [x] 6.5 Handle edge cases: no merged PR found, empty checklist, all/none checked

## 7. Implement Taxonomy Evolution

- [x] 7.1 After CSV update in `--post-merge`, select top 100 projects by OpenRank + all newly added projects for reclassification
- [x] 7.2 Fetch latest GitHub info + README for selected projects
- [x] 7.3 Run `classify_project()` against current TAXONOMY; update `categories` column in CSV
- [x] 7.4 Implement keyword coverage analysis: extract keywords from "Other"/low-confidence projects, find co-occurring keyword clusters (≥3 projects sharing ≥2 uncovered keywords)
- [x] 7.5 Print taxonomy suggestions to stdout (advisory, not auto-applied)
- [x] 7.6 Print taxonomy coverage percentage

## 8. Wire Up End-to-End Flow

- [x] 8.1 Update `--check` main flow: query → filter → generate internal report → publish Yuque → send DingTalk (with Yuque link) → create PR
- [x] 8.2 Update `--post-merge` main flow: parse merged PR → update CSV → fetch fresh data for top 100 + new → reclassify → taxonomy analysis → print suggestions
- [x] 8.3 Update `--full` to use new flow (check + confirm all without PR, for legacy non-interactive use)
- [x] 8.4 End-to-end test: run `--check`, verify Yuque doc created, DingTalk sent, PR opened; manually merge PR, run `--post-merge`, verify CSV updated and categories correct
