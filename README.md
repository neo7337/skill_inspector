# Skill Inspector

A web-based validation studio and CLI companion for [agentskills.io](https://agentskills.io) format `SKILL.md` skill packages. Combines static structural validation, on-disk reference resolution, multi-tier context token economics, LLM-as-a-Judge behavioral evaluation, interactive auto-repair, synthetic red-teaming scenario generation, and execution trajectory profiling.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Install and Run](#install-and-run)
- [CLI Installation and Usage](#cli-installation-and-usage)
  - [Install CLI](#install-cli)
  - [CLI Commands](#cli-commands)
- [Backend API](#backend-api)
  - [Endpoints](#endpoints)
  - [Run Backend Tests](#run-backend-tests)
- [LLM Provider Setup](#llm-provider-setup)
  - [OpenAI](#openai)
  - [Anthropic](#anthropic)
  - [Google Gemini](#google-gemini)
  - [Ollama (local, no API key)](#ollama-local-no-api-key)
- [Static Validation Rules](#static-validation-rules)
- [LLM Evaluation Dimensions](#llm-evaluation-dimensions)
- [Project Structure & Page Tree](#project-structure--page-tree)
- [License](#license)

---

## Features

- **Live Split-Pane Studio** — Independent left (Editor) and right (Report Panels) scrolling panes with fixed header, status beacon, and token stats bar for distraction-free editing.
- **Skill Package Resolution Engine** — Attach on-disk package roots (`--base-dir`) to discover, resolve, and audit referenced scripts (`scripts/`), documentation (`references/`), and assets (`assets/`) with safe path-traversal prevention.
- **Multi-Tier Context Token Economics** — Live visual breakdown and gauge tracking Catalog footprint, Activation Body token count, and On-Demand Reference peak context footprint.
- **Slide-Over Reference File Drawer** — Inspect referenced file contents, line counts, sizes, and token footprints directly inside the UI with syntax highlighting.
- **Static Analysis & Reference Rules** — Enforces all agentskills.io spec rules plus package reference validation (`references.file-exists`, `references.path-traversal`, `references.not-empty`, and `references.peak-token-budget`).
- **Interactive "Diff & Repair" Studio** — Visual unified diffs and one-click ESLint-style `--fix` actions with CLI repair for frontmatter schemas, naming conventions, and AI instruction refactoring.
- **LLM-as-Judge with Package Grounding** — Behavioral evaluation across Description Quality, Instruction Clarity, Scope & Boundaries, and Token Efficiency, grounded in referenced file summaries.
- **Synthetic Scenario & Edge-Case Generator** — Automatically synthesizes 10–16 realistic scenarios across Happy Path, Adversarial, Tool Failure Modes, and Scope Boundaries, exportable to Pytest, JSON, and Markdown.
- **Trajectory & Step-Economy Profiler** — Analyzes agent execution traces against baselines, flagging redundant file reads, search loops, error ping-pongs, and context bloat with interactive timeline visualization.
- **Multi-Provider Support** — OpenAI, Anthropic Claude, Google Gemini, and Ollama (local models, no API key needed).
- **Skill Inspector CLI** — Full-featured command-line suite with `validate` (with rich package tables), `fix`, `profile`, and `generate-tests`.

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- (Optional) [Ollama](https://ollama.ai) for local LLM evaluation

### Install and Run

```bash
# Install all dependencies (backend virtualenv + frontend npm modules)
make install

# Configure frontend environment (optional / defaults)
cat <<EOF > frontend/.env.local
VITE_API_URL=http://localhost:8000
VITE_ENABLE_SYNTHETIC_TESTS=1
VITE_ENABLE_TRAJECTORY_PROFILER=1
EOF

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

---

## CLI Installation and Usage

### Install CLI

Install the latest version via the automated installer:
```bash
curl -sSL https://raw.githubusercontent.com/neo7337/skill_inspector/main/install/install.sh | bash
```

Or install a specific version (e.g., v1.1.0):
```bash
curl -sSL https://raw.githubusercontent.com/neo7337/skill_inspector/main/install/install.sh | bash -s -- v1.1.0
```

Alternatively, install directly from local repository:
```bash
pip install -e .
```

### CLI Commands

The companion CLI provides terminal validation, package inspection, auto-repair, trajectory profiling, and test generation:

```bash
# Validate SKILL.md with static structural checks
skill-inspector validate path/to/SKILL.md

# Validate with full package resolution & reference auditing
skill-inspector validate path/to/SKILL.md --base-dir path/to/skill-package

# Run static + LLM-as-a-Judge evaluation via CLI
skill-inspector validate path/to/SKILL.md --llm --provider openai --model gpt-4o

# Auto-fix frontmatter schema errors & show unified diff
skill-inspector fix path/to/SKILL.md --dry-run
skill-inspector fix path/to/SKILL.md --apply

# AI-assisted instruction refactoring via CLI
skill-inspector fix path/to/SKILL.md --llm --apply

# Profile execution trajectory trace against baseline steps
skill-inspector profile path/to/trace.json --baseline 3

# Generate synthetic test scenario matrix & export to Pytest
skill-inspector generate-tests path/to/SKILL.md --format pytest --output tests/test_skill.py
```

---

## Backend API

FastAPI server runs at `http://localhost:8000`. Interactive OpenAPI documentation is available at `http://localhost:8000/docs`.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check & service connectivity status |
| POST | `/skill/package` | Inspect & resolve package directory, audit referenced files, and calculate context token economics |
| POST | `/validate/static` | Run static structural validation and reference checks (supports optional `base_dir`) |
| POST | `/validate/llm` | Run LLM-as-Judge behavioral evaluation with package context |
| POST | `/repair/plan` | Generate deterministic repair plan and unified diff |
| POST | `/repair/apply` | Apply deterministic frontmatter & schema repairs |
| POST | `/repair/refactor-llm` | AI-assisted instruction refactoring |
| POST | `/scenarios/generate` | Synthesize edge-case test scenario suite |
| POST | `/scenarios/export` | Export test scenarios to Pytest, JSON, or Markdown |
| POST | `/profiler/trajectory` | Profile agent execution trace for redundancy, loops, bloat, and reference access audit |

### Run Backend Tests

```bash
make test
# or
cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v
```

**136 tests** covering parser, package resolution engine, static validator, repair engine, trajectory profiler, scenario generator, CLI commands, and API endpoints.

---

## LLM Provider Setup

### OpenAI

1. Get an API key from [platform.openai.com](https://platform.openai.com)
2. In the UI: select **OpenAI**, enter your key in the API Key field
3. Recommended model: `gpt-4o` or `gpt-4o-mini`

### Anthropic

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. In the UI: select **Anthropic**, enter your key
3. Recommended model: `claude-3-5-haiku-20241022` or `claude-3-5-sonnet-20241022`

### Google Gemini

1. Get an API key from [aistudio.google.com](https://aistudio.google.com)
2. In the UI: select **Google Gemini**, enter your key
3. Recommended model: `gemini-1.5-flash` or `gemini-1.5-pro`

### Ollama (local, no API key)

1. Install Ollama: `brew install ollama` or [download from ollama.ai](https://ollama.ai)
2. Pull a model: `ollama pull llama3`
3. Ollama runs automatically on `http://localhost:11434`
4. In the UI: select **Ollama (local)**, enter `llama3` as the model

> Note: Local models on CPU can take 15–60 seconds per evaluation.

---

## Static Validation Rules

All rules from the [agentskills.io specification](https://agentskills.io/specification) plus package reference integrity:

| Field / Dimension | Rule ID | Description | Severity |
|-------------------|---------|-------------|----------|
| `name` | `name.required` | Required frontmatter field | FAIL |
| `name` | `name.max-length` | Max 64 characters | FAIL |
| `name` | `name.format` | Lowercase alphanumeric + hyphens only | FAIL |
| `name` | `name.no-leading-trailing-hyphens` | No leading or trailing hyphens | FAIL |
| `name` | `name.no-consecutive-hyphens` | No consecutive hyphens (`--`) | FAIL |
| `description` | `description.required` | Required frontmatter field | FAIL |
| `description` | `description.max-length` | Max 1024 characters | FAIL |
| `description` | `description.when-to-use` | Should explicitly mention "when to use" / activation cues | WARN |
| `compatibility` | `compatibility.max-length` | Max 500 characters if present | FAIL |
| `metadata` | `metadata.type` | Must be a string→string key-value mapping | WARN |
| `allowed-tools` | `allowed-tools.type` | Must be a string if defined | FAIL |
| Body | `body.non-empty` | Body instructions must not be empty | FAIL |
| Body | `body.max-lines` | Recommended < 500 lines (prompt bloat prevention) | WARN |
| Body | `body.max-tokens` | Recommended < 5,000 tokens for body instructions | WARN |
| Frontmatter | `frontmatter.unknown-fields` | Unrecognized fields not defined in agentskills.io spec | WARN |
| References | `references.file-exists` | On-disk referenced file must exist within package root | FAIL |
| References | `references.path-traversal` | Path traversal (`../` or leading `/`) forbidden | FAIL |
| References | `references.not-empty` | Referenced file must contain content (non-zero bytes) | WARN |
| References | `references.peak-token-budget` | Recommended peak context footprint < 10,000 tokens | WARN |

---

## LLM Evaluation Dimensions

| Dimension | What it Checks |
|-----------|----------------|
| **Description Quality** | Does it state both WHAT the skill does AND WHEN to activate it? |
| **Instruction Clarity** | Are steps unambiguous, structured, and resilient for agentic execution? |
| **Scope & Boundaries** | Does it clearly define negative boundaries and what the skill should NOT do? |
| **Token Efficiency** | Is the body concise, or bloated with redundant text and repetitive instructions? |

Scores range from 0–100 per dimension: **Pass ≥ 75**, **Warn ≥ 50**, **Fail < 50**.

---

## Project Structure & Page Tree

```
skill_inspector/
├── README.md                           # Project documentation & quick start guide
├── CHANGELOG.md                        # Version release history & changelog
├── LICENSE                             # MIT License
├── Makefile                            # Dev workflow targets (dev, test, install, clean)
├── docker-compose.yml                  # Multi-container orchestration (FastAPI + Vite)
├── pyproject.toml                      # PEP 621 Python packaging & CLI console entry points
├── install/
│   └── install.sh                      # Standalone curl-pipe-bash automated CLI installer
├── tasks/
│   ├── design-tasks.md                 # UI/UX redesign roadmap and specifications
│   └── package-resolution-tasks.md     # Package resolution engine specifications
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── cli.py                      # CLI companion suite (typer + rich formatting)
│   │   ├── main.py                     # FastAPI server, endpoints, and CORS setup
│   │   ├── package.py                  # Package resolution engine & multi-tier context economics
│   │   ├── parser.py                   # YAML frontmatter parser & AST extraction
│   │   ├── profiler/                   # Trajectory & Step-Economy Profiler
│   │   │   ├── __init__.py
│   │   │   ├── engine.py               # Redundancy, loop, bloat & reference access detection
│   │   │   └── models.py               # Trace models, metric schemas & tool call types
│   │   ├── repair/                     # Diff & Repair Auto-Fixer
│   │   │   ├── __init__.py
│   │   │   ├── diff_utils.py           # Unified diff generator & patch utilities
│   │   │   ├── engine.py               # Deterministic schema & frontmatter auto-repair
│   │   │   └── llm_repair.py           # AI-assisted instruction refactoring
│   │   ├── scenarios/                  # Synthetic Scenario & Edge-Case Generator
│   │   │   ├── __init__.py
│   │   │   ├── exporter.py             # Pytest, JSON & Markdown format exporters
│   │   │   ├── generator.py            # Scenario synthesis pipeline & prompt builder
│   │   │   └── models.py               # Test scenario data models & difficulty tags
│   │   └── validators/
│   │       ├── __init__.py
│   │       ├── static.py               # Static spec rule engine + package reference checks
│   │       └── llm_judge.py            # Multi-provider LLM-as-a-Judge evaluation engine
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_api.py                 # FastAPI route & validation tests
│   │   ├── test_cli.py                 # Typer CLI invocation & argument tests
│   │   ├── test_llm_judge.py           # LLM judge provider config & evaluation tests
│   │   ├── test_new_endpoints.py       # Package & repair endpoint integration tests
│   │   ├── test_package.py             # Package resolution & context token tests
│   │   ├── test_parser.py              # Frontmatter parsing & error handling tests
│   │   ├── test_profiler.py            # Trajectory analysis & loop detection tests
│   │   ├── test_repair.py              # Repair plan generation & patch tests
│   │   ├── test_scenarios.py           # Scenario generation & export format tests
│   │   └── test_static_validator.py    # Static spec & reference rule unit tests
│   ├── pytest.ini                      # Pytest runner configuration
│   ├── pyproject.toml                  # Backend project metadata & dependencies
│   └── requirements.txt                # Pinned Python dependencies
├── frontend/
│   ├── index.html                      # Single-page application entry HTML
│   ├── package.json                    # Frontend dependencies & build scripts
│   ├── vite.config.ts                  # Vite configuration & dev server proxy
│   ├── tailwind.config.js              # Tailwind CSS theme extensions & glow utilities
│   ├── tsconfig.json                   # TypeScript compiler configuration
│   └── src/
│       ├── main.tsx                    # React DOM root entry point
│       ├── App.tsx                     # Main application layout, editor & studio tabs
│       ├── App.css                     # Global styles
│       ├── index.css                   # Tailwind layers, custom scrollbars & theme variables
│       ├── api.ts                      # Axios API client & backend contract definitions
│       ├── types.ts                    # Shared TypeScript types & validation interfaces
│       ├── examples.ts                 # Valid & broken sample skill templates
│       ├── hooks/
│       │   └── useTheme.ts             # Dark/light theme state & persistence hook
│       ├── utils/
│       │   └── applyFix.ts             # Deterministic AST fix applier for editor buffer
│       └── components/
│           ├── DiffViewer.tsx          # Interactive side-by-side & unified diff viewer
│           ├── LLMReport.tsx           # Multi-dimensional LLM Judge scorecard report
│           ├── ProviderConfigPanel.tsx # LLM provider modal & credentials config
│           ├── ReferenceFileDrawer.tsx # Slide-over syntax-highlighted reference file drawer
│           ├── ScenarioMatrix.tsx      # Synthetic scenario matrix & test exporter UI
│           ├── ScoreBar.tsx            # Animated SVG score gauge & progress bars
│           ├── SkillTokenBreakdown.tsx # Multi-tier context economics breakdown cards
│           ├── StaticReport.tsx        # Static rules report & one-click auto-fix actions
│           ├── StatusBadge.tsx         # Pass, Warn, and Fail status indicators
│           ├── ThemeToggle.tsx         # Smooth-rotating dark/light theme switch
│           └── TrajectoryReport.tsx    # Trace timeline, step waterfall & bottleneck diagnostics
└── samples/
    ├── sample-trace.json               # Sample agent execution trace for trajectory profiler
    ├── broken-skill/
    │   └── SKILL.md                    # Sample skill with intentional frontmatter & prompt flaws
    ├── broken-package/
    │   ├── SKILL.md                    # Package with missing file & 0-byte script references
    │   └── scripts/
    │       └── empty_file.py           # Zero-byte file demonstrating references.not-empty rule
    └── valid-skill/
        ├── SKILL.md                    # agentskills.io compliant PDF processing skill
        ├── references/
        │   └── guide.md                # Reference documentation demonstrating on-demand context
        └── scripts/
            ├── extract.py              # Sample Python extraction utility script
            ├── fill_form.py            # Sample PDF form-filling utility script
            └── merge.py                # Sample PDF merge utility script
```

---

## License

Licensed under the [MIT License](LICENSE).