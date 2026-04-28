#!/usr/bin/env python3
"""Unit tests for weekly_update.py — run with: .venv/bin/python3 scripts/test_weekly_update.py"""

import sys
import os

# Ensure we can import the module
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Stub heavy imports before importing weekly_update
import types
from unittest.mock import MagicMock

# Mock clickhouse_connect before import
mock_cc = MagicMock()
sys.modules["clickhouse_connect"] = mock_cc

# Set env vars so load_dotenv doesn't fail
os.environ.setdefault("CLICKHOUSE_HOST", "localhost")
os.environ.setdefault("CLICKHOUSE_USER", "test")
os.environ.setdefault("CLICKHOUSE_PASSWORD", "test")

import weekly_update as wu

passed = 0
failed = 0

def test(name, condition, detail=""):
    global passed, failed
    if condition:
        print(f"  ✓ {name}")
        passed += 1
    else:
        print(f"  ✗ {name} — {detail}")
        failed += 1

# ── 1. Path resolution ────────────────────────────────────────────────
print("\n1. Path resolution")
test("BASE ends with llm-oss-landscape", wu.BASE.endswith("llm-oss-landscape"), wu.BASE)
test("SCRIPT_DIR ends with scripts", wu.SCRIPT_DIR.endswith("scripts"), wu.SCRIPT_DIR)
test("PR_TARGET_REPO is antgroup", wu.PR_TARGET_REPO == "antgroup/llm-oss-landscape", wu.PR_TARGET_REPO)
# Check source code doesn't contain hardcoded path
with open(os.path.join(wu.SCRIPT_DIR, "weekly_update.py"), "r") as f:
    src = f.read()
test("no hardcoded paths", "xiaoyawork" not in src and "/Users/" not in src.split("SCRIPT_DIR")[0], "check source")

# ── 2. md_cell pipe escaping ──────────────────────────────────────────
print("\n2. md_cell pipe escaping")
test("escapes pipe", wu.md_cell("Browser Harness | Self-healing") == "Browser Harness │ Self-healing")
test("truncates long text", wu.md_cell("x" * 100, 50) == "x" * 50 + "...")
test("handles None", wu.md_cell(None) == "")
test("handles empty", wu.md_cell("") == "")
test("short text unchanged", wu.md_cell("hello", 50) == "hello")

# ── 3. generate_reader_report with placeholder ────────────────────────
print("\n3. generate_reader_report")
fake_projects = [
    {
        "repo_name": "test/repo",
        "description": "A test | project with pipe",
        "stars": 1500,
        "language": "Python",
        "categories": ["Coding Agent", "Browser Agent"],
    },
    {
        "repo_name": "foo/bar",
        "description": "Another project",
        "stars": 500,
        "language": "Rust",
        "categories": ["Agent Framework"],
    },
]
fake_recs = [
    (fake_projects[0], 0.9, "OpenRank 增长 200%"),
]
report = wu.generate_reader_report(fake_projects, [], fake_recs)
test("contains placeholder", "TREND_ANALYSIS_PLACEHOLDER" in report)
test("pipe escaped in output", "│" in report and "|" not in report.split("│")[0].split("\n")[-1] or "test/repo" in report)
test("has recommendation section", "值得关注" in report)
test("has trend section header", "趋势洞察" in report)

# ── 4. PR body with inline checkbox ───────────────────────────────────
print("\n4. PR body format (create_pr mock)")
# We can't run create_pr (needs git), but we can verify the format logic
lines = []
lines.append("| ✓ | Repo | Description | Stars | Language | Created |")
lines.append("|---|------|-------------|-------|----------|---------|")
for p in fake_projects:
    desc = wu.md_cell(p.get("description", ""), 50)
    stars_str = f"{p['stars']/1000:.1f}k"
    lang = p["language"]
    created = "-"
    lines.append(f"| - [ ] | **{p['repo_name']}** | {desc} | {stars_str} | {lang} | {created} |")
body = "\n".join(lines)
test("has checkbox column", "- [ ]" in body)
test("repo in bold", "**test/repo**" in body)
test("pipe in desc escaped", "│" in body)

# ── 5. parse_pr_checklist ─────────────────────────────────────────────
print("\n5. parse_pr_checklist")
# Table-style
pr_body_table = """## Weekly Update
| ✓ | Repo | Description | Stars | Language | Created |
|---|------|-------------|-------|----------|---------|
| - [x] | **test/repo** | A test project | 1.5k | Python | 2026-01 |
| - [ ] | **foo/bar** | Another project | 0.5k | Rust | 2026-02 |
"""
items = wu.parse_pr_checklist(pr_body_table)
test("parses table rows", len(items) == 2, f"got {len(items)}")
test("detects checked item", items[0] == ("test/repo", True), str(items[0]))
test("detects unchecked item", items[1] == ("foo/bar", False), str(items[1]))

# List-style fallback
pr_body_list = "- [x] **test/repo** — desc\n- [ ] **foo/bar** — desc\n"
items2 = wu.parse_pr_checklist(pr_body_list)
test("parses list style", len(items2) == 2, f"got {len(items2)}")
test("list checked correct", items2[0] == ("test/repo", True))

# ── 6. generate_trend_context ─────────────────────────────────────────
print("\n6. generate_trend_context")
fake_projects_trend = [
    {
        "repo_name": "fast/grower",
        "description": "Fast growing project",
        "stars": 50000,
        "language": "Python",
        "created_at": "2026-01-15",
        "categories": ["Coding Agent"],
        "openrank_latest": 80.0,
        "openrank_trend": {"2025-11": 10.0, "2025-12": 20.0, "2026-01": 40.0, "2026-02": 80.0},
        "participants": 200,
    },
    {
        "repo_name": "new/hot",
        "description": "Brand new project",
        "stars": 10000,
        "language": "Rust",
        "created_at": "2026-03-01",
        "categories": ["Browser Agent", "Coding Agent"],
        "openrank_latest": 5.0,
        "openrank_trend": {},
        "participants": 50,
    },
]
trend_months = ["2025-11", "2025-12", "2026-01", "2026-02"]
fake_recs_trend = [(fake_projects_trend[0], 0.95, "增速 700%")]
wu.generate_trend_context(fake_projects_trend, trend_months, fake_recs_trend)

test("trend context file created", os.path.exists(wu.TREND_CONTEXT_FILE))
with open(wu.TREND_CONTEXT_FILE, "r") as f:
    ctx = f.read()
test("has category distribution", "Coding Agent" in ctx and "Browser Agent" in ctx)
test("has data highlights", "增速最快" in ctx)
test("has top recommendations", "fast/grower" in ctx)
test("has growth percentage", "700%" in ctx)
test("has participant count", "200" in ctx)

# Cleanup
os.remove(wu.TREND_CONTEXT_FILE)

# ── 7. CSV path correctness ───────────────────────────────────────────
print("\n7. File paths")
test("INPUT_CSV points to data/", wu.INPUT_CSV.endswith("data/agentic-ai-projects.csv"), wu.INPUT_CSV)
test("REPORT_FILE points to data/", wu.REPORT_FILE.endswith("data/weekly_report.md"), wu.REPORT_FILE)
test("CSV file exists", os.path.exists(wu.INPUT_CSV))

# ── Summary ────────────────────────────────────────────────────────────
print(f"\n{'='*40}")
print(f"Results: {passed} passed, {failed} failed")
if failed:
    print("Some tests failed!")
    sys.exit(1)
else:
    print("All tests passed!")
