"""Tests for synthetic scenario generation and exporters."""
import pytest
from app.scenarios import ScenarioGenerator, export_as_json, export_as_pytest, export_as_markdown

SAMPLE_SKILL = """\
---
name: pdf-extractor
description: Extracts tables and text from PDF documents. Use when parsing PDFs.
allowed-tools: read_pdf, parse_table
---

## Instructions

Step 1: Open the PDF.
Step 2: Parse table rows.
Step 3: Return extracted JSON data.
"""


@pytest.mark.asyncio
async def test_scenario_generator_fallback():
    generator = ScenarioGenerator()
    suite = await generator.generate(SAMPLE_SKILL, config=None, count=8)

    assert suite.skill_name == "pdf-extractor"
    assert suite.total_scenarios >= 6
    assert "happy_path" in suite.categories_breakdown
    assert "adversarial" in suite.categories_breakdown
    assert "tool_failure" in suite.categories_breakdown
    assert "scope_boundary" in suite.categories_breakdown


@pytest.mark.asyncio
async def test_scenario_exporters():
    generator = ScenarioGenerator()
    suite = await generator.generate(SAMPLE_SKILL, config=None, count=8)

    json_out = export_as_json(suite)
    assert '"skill_name": "pdf-extractor"' in json_out

    pytest_out = export_as_pytest(suite)
    assert "async def test_pdf_extractor" in pytest_out
    assert "@pytest.mark.asyncio" in pytest_out

    md_out = export_as_markdown(suite)
    assert "# Test Scenario Suite: `pdf-extractor`" in md_out
    assert "[HAPPY_PATH]" in md_out
