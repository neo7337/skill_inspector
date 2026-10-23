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
