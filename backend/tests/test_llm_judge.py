"""Unit tests for LLM Judge package context integration and referenced files."""
import json
from pathlib import Path
from unittest.mock import AsyncMock, patch
import pytest

from app.parser import parse_skill_md
from app.package import ReferenceFileStatus, ResolvedFileReference, resolve_skill_package
from app.validators.llm_judge import (
    ProviderConfig,
    assemble_referenced_context,
    run_llm_validation,
    USER_PROMPT_TEMPLATE,
    USER_PROMPT_WITH_REFS_TEMPLATE,
)

SAMPLE_LLM_RESPONSE = json.dumps({
    "description_quality": {
        "score": 90,
        "status": "pass",
        "findings": ["Clear triggers"],
        "suggestions": [],
    },
    "instruction_clarity": {
        "score": 95,
        "status": "pass",
        "findings": ["Matches referenced extract.py arguments accurately"],
        "suggestions": [],
    },
    "scope_and_boundaries": {
        "score": 85,
        "status": "pass",
        "findings": ["Explicit limitations"],
        "suggestions": [],
    },
    "token_efficiency": {
        "score": 90,
        "status": "pass",
        "findings": ["Concise instructions delegating details to references"],
        "suggestions": [],
    },
})


def test_provider_config_include_references():
    config_default = ProviderConfig(provider="openai", model="gpt-4o")
    assert config_default.include_references is False

    config_with_refs = ProviderConfig(provider="openai", model="gpt-4o", include_references=True)
    assert config_with_refs.include_references is True


def test_assemble_referenced_context(tmp_path: Path):
    doc_file = tmp_path / "guide.md"
    doc_file.write_text("# API Reference\nDetails here.", encoding="utf-8")

    bin_file = tmp_path / "logo.png"
    bin_file.write_bytes(b"\x89PNG")

    resolved = [
        ResolvedFileReference(
            relative_path="references/guide.md",
            kind="reference",
            status=ReferenceFileStatus.FOUND,
            absolute_path=str(doc_file),
            is_binary=False,
            token_count=10,
        ),
        ResolvedFileReference(
            relative_path="assets/logo.png",
            kind="asset",
            status=ReferenceFileStatus.FOUND,
            absolute_path=str(bin_file),
            is_binary=True,
            token_count=0,
        ),
        ResolvedFileReference(
            relative_path="references/missing.md",
            kind="reference",
            status=ReferenceFileStatus.MISSING,
            token_count=0,
        ),
    ]

    xml = assemble_referenced_context(resolved)
    assert '<file path="references/guide.md" kind="reference">' in xml
    assert "# API Reference" in xml
    assert "logo.png" not in xml  # Binary files are omitted
    assert "missing.md" not in xml  # Missing files are omitted


def test_assemble_referenced_context_truncates_large_files(tmp_path: Path):
    huge_file = tmp_path / "huge.md"
    huge_file.write_text("A" * 20000, encoding="utf-8")

    resolved = [
        ResolvedFileReference(
            relative_path="references/huge.md",
            kind="reference",
            status=ReferenceFileStatus.FOUND,
            absolute_path=str(huge_file),
            is_binary=False,
            token_count=5000,
        )
    ]

    xml = assemble_referenced_context(resolved, max_chars_per_file=100)
    assert "[content truncated for token budget]" in xml
    assert len(xml) < 500


@pytest.mark.asyncio
async def test_run_llm_validation_injects_references_into_prompt(tmp_path: Path):
    skill_dir = tmp_path / "skill"
    skill_dir.mkdir()
    (skill_dir / "scripts").mkdir()
    (skill_dir / "scripts" / "extract.py").write_text("def extract(): pass", encoding="utf-8")

    skill_content = """---
name: sample-skill
description: Extracts text. Use when handling text.
---
Run `scripts/extract.py`.
"""
    doc = parse_skill_md(skill_content)
    config = ProviderConfig(provider="openai", model="gpt-4o", include_references=True)

    with patch("app.validators.llm_judge._invoke_provider", new_callable=AsyncMock) as mock_invoke:
        mock_invoke.return_value = SAMPLE_LLM_RESPONSE

        report = await run_llm_validation(doc, config, base_dir=skill_dir)

        assert mock_invoke.called
        messages = mock_invoke.call_args[0][1]
        user_msg = next(m["content"] for m in messages if m["role"] == "user")
        assert "<referenced_files>" in user_msg
        assert 'path="scripts/extract.py"' in user_msg
        assert "def extract(): pass" in user_msg

        assert report.overall_score == 90
        assert report.package_tokens is not None
        assert len(report.resolved_files) == 1
        assert report.resolved_files[0].status == ReferenceFileStatus.FOUND


@pytest.mark.asyncio
async def test_run_llm_validation_without_include_references(tmp_path: Path):
    skill_dir = tmp_path / "skill2"
    skill_dir.mkdir()
    (skill_dir / "scripts").mkdir()
    (skill_dir / "scripts" / "extract.py").write_text("def extract(): pass", encoding="utf-8")

    doc = parse_skill_md("""---
name: sample-skill
description: Extracts text. Use when handling text.
---
Run `scripts/extract.py`.
""")
    # include_references is False by default
    config = ProviderConfig(provider="openai", model="gpt-4o", include_references=False)

    with patch("app.validators.llm_judge._invoke_provider", new_callable=AsyncMock) as mock_invoke:
        mock_invoke.return_value = SAMPLE_LLM_RESPONSE

        report = await run_llm_validation(doc, config, base_dir=skill_dir)

        assert mock_invoke.called
        messages = mock_invoke.call_args[0][1]
        user_msg = next(m["content"] for m in messages if m["role"] == "user")
        assert "<referenced_files>" not in user_msg

        # Package tokens and files are still attached for metadata
        assert report.package_tokens is not None
        assert len(report.resolved_files) == 1


@pytest.mark.asyncio
async def test_run_llm_validation_error_preserves_package_metadata(tmp_path: Path):
    skill_dir = tmp_path / "error-skill"
    skill_dir.mkdir()
    (skill_dir / "scripts").mkdir()
    (skill_dir / "scripts" / "extract.py").write_text("def extract(): pass", encoding="utf-8")

    doc = parse_skill_md("""---
name: sample-skill
description: Extracts text. Use when handling text.
---
Run `scripts/extract.py`.
""")
    config = ProviderConfig(provider="openai", model="gpt-4o")

    with patch("app.validators.llm_judge._invoke_provider", new_callable=AsyncMock) as mock_invoke:
        mock_invoke.side_effect = RuntimeError("API key invalid")

        report = await run_llm_validation(doc, config, base_dir=skill_dir)
        assert report.overall_status == "fail"
        assert report.overall_score == 0
        assert report.package_tokens is not None
        assert len(report.resolved_files) == 1
