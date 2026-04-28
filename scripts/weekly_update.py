#!/usr/bin/env python3
"""
Weekly Agentic AI Projects Update Workflow

Steps:
1. Query ClickHouse for top 100 projects by star growth in past week
2. Fetch project info (description, topics, readme)
3. Filter for agentic AI projects not in existing CSV
4. Generate recommendation report for manual confirmation
5. After confirmation, update CSV and regenerate classification

Usage:
    python weekly_update.py --check          # Just check for new projects
    python weekly_update.py --confirm       # Confirm and update after review
    python weekly_update.py --full          # Full pipeline (check + confirm)
"""

import os
import sys
import csv
import json
import time
import re
import base64
import argparse
import subprocess
import requests
import hashlib
import hmac
import urllib.parse
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv
import clickhouse_connect

# ── Paths ──────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCRIPT_DIR)
ENV_PATH = os.path.join(BASE, "scripts", ".env")
INPUT_CSV = os.path.join(BASE, "data", "agentic-ai-projects.csv")
OUTPUT_CSV = os.path.join(BASE, "data", "agentic-ai-projects.csv")
REPORT_FILE = os.path.join(BASE, "data", "weekly_report.md")

# Target repo for PRs
PR_TARGET_REPO = "antgroup/llm-oss-landscape"

load_dotenv(ENV_PATH)

# ── DingTalk Webhook ─────────────────────────────────────────────────
# Get from environment or use default
DINGTALK_WEBHOOK = os.getenv("DINGTALK_WEBHOOK", "")
DINGTALK_SECRET = os.getenv("DINGTALK_SECRET", "")

# ── Colors ──────────────────────────────────────────────────────────────
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

# ── ClickHouse ─────────────────────────────────────────────────────────
ch_client = clickhouse_connect.get_client(
    host=os.getenv("CLICKHOUSE_HOST"),
    port=8123,
    username=os.getenv("CLICKHOUSE_USER"),
    password=os.getenv("CLICKHOUSE_PASSWORD"),
)

# ── Dynamic date calculation ───────────────────────────────────────────
now = datetime.now()

