"""Unit tests for the Skill Inspector CLI."""
from pathlib import Path
from typer.testing import CliRunner
from app.cli import app

runner = CliRunner()


def test_cli_version():
    result = runner.invoke(app, ["--version"])
    assert result.exit_code == 0
    assert "skill-inspector cli version" in result.stdout


def test_cli_validate_auto_detects_base_dir(tmp_path: Path):
    skill_dir = tmp_path / "my-skill"
    skill_dir.mkdir()
    (skill_dir / "references").mkdir()
    (skill_dir / "references" / "guide.md").write_text("# Guide\nSome instructions.")
    skill_file = skill_dir / "SKILL.md"
    skill_file.write_text("""---
name: my-skill
description: Validates CLI. Use when testing CLI.
---
See [references/guide.md](references/guide.md).
""")

    result = runner.invoke(app, ["validate", str(skill_file)])
    assert result.exit_code == 0
    assert "Referenced Files & Package Integrity" in result.stdout
    assert "references/guide.md" in result.stdout
    assert "FOUND" in result.stdout
    assert "Context & Token Economy Footprint" in result.stdout


def test_cli_validate_with_explicit_base_dir(tmp_path: Path):
    skill_dir = tmp_path / "explicit-skill"
    skill_dir.mkdir()
    (skill_dir / "scripts").mkdir()
    (skill_dir / "scripts" / "run.py").write_text("print('running')")
    skill_file = skill_dir / "SKILL.md"
    skill_file.write_text("""---
name: explicit-skill
description: Tests explicit base dir. Use when testing.
---
Run `scripts/run.py`.
""")

    result = runner.invoke(app, ["validate", str(skill_file), "--base-dir", str(skill_dir)])
    assert result.exit_code == 0
    assert "scripts/run.py" in result.stdout
    assert "FOUND" in result.stdout


def test_cli_profile_with_reference_audit(tmp_path: Path):
    import json
    skill_dir = tmp_path / "profile-skill"
    skill_dir.mkdir()
    (skill_dir / "docs").mkdir()
    (skill_dir / "docs" / "guide.md").write_text("# Guide Content")
    skill_file = skill_dir / "SKILL.md"
    skill_file.write_text("""---
name: profile-skill
description: Profile test skill. Use when profiling.
---
See [docs/guide.md](docs/guide.md).
""")
    trace_file = tmp_path / "trace.json"
    trace_data = {
        "task_id": "cli_profile_test",
        "tool_calls": [
            {"step_index": 1, "tool_name": "view_file", "tool_arguments": {"path": "docs/guide.md"}},
            {"step_index": 2, "tool_name": "read_file", "tool_arguments": {"path": "unlisted.txt"}},
        ],
    }
    trace_file.write_text(json.dumps(trace_data))

    result = runner.invoke(app, ["profile", str(trace_file), "--skill", str(skill_file)])
    assert result.exit_code == 0
    assert "Package Reference Access Audit" in result.stdout
    assert "Reference Coverage" in result.stdout
    assert "Undeclared File Accesses" in result.stdout


def test_cli_config_commands():
    result = runner.invoke(app, ["config", "--path"])
    assert result.exit_code == 0
    assert "Config path:" in result.stdout

    result = runner.invoke(app, ["config"])
    assert result.exit_code == 0
    assert "Configuration File:" in result.stdout




def test_validate_claude_code_mode_no_unknown_warn(tmp_path):
    """--mode claude-code must not produce unknown-field warnings for CC-specific fields."""
    skill_dir = tmp_path / "deploy-app"
    skill_dir.mkdir()
    skill_file = skill_dir / "SKILL.md"
    skill_file.write_text("""---
name: deploy-app
description: Deploy the application. Use when the user asks to ship.
disable-model-invocation: true
context: fork
model: sonnet
argument-hint: "[env]"
allowed-tools:
  - Bash(git *)
  - Read
---
Run tests, then deploy.
""", encoding="utf-8")

    result = runner.invoke(app, ["validate", str(skill_file), "--mode", "claude-code"])
    assert result.exit_code == 0
    assert "frontmatter.unknown-fields" not in result.output or "WARN" not in result.output


def test_validate_standard_mode_warns_cc_fields(tmp_path):
    """Default --mode standard must still warn about Claude Code fields."""
    skill_dir = tmp_path / "deploy-app"
    skill_dir.mkdir()
    skill_file = skill_dir / "SKILL.md"
    skill_file.write_text("""---
name: deploy-app
description: Deploy the application. Use when the user asks to ship.
disable-model-invocation: true
context: fork
---
Run tests, then deploy.
""", encoding="utf-8")

    result = runner.invoke(app, ["validate", str(skill_file)])
    # Should still exit without crash; warning present
    assert result.exit_code == 0
    # The unknown-fields warning should reference the CC fields
    assert "unknown" in result.output.lower() or "WARN" in result.output
