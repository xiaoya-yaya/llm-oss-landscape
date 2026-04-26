## ADDED Requirements

### Requirement: Inline classification on CSV update
When the CSV is updated (via `--post-merge`), the system SHALL reclassify all newly added projects and the top 100 existing projects by latest OpenRank score using the current TAXONOMY. Classification SHALL run as part of the main `weekly_update.py` script, not as a separate script.

#### Scenario: Post-merge triggers reclassification
- **WHEN** `--post-merge` adds 25 new projects to the CSV
- **THEN** the system SHALL classify all 25 new projects plus the top 100 existing projects by OpenRank, and update the `categories` column in the CSV

#### Scenario: Top 100 projects get fresh labels
- **WHEN** existing project categories may be stale
- **THEN** the system SHALL overwrite the `categories` column for the top 100 projects with freshly computed labels based on the current TAXONOMY

### Requirement: Fresh info and README for classified projects
Before classification, the system SHALL fetch the latest GitHub info (description, topics, stars, language) and README content for all projects being classified (top 100 + new). This ensures classification runs against current project metadata.

#### Scenario: Project description changed since last classification
- **WHEN** a project previously classified as "Coding Agent" has updated its description to focus on "agent framework"
- **THEN** the system SHALL reclassify it based on the new description, potentially updating its categories

### Requirement: Keyword coverage analysis for taxonomy suggestions
After classification, the system SHALL analyze projects that received no category match ("Other") or only low-confidence matches. The system SHALL extract frequently co-occurring keywords from these projects and suggest new TAXONOMY categories when ≥3 projects share ≥2 uncovered keywords.

#### Scenario: New cluster discovered
- **WHEN** 5 projects all contain "prompt engineering", "prompt template", and "prompt management" but no existing TAXONOMY category covers these terms
- **THEN** the system SHALL print a suggestion: "Consider adding category: [suggested name] with keywords: prompt engineering, prompt template, prompt management (5 projects affected)"

#### Scenario: No new clusters
- **WHEN** all projects are well-covered by existing categories
- **THEN** the system SHALL print "Taxonomy coverage: X% — no new category suggestions"

### Requirement: Single CSV source of truth
The system SHALL maintain a single CSV file (`data/agentic-ai-projects.csv`) with a `categories` column containing pipe-separated category labels. The separate `agentic-ai-projects-classified.csv` file SHALL NOT be generated. The classification logic from `classify_projects.py` SHALL be imported as a function.

#### Scenario: CSV contains categories inline
- **WHEN** a project is classified as "Coding Agent" and "Agent Framework"
- **THEN** the `categories` column in `agentic-ai-projects.csv` SHALL contain "Coding Agent|Agent Framework"

#### Scenario: No classified CSV generated
- **WHEN** classification runs
- **THEN** the system SHALL NOT create `data/agentic-ai-projects-classified.csv`

### Requirement: TAXONOMY defined as accessible constant
The TAXONOMY dictionary SHALL be defined as a top-level constant in `weekly_update.py` (or imported from a shared module). It SHALL use the same structure as `classify_projects.py` (category name → keywords + weight) and be the single authoritative source for both filtering and classification.

#### Scenario: Taxonomy used for both filter and classify
- **WHEN** a project is being filtered for agentic relevance AND classified into categories
- **THEN** both operations SHALL reference the same TAXONOMY constant