# OpenRank: latest month (previous month)
openrank_latest_month = (now.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")

# OpenRank trend: last 6 months
trend_months = []
for i in range(5, -1, -1):
    month_date = (now.replace(day=1) - relativedelta(months=i))
    trend_months.append(month_date.strftime("%Y-%m"))

# Participants: current month
participants_start = now.replace(day=1).strftime("%Y-%m-%d")
if now.month == 12:
    participants_end = f"{now.year + 1}-01-01"
else:
    participants_end = f"{now.year}-{now.month + 1:02d}-01"

print(f"Current date: {now.strftime('%Y-%m-%d')}")
print(f"OpenRank latest month: {openrank_latest_month}")
print(f"OpenRank trend months: {trend_months}")
print(f"Participants month: {now.strftime('%Y-%m')}")

# ── GitHub API ─────────────────────────────────────────────────────────
github_token = os.getenv("GITHUB_TOKEN", "").strip()
gh_headers = {"Accept": "application/vnd.github.v3+json"}
if github_token:
    gh_headers["Authorization"] = f"token {github_token}"
    print(f"{GREEN}GitHub API: authenticated (rate limit ~5000/hr){RESET}")
else:
    print(f"{YELLOW}GitHub API: unauthenticated (rate limit 60/hr){RESET}")

# ── ClickHouse batch queries ───────────────────────────────────────────
def fetch_openrank_data(repo_names):
    """Fetch latest OpenRank and 6-month trend for repos."""
    if not repo_names:
        return {}

    def build_in_clause(names):
        return ", ".join([f"'{name.replace(chr(39), chr(39)+chr(39))}'" for name in names])

    repo_placeholders = build_in_clause(repo_names)
    openrank_data = {}

    # Query latest month OpenRank
    sql_latest = f"""
        SELECT repo_name, openrank
        FROM opensource.global_openrank
        WHERE platform = 'GitHub'
          AND repo_name IN ({repo_placeholders})
          AND type = 'Repo'
          AND created_at = '{openrank_latest_month}-01'
    """
    result = ch_client.query(sql_latest)
    for row in result.result_rows:
        name, score = row
        openrank_data[name] = {
            "latest": round(score, 2),
            "trend": {}
        }

    # Query 6-month trend
    for month in trend_months:
        sql_trend = f"""
            SELECT repo_name, openrank
            FROM opensource.global_openrank
            WHERE platform = 'GitHub'
              AND repo_name IN ({repo_placeholders})
              AND type = 'Repo'
              AND created_at = '{month}-01'
        """
        result = ch_client.query(sql_trend)
        for row in result.result_rows:
            name, score = row
            if name in openrank_data:
                openrank_data[name]["trend"][month] = round(score, 2)

    return openrank_data

def fetch_participants_data(repo_names):
    """Fetch participant count (unique actors) for repos in current month."""
    if not repo_names:
        return {}

    def build_in_clause(names):
        return ", ".join([f"'{name.replace(chr(39), chr(39)+chr(39))}'" for name in names])

    repo_placeholders = build_in_clause(repo_names)
    participants_data = {}

    sql = f"""
        SELECT repo_name, count(DISTINCT actor_id) as participants
        FROM opensource.events
        WHERE platform = 'GitHub'
          AND repo_name IN ({repo_placeholders})
          AND type IN ('IssuesEvent', 'IssueCommentEvent', 'PullRequestEvent',
                       'PullRequestReviewEvent', 'PullRequestReviewCommentEvent')
          AND created_at >= '{participants_start}'
          AND created_at < '{participants_end}'
        GROUP BY repo_name
    """
    result = ch_client.query(sql)
    for row in result.result_rows:
        name, count = row
        participants_data[name] = count

    return participants_data

# ── Load existing projects ─────────────────────────────────────────────
def load_existing_projects():
    """Load existing project repo_names from CSV."""
    existing = set()
    if os.path.exists(INPUT_CSV):
        with open(INPUT_CSV, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("repo_name"):
                    existing.add(row["repo_name"].strip())
    print(f"Loaded {len(existing)} existing projects")
    return existing

# ── Query ClickHouse for star growth ──────────────────────────────────
def query_top_star_growth_projects(limit=100):
    """Query top projects by star growth in the past week."""
    # Calculate date range - last 7 days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    
    # Query for most starred repos in past week (WatchEvent = GitHub star)
    sql = f"""
        SELECT repo_name, count() as stars_received
        FROM opensource.events
        WHERE platform = 'GitHub'
          AND type = 'WatchEvent'
          AND created_at >= '{start_date.strftime('%Y-%m-%d')}'
          AND created_at < '{end_date.strftime('%Y-%m-%d')}'
        GROUP BY repo_name
        ORDER BY stars_received DESC
        LIMIT {limit}
    """
    
    try:
        result = ch_client.query(sql)
        projects = [row[0] for row in result.result_rows]
        print(f"Found {len(projects)} projects with star events in past week")
        return projects
    except Exception as e:
        print(f"Error querying events table: {e}")
        return []

# ── Fetch GitHub info ─────────────────────────────────────────────────
def fetch_github_info(repo_name):
    """Fetch repo info from GitHub API."""
    url = f"https://api.github.com/repos/{repo_name}"
    try:
        resp = requests.get(url, headers=gh_headers, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "repo_id": data.get("id", 0),
                "description": data.get("description") or "",
                "stars": data.get("stargazers_count", 0),
                "language": data.get("language") or "",
                "created_at": data.get("created_at", "").split("T")[0] if data.get("created_at") else "",
                "topics": ",".join(data.get("topics", [])),
            }
        elif resp.status_code == 404:
            return None
        else:
            print(f"  HTTP {resp.status_code} for {repo_name}")
    except Exception as e:
        print(f"  Error for {repo_name}: {e}")
    return None

def fetch_github_readme(repo_name):
    """Fetch README content from GitHub API."""
    url = f"https://api.github.com/repos/{repo_name}/readme"
    try:
        resp = requests.get(url, headers=gh_headers, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            content = base64.b64decode(data["content"]).decode("utf-8", errors="replace")
            return content[:50000]
    except:
        pass
    return ""

# ── Filter agentic AI projects ────────────────────────────────────────

def _word_match(keyword, text):
    """Match keyword with word boundaries to prevent substring false positives."""
    return bool(re.search(r'\b' + re.escape(keyword) + r'\b', text, re.IGNORECASE))

AGENTIC_CORE_KEYWORDS = [
    "agent", "agents", "agentic", "autonomous", "multi-agent", "multi agent",
    "ai agent", "coding agent", "dev agent", "llm agent", "gpt agent",
    "agent framework", "agent sdk", "agent toolkit", "agent builder",
    "agentic workflow", "agent workflow", "agent orchestration",
    "mcp", "model context protocol", "mcp server", "mcp client",
    "tool calling", "function calling", "tool integration",
    "browser agent", "web agent", "robot agent", "voice agent",
    "autogpt", "crewai", "langchain", "langgraph", "autogen", "agno", "camel",
    "metagpt", "openmanus", "claude agent", "gpt builder",
    "agent tools", "agent communication", "agent protocol", "a2a",
    "self-driving agent", "autonomous system", "agent autonomy",
]

ML_GENERAL_KEYWORDS = [
    "rag", "retrieval augmented", "vector database", "embedding",
    "fine-tuning", "model training", "inference", "llm inference", "vllm", "ollama",
    "workflow", "orchestration", "automation", "dify", "n8n", "flowise",
    "memory", "mem0", "memgpt", "letta", "context management",
    "evaluation", "observability", "tracing", "langfuse", "wandb",
    "code generation", "code completion", "ai coding", "program synthesis",
    "chatbot", "ai assistant", "knowledge base",
    "graphrag", "knowledge graph",
    "speech", "voice", "tts", "stt",
]

COLLECTION_KEYWORDS = [
    "awesome", "awesome list", "collection", "curated list",
    "papers", "tutorial", "course", "book", "blog", "newsletter",
    "reading list", "resources",
]

EXCLUSION_KEYWORDS = [
    "best practice", "best-practice", "cheat sheet", "cheatsheet",
    "design spec", "specification", "handbook",
    "skill file", "claude.md",
    "prompt template", "system prompt",
]

# Repo-name patterns that indicate non-project repos (skill files, CLAUDE.md repos)
SKILL_REPO_PATTERNS = [
    r'-skills?$',           # ends with -skill or -skills
    r'-best-practices?$',   # ends with -best-practice(s)
    r'claude[.-]code[.-]skill',  # contains claude-code-skill pattern
]

def is_agentic_project(project_info, readme_content, repo_name=""):
    """Check if project is agentic AI related using tiered keyword matching."""
    text = f"{project_info.get('description', '')} {project_info.get('topics', '')} {readme_content[:5000]}".lower()

    # Check repo-name patterns for skill-file / non-project repos
    name_part = repo_name.split("/")[-1] if "/" in repo_name else repo_name
    for pattern in SKILL_REPO_PATTERNS:
        if re.search(pattern, name_part, re.IGNORECASE):
            return False

    # Check exclusion keywords — reject unless strong agentic signal (≥5 core matches)
    core_count = sum(1 for kw in AGENTIC_CORE_KEYWORDS if _word_match(kw, text))
    for kw in EXCLUSION_KEYWORDS:
        if _word_match(kw, text):
            if core_count < 5:
                return False
            break

    # Check collection keywords — reject unless strong agentic signal (≥5 core matches)
    for kw in COLLECTION_KEYWORDS:
        if _word_match(kw, text):
            if core_count < 5:
                return False
            break

    # Require at least 1 agentic core keyword AND ≥2 total matches (core + general)
    if core_count < 1:
        return False

    general_count = sum(1 for kw in ML_GENERAL_KEYWORDS if _word_match(kw, text))
    total_count = core_count + general_count

    return total_count >= 2

# ── Taxonomy & Classification ──────────────────────────────────────────
TAXONOMY = {
    "Coding Agent": {
        "keywords": [
            "coding agent", "code agent", "coding assistant", "ai coding", "code generation",
            "autonomous coding", "developer agent", "programming agent", "code completion",
            "ide agent", "terminal agent", "cli agent", "code editor", "copilot",
            "aider", "cline", "continue", "tabby", "codex", "opencode", "goose",
            "cursor", "code assistant", "autonomous developer",
        ],
        "weight": 1.0,
    },
    "Agent Framework": {
        "keywords": [
            "agent framework", "build agents", "create agents", "agent development",
            "agent sdk", "agent library", "multi-agent", "agent orchestration",
            "langchain", "langgraph", "crewai", "autogen", "semantic kernel",
            "agent toolkit", "agent builder", "agentic framework", "llm agent",
            "agent workflow", "agno", "camel", "openai agents",
        ],
        "weight": 1.0,
    },
    "Workflow Orchestration": {
        "keywords": [
            "workflow", "orchestration", "automation platform", "low-code", "no-code",
            "dify", "n8n", "flowise", "langflow", "activepieces", "workflow automation",
            "visual builder", "drag and drop", "flow builder", "pipeline orchestration",
            "workflow engine", "process automation",
        ],
        "weight": 0.9,
    },
    "LLM Inference": {
        "keywords": [
            "llm inference", "model serving", "inference server", "vllm", "ollama",
            "llama.cpp", "tensorrt", "text generation inference", "tgi", "inference engine",
            "model deployment", "llm serving", "gpu inference", "optimized inference",
            "inference optimization", "sglang", "triton inference", "bentoml",
            "ramalama", "dynamo", "gpustack", "xinference",
        ],
        "weight": 1.0,
    },
    "Model Training & Fine-tuning": {
        "keywords": [
            "fine-tuning", "model training", "training framework", "llm training",
            "deep learning framework", "pytorch", "tensorflow", "jax", "paddle",
            "deepspeed", "megatron", "nemo", "colossalai", "unsloth", "swift",
            "llama factory", "openrlhf", "verl", "areal", "flash attention",
            "model optimization", "quantization", "distillation",
        ],
        "weight": 0.9,
    },
    "Vector Database & RAG": {
        "keywords": [
            "vector database", "vector search", "embedding", "rag", "retrieval augmented",
            "milvus", "chroma", "weaviate", "qdrant", "lancedb", "pgvector",
            "semantic search", "document retrieval", "knowledge retrieval",
            "ragflow", "anything-llm", "fastgpt", "docling",
        ],
        "weight": 0.9,
    },
    "Memory & Knowledge": {
        "keywords": [
            "memory", "knowledge base", "memory system", "agent memory",
            "mem0", "memgpt", "letta", "second-me", "claude-mem",
            "long-term memory", "conversation memory", "context management",
            "knowledge management", "memory layer",
        ],
        "weight": 0.9,
    },
    "MCP (Model Context Protocol)": {
        "keywords": [
            "mcp", "model context protocol", "mcp server", "mcp client",
            "context protocol", "mcp tools", "mcp integration",
        ],
        "weight": 1.0,
    },
    "Browser Agent": {
        "keywords": [
            "browser agent", "web agent", "browser automation", "web browsing",
            "browser-use", "playwright", "selenium", "puppeteer", "web interaction",
            "browser control", "web scraping agent", "omniparser",
        ],
        "weight": 1.0,
    },
    "Chat UI & Frontend": {
        "keywords": [
            "chat ui", "chat interface", "chatbot ui", "web ui", "frontend",
            "open-webui", "chatbox", "nextchat", "cherry studio", "lobe chat",
            "siyuan", "silly tavern", "text-generation-webui", "chat frontend",
            "conversation ui",
        ],
        "weight": 0.8,
    },
    "Observability & Evaluation": {
        "keywords": [
            "observability", "monitoring", "evaluation", "llm evaluation", "tracing",
            "langfuse", "wandb", "phoenix", "opik", "mlflow", "promptfoo",
            "opencompass", "model evaluation", "prompt evaluation", "llm monitoring",
            "agent evaluation", "benchmark",
        ],
        "weight": 0.9,
    },
    "LLM Gateway & Proxy": {
        "keywords": [
            "llm gateway", "api gateway", "proxy", "litellm", "one-api",
            "ai gateway", "model proxy", "api proxy", "unified api",
            "llm api", "model routing", "load balancing",
        ],
        "weight": 1.0,
    },
    "Data Processing & ETL": {
        "keywords": [
            "data processing", "etl", "data pipeline", "airflow", "dagster",
            "prefect", "airbyte", "dbt", "data orchestration", "data integration",
            "unstructured", "document processing", "data extraction",
            "apache spark", "dask", "datachain",
        ],
        "weight": 0.7,
    },
    "Data Lake & Storage": {
        "keywords": [
            "data lake", "data warehouse", "iceberg", "delta lake", "hudi",
            "paimon", "gravitino", "openmetadata", "datahub", "data catalog",
            "table format", "apache iceberg",
        ],
        "weight": 0.7,
    },
    "Robotics & Embodied AI": {
        "keywords": [
            "robotics", "embodied ai", "robot", "lerobot", "genesis",
            "robot learning", "manipulation", "robotic arm", "embodied agent",
        ],
        "weight": 1.0,
    },
    "Multi-Agent System": {
        "keywords": [
            "multi-agent", "multi agent", "agent team", "agent collaboration",
            "crewai", "autogen", "metagpt", "openmanus", "agent swarm",
            "hierarchical agent", "agent coordination",
        ],
        "weight": 1.0,
    },
    "Search & Information Retrieval": {
        "keywords": [
            "search engine", "information retrieval", "perplexica", "searxng",
            "web search", "search api", "knowledge search",
        ],
        "weight": 0.9,
    },
    "Tool & Integration Platform": {
        "keywords": [
            "tool integration", "api integration", "composio", "daytona",
            "integration platform", "tool calling", "function calling",
            "agent tools", "mcp servers",
        ],
        "weight": 0.9,
    },
    "Speech & Voice AI": {
        "keywords": [
            "speech", "voice", "audio", "tts", "stt", "speech recognition",
            "livekit", "pipecat", "voice agent", "audio processing",
        ],
        "weight": 1.0,
    },
    "Image & Video Generation": {
        "keywords": [
            "image generation", "video generation", "stable diffusion", "comfyui",
            "diffusion model", "image synthesis", "generative art",
            "automatic1111", "sdxl", "flux",
        ],
        "weight": 1.0,
    },
    "Notebook & Development Environment": {
        "keywords": [
            "notebook", "jupyter", "marimo", "development environment",
            "ide", "code environment", "interactive computing",
        ],
        "weight": 0.8,
    },
    "AI Infrastructure & Platform": {
        "keywords": [
            "ai infrastructure", "ml platform", "kubernetes", "ray", "spark",
            "distributed computing", "gpu management", "volcano", "1panel",
            "coder", "dev environment", "cloud native",
        ],
        "weight": 0.7,
    },
    "LLM SDK & Library": {
        "keywords": [
            "sdk", "library", "client library", "llm sdk", "python sdk",
            "typescript sdk", "api client", "vercel ai", "llamaindex",
            "haystack", "dspy",
        ],
        "weight": 0.8,
    },
    "GraphRAG & Knowledge Graph": {
        "keywords": [
            "graphrag", "knowledge graph", "graph rag", "neo4j", "graph database",
            "entity extraction", "relationship extraction",
        ],
        "weight": 1.0,
    },
    "Deep Learning Core": {
        "keywords": [
            "deep learning", "neural network", "pytorch", "tensorflow", "jax",
            "paddle", "keras", "onnx", "mlx", "triton", "cuda", "nccl",
            "flashinfer", "cutlass", "transformer engine",
        ],
        "weight": 0.6,
    },
    "Hardware & Edge AI": {
        "keywords": [
            "edge ai", "embedded ai", "esp32", "xiaozhi", "on-device",
            "mobile ai", "iot ai", "edge computing",
        ],
        "weight": 1.0,
    },
    "A2A Protocol": {
        "keywords": [
            "a2a", "agent-to-agent", "agent communication", "agent protocol",
        ],
        "weight": 1.0,
    },
    "Autonomous Agent": {
        "keywords": [
            "autonomous agent", "autogpt", "autonomous ai", "self-driving agent",
            "autonomous system", "agent autonomy",
        ],
        "weight": 1.0,
    },
    "API & Backend Service": {
        "keywords": [
            "api server", "backend", "rest api", "graphql", "fastapi",
            "supabase", "elasticsearch", "opensearch", "vespa",
        ],
        "weight": 0.6,
    },
}

def classify_project(proj):
    """Classify a project based on its content against TAXONOMY."""
    text = f"{proj.get('description', '')} {proj.get('topics', '')} {proj.get('readme', '')[:10000]}".lower()

    scores = {}
    for category, config in TAXONOMY.items():
        score = 0
        for keyword in config["keywords"]:
            pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
            matches = len(re.findall(pattern, text))
            if matches > 0:
                score += matches * config["weight"]
        if score > 0:
            scores[category] = score

    sorted_categories = sorted(scores.items(), key=lambda x: -x[1])
    return [cat for cat, score in sorted_categories if score > 0.5]

# ── Markdown helpers ────────────────────────────────────────────────────
def md_cell(text, max_len=50):
    """Sanitize text for a markdown table cell: escape pipes, truncate."""
    s = str(text) if text else ""
    s = s.replace("|", "│")
    if len(s) > max_len:
        s = s[:max_len] + "..."
    return s

# ── OpenRank Sparkline ─────────────────────────────────────────────────
def generate_sparkline(trend_dict, trend_months):
    """Generate ASCII sparkline from OpenRank trend data."""
    if not trend_dict or not trend_months:
        return "—"

    # Get values in order, handle missing months
    values = []
    for month in trend_months:
        if month in trend_dict:
            values.append(trend_dict[month])

    if len(values) < 2:
        return "—"

    # Map values to sparkline characters
    chars = "▁▂▃▄▅▆▇█"
    min_val, max_val = min(values), max(values)

    if min_val == max_val:
        return chars[4] * len(values)

    sparkline = ""
    for v in values:
        idx = int((v - min_val) / (max_val - min_val) * (len(chars) - 1))
        sparkline += chars[idx]

    return sparkline

# ── Recommendation Algorithm ────────────────────────────────────────────
def compute_recommendation_score(project, trend_months):
    """
    Compute a recommendation score for a project.
    OpenRank-dominant weighting:
    - OpenRank growth rate: 50%
    - OpenRank trend slope: 20%
    - Participants (log scaled): 15%
    - Stars (log scaled, with novelty bonus for new projects): 15%
    """
    import math
    from datetime import datetime

    trend = project.get("openrank_trend", {})
    stars = project.get("stars", 0) or 0
    participants = project.get("participants", 0) or 0
    created_at = project.get("created_at", "")

    # Get OpenRank values in order
    values = [trend.get(m, 0) for m in trend_months if m in trend]

    if len(values) < 2 or max(values) == 0:
        # Not enough data, use default score
        return 0.5, {"reason": "数据不足"}

    # OpenRank growth rate (50%)
    or_growth = (values[-1] - values[0]) / (values[0] + 1)

    # OpenRank trend slope (20%) - linear regression slope normalized
    n = len(values)
    if n > 1:
        x_mean = (n - 1) / 2
        y_mean = sum(values) / n
        numerator = sum((i - x_mean) * (values[i] - y_mean) for i in range(n))
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        or_slope = numerator / denominator if denominator != 0 else 0
        # Normalize slope by average OpenRank
        avg_or = sum(values) / n
        or_slope_normalized = or_slope / (avg_or + 1)
    else:
        or_slope_normalized = 0

    # Participants score (15%) - log scaled
    participants_score = math.log(participants + 1) / math.log(1000 + 1)

    # Stars score with novelty bonus (15%)
    stars_score = math.log(stars + 1) / math.log(100000 + 1)

    # Novelty bonus: projects created within 6 months get 1.5x bonus
    novelty_bonus = 1.0
    if created_at:
        try:
            created_date = datetime.strptime(created_at, "%Y-%m-%d")
            age_months = (datetime.now() - created_date).days / 30
            if age_months < 6:
                novelty_bonus = 1.5
        except:
            pass

    # Compute total score
    score = (
        0.50 * or_growth +
        0.20 * or_slope_normalized +
        0.15 * participants_score +
        0.15 * novelty_bonus * stars_score
    )

    # Build reason
    reasons = []
    if or_growth > 0.5:
        reasons.append(f"OpenRank 增长 {or_growth*100:.0f}%")
    if or_slope_normalized > 0.1:
        reasons.append("趋势陡峭")
    if participants > 100:
        reasons.append(f"社区活跃 ({participants} 参与者)")
    if novelty_bonus > 1:
        reasons.append("新项目")
    if stars > 5000:
        reasons.append(f"高关注 ({stars} stars)")

    reason = ", ".join(reasons[:3]) if reasons else "综合表现良好"

    return score, {"reason": reason}

def generate_recommendations(new_projects, trend_months, top_n=None):
    """
    Generate recommendation list sorted by comprehensive score.
    Returns list of (project, score, reason) tuples.
    """
    scored = []
    for p in new_projects:
        score, meta = compute_recommendation_score(p, trend_months)
        scored.append((p, score, meta["reason"]))

    # Sort by score descending
    scored.sort(key=lambda x: -x[1])

    # Return top N (dynamic if top_n is None)
    if top_n:
        return scored[:top_n]

    # Dynamic: include all projects with score > 0.5
    return [(p, s, r) for p, s, r in scored if s > 0.5]

# ── Generate recommendation report ─────────────────────────────────────
def generate_report(new_projects, trend_months=None):
    """Generate a markdown report for manual confirmation."""
    if trend_months is None:
        trend_months = []
    
    report = f"""# Weekly Agentic AI Projects Update

**Date:** {datetime.now().strftime('%Y-%m-%d %H:%M')}

## Summary

Found **{len(new_projects)}** new agentic AI projects this week (not in existing list).

## Projects to Review

| # | Repo | Description | Topics | Stars | Created | OpenRank | 趋势 | 参与者 | 语言 |
|---|------|-------------|--------|-------|---------|----------|------|--------|------|
"""
    
    for i, p in enumerate(new_projects, 1):
        desc = md_cell(p.get("description", ""), 50)
        topics = md_cell(p.get("topics", ""), 40)
        stars = p.get("stars", 0)
        stars_str = f"{stars/1000:.1f}k" if stars >= 1000 else str(stars)
        created = p.get("created_at", "-")[:7] if p.get("created_at") else "-"
        openrank = p.get("openrank_latest", "")
        openrank_str = f"{openrank:.1f}" if openrank else "-"
        trend = p.get("openrank_trend", {})
        sparkline = generate_sparkline(trend, trend_months)
        participants = p.get("participants", 0)
        lang = p.get("language", "-") or "-"

        report += f"| {i} | {p['repo_name']} | {desc} | {topics} | {stars_str} | {created} | {openrank_str} | {sparkline} | {participants} | {lang} |\n"

    # Generate recommendations
    if len(new_projects) >= 3:
        recommendations = generate_recommendations(new_projects, trend_months)

        if recommendations:
            report += """
## 🌟 值得额外关注的项目

基于 OpenRank 增速、社区活跃度、Star 数和创建时间的综合评估：

| Repo | 推荐指数 | 推荐理由 |
|------|---------|---------|
"""
            for p, score, reason in recommendations[:5]:  # Top 5
                # Map score to stars rating
                if score >= 0.8:
                    rating = "⭐⭐⭐⭐⭐"
                elif score >= 0.6:
                    rating = "⭐⭐⭐⭐"
                elif score >= 0.4:
                    rating = "⭐⭐⭐"
                else:
                    rating = "⭐⭐"

                report += f"| {p['repo_name']} | {rating} | {md_cell(reason, 80)} |\n"

            # Add detailed analysis for top recommendation
            if recommendations:
                top_p, top_score, top_reason = recommendations[0]
                trend_data = top_p.get("openrank_trend", {})
                values = [trend_data.get(m, 0) for m in trend_months if m in trend_data]

                if len(values) >= 2:
                    or_growth = (values[-1] - values[0]) / (values[0] + 1) if values[0] > 0 else 0
                    report += f"""
**深度分析**：

- **{top_p['repo_name']}**: OpenRank 从 {values[0]:.1f} 增长到 {values[-1]:.1f} ({or_growth*100:.0f}% 增长)，
  最近一月 {top_p.get('participants', 0)} 位参与者，{top_p.get('stars', 0)} stars。{top_reason}。

"""

    report += f"""

## Action Required

Please review the projects above and confirm which ones to add.

To confirm, run:
```bash
python scripts/weekly_update.py --confirm
```

To skip this week, simply close the PR without merging.

---
*Generated by Numa 🐂*
"""
    
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write(report)
    
    print(f"\n{REPORT_FILE}")
    return report

# ── Send DingTalk notification ─# ── Send DingTalk notification ────────────────────────────────────────
def send_dingtalk(message, projects=None, recommendations=None, yuque_url=None):
    """Send DingTalk message with webhook and signature."""
    if not DINGTALK_WEBHOOK:
        print(f"{YELLOW}No DingTalk webhook configured, skipping notification{RESET}")
        return
    if not projects:
        return

    # Build markdown message
    md_msg = f"## 🐂 Weekly Agentic AI Projects Update\n\n"
    md_msg += f"**Date:** {datetime.now().strftime('%Y-%m-%d')}\n\n"
    md_msg += f"Found **{len(projects)}** new agentic AI projects this week.\n\n"

    # Highlight recommended projects
    if recommendations:
        md_msg += "### 🌟 值得关注\n\n"
        for p, score, reason in recommendations[:5]:
            stars = p.get("stars", 0)
            stars_str = f"{stars/1000:.1f}k" if stars >= 1000 else str(stars)
            md_msg += f"- **{p['repo_name']}** ⭐{stars_str} — {reason}\n"
        md_msg += "\n"

    # Link to Yuque
    if yuque_url:
        md_msg += f"[📖 查看完整报告]({yuque_url})\n\n"
    else:
        md_msg += "完整报告稍后发布\n\n"
    
    payload = {
        "msgtype": "markdown",
        "markdown": {
            "title": "Weekly Agentic AI Update",
            "text": md_msg
        }
    }
    
    # Generate signature if secret is provided
    url = DINGTALK_WEBHOOK
    if DINGTALK_SECRET:
        timestamp = str(round(time.time() * 1000))
        secret_enc = DINGTALK_SECRET.encode('utf-8')
        string_to_sign = f'{timestamp}\n{DINGTALK_SECRET}'
        string_to_sign_enc = string_to_sign.encode('utf-8')
        hmac_code = hmac.new(secret_enc, string_to_sign_enc, digestmod=hashlib.sha256).digest()
        sign = urllib.parse.quote_plus(base64.b64encode(hmac_code))
        url = f"{DINGTALK_WEBHOOK}&timestamp={timestamp}&sign={sign}"
    
    try:
        resp = requests.post(url, json=payload, timeout=10)
        if resp.status_code == 200:
            result = resp.json()
            if result.get('errcode') == 0:
                print(f"{GREEN}DingTalk notification sent!{RESET}")
            else:
                print(f"{RED}DingTalk error: {result.get('errmsg')}{RESET}")
        else:
            print(f"{RED}DingTalk HTTP error: {resp.status_code}{RESET}")
    except Exception as e:
        print(f"{RED}Failed to send DingTalk: {e}{RESET}")

# ── Reader-facing report for Yuque ─────────────────────────────────────
def generate_reader_report(new_projects, trend_months, recommendations=None):
    """Generate a reader-facing markdown report for Yuque (no Action Required)."""
    date_str = datetime.now().strftime('%Y-%m-%d')
    report = f"# Agentic 每周推送 {date_str}\n\n"
    report += f"本周发现 **{len(new_projects)}** 个新的 Agentic AI 开源项目。\n\n"

    report += "## 📋 本周新项目\n\n"
    report += "| 项目 | 描述 | Stars | 语言 |\n"
    report += "|------|------|-------|------|\n"
    for p in new_projects:
        desc = md_cell(p.get("description", ""), 60)
        stars = p.get("stars", 0)
        stars_str = f"{stars/1000:.1f}k" if stars >= 1000 else str(stars)
        lang = p.get("language", "-") or "-"
        report += f"| [{p['repo_name']}](https://github.com/{p['repo_name']}) | {desc} | {stars_str} | {lang} |\n"

    if recommendations:
        report += "\n## 🌟 值得关注\n\n"
        for p, score, reason in recommendations[:5]:
            stars = p.get("stars", 0)
            stars_str = f"{stars/1000:.1f}k" if stars >= 1000 else str(stars)
            report += f"**[{p['repo_name']}](https://github.com/{p['repo_name']})** ⭐{stars_str}\n\n"
            report += f"- {reason}\n\n"

    # Placeholder for LLM-generated trend analysis
    report += "## 🔥 趋势洞察\n\n"
    report += "<!-- TREND_ANALYSIS_PLACEHOLDER -->\n"

    return report

# ── Trend context for LLM analysis ─────────────────────────────────────
TREND_CONTEXT_FILE = os.path.join(BASE, "data", "trend_context.md")

def generate_trend_context(new_projects, trend_months, recommendations=None):
    """Generate a structured data summary for Claude session to produce trend analysis."""
    from collections import Counter

    ctx = "# 本周趋势分析数据\n\n"
    ctx += f"## 概览\n\n"
    ctx += f"- 新增项目：{len(new_projects)} 个\n"

    # Category distribution
    cat_counter = Counter()
    cat_projects = {}  # category -> list of (stars, repo_name, desc)
    for p in new_projects:
        cats = p.get("categories", [])
        if isinstance(cats, str):
            cats = [c.strip() for c in cats.split("|") if c.strip()]
        if not cats:
            cats = classify_project(p)
        for c in cats:
            cat_counter[c] += 1
            if c not in cat_projects:
                cat_projects[c] = []
            stars = p.get("stars", 0) or 0
            cat_projects[c].append((stars, p["repo_name"], p.get("description", "") or ""))

    ctx += f"- 覆盖分类：{len(cat_counter)} 个\n\n"

    ctx += "## 分类分布\n\n"
    ctx += "| 分类 | 项目数 | 代表项目 |\n"
    ctx += "|------|--------|----------|\n"
    for cat, count in cat_counter.most_common():
        top_in_cat = sorted(cat_projects.get(cat, []), key=lambda x: -x[0])[:2]
        reps = ", ".join(r[1] for r in top_in_cat)
        ctx += f"| {cat} | {count} | {reps} |\n"
    ctx += "\n"

    # Top recommendations with full detail
    if recommendations:
        ctx += "## Top 5 推荐（用于案例引用）\n\n"
        for i, (p, score, reason) in enumerate(recommendations[:5], 1):
            stars = p.get("stars", 0) or 0
            stars_str = f"{stars/1000:.1f}k" if stars >= 1000 else str(stars)
            cats = p.get("categories", [])
            if isinstance(cats, str):
                cats = [c.strip() for c in cats.split("|") if c.strip()]
            cats_str = ", ".join(cats[:3]) if cats else "未分类"

            ctx += f"### {i}. [{p['repo_name']}](https://github.com/{p['repo_name']}) ⭐{stars_str}\n"
            ctx += f"- 描述：{p.get('description', '')}\n"
            ctx += f"- 分类：{cats_str}\n"

            trend = p.get("openrank_trend", {})
            or_latest = p.get("openrank_latest", "")
            if trend:
                values = [trend.get(m) for m in trend_months if m in trend]
                valid = [v for v in values if v is not None and v > 0]
                if len(valid) >= 2:
                    growth_pct = (valid[-1] - valid[0]) / (valid[0] + 1) * 100
                    ctx += f"- OpenRank 趋势：{valid[0]:.1f} → {valid[-1]:.1f} (增长 {growth_pct:.0f}%)\n"
                elif or_latest:
                    ctx += f"- OpenRank：{or_latest:.1f}\n"
            elif or_latest:
                ctx += f"- OpenRank：{or_latest:.1f}\n"

            participants = p.get("participants", 0)
            if participants:
                ctx += f"- 参与者：{participants}\n"
            ctx += f"- 推荐理由：{reason}\n\n"

    # Data highlights
    ctx += "## 数据亮点\n\n"

    # Fastest growing
    growth_list = []
    for p in new_projects:
        trend = p.get("openrank_trend", {})
        values = [trend.get(m) for m in trend_months if m in trend]
        valid = [v for v in values if v is not None and v > 0]
        if len(valid) >= 2:
            growth = (valid[-1] - valid[0]) / (valid[0] + 1)
            growth_list.append((p["repo_name"], growth, valid[0], valid[-1]))
    if growth_list:
        growth_list.sort(key=lambda x: -x[1])
        ctx += "### 增速最快\n\n"
        for name, g, v0, v1 in growth_list[:3]:
            ctx += f"- **{name}**：OpenRank {v0:.1f} → {v1:.1f} (增长 {g*100:.0f}%)\n"
        ctx += "\n"

    # Most participants
    part_list = [(p["repo_name"], p.get("participants", 0) or 0) for p in new_projects]
    part_list.sort(key=lambda x: -x[1])
    if part_list and part_list[0][1] > 0:
        ctx += "### 参与者最多\n\n"
        for name, cnt in part_list[:3]:
            ctx += f"- **{name}**：{cnt} 位参与者\n"
        ctx += "\n"

    # Highest stars among young projects (< 6 months)
    from datetime import datetime
    young = []
    for p in new_projects:
        created = p.get("created_at", "")
        stars = p.get("stars", 0) or 0
        if created and stars >= 1000:
            try:
                age_days = (datetime.now() - datetime.strptime(created, "%Y-%m-%d")).days
                if age_days < 180:
                    young.append((p["repo_name"], stars, created[:7]))
            except ValueError:
                pass
    if young:
        young.sort(key=lambda x: -x[1])
        ctx += "### 新锐高星项目（6 个月内创建）\n\n"
        for name, s, c in young[:3]:
            s_str = f"{s/1000:.1f}k" if s >= 1000 else str(s)
            ctx += f"- **{name}** ⭐{s_str} (创建于 {c})\n"
        ctx += "\n"

    # Write to file
    with open(TREND_CONTEXT_FILE, "w", encoding="utf-8") as f:
        f.write(ctx)
    print(f"{CYAN}Trend context saved to {TREND_CONTEXT_FILE}{RESET}")

# ── Yuque publish ──────────────────────────────────────────────────────
YUQUE_BOOK_ID = 211551637

def publish_to_yuque(reader_report):
    """Save reader-facing report for Yuque publishing. Returns file path."""
    date_str = datetime.now().strftime('%Y-%m-%d')
    title = f"Agentic 每周推送 {date_str}"
    yuque_file = os.path.join(BASE, "data", "yuque_report.md")
    with open(yuque_file, "w", encoding="utf-8") as f:
        f.write(reader_report)
    print(f"{CYAN}Yuque report saved to {yuque_file}{RESET}")
    return yuque_file

# ── GitHub PR creation ────────────────────────────────────────────────
def create_pr(projects):
    """Create a GitHub PR with checklist for project selection."""
    date_str = datetime.now().strftime('%Y-%m-%d')
    branch_name = f"weekly/{date_str}"

    try:
        # Create branch and commit report
        subprocess.run(["git", "checkout", "-b", branch_name], check=True, capture_output=True)
        subprocess.run(["git", "add", REPORT_FILE], check=True, capture_output=True)
        subprocess.run(["git", "commit", "-m", f"Weekly update {date_str}: {len(projects)} new projects"],
                       check=True, capture_output=True)
        subprocess.run(["git", "push", "-u", "origin", branch_name], check=True, capture_output=True)

        # Build PR body with inline-checkbox table
        body_lines = [f"## Weekly Agentic AI Projects Update — {date_str}\n"]
        body_lines.append(f"Found **{len(projects)}** new agentic AI projects.\n")
        body_lines.append("Check the projects you want to include:\n")

        body_lines.append("| ✓ | Repo | Description | Stars | Language | Created |")
        body_lines.append("|---|------|-------------|-------|----------|---------|")
        for p in projects:
            desc = md_cell(p.get("description", ""), 50)
            stars = p.get("stars", 0)
            stars_str = f"{stars/1000:.1f}k" if stars >= 1000 else str(stars)
            lang = p.get("language", "-") or "-"
            created = p.get("created_at", "-")[:7] if p.get("created_at") else "-"
            body_lines.append(f"| - [ ] | **{p['repo_name']}** | {desc} | {stars_str} | {lang} | {created} |")

        body = "\n".join(body_lines)

        # Determine fork owner from origin remote
        remote_url = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            capture_output=True, text=True, check=True
        ).stdout.strip()
        # Extract owner from git@github.com:owner/repo.git or https://github.com/owner/repo.git
        owner_match = re.search(r'[:/]([^/]+)/', remote_url)
        fork_owner = owner_match.group(1) if owner_match else "xiaoya-yaya"

        result = subprocess.run(
            ["gh", "pr", "create",
             "--repo", PR_TARGET_REPO,
             "--head", f"{fork_owner}:{branch_name}",
             "--title", f"Weekly update {date_str}: {len(projects)} new projects",
             "--body", body],
            capture_output=True, text=True, check=True
        )
        pr_url = result.stdout.strip()
        print(f"{GREEN}PR created: {pr_url}{RESET}")

        # Switch back to main
        subprocess.run(["git", "checkout", "main"], capture_output=True)

        return pr_url
    except FileNotFoundError:
        print(f"{YELLOW}gh CLI not found. Skipping PR creation.{RESET}")
        return None
    except subprocess.CalledProcessError as e:
        print(f"{YELLOW}PR creation failed: {e.stderr[:200] if e.stderr else e}{RESET}")
        subprocess.run(["git", "checkout", "main"], capture_output=True)
        return None

# ── Post-merge: parse PR and update CSV ────────────────────────────────

def parse_pr_checklist(pr_body):
    """Parse checked/unchecked items from PR body (table-embedded or list checkboxes).
    Returns list of (repo_name, checked)."""
    items = []
    for line in pr_body.split("\n"):
        line = line.strip()
        # Table row with checkbox: | - [x] | **repo** | ... | or | - [ ] | **repo** | ... |
        if line.startswith("|") and ("- [x]" in line or "- [ ]" in line):
            checked = "- [x]" in line
            match = re.search(r'\*\*([^*]+)\*\*', line)
            if match:
                items.append((match.group(1), checked))
            continue
        # Fallback: list-style checkbox: - [x] **repo** or - [ ] **repo**
        if line.startswith("- [x]") or line.startswith("- [ ]"):
            checked = line.startswith("- [x]")
            match = re.search(r'\*\*([^*]+)\*\*', line)
            if match:
                items.append((match.group(1), checked))
    return items

def find_merged_pr():
    """Find the most recently merged weekly PR."""
    try:
        # List all merged PRs and filter for weekly/ branches
        result = subprocess.run(
            ["gh", "pr", "list", "--state", "merged",
             "--json", "number,title,body,url,headRefName", "--limit", "10"],
            capture_output=True, text=True, check=True
        )
        prs = json.loads(result.stdout)
        # Filter for weekly/ branch prefix
        weekly_prs = [p for p in prs if p.get("headRefName", "").startswith("weekly/")]
        if not weekly_prs:
            return None
        return weekly_prs[0]
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None

def update_csv_with_projects(selected_projects):
    """Add selected projects to CSV."""
    with open(INPUT_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames)
        existing_rows = list(reader)

    added = 0
    for p in selected_projects:
        if any(r.get("repo_name") == p["repo_name"] for r in existing_rows):
            continue
        row = {
            "repo_id": p.get("repo_id", ""),
            "repo_name": p["repo_name"],
            "description": p.get("description", ""),
            "stars": p.get("stars", 0),
            "language": p.get("language", ""),
            "created_at": p.get("created_at", ""),
            "topics": p.get("topics", ""),
            "categories": "|".join(p.get("categories", [])) if isinstance(p.get("categories"), list) else "",
        }
        # Set openrank fields from whichever columns exist
        for fn in fieldnames:
            if fn not in row:
                row[fn] = ""
        existing_rows.append(row)
        added += 1

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(existing_rows)

    return added

# ── Taxonomy evolution ─────────────────────────────────────────────────
def reclassify_projects(project_list):
    """Reclassify a list of projects using current TAXONOMY. Updates categories in-place."""
    for p in project_list:
        categories = classify_project(p)
        p["categories"] = categories if categories else ["Other"]
    return project_list

def analyze_taxonomy_coverage(all_projects):
    """Analyze keyword coverage and suggest new taxonomy categories."""
    # Collect keywords from unclassified/Other projects
    other_projects = [p for p in all_projects if "Other" in p.get("categories", [])]

    if not other_projects:
        total = len(all_projects)
        covered = total - len(other_projects)
        pct = (covered / total * 100) if total > 0 else 100
        print(f"\n{GREEN}Taxonomy coverage: {pct:.1f}% — no new category suggestions{RESET}")
        return

    # Extract potential keywords from Other projects
    from collections import Counter
    keyword_counter = Counter()
    for p in other_projects:
        text = f"{p.get('description', '')} {p.get('topics', '')}".lower()
        words = re.findall(r'\b[a-z][a-z-]+[a-z]\b', text)
        keyword_counter.update(words)

    # Check which high-frequency words are NOT covered by existing taxonomy
    existing_kw = set()
    for config in TAXONOMY.values():
        existing_kw.update(kw.lower() for kw in config["keywords"])

    uncovered = {kw: count for kw, count in keyword_counter.most_common(50)
                 if kw not in existing_kw and count >= 2 and len(kw) > 3}

    total = len(all_projects)
    covered = total - len(other_projects)
    pct = (covered / total * 100) if total > 0 else 100
    print(f"\n{CYAN}=== Taxonomy Coverage ==={RESET}")
    print(f"Coverage: {pct:.1f}% ({covered}/{total} projects classified)")
    print(f"Unclassified projects: {len(other_projects)}")

    if uncovered:
        print(f"\n{YELLOW}Suggested new keywords to consider for taxonomy:{RESET}")
        for kw, count in sorted(uncovered.items(), key=lambda x: -x[1])[:10]:
            print(f"  - \"{kw}\" (appears in {count} unclassified projects)")

def fetch_and_reclassify_top100(new_repo_names):
    """Fetch fresh data for top 100 projects + new ones, reclassify all."""
    print(f"\n{BOLD}=== Reclassifying top projects ==={RESET}")

    # Read all projects from CSV
    with open(INPUT_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        all_rows = list(reader)

    # Sort by openrank to get top 100
    def sort_key(row):
        try:
            return float(row.get("openrank_latest", 0) or 0)
        except (ValueError, TypeError):
            return 0

    all_rows.sort(key=sort_key, reverse=True)
    top_rows = all_rows[:100]

    # Add new projects not yet in CSV
    new_rows = []
    for name in new_repo_names:
        if not any(r.get("repo_name") == name for r in all_rows):
            new_rows.append({"repo_name": name})

    to_classify = top_rows + new_rows
    print(f"Reclassifying {len(to_classify)} projects ({len(top_rows)} top + {len(new_rows)} new)")

    # Fetch fresh info for each
    classified_count = 0
    for i, row in enumerate(to_classify):
        repo_name = row.get("repo_name", "")
        if not repo_name:
            continue
        print(f"  [{i+1}/{len(to_classify)}] {repo_name}...", end=" ")
        info = fetch_github_info(repo_name)
        if info:
            readme = fetch_github_readme(repo_name)
            proj = {**row, **info, "readme": readme}
            categories = classify_project(proj)
            row["categories"] = "|".join(categories) if categories else "Other"
            row["description"] = info.get("description", row.get("description", ""))
            row["stars"] = info.get("stars", row.get("stars", 0))
            row["topics"] = info.get("topics", row.get("topics", ""))
            row["language"] = info.get("language", row.get("language", ""))
            classified_count += 1
            print(f"{GREEN}{row['categories'][:40]}{RESET}")
        else:
            print(f"{YELLOW}skip{RESET}")
        time.sleep(0.3)

    # Write updated CSV using existing fieldnames
    fieldnames = list(all_rows[0].keys()) if all_rows else ["repo_id", "repo_name", "description", "stars",
                  "openrank_latest", "openrank_trend", "language",
                  "created_at", "topics", "categories"]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"{GREEN}Reclassified {classified_count} projects{RESET}")

    # Taxonomy coverage analysis
    analyze_taxonomy_coverage(all_rows)

# ── Orchestrators ──────────────────────────────────────────────────────
def run_check(full_mode=False):
    """Main --check flow: query, filter, report, publish, notify, create PR."""
    print(f"\n{BOLD}=== Step 1: Query ClickHouse for top star growth projects ==={RESET}")
    top_projects = query_top_star_growth_projects(100)

    print(f"\n{BOLD}=== Step 2: Fetch GitHub info and filter for agentic projects ==={RESET}")
    existing_projects = load_existing_projects()

    candidate_projects = []
    for i, repo_name in enumerate(top_projects):
        if repo_name in existing_projects:
            continue

        print(f"[{i+1}/{len(top_projects)}] Checking {repo_name}...", end=" ")
        info = fetch_github_info(repo_name)
        if not info:
            print("not found")
            continue

        readme = fetch_github_readme(repo_name)
        if is_agentic_project(info, readme, repo_name):
            text = f"{info.get('description', '')} {info.get('topics', '')} {readme[:5000]}".lower()
            core_matches = [kw for kw in AGENTIC_CORE_KEYWORDS if _word_match(kw, text)]
            general_matches = [kw for kw in ML_GENERAL_KEYWORDS if _word_match(kw, text)]
            info["repo_name"] = repo_name
            info["reason"] = ", ".join((core_matches + general_matches)[:3])
            info["readme"] = readme
            candidate_projects.append(info)
            print(f"{GREEN}✓ Agentic!{RESET}")
        else:
            print(f"{YELLOW}✗ Not agentic{RESET}")

        if not github_token:
            time.sleep(1.5)
        else:
            time.sleep(0.3)

    # Enrich with ClickHouse data
    print(f"\n{BOLD}=== Step 3: Enrich with OpenRank and Participants data ==={RESET}")
    repo_names = [p["repo_name"] for p in candidate_projects]
    openrank_data = fetch_openrank_data(repo_names)
    participants_data = fetch_participants_data(repo_names)

    new_agentic_projects = []
    for p in candidate_projects:
        or_data = openrank_data.get(p["repo_name"], {})
        p["openrank_latest"] = or_data.get("latest", "")
        p["openrank_trend"] = or_data.get("trend", {})
        p["participants"] = participants_data.get(p["repo_name"], 0)
        new_agentic_projects.append(p)

    print(f"Enriched {len(new_agentic_projects)} projects")

    if not new_agentic_projects:
        print(f"{YELLOW}No new agentic projects this week{RESET}")
        return

    # Generate recommendations
    recommendations = generate_recommendations(new_agentic_projects, trend_months) if len(new_agentic_projects) >= 3 else []

    # Generate internal report
    print(f"\n{BOLD}=== Step 4: Generate reports and publish ==={RESET}")
    generate_report(new_agentic_projects, trend_months)

    # Generate reader report and publish to Yuque
    reader_report = generate_reader_report(new_agentic_projects, trend_months, recommendations)
    yuque_file = publish_to_yuque(reader_report)

    # Generate trend context for LLM analysis
    generate_trend_context(new_agentic_projects, trend_months, recommendations)

    # Print instructions for trend analysis → Yuque → DingTalk (in this order)
    date_str = datetime.now().strftime('%Y-%m-%d')
    print(f"\n{BOLD}=== Next: Trend analysis → Yuque → DingTalk ==={RESET}")
    print(f"请执行以下步骤（按顺序）：")
    print(f"  1. 读取 {TREND_CONTEXT_FILE}")
    print(f"  2. 读取 {yuque_file}")
    print(f"  3. 基于数据生成 2-3 段中文趋势洞察，引用推荐项目作为案例")
    print(f"  4. 替换 {yuque_file} 中的 TREND_ANALYSIS_PLACEHOLDER")
    print(f"  5. 调用 skylark_doc_create(book_id={YUQUE_BOOK_ID}, title='Agentic 每周推送 {date_str}', body=<content>) 发布到语雀")
    print(f"  6. 获取语雀文档 URL 后，调用 send_dingtalk() 推送钉钉卡片（含语雀链接 + 趋势摘要）")

    if full_mode:
        # Legacy: add all projects directly
        print(f"\n{BOLD}=== Full mode: adding all projects ==={RESET}")
        added = update_csv_with_projects(new_agentic_projects)
        print(f"{GREEN}Added {added} projects to CSV{RESET}")
    else:
        # Create PR with checklist
        create_pr(new_agentic_projects)

    print(f"\n{GREEN}Check complete!{RESET}")

def run_post_merge():
    """Process a merged PR: update CSV with checked items, reclassify, evolve taxonomy."""
    print(f"\n{BOLD}=== Post-merge: Finding merged PR ==={RESET}")
    pr = find_merged_pr()
    if not pr:
        print(f"{RED}No merged weekly PR found. Make sure you've merged the PR first.{RESET}")
        return

    print(f"Found merged PR: {pr.get('title', '')} — {pr.get('url', '')}")

    # Parse checklist from PR body
    body = pr.get("body", "")
    items = parse_pr_checklist(body)
    if not items:
        print(f"{YELLOW}No checklist items found in PR body{RESET}")
        return

    checked_repos = {name for name, checked in items if checked}
    unchecked_repos = {name for name, checked in items if not checked}
    print(f"Checked: {len(checked_repos)} / {len(items)} projects")

    # Build project data from PR body table + checklist info
    # Parse the table in PR body for basic project info
    all_pending = []
    for line in body.split("\n"):
        line = line.strip()
        if not line.startswith("|") or line.startswith("|---") or line.startswith("| #"):
            continue
        parts = [c.strip() for c in line.split("|")]
        # Filter empty strings from leading/trailing pipes
        parts = [p for p in parts if p]
        if len(parts) < 4:
            continue
        repo_name = parts[1]
        if "/" not in repo_name:
            continue
        # Basic info from table
        proj = {
            "repo_name": repo_name,
            "description": parts[2].replace("│", "|"),
            "stars": 0,
            "language": parts[4] if len(parts) > 4 else "",
            "created_at": parts[5] if len(parts) > 5 else "",
        }
        all_pending.append(proj)

    # If table parsing failed, fall back to checklist parsing
    if not all_pending:
        for name, _ in items:
            all_pending.append({"repo_name": name, "stars": 0})

    # Filter to only checked projects
    selected = [p for p in all_pending if p["repo_name"] in checked_repos]
    print(f"Selected {len(selected)} projects to add")

    if selected:
        # Update CSV
        added = update_csv_with_projects(selected)
        print(f"{GREEN}Added {added} projects to CSV{RESET}")

        # Reclassify top 100 + new projects
        new_repo_names = [p["repo_name"] for p in selected]
        fetch_and_reclassify_top100(new_repo_names)
    else:
        print(f"{YELLOW}No projects selected{RESET}")

# ── Main workflow ─────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Weekly Agentic AI Projects Update")
    parser.add_argument("--check", action="store_true", help="Check for new projects, publish report, create PR")
    parser.add_argument("--confirm", action="store_true", help="(DEPRECATED) Use PR-based confirmation instead")
    parser.add_argument("--post-merge", action="store_true", help="Process merged PR: update CSV, reclassify, evolve taxonomy")
    parser.add_argument("--full", action="store_true", help="Full pipeline (check + confirm all without PR)")
    args = parser.parse_args()

    if args.confirm:
        print(f"{YELLOW}--confirm is deprecated. Use PR-based confirmation:{RESET}")
        print(f"  1. Review the PR created by --check")
        print(f"  2. Check items you want to include")
        print(f"  3. Merge the PR")
        print(f"  4. Run --post-merge to update CSV")
        return

    if args.check or args.full:
        run_check(full_mode=args.full)

    if args.post_merge:
        run_post_merge()

if __name__ == "__main__":
    main()
