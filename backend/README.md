# Skill Inspector — Backend

FastAPI server and the `skill-inspector` CLI for validating, repairing and profiling
agent skills (`SKILL.md`). For the full project guide (web studio, CLI usage, validation
rules, LLM setup) see the [main README](https://github.com/neo7337/skill_inspector#readme).

## Local setup

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env        # optional: provider keys
```

Requires Python 3.11+.

## Run

```bash
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Interactive API docs: <http://localhost:8000/docs>.

To use the CLI from source: `.venv/bin/pip install -e .` then `skill-inspector --help`.

## Test

```bash
PYTHONPATH=. .venv/bin/pytest tests/ -v
```

## Environment variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | OpenAI provider key |
| `ANTHROPIC_API_KEY` | Anthropic provider key |
| `OLLAMA_BASE_URL` | Ollama endpoint (default `http://localhost:11434`) |

## Layout (`app/`)

| Path | Responsibility |
|------|----------------|
| `main.py` | FastAPI app and endpoints |
| `cli.py` | Typer CLI (`validate`, `fix`, `profile`, `generate-tests`, `config`) |
| `config.py` | `~/.skill-inspector/config.json` handling |
| `parser.py` | `SKILL.md` frontmatter parsing |
| `package.py`, `project.py` | Package/project resolution and token economics |
| `validators/` | Static rules and LLM-as-judge |
| `repair/` | Deterministic and LLM-assisted fixes |
| `scenarios/` | Synthetic test scenario generation/export |
| `profiler/` | Agent trajectory profiling |

## Versioning

The single source of truth is `__version__` in `app/__init__.py`; `pyproject.toml`
reads it at build time.
