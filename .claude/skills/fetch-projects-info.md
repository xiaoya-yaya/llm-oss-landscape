---
name: fetch-projects-info
description: Fetch and enrich agentic-ai-projects.csv with GitHub API (description, stars, language, created_at, topics, readme) and ClickHouse data (openrank, participants). Dynamic dates based on current month.
---

# Fetch Projects Info Skill

Fetch and enrich the `agentic-ai-projects.csv` file with data from GitHub API and ClickHouse database.

## When to use

- User wants to refresh/update project enrichment data
- User mentions "fetch projects info", "enrich projects", "update project data", "refresh enrichment"
- User wants to add new projects or update existing project information

## What it does

The script adds these columns to each project:

### GitHub API Data
- **description** - Project description from GitHub
- **stars** - Stargazers count
- **language** - Primary programming language
- **created_at** - Repository creation date
- **topics** - GitHub topics (comma-separated)
- **readme** - README content (saved to `project_readmes.json`)

### ClickHouse Data (Dynamic Dates)
- **openrank_latest** - OpenRank score for the most recent available month
- **openrank_trend** - JSON list of 12-month trend
- **participants_latest** - Number of unique participants in issues/PRs for current month

## Dynamic Date Logic

The script automatically calculates dates based on the current date:
- **openrank_latest**: Previous month (OpenRank data is updated monthly)
- **participants_latest**: Current month (events are real-time)
- **openrank_trend**: Last 12 months ending with the previous month

Example (if today is 2026-04-23):
- openrank_latest_month: 2026-03
- participants_latest_month: 2026-04
- trend_months: 2025-05 to 2026-03

## How to run

Execute the fetch script:

```bash
cd "/Users/xiaoyawork/Desktop/GitHub Projects/llm-oss-landscape"
source .venv/bin/activate
python scripts/fetch_projects_info.py
```

## Prerequisites

- Python virtual environment with `clickhouse-connect`, `requests`, `python-dateutil`, and `python-dotenv` installed
- `.env` file in `notebooks/` folder with:
  - `GITHUB_TOKEN` - GitHub API token for higher rate limits
  - `CLICKHOUSE_HOST` - ClickHouse server host
  - `CLICKHOUSE_USER` - ClickHouse username
  - `CLICKHOUSE_PASSWORD` - ClickHouse password

## Input/Output

- **Input**: `data/agentic-ai-projects.csv` (must have `repo_id` and `repo_name` columns)
- **Output**: 
  - `data/agentic-ai-projects.csv` - Enriched with additional columns
  - `data/project_readmes.json` - README content for all projects

## Notes

- The script handles rate limiting automatically (with retry and exponential backoff)
- GitHub API: authenticated (~5000/hr with token), unauthenticated (60/hr)
- Projects not found in GitHub API will have empty values
- Projects not in ClickHouse will have empty openrank/participants values
- Takes ~2-3 minutes for ~200 repos with authentication
- README content is limited to 50KB per project
- ClickHouse queries are batched (OpenRank queried per month for all repos, participants queried once)
- Output includes a summary of repos with openrank, stars, participants, and readme data
