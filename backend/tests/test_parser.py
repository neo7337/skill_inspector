"""Tests for the SKILL.md parser."""
import pytest
from app.parser import ParseError, SkillDocument, extract_file_references, parse_skill_md


VALID_MINIMAL = """\
---
name: my-skill
description: Extracts text from PDFs. Use when working with PDF documents.
---

## Instructions

Step 1: Do something useful.
"""

VALID_FULL = """\
---
name: pdf-processing
description: Extract PDF text, fill forms, merge files. Use when handling PDFs.
license: Apache-2.0
compatibility: Requires Python 3.11+
metadata:
  author: example-org
  version: "1.0"
allowed-tools: Bash(python:*) Read
---

## Instructions

Step 1: Open the PDF.
Step 2: Extract text.
"""


class TestParseSkillMd:
    def test_valid_minimal_skill(self):
        doc = parse_skill_md(VALID_MINIMAL)
        assert isinstance(doc, SkillDocument)
        assert doc.name == "my-skill"
        assert doc.description is not None
        assert "Extracts text" in doc.description
        assert "Step 1" in doc.body

    def test_valid_full_skill(self):
        doc = parse_skill_md(VALID_FULL)
        assert doc.name == "pdf-processing"
        assert doc.license == "Apache-2.0"
        assert doc.compatibility == "Requires Python 3.11+"
        assert doc.metadata_field == {"author": "example-org", "version": "1.0"}
        assert doc.allowed_tools == "Bash(python:*) Read"

    def test_raw_preserved(self):
        doc = parse_skill_md(VALID_MINIMAL)
        assert doc.raw == VALID_MINIMAL

    def test_empty_content_raises(self):
        with pytest.raises(ParseError, match="empty"):
            parse_skill_md("")

    def test_whitespace_only_raises(self):
        with pytest.raises(ParseError, match="empty"):
            parse_skill_md("   \n\n  ")

    def test_missing_frontmatter_raises(self):
        with pytest.raises(ParseError, match="frontmatter"):
            parse_skill_md("# Just markdown\n\nNo frontmatter here.")

    def test_malformed_yaml_raises(self):
        bad_yaml = """\
---
name: [unclosed
description: something
---
body
"""
        with pytest.raises(ParseError, match="Invalid YAML"):
            parse_skill_md(bad_yaml)

    def test_empty_frontmatter_block_raises(self):
        content = "---\n---\nbody here"
        with pytest.raises(ParseError, match="empty"):
            parse_skill_md(content)

    def test_non_mapping_frontmatter_raises(self):
        content = "---\n- item1\n- item2\n---\nbody"
        with pytest.raises(ParseError, match="mapping"):
            parse_skill_md(content)

    def test_body_line_count(self):
        doc = parse_skill_md(VALID_MINIMAL)
        assert doc.body_line_count > 0

    def test_estimated_token_count(self):
        doc = parse_skill_md(VALID_FULL)
        # Body "## Instructions\n\nStep 1: Open the PDF.\nStep 2: Extract text." is ~70 chars → ~17 tokens
        assert doc.estimated_token_count >= 1

    def test_token_estimate_known_lengths(self):
        content = (
            "---\n"
            "name: abcd\n"
            "description: efghijkl\n"
            "---\n"
            "12345678\n"
        )
        doc = parse_skill_md(content)
        # name=4, description=8 → catalog 12//4=3
        # body="12345678" → 8//4=2
        # raw=50 chars → 50//4=12
        assert doc.token_estimate == {"catalog": 3, "body": 2, "total": 12}
        assert doc.estimated_token_count == 2

    def test_token_estimate_ignores_non_string_catalog_fields(self):
        content = "---\nname: 42\ndescription: abcd\n---\nbody\n"
        doc = parse_skill_md(content)
        assert doc.token_estimate["catalog"] == len("abcd") // 4

    def test_body_empty_skill(self):
        content = "---\nname: my-skill\ndescription: Does things. Use when needed.\n---\n"
        doc = parse_skill_md(content)
        assert doc.body == ""
        assert doc.referenced_files == []


class TestExtractFileReferences:
    def test_markdown_link(self):
        refs = extract_file_references("See [the guide](references/guide.md) for details.")
        assert [r.model_dump() for r in refs] == [
            {"path": "references/guide.md", "kind": "reference"}
        ]

    def test_scripts_backtick_path(self):
        refs = extract_file_references("Run `scripts/extract.py` then continue.")
        assert [r.model_dump() for r in refs] == [
            {"path": "scripts/extract.py", "kind": "script"}
        ]

    def test_url_ignored(self):
        refs = extract_file_references("See [docs](https://example.com/guide.md) and [local](references/guide.md).")
        assert [r.path for r in refs] == ["references/guide.md"]

    def test_placeholder_ignored(self):
        refs = extract_file_references("Run `scripts/extract.py <file_path>` and ignore `<file_path>`.")
        assert [r.path for r in refs] == ["scripts/extract.py"]

    def test_duplicates_collapsed(self):
        body = (
            "See [one](references/guide.md) and [again](references/guide.md). "
            "Also `references/guide.md`."
        )
        refs = extract_file_references(body)
        assert [r.path for r in refs] == ["references/guide.md"]

    def test_classifies_assets_and_other(self):
        body = "Use [logo](assets/logo.png) and [notes](notes.txt)."
        refs = extract_file_references(body)
        assert [r.model_dump() for r in refs] == [
            {"path": "assets/logo.png", "kind": "asset"},
            {"path": "notes.txt", "kind": "other"},
        ]
