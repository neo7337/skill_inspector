# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.8] - 2026-11-08

### Added
- **Claude Code / plugin linting mode**: `skill-inspector validate --mode claude-code` and a `mode` field on the validation endpoints accept Claude Code-specific frontmatter fields and list-style `allowed-tools`; UI toggle included.
- **Sample skills and demo**: Claude Code sample skills (`samples/cc-*`), in-UI examples and a usage demo GIF.
- **Open-source community files**: `SECURITY.md`, `CONTRIBUTING.md` (including release steps), `CODE_OF_CONDUCT.md`, issue and pull request templates, and Dependabot configuration.
- **Backend README**: `backend/README.md` with backend-specific setup, run and test instructions; used as the package long description.

### Changed
- **Single-source versioning**: the version now lives only in `backend/app/__init__.py`; `backend/pyproject.toml` reads it dynamically and the FastAPI app reports it (previously a stale `1.1.0`).
- **Packaging**: removed the duplicate root `pyproject.toml`; CI builds from `backend/`. Added full package metadata, declared runtime dependencies (fastapi, uvicorn, python-dotenv, python-multipart) and set `requires-python >=3.11`.
- **CI**: dropped the unneeded global `packages: write` permission.
- **Lint**: applied Ruff auto-fixes across the backend.
- **README**: removed the unsupported Google Gemini provider, fixed the local install command (`pip install -e backend`), documented project endpoints and `--mode`, refreshed the project tree and added badges.
- `.gitignore` now excludes `.claude/`, `.env`, `.venv/`, `node_modules/` and `coverage.xml`.

### Fixed
- `samples/pdf-processing` is a real directory instead of a symlink, so it works on Windows checkouts and zip downloads.

---

## [0.0.5] - 2026-10-26

### Added
- **GitHub Actions CI/CD Workflow**: Implemented automated CI pipeline (`.github/workflows/ci.yml`) for pull requests and pushes to `main`:
  - **Step 1 (Static Checks)**: Parallel execution of backend Ruff syntax/critical checks and frontend Oxlint & TypeScript type checking (`tsc -b`).
  - **Step 2 (Automated Testing)**: Pytest test suite execution with test coverage tracking and XML report artifact upload.
  - **Step 3 (Parallel Builds)**: Parallel compilation of backend distribution packages (wheel & source distributions via `python -m build`) and frontend production bundle (`npm run build`).
- **Repository Hygiene & Ignore Rules**: Updated `.gitignore` to omit distribution directories (`dist/`, `build/`, `*.egg-info/`) and linter/test caches (`.ruff_cache/`, `.pytest_cache/`).

---

## [0.0.4] - 2026-10-24

### Added
- **Skill Package Resolution Engine**: Added `SkillPackage` abstraction, safe relative path resolution, directory traversal prevention, file kind classification (`script`, `reference`, `asset`), and on-demand file token counters.
- **Static Validation Package Reference Rules**: New validation rules verifying file existence (`references.file-exists`), path traversal prevention (`references.path-traversal`), empty file warning (`references.not-empty`), and peak context token footprint safety (`references.peak-token-budget`).
- **Package Inspection API & Schemas**: Added `POST /skill/package` inspection endpoint and updated `/validate/static` and `/validate/llm` with optional `base_dir` parameter.
- **CLI Package Companion**: Integrated `--base-dir` option into `skill-inspector validate` with Rich tabular output for referenced files, file kind, status, size, and token footprint.
- **LLM Judge Package Context**: Grounding LLM prompts with actual on-disk referenced file contents and summaries.
- **Trajectory Profiler Reference Access Audit**: Audit of declared vs accessed referenced files with coverage metrics and detection of redundant reference reads.
- **Frontend Base Directory Toolbar & File Drawer**: App toolbar for base directory configuration with live status pills (`Ready`, `Unresolved`, `Scanning`, `Idle`), multi-tier context cost gauge (Catalog, Activation Body, On-Demand References), and slide-over syntax-highlighted reference file drawer.
- **Real-World Sample Packages**: Created full `pdf-processing` (`samples/valid-skill`) package with Python scripts (`extract.py`, `fill_form.py`, `merge.py`) and reference documentation (`guide.md`), along with `samples/broken-package` for flaw demonstration.

