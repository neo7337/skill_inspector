"""Tests for deterministic and diff repair engine."""
import pytest
from app.repair import DeterministicRepairEngine, compute_unified_diff, parse_diff_to_structured


BROKEN_FM = """\
name: My_Invalid--Skill Name!
description: Does some things without when.
metadata:
  count: 100
  flag: true
allowed-tools:
  - bash
  - python
"""

EMPTY_DOC = ""


def test_deterministic_repair_normalizes_name():
    engine = DeterministicRepairEngine()
    result = engine.repair(BROKEN_FM)

    assert "name: my-invalid-skill-name" in result.repaired_content
    assert result.diff.has_changes is True
    assert len(result.repairs_applied) >= 3


def test_deterministic_repair_metadata_strings():
    engine = DeterministicRepairEngine()
    result = engine.repair(BROKEN_FM)

    assert "count: '100'" in result.repaired_content or "count: \"100\"" in result.repaired_content
    assert "flag: 'True'" in result.repaired_content or "flag: 'true'" in result.repaired_content or "flag: true" in result.repaired_content


def test_deterministic_repair_allowed_tools():
    engine = DeterministicRepairEngine()
    result = engine.repair(BROKEN_FM)

    assert "allowed-tools: bash, python" in result.repaired_content


def test_deterministic_repair_empty_doc():
    engine = DeterministicRepairEngine()
    result = engine.repair(EMPTY_DOC)

    assert result.repaired_content.startswith("---")
    assert "name: custom-skill" in result.repaired_content
    assert "## Instructions" in result.repaired_content


def test_compute_unified_diff():
    orig = "line1\nline2\nline3\n"
    mod = "line1\nline2 modified\nline3\nline4\n"
    diff = compute_unified_diff(orig, mod)
    assert "-line2" in diff
    assert "+line2 modified" in diff
    assert "+line4" in diff


def test_parse_diff_to_structured():
    orig = "line1\nline2\n"
    mod = "line1\nline2_new\n"
    report = parse_diff_to_structured(orig, mod)
    assert report.has_changes is True
    assert report.additions_count == 1
    assert report.deletions_count == 1
    assert len(report.hunks) >= 1
