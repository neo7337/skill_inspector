# Skill Inspector

A web-based validator for [agentskills.io](https://agentskills.io) format SKILL.md files. Combines static structural checks with LLM-as-a-Judge behavioral evaluation.

## Features

- **Live editor** — paste SKILL.md content and see static validation in real-time (< 350ms)
- **Static analysis** — all agentskills.io spec rules (name constraints, description quality, metadata types, body length)
- **Interactive "Diff & Repair" Auto-Fixer** — one-click ESLint-style `--fix` and CLI repair for frontmatter schemas, names, and AI instruction refactoring with unified visual diffs
- **Synthetic Scenario & Edge-Case Generator** — automatically synthesizes 10–16 realistic scenarios across Happy Path, Adversarial, Tool Failure Modes, and Scope Boundaries, exportable to Pytest, JSON, and Markdown
- **Trajectory & Step-Economy Profiler** — measures agent execution paths against baselines, flagging redundant file reads, search loops, error ping-pongs, and context bloat
- **LLM-as-Judge** — evaluates instruction clarity, description quality, scope definition, and token efficiency
- **Multi-provider** — OpenAI, Anthropic, or Ollama (local models, no API key needed)
- **Skill Inspector CLI** — command-line suite with `validate`, `fix`, `profile`, and `generate-tests`

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- (Optional) [Ollama](https://ollama.ai) for local LLM evaluation

### Install and run

```bash
# Install all dependencies
make install

# Create an .env.local file in frontend folder
VITE_API_URL=http://localhost:8000
VITE_ENABLE_SYNTHETIC_TESTS=0
VITE_ENABLE_TRAJECTORY_PROFILER=0

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

## CLI Usage

The companion CLI provides terminal validation, auto-repair, trajectory profiling, and test generation:

```bash
# Validate SKILL.md
python -m app.cli validate path/to/SKILL.md [--llm]

# Auto-fix frontmatter schema errors & show diff
python -m app.cli fix path/to/SKILL.md --dry-run
python -m app.cli fix path/to/SKILL.md --apply

# AI instruction refactoring via CLI
python -m app.cli fix path/to/SKILL.md --llm --apply

# Profile execution trajectory trace
python -m app.cli profile path/to/trace.json --baseline 3

# Generate synthetic test scenario matrix
python -m app.cli generate-tests path/to/SKILL.md --format pytest --output tests/test_skill.py
```

## Backend

FastAPI server at `http://localhost:8000`.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/validate/static` | Static structural validation |
| POST | `/validate/llm` | LLM-as-Judge evaluation |
| POST | `/repair/plan` | Generate repair plan and unified diff |
| POST | `/repair/apply` | Apply deterministic frontmatter & schema repairs |
| POST | `/repair/refactor-llm` | AI-assisted instruction refactoring |
| POST | `/scenarios/generate` | Synthesize edge-case test scenario suite |
| POST | `/scenarios/export` | Export test scenarios to Pytest, JSON, or Markdown |
| POST | `/profiler/trajectory` | Profile agent execution trace for redundancy & step economy |

### Run tests

```bash
make test
# or
cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v
```

89 tests covering parser, static validator, repair engine, trajectory profiler, scenario generator, and API endpoints.

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
skill_inspector/
├── backend/
│   ├── app/
│   │   ├── cli.py               # CLI companion (typer + rich)
│   │   ├── main.py              # FastAPI app + endpoints
│   │   ├── parser.py            # SKILL.md YAML frontmatter parser
│   │   ├── profiler/            # Trajectory & Step-Economy Profiler
│   │   │   ├── engine.py        # Redundancy, loop & bloat detection
│   │   │   └── models.py        # Trace & profile data models
│   │   ├── repair/              # Diff & Repair Auto-Fixer
│   │   │   ├── diff_utils.py    # Unified diff & patch generator
│   │   │   ├── engine.py        # Deterministic schema & frontmatter repair
│   │   │   └── llm_repair.py    # AI-assisted instruction refactoring
│   │   ├── scenarios/           # Synthetic Scenario & Edge-Case Generator
│   │   │   ├── exporter.py      # Pytest, JSON & Markdown exporters
│   │   │   ├── generator.py     # Scenario generation pipeline
│   │   │   └── models.py        # Test scenario data models
│   │   └── validators/
│   │       ├── static.py        # Static rules engine (all spec rules)
│   │       └── llm_judge.py     # LLM-as-Judge (OpenAI/Anthropic/Ollama)
│   ├── tests/
│   │   ├── test_api.py
│   │   ├── test_new_endpoints.py
│   │   ├── test_parser.py
│   │   ├── test_profiler.py
│   │   ├── test_repair.py
│   │   ├── test_scenarios.py
│   │   └── test_static_validator.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx              # Main app with live editor + 5 analysis tabs
│       ├── api.ts               # API client (axios)
│       ├── types.ts             # Shared TypeScript types
│       ├── examples.ts          # Sample SKILL.md content
│       └── components/
│           ├── DiffViewer.tsx   # Interactive Diff & Auto-Fixer UI
│           ├── LLMReport.tsx    # LLM analysis report UI
│           ├── ProviderConfigPanel.tsx  # LLM provider config UI
│           ├── ScenarioMatrix.tsx       # Synthetic scenario matrix UI
│           ├── ScoreBar.tsx     # Score progress bars
│           ├── StaticReport.tsx # Static analysis report UI
│           ├── StatusBadge.tsx  # pass/warn/fail badges
│           ├── ThemeToggle.tsx  # Dark/light theme switcher
│           └── TrajectoryReport.tsx     # Trajectory profiler & timeline UI
├── samples/
│   ├── broken-skill/SKILL.md    # Example with intentional errors
│   ├── sample-trace.json        # Example execution trace for profiler
│   └── valid-skill/SKILL.md     # Example of a valid skill
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