---

## [0.0.3] - 2026-10-22

### Added
- **Modern Design System**: Rebuilt typography system (Plus Jakarta Sans, JetBrains Mono), custom HSL color palette, dark/light theme tokens, and glassmorphic card primitives.
- **Global App Shell & Navigation**: Header with active backend health beacon, responsive tab navigation, and animated toast notification system.
- **Markdown Editor Workspace**: Redesigned split-pane editor with live synchronized preview, sample skill loaders, word/line metric counters, and formatting helpers.
- **Static Rules & Linting Report**: Overhauled rule inspection cards with severity filter chips (Error, Warning, Info), code snippet references, and single-click auto-fix actions.
- **LLM Judge & Provider Config Panel**: Redesigned model provider modal with API key masking, provider selector (OpenAI, Anthropic Claude, Google Gemini, Ollama), and multi-criteria evaluation scorecards.
- **Interactive Diff & Auto-Fixer Studio**: Side-by-side / unified diff visualization with hunk inspection and direct buffer replacement.
- **Synthetic Scenario & Red-Teaming Studio**: Scenario matrix grid with risk/difficulty badges, test prompt generator, and JSON/CSV export actions.
- **Agent Trajectory Profiler**: Interactive trace timeline, tool utilization charts, step duration waterfall, and bottleneck diagnostics.

### Changed
- Refactored `ScoreBar` into an animated SVG gauge supporting dynamic grade tiering and smooth transitions.
- Enhanced `StatusBadge` with pulsating state indicators and accessible contrast.
- Polished `ThemeToggle` with seamless rotation micro-animations.

### Fixed
- Passed comprehensive theme contrast audit for WCAG compliance across both dark and light modes.
- Fixed layout overflowing and scroll clipping across multi-pane views on smaller viewports.

---

## [0.0.2] - 2026-10-21

### Added
- **Automated Installer**: Added standalone automated installation script (`install/install.sh`) for quick local and server deployment.
- **PyPI / PEP 621 Packaging**: Configured root and backend `pyproject.toml` specs enabling `pip install .` and console entry point `skill-inspector`.
- Dynamic version discovery via CLI (`skill-inspector --version`).

### Changed
- Updated documentation with installation guide and automated script instructions.
- Refined `.gitignore` to omit virtual environment paths and build distribution bundles.

### Fixed
- Fixed CLI path resolution issues when invoked outside of the backend module directory.
- Fixed script permission flags and path handling in `install.sh`.

---

## [0.0.1] - 2026-10-19

### Added
- **Core Static Validator**: AST and regex-based validation of `SKILL.md` specifications, verifying YAML frontmatter, parameter schemas, naming conventions, and common anti-patterns.
- **Multi-Provider LLM Judge**: Evaluation engine supporting OpenAI, Anthropic, Google Gemini, and local Ollama models with configurable judging prompts and rubrics.
- **Rule-Based & LLM Repair Engine**: Automatic generation of fixes for broken skill definitions and schema violations.
- **Synthetic Scenario Generator**: Automated generation of stress-test inputs and edge-case execution scenarios for agent skills.
- **Agent Trajectory Profiler**: Execution log ingestion engine calculating step counts, tool call distributions, and failure points.
- **Interactive Web UI**: React + Vite frontend providing live validation, Markdown editing, and visual reporting.
- **CLI Suite**: Command-line interface providing `validate`, `profile`, `generate-scenarios`, and `repair` commands.
- **Docker Support**: Containerized multi-stage Dockerfile and Docker Compose environment with Ollama network integration.
- **Initial Documentation & Samples**: Added project README, MIT license, and sample test skills (`valid-skill`, `broken-skill`, `sample-trace.json`).

[Unreleased]: https://github.com/neo7337/skill_inspector/compare/0.0.4...HEAD
[0.0.4]: https://github.com/neo7337/skill_inspector/compare/0.0.3...0.0.4
[0.0.3]: https://github.com/neo7337/skill_inspector/compare/0.0.2...0.0.3
[0.0.2]: https://github.com/neo7337/skill_inspector/compare/v0.0.1...0.0.2
[0.0.1]: https://github.com/neo7337/skill_inspector/releases/tag/v0.0.1
