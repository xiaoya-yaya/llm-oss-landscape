"""
Classify agentic AI projects into categories based on description, topics, and README content.

DEPRECATED: Classification logic has been consolidated into weekly_update.py.
This file is kept for reference only. Use weekly_update.py --post-merge instead.
"""

import json
import re
import csv
from collections import defaultdict

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCRIPT_DIR)
INPUT_JSON = f"{BASE}/data/project_readmes.json"
OUTPUT_CSV = f"{BASE}/data/agentic-ai-projects-classified.csv"

# Classification taxonomy with keywords
TAXONOMY = {
    "Coding Agent": {
        "keywords": [
            "coding agent", "code agent", "coding assistant", "ai coding", "code generation",
            "autonomous coding", "developer agent", "programming agent", "code completion",
            "ide agent", "terminal agent", "cli agent", "code editor", "copilot",
            "aider", "cline", "continue", "tabby", "codex", "opencode", "goose",
            "cursor", "code assistant", "autonomous developer"
        ],
        "weight": 1.0
    },
    "Agent Framework": {
        "keywords": [
            "agent framework", "build agents", "create agents", "agent development",
            "agent sdk", "agent library", "multi-agent", "agent orchestration",
            "langchain", "langgraph", "crewai", "autogen", "semantic kernel",
            "agent toolkit", "agent builder", "agentic framework", "llm agent",
            "agent workflow", "agno", "camel", "openai agents"
        ],
        "weight": 1.0
    },
    "Workflow Orchestration": {
        "keywords": [
            "workflow", "orchestration", "automation platform", "low-code", "no-code",
            "dify", "n8n", "flowise", "langflow", "activepieces", "workflow automation",
            "visual builder", "drag and drop", "flow builder", "pipeline orchestration",
            "workflow engine", "process automation"
        ],
        "weight": 0.9
    },
    "LLM Inference": {
        "keywords": [
            "llm inference", "model serving", "inference server", "vllm", "ollama",
            "llama.cpp", "tensorrt", "text generation inference", "tgi", "inference engine",
            "model deployment", "llm serving", "gpu inference", "optimized inference",
            "inference optimization", "sglang", "triton inference", "bentoml",
            "ramalama", "dynamo", "gpustack", "xinference"
        ],
        "weight": 1.0
    },
    "Model Training & Fine-tuning": {
        "keywords": [
            "fine-tuning", "model training", "training framework", "llm training",
            "deep learning framework", "pytorch", "tensorflow", "jax", "paddle",
            "deepspeed", "megatron", "neMo", "colossalai", "unsloth", "swift",
            "llama factory", "openrlhf", "verl", "areal", "flash attention",
            "model optimization", "quantization", "distillation"
        ],
        "weight": 0.9
    },
    "Vector Database & RAG": {
        "keywords": [
            "vector database", "vector search", "embedding", "rag", "retrieval augmented",
            "milvus", "chroma", "weaviate", "qdrant", "lancedb", "pgvector",
            "semantic search", "document retrieval", "knowledge retrieval",
            "ragflow", "anything-llm", "fastgpt", "docling"
        ],
        "weight": 0.9
    },
    "Memory & Knowledge": {
        "keywords": [
            "memory", "knowledge base", "memory system", "agent memory",
            "mem0", "memgpt", "letta", "second-me", "claude-mem",
            "long-term memory", "conversation memory", "context management",
            "knowledge management", "memory layer"
        ],
        "weight": 0.9
    },
    "MCP (Model Context Protocol)": {
        "keywords": [
            "mcp", "model context protocol", "mcp server", "mcp client",
            "context protocol", "mcp tools", "mcp integration"
        ],
        "weight": 1.0
    },
    "Browser Agent": {
        "keywords": [
            "browser agent", "web agent", "browser automation", "web browsing",
            "browser-use", "playwright", "selenium", "puppeteer", "web interaction",
            "browser control", "web scraping agent", "omniparser"
        ],
        "weight": 1.0
    },
    "Chat UI & Frontend": {
        "keywords": [
            "chat ui", "chat interface", "chatbot ui", "web ui", "frontend",
            "open-webui", "chatbox", "nextchat", "cherry studio", "lobe chat",
            "siyuan", "silly tavern", "text-generation-webui", "chat frontend",
            "conversation ui"
        ],
        "weight": 0.8
    },
    "Observability & Evaluation": {
        "keywords": [
            "observability", "monitoring", "evaluation", "llm evaluation", "tracing",
            "langfuse", "wandb", "phoenix", "opik", "mlflow", "promptfoo",
            "opencompass", "model evaluation", "prompt evaluation", "llm monitoring",
            "agent evaluation", "benchmark"
        ],
        "weight": 0.9
    },
    "LLM Gateway & Proxy": {
        "keywords": [
            "llm gateway", "api gateway", "proxy", "litellm", "one-api",
            "ai gateway", "model proxy", "api proxy", "unified api",
            "llm api", "model routing", "load balancing"
        ],
        "weight": 1.0
    },
    "Data Processing & ETL": {
        "keywords": [
            "data processing", "etl", "data pipeline", "airflow", "dagster",
            "prefect", "airbyte", "dbt", "data orchestration", "data integration",
            "unstructured", "document processing", "data extraction",
            "apache spark", "dask", "datachain"
        ],
        "weight": 0.7
    },
    "Data Lake & Storage": {
        "keywords": [
            "data lake", "data warehouse", "iceberg", "delta lake", "hudi",
            "paimon", "gravitino", "openmetadata", "datahub", "data catalog",
            "table format", "apache iceberg"
        ],
        "weight": 0.7
    },
    "Robotics & Embodied AI": {
        "keywords": [
            "robotics", "embodied ai", "robot", "lerobot", "genesis",
            "robot learning", "manipulation", "robotic arm", "embodied agent"
        ],
        "weight": 1.0
    },
    "Multi-Agent System": {
        "keywords": [
            "multi-agent", "multi agent", "agent team", "agent collaboration",
            "crewai", "autogen", "metagpt", "openmanus", "agent swarm",
            "hierarchical agent", "agent coordination"
        ],
        "weight": 1.0
    },
    "Search & Information Retrieval": {
        "keywords": [
            "search engine", "information retrieval", "perplexica", "searxng",
            "web search", "search api", "knowledge search"
        ],
        "weight": 0.9
    },
    "Tool & Integration Platform": {
        "keywords": [
            "tool integration", "api integration", "composio", "daytona",
            "integration platform", "tool calling", "function calling",
            "agent tools", "mcp servers"
        ],
        "weight": 0.9
    },
    "Speech & Voice AI": {
        "keywords": [
            "speech", "voice", "audio", "tts", "stt", "speech recognition",
            "livekit", "pipecat", "voice agent", "audio processing"
        ],
        "weight": 1.0
    },
    "Image & Video Generation": {
        "keywords": [
            "image generation", "video generation", "stable diffusion", "comfyui",
            "diffusion model", "image synthesis", "generative art",
            "automatic1111", "sdxl", "flux"
        ],
        "weight": 1.0
    },
    "Notebook & Development Environment": {
        "keywords": [
            "notebook", "jupyter", "marimo", "development environment",
            "ide", "code environment", "interactive computing"
        ],
        "weight": 0.8
    },
    "AI Infrastructure & Platform": {
        "keywords": [
            "ai infrastructure", "ml platform", "kubernetes", "ray", "spark",
            "distributed computing", "gpu management", "volcano", "1panel",
            "coder", "dev environment", "cloud native"
        ],
        "weight": 0.7
    },
    "LLM SDK & Library": {
        "keywords": [
            "sdk", "library", "client library", "llm sdk", "python sdk",
            "typescript sdk", "api client", "vercel ai", "llamaindex",
            "haystack", "dspy"
        ],
        "weight": 0.8
    },
    "GraphRAG & Knowledge Graph": {
        "keywords": [
            "graphrag", "knowledge graph", "graph rag", "neo4j", "graph database",
            "entity extraction", "relationship extraction"
        ],
        "weight": 1.0
    },
    "Deep Learning Core": {
        "keywords": [
            "deep learning", "neural network", "pytorch", "tensorflow", "jax",
            "paddle", "keras", "onnx", "mlx", "triton", "cuda", "nccl",
            "flashinfer", "cutlass", "transformer engine"
        ],
        "weight": 0.6
    },
    "Hardware & Edge AI": {
        "keywords": [
            "edge ai", "embedded ai", "esp32", "xiaozhi", "on-device",
            "mobile ai", "iot ai", "edge computing"
        ],
        "weight": 1.0
    },
    "A2A Protocol": {
        "keywords": [
            "a2a", "agent-to-agent", "agent communication", "agent protocol"
        ],
        "weight": 1.0
    },
    "Autonomous Agent": {
        "keywords": [
            "autonomous agent", "autogpt", "autonomous ai", "self-driving agent",
            "autonomous system", "agent autonomy"
        ],
        "weight": 1.0
    },
    "API & Backend Service": {
        "keywords": [
            "api server", "backend", "rest api", "graphql", "fastapi",
            "supabase", "elasticsearch", "opensearch", "vespa"
        ],
        "weight": 0.6
    }
}

