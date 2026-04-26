"""
Fetch README content for all projects in agentic-ai-projects.csv.
README content is fetched from GitHub API and decoded from base64.
"""

import os
import csv
import json
import time
import base64
import requests
from dotenv import load_dotenv

# Paths
BASE = "/Users/xiaoyawork/Desktop/GitHub Projects/llm-oss-landscape"
ENV_PATH = os.path.join(BASE, "notebooks", ".env")
INPUT_CSV = os.path.join(BASE, "data", "agentic-ai-projects.csv")
OUTPUT_JSON = os.path.join(BASE, "data", "project_readmes.json")

load_dotenv(ENV_PATH)

# GitHub API
github_token = os.getenv("GITHUB_TOKEN", "").strip()
gh_headers = {"Accept": "application/vnd.github.v3+json"}
if github_token:
    gh_headers["Authorization"] = f"token {github_token}"
    print(f"GitHub API: authenticated")
else:
    print("GitHub API: unauthenticated")

def fetch_readme(repo_name, max_retries=3):
    """Fetch README content from GitHub API."""
    url = f"https://api.github.com/repos/{repo_name}/readme"
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, headers=gh_headers, timeout=30)
            if resp.status_code == 200:
                data = resp.json()
                content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
                return content[:50000]  # Limit to 50KB per README
            elif resp.status_code == 404:
                return None
            elif resp.status_code == 403 and "rate limit" in resp.text.lower():
                reset_time = int(resp.headers.get("X-RateLimit-Reset", 0))
                wait = max(reset_time - int(time.time()), 60)
                print(f"  Rate limit hit, waiting {wait}s...")
                time.sleep(wait)
                continue
            else:
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
        except Exception as e:
            print(f"  Error for {repo_name}: {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
    return None

# Read input CSV
with open(INPUT_CSV, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    projects = list(reader)

print(f"Fetching READMEs for {len(projects)} projects...")

results = []
for i, proj in enumerate(projects):
    repo_name = proj["repo_name"]
    print(f"[{i+1}/{len(projects)}] {repo_name}...", end=" ", flush=True)

    readme = fetch_readme(repo_name)

    results.append({
        "repo_id": proj["repo_id"],
        "repo_name": repo_name,
        "description": proj.get("description", ""),
        "stars": int(proj.get("stars", 0) or 0),
        "language": proj.get("language", ""),
        "created_at": proj.get("created_at", ""),
        "topics": proj.get("topics", ""),
        "readme": readme or ""
    })

    print("done" if readme else "no readme")

    # Rate limiting
    if github_token:
        time.sleep(0.2)
    else:
        time.sleep(1.5)

# Save results
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(f"\nSaved {len(results)} projects to {OUTPUT_JSON}")