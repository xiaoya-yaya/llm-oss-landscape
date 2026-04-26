## ADDED Requirements

### Requirement: Yuque document auto-publish
After generating the weekly report, the system SHALL publish a reader-facing document to Yuque book 211551637 via the Yuque MCP `skylark_doc_create` tool. The document title SHALL follow the format "Agentic 每周推送 YYYY-MM-DD" using the report generation date.

#### Scenario: Successful Yuque publish
- **WHEN** the report is generated with 30 new agentic projects
- **THEN** the system SHALL create a Yuque document with reader-facing content, title "Agentic 每周推送 2026-04-26", and return the document URL

#### Scenario: Yuque publish failure
- **WHEN** the Yuque MCP call fails (network error, auth error)
- **THEN** the system SHALL log a warning, continue with DingTalk notification without the Yuque link, and NOT abort the pipeline

### Requirement: Reader-facing report format
The Yuque document SHALL use a reader-facing format that excludes the "Action Required" section, omits internal sparkline/technical columns, and presents recommendations as narrative highlights with project descriptions and reasons for recommendation.

#### Scenario: Report content structure
- **WHEN** the reader-facing report is generated
- **THEN** it SHALL contain: a summary paragraph with project count, a curated table of all new projects (repo name, description, stars, language), a "🌟 值得关注" highlights section with recommended projects and reasons, and SHALL NOT contain "Action Required", "--confirm" commands, or internal file paths

### Requirement: DingTalk card with recommendations and Yuque link
The system SHALL send a DingTalk Webhook notification after Yuque publication. The card SHALL highlight the top 5 recommended projects by name and reason, and include the Yuque document URL as a clickable link. If Yuque publication failed, the card SHALL still be sent without the link.

#### Scenario: Card with Yuque link
- **WHEN** Yuque publishes successfully and returns document URL
- **THEN** the DingTalk card SHALL include the top 5 recommended projects with star counts and reasons, plus a "📖 查看完整报告" link to the Yuque document

#### Scenario: Card without Yuque link
- **WHEN** Yuque publication fails
- **THEN** the DingTalk card SHALL include project highlights but omit the Yuque link, and include a note "完整报告稍后发布"

### Requirement: GitHub PR with checklist
After DingTalk notification, the system SHALL create a GitHub PR using `gh` CLI. The branch SHALL be named `weekly/YYYY-MM-DD`. The PR body SHALL contain a `- [ ]` checklist with one entry per project: `- [ ] owner/repo — Description ⭐Xk (Language)`. The PR SHALL include the internal report file and pending project data as committed files.

#### Scenario: PR creation with 40 projects
- **WHEN** 40 new agentic projects are found
- **THEN** the system SHALL create branch `weekly/2026-04-26`, commit `data/weekly_report.md` and `data/weekly_pending.json`, open a PR against main with a body containing 40 unchecked checklist items

#### Scenario: No new projects found
- **WHEN** zero new agentic projects pass the filter
- **THEN** the system SHALL NOT create a PR and SHALL print "No new agentic projects this week"

### Requirement: Post-merge CSV update from PR checklist
The system SHALL support a `--post-merge` command that reads the most recently merged PR with branch prefix `weekly/`, parses the PR body checklist to identify checked (`- [x]`) and unchecked (`- [ ]`) items, and updates the CSV with only the checked projects. After CSV update, the system SHALL clean up the PR branch and pending data files.

#### Scenario: Partial selection
- **WHEN** a PR has 40 checklist items and 25 are checked by the user
- **THEN** `--post-merge` SHALL add only those 25 projects to `agentic-ai-projects.csv`

#### Scenario: All items checked
- **WHEN** all checklist items are checked
- **THEN** `--post-merge` SHALL add all projects to the CSV

#### Scenario: PR not merged
- **WHEN** `--post-merge` is run but no merged PR exists for the week
- **THEN** the system SHALL print an error message and exit without modifying the CSV

### Requirement: Removal of local pending file
The system SHALL NOT create or rely on `data/new_projects_pending.json`. All pending project data SHALL be stored in the PR branch as `data/weekly_pending.json`. The `--confirm` command SHALL be removed.

#### Scenario: --check runs without creating pending file
- **WHEN** `--check` generates new projects
- **THEN** the system SHALL NOT write `data/new_projects_pending.json`; pending data is committed to the PR branch only

#### Scenario: Legacy --confirm command
- **WHEN** a user runs `--confirm`
- **THEN** the system SHALL print a deprecation message directing the user to use PR-based confirmation with `--post-merge`
