# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.0.3]: https://github.com/neo7337/skill_inspector/compare/0.0.2...0.0.3
[0.0.2]: https://github.com/neo7337/skill_inspector/compare/v0.0.1...0.0.2
[0.0.1]: https://github.com/neo7337/skill_inspector/releases/tag/v0.0.1
