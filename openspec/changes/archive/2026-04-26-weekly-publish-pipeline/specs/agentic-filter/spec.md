## ADDED Requirements

### Requirement: Word-boundary keyword matching
The system SHALL match all keywords using word-boundary regex (`\b<keyword>\b`) instead of substring `in` operator. This prevents false positives like "rag" matching "leverage", "fragments", or "storage".

#### Scenario: Substring false positive eliminated
- **WHEN** a project README contains the word "leverage" but not "rag"
- **THEN** the filter SHALL NOT count it as a "rag" keyword match

#### Scenario: Multi-word keyword matching
- **WHEN** a project description contains "agentic workflow"
- **THEN** the filter SHALL match the two-word keyword "agentic workflow" as a single term using word boundaries

### Requirement: Three-tier keyword structure
The system SHALL organize keywords into three tiers: **Agentic Core**, **ML General**, and **Exclusion**. A project MUST match at least one Agentic Core keyword to be considered agentic. ML General keywords contribute to relevance scoring but SHALL NOT qualify a project on their own.

#### Scenario: Project matches only ML general keywords
- **WHEN** a project matches "inference" and "memory" but no Agentic Core keywords
- **THEN** the system SHALL reject the project as non-agentic

#### Scenario: Project matches one agentic core keyword
- **WHEN** a project matches "agent framework" (core) and "inference" (general)
- **THEN** the system SHALL accept the project as agentic

### Requirement: Exclusion filter for non-project repos
The system SHALL maintain an Exclusion keyword list that identifies non-project repositories (pure documentation, awesome lists, CLAUDE.md skills, best-practices guides, design specs, cheat sheets). A project matching any Exclusion keyword SHALL be rejected regardless of agentic keyword matches, unless it has ≥3 Agentic Core keyword matches (indicating it's an agentic project that happens to have documentation).

#### Scenario: Awesome list with agentic mentions
- **WHEN** a project's text matches "awesome list" (exclusion) and "agent" (1 core match)
- **THEN** the system SHALL reject the project

#### Scenario: Agentic framework with tutorial section
- **WHEN** a project's text matches "tutorial" (exclusion) but also "agent framework", "multi-agent", "tool calling" (3+ core matches)
- **THEN** the system SHALL accept the project

#### Scenario: CLAUDE.md skills file
- **WHEN** a project is a CLAUDE.md file or skills repository matching "skill" or "CLAUDE.md" in exclusion keywords
- **THEN** the system SHALL reject the project

### Requirement: Expanded collection keywords
The system SHALL include additional collection keywords beyond the current list: "best practices", "best-practices", "skill", "skills", "guide", "handbook", "cheat sheet", "cheatsheet", "design spec", "specification". The collection override threshold SHALL require ≥5 Agentic Core matches (up from 3) to pass through.

#### Scenario: Collection project with few agentic keywords
- **WHEN** a project matches "awesome list" (collection) and has 3 Agentic Core keyword matches
- **THEN** the system SHALL reject the project (threshold is 5)

#### Scenario: Collection project with strong agentic signal
- **WHEN** a project matches "tutorial" (collection) but has 5+ Agentic Core keyword matches
- **THEN** the system SHALL accept the project

### Requirement: Minimum match threshold with core requirement
The system SHALL require ≥2 total keyword matches (across core and general) AND ≥1 Agentic Core match for a project to be classified as agentic. This replaces the previous flat threshold of 2 matches from a single list.

#### Scenario: Two general matches, zero core
- **WHEN** a project matches "inference" and "fine-tuning" (both general) but zero core keywords
- **THEN** the system SHALL reject the project

#### Scenario: One core match, one general match
- **WHEN** a project matches "agent" (core) and "workflow" (general)
- **THEN** the system SHALL accept the project