def classify_project(proj):
    """Classify a project based on its content."""
    text = f"{proj['description']} {proj['topics']} {proj['readme'][:10000]}".lower()

    scores = {}
    for category, config in TAXONOMY.items():
        score = 0
        for keyword in config["keywords"]:
            # Count occurrences with word boundary matching
            pattern = r'\b' + re.escape(keyword.lower()) + r'\b'
            matches = len(re.findall(pattern, text))
            if matches > 0:
                score += matches * config["weight"]
        if score > 0:
            scores[category] = score

    # Sort by score descending
    sorted_categories = sorted(scores.items(), key=lambda x: -x[1])

    # Return top categories (score > 0.5)
    return [cat for cat, score in sorted_categories if score > 0.5]

# Load data
with open(INPUT_JSON) as f:
    projects = json.load(f)

# Load original CSV for openrank data
original_csv = f"{BASE}/data/agentic-ai-projects.csv"
openrank_data = {}
with open(original_csv, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        openrank_data[row["repo_name"]] = {
            "openrank_2603": row.get("openrank_2603", ""),
            "openrank_trend": row.get("openrank_trend", "")
        }

print(f"Classifying {len(projects)} projects...")

# Classify each project
results = []
for proj in projects:
    categories = classify_project(proj)
    # Get openrank data from original CSV
    or_data = openrank_data.get(proj["repo_name"], {})

    # If no categories found, mark as "Other"
    if not categories:
        categories = ["Other"]

    results.append({
        **proj,
        "openrank_2603": or_data.get("openrank_2603", ""),
        "openrank_trend": or_data.get("openrank_trend", ""),
        "categories": categories
    })

    print(f"{proj['repo_name']}: {', '.join(categories[:3])}{'...' if len(categories) > 3 else ''}")

# Write output CSV - preserve all original fields
fieldnames = ["repo_id", "repo_name", "description", "stars", "openrank_2603",
              "openrank_trend", "language", "created_at", "topics", "categories"]

with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
    writer.writeheader()
    for row in results:
        output_row = {
            "repo_id": row["repo_id"],
            "repo_name": row["repo_name"],
            "description": row["description"],
            "stars": row["stars"],
            "openrank_2603": row.get("openrank_2603", ""),
            "openrank_trend": row.get("openrank_trend", ""),
            "language": row["language"],
            "created_at": row["created_at"],
            "topics": row["topics"],
            "categories": "|".join(row["categories"])
        }
        writer.writerow(output_row)

print(f"\nSaved to {OUTPUT_CSV}")

# Print category statistics
print("\n=== Category Statistics ===")
category_counts = defaultdict(int)
for proj in results:
    for cat in proj["categories"]:
        category_counts[cat] += 1

for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
    print(f"{cat}: {count} projects")