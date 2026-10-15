# Skill Inspector

A web-based validator for [agentskills.io](https://agentskills.io) format SKILL.md files. Combines static structural checks with LLM-as-a-Judge behavioral evaluation.

## Features

- **Live editor** — paste SKILL.md content and see static validation in real-time (< 350ms)
- **Static analysis** — all agentskills.io spec rules (name constraints, description quality, metadata types, body length)
- **LLM-as-Judge** — evaluates instruction clarity, description quality, scope definition, and token efficiency
- **Multi-provider** — OpenAI, Anthropic, or Ollama (local models, no API key needed)
- **Unified report** — scorecard + numeric scores + actionable fix suggestions per dimension

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- (Optional) [Ollama](https://ollama.ai) for local LLM evaluation

### Install and run

```bash
# Install all dependencies
make install

# Start backend + frontend (two terminals, or run separately)
make backend   # terminal 1 — http://localhost:8000
make frontend  # terminal 2 — http://localhost:5173
```

Or run both in one command (background):
```bash
make dev
```

Or run both using Docker:
```bash
# Start services in background
docker compose up -d

# View logs (frontend, backend, or both)
docker compose logs -f frontend
docker compose logs -f backend
docker compose logs -f

# Stop services
docker compose down
```

## Known issues with docker
- Unable to connect to locally running Ollama

## Backend

FastAPI server at `http://localhost:8000`.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/validate/static` | Static structural validation |
| POST | `/validate/llm` | LLM-as-Judge evaluation |

### Run tests

```bash
make test
# or
cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v
```

57 tests covering parser, static validator, API endpoints, and LLM judge unit tests.

## LLM Provider Setup

### OpenAI

1. Get an API key from [platform.openai.com](https://platform.openai.com)
2. In the UI: select **OpenAI**, enter your key in the API Key field
3. Recommended model: `gpt-4o` or `gpt-4o-mini`

### Anthropic

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. In the UI: select **Anthropic**, enter your key
3. Recommended model: `claude-3-5-haiku-20241022`

### Ollama (local, no API key)

1. Install Ollama: `brew install ollama` or [download from ollama.ai](https://ollama.ai)
2. Pull a model: `ollama pull llama3`
3. Ollama runs automatically on `http://localhost:11434`
4. In the UI: select **Ollama (local)**, enter `llama3` as the model

> Note: Local models on CPU can take 15–60 seconds per evaluation.

## Project Structure

```
skills-scope/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + endpoints
│   │   ├── parser.py            # SKILL.md YAML frontmatter parser
│   │   └── validators/
│   │       ├── static.py        # Static rules engine (all spec rules)
│   │       └── llm_judge.py     # LLM-as-Judge (OpenAI/Anthropic/Ollama)
│   ├── tests/
│   │   ├── test_parser.py
│   │   ├── test_static_validator.py
│   │   └── test_api.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx              # Main app with live editor + report tabs
│       ├── api.ts               # API client (axios)
│       ├── types.ts             # Shared TypeScript types
│       ├── examples.ts          # Sample SKILL.md content
│       └── components/
│           ├── StaticReport.tsx # Static analysis report UI
│           ├── LLMReport.tsx    # LLM analysis report UI
│           ├── ProviderConfigPanel.tsx  # LLM provider config UI
│           ├── StatusBadge.tsx  # pass/warn/fail badges
│           └── ScoreBar.tsx     # Score progress bars
├── samples/
│   ├── valid-skill/SKILL.md     # Example of a valid skill
│   └── broken-skill/SKILL.md   # Example with intentional errors
└── Makefile
```

## Static Validation Rules

All rules from the [agentskills.io specification](https://agentskills.io/specification):

| Field | Rule | Severity |
|-------|------|----------|
| `name` | Required | FAIL |
| `name` | Max 64 characters | FAIL |
| `name` | Lowercase alphanumeric + hyphens only | FAIL |
| `name` | No leading/trailing hyphens | FAIL |
| `name` | No consecutive hyphens | FAIL |
| `description` | Required | FAIL |
| `description` | Max 1024 characters | FAIL |
| `description` | Should mention "when to use" | WARN |
| `compatibility` | Max 500 characters if present | FAIL |
| `metadata` | Must be string→string mapping | WARN |
| `allowed-tools` | Must be a string | FAIL |
| Body | Must not be empty | FAIL |
| Body | Recommended < 500 lines | WARN |
| Body | Recommended < 5000 tokens | WARN |
| Unknown fields | Not part of spec | WARN |

## LLM Evaluation Dimensions

| Dimension | What it checks |
|-----------|----------------|
| Description Quality | Does it state both WHAT the skill does AND WHEN to use it? |
| Instruction Clarity | Are steps unambiguous and structured for reliable LLM execution? |
| Scope & Boundaries | Does it define what the skill should NOT do? |
| Token Efficiency | Is the body concise, or bloated with redundant content? |

Scores: 0–100 per dimension. Pass ≥ 75, Warn ≥ 50, Fail < 50.

> LLM scores may vary ±5–10 points between runs. Focus on the textual findings and suggestions rather than exact numbers.

# License

Licensed under [MIT License](LICENSE)