"""Tests for the static validation rules engine."""
import pytest
from app.parser import parse_skill_md
from app.validators.static import RuleStatus, run_static_validation


def make_skill(name="my-skill", description="Does things. Use when user asks about things.", body="## Instructions\n\nDo stuff.", extra=""):
    fm = f"name: {name}\ndescription: {description}"
    if extra:
        fm += f"\n{extra}"
    return f"---\n{fm}\n---\n\n{body}"


def validate(content):
    doc = parse_skill_md(content)
    return run_static_validation(doc)


class TestNameRules:
    def test_valid_name_passes(self):
        report = validate(make_skill(name="my-skill"))
        failures = [f for f in report.findings if f.rule == "name.valid"]
        assert any(f.status == RuleStatus.PASS for f in failures)

    def test_missing_name_fails(self):
        content = "---\ndescription: Does things. Use when needed.\n---\nbody"
        doc = parse_skill_md(content)
        report = run_static_validation(doc)
        assert any(f.rule == "name.required" and f.status == RuleStatus.FAIL for f in report.findings)

    def test_name_too_long_fails(self):
        long_name = "a" * 65
        report = validate(make_skill(name=long_name))
        assert any(f.rule == "name.max-length" and f.status == RuleStatus.FAIL for f in report.findings)

    def test_name_exactly_64_passes(self):
        name = "a" * 64
        report = validate(make_skill(name=name))
        assert any(f.rule == "name.max-length" and f.status == RuleStatus.PASS for f in report.findings)

    def test_name_uppercase_fails(self):
        report = validate(make_skill(name="MySkill"))
        assert any(f.rule == "name.charset" and f.status == RuleStatus.FAIL for f in report.findings)

    def test_name_leading_hyphen_fails(self):
        report = validate(make_skill(name="-my-skill"))
        assert any(f.rule == "name.hyphen-boundaries" and f.status == RuleStatus.FAIL for f in report.findings)

    def test_name_trailing_hyphen_fails(self):
        report = validate(make_skill(name="my-skill-"))
        assert any(f.rule == "name.hyphen-boundaries" and f.status == RuleStatus.FAIL for f in report.findings)

    def test_name_consecutive_hyphens_fails(self):
        report = validate(make_skill(name="my--skill"))
        assert any(f.rule == "name.consecutive-hyphens" and f.status == RuleStatus.FAIL for f in report.findings)

    def test_name_with_spaces_fails(self):
        report = validate(make_skill(name="my skill"))
        assert any(f.rule == "name.charset" and f.status == RuleStatus.FAIL for f in report.findings)

    def test_name_with_digits_passes(self):
        report = validate(make_skill(name="skill-v2"))
        assert any(f.rule == "name.valid" and f.status == RuleStatus.PASS for f in report.findings)


class TestDescriptionRules:
    def test_missing_description_fails(self):
        content = "---\nname: my-skill\n---\nbody"
        doc = parse_skill_md(content)
        report = run_static_validation(doc)
        assert any(f.rule == "description.required" and f.status == RuleStatus.FAIL for f in report.findings)

    def test_empty_description_fails(self):
        content = "---\nname: my-skill\ndescription: ''\n---\nbody"
        doc = parse_skill_md(content)
        report = run_static_validation(doc)
        assert any(f.rule == "description.non-empty" and f.status == RuleStatus.FAIL for f in report.findings)

    def test_description_too_long_fails(self):
        long_desc = "a" * 1025
        report = validate(make_skill(description=long_desc))
        assert any(f.rule == "description.max-length" and f.status == RuleStatus.FAIL for f in report.findings)

    def test_description_exactly_1024_passes(self):
        desc = "a" * 1024
        report = validate(make_skill(description=desc))
        assert any(f.rule == "description.max-length" and f.status == RuleStatus.PASS for f in report.findings)

    def test_description_without_when_warns(self):
        report = validate(make_skill(description="This skill does stuff."))
        assert any(f.rule == "description.when-to-use" and f.status == RuleStatus.WARN for f in report.findings)

    def test_description_with_when_passes(self):
        report = validate(make_skill(description="Does things. Use when user asks about PDFs."))
        assert any(f.rule == "description.when-to-use" and f.status == RuleStatus.PASS for f in report.findings)


class TestCompatibilityRules:
    def test_no_compatibility_skipped(self):
        report = validate(make_skill())
        assert not any(f.rule.startswith("compatibility.") for f in report.findings)

    def test_valid_compatibility_passes(self):
        report = validate(make_skill(extra='compatibility: "Requires Python 3.11+"'))
        assert any(f.rule == "compatibility.valid" and f.status == RuleStatus.PASS for f in report.findings)

    def test_compatibility_too_long_fails(self):
        long_compat = "a" * 501
        report = validate(make_skill(extra=f'compatibility: "{long_compat}"'))
        assert any(f.rule == "compatibility.max-length" and f.status == RuleStatus.FAIL for f in report.findings)


class TestMetadataRules:
    def test_no_metadata_skipped(self):
        report = validate(make_skill())
        assert not any(f.rule.startswith("metadata.") for f in report.findings)

    def test_valid_metadata_passes(self):
        extra = "metadata:\n  author: test-org\n  version: '1.0'"
        report = validate(make_skill(extra=extra))
        assert any(f.rule == "metadata.valid" and f.status == RuleStatus.PASS for f in report.findings)

    def test_metadata_non_string_value_warns(self):
        extra = "metadata:\n  author: test-org\n  count: 42"
        report = validate(make_skill(extra=extra))
        assert any(f.rule == "metadata.string-values" and f.status == RuleStatus.WARN for f in report.findings)


class TestBodyRules:
    def test_empty_body_fails(self):
        content = "---\nname: my-skill\ndescription: Does things. Use when needed.\n---\n"
        doc = parse_skill_md(content)
        report = run_static_validation(doc)
        assert any(f.rule == "body.non-empty" and f.status == RuleStatus.FAIL for f in report.findings)

    def test_body_over_500_lines_warns(self):
        body = "\n".join([f"Step {i}: Do something." for i in range(502)])
        report = validate(make_skill(body=body))
        assert any(f.rule == "body.line-count" and f.status == RuleStatus.WARN for f in report.findings)

    def test_body_over_token_limit_warns(self):
        # ~5001 tokens × 4 chars = ~20004 chars
        body = "word " * 5100
        report = validate(make_skill(body=body))
        assert any(f.rule == "body.token-count" and f.status == RuleStatus.WARN for f in report.findings)


class TestUnknownFields:
    def test_unknown_field_warns(self):
        extra = "custom-field: some-value"
        report = validate(make_skill(extra=extra))
        assert any(f.rule == "frontmatter.unknown-fields" and f.status == RuleStatus.WARN for f in report.findings)


class TestOverallScore:
    def test_perfect_skill_high_score(self):
        report = validate(make_skill())
        assert report.score >= 85

    def test_multiple_failures_reduce_score(self):
        content = "---\ndescription: ''\n---\nbody"
        doc = parse_skill_md(content)
        report = run_static_validation(doc)
        assert report.score <= 70  # name.required + description.non-empty = 2 failures = 100 - 30 = 70

    def test_fail_status_when_failures_present(self):
        content = "---\ndescription: ''\n---\nbody"
        doc = parse_skill_md(content)
        report = run_static_validation(doc)
        assert report.overall_status == RuleStatus.FAIL


class TestScriptRules:
    def test_valid_script_extension_passes(self):
        content = """---
name: script-skill
description: Tests scripts. Use when running scripts.
---
Run `scripts/process.py` and `scripts/deploy.sh`.
"""
        doc = parse_skill_md(content)
        report = run_static_validation(doc)
        finding = next((f for f in report.findings if f.rule == "scripts.valid-format"), None)
        assert finding is not None
        assert finding.status == RuleStatus.PASS

    def test_invalid_script_extension_warns(self):
        content = """---
name: script-skill
description: Tests scripts. Use when running scripts.
---
Run `scripts/do_something` to execute.
"""
        doc = parse_skill_md(content)
        report = run_static_validation(doc)
        finding = next((f for f in report.findings if f.rule == "scripts.valid-format"), None)
        assert finding is not None
        assert finding.status == RuleStatus.WARN
        assert finding.fix_snippet == "scripts/do_something.py"

    def test_no_scripts_referenced_skips(self):
        content = """---
name: no-script-skill
description: No scripts here. Use when needed.
---
No scripts in this body.
"""
        doc = parse_skill_md(content)
        report = run_static_validation(doc)
        assert not any(f.rule == "scripts.valid-format" for f in report.findings)


class TestPackageReferenceRules:
    def test_all_references_exist_passes(self, tmp_path):
        skill_dir = tmp_path / "my-pkg"
        skill_dir.mkdir()
        (skill_dir / "references").mkdir()
        (skill_dir / "references" / "guide.md").write_text("# Guide\nSome non-empty content here.")

        content = """---
name: my-pkg
description: Tests package resolution. Use when testing.
---
Check [references/guide.md](references/guide.md) for info.
"""
        doc = parse_skill_md(content)
        report = run_static_validation(doc, base_dir=skill_dir)

        exists_finding = next((f for f in report.findings if f.rule == "references.file-exists"), None)
        assert exists_finding is not None
        assert exists_finding.status == RuleStatus.PASS

        not_empty_finding = next((f for f in report.findings if f.rule == "references.not-empty"), None)
        assert not_empty_finding is not None
        assert not_empty_finding.status == RuleStatus.PASS

    def test_missing_reference_fails(self, tmp_path):
        skill_dir = tmp_path / "missing-pkg"
        skill_dir.mkdir()

        content = """---
name: missing-pkg
description: Has missing file. Use when testing.
---
Check `references/nonexistent.md`.
"""
        doc = parse_skill_md(content)
        report = run_static_validation(doc, base_dir=skill_dir)

        finding = next((f for f in report.findings if f.rule == "references.file-exists"), None)
        assert finding is not None
        assert finding.status == RuleStatus.FAIL
        assert "references/nonexistent.md" in finding.message

    def test_path_traversal_fails(self, tmp_path):
        skill_dir = tmp_path / "traversal-pkg"
        skill_dir.mkdir()

        content = """---
name: traversal-pkg
description: Has path traversal. Use when testing.
---
Read [outside](../../outside.txt).
"""
        doc = parse_skill_md(content)
        report = run_static_validation(doc, base_dir=skill_dir)

        finding = next((f for f in report.findings if f.rule == "references.path-traversal"), None)
        assert finding is not None
        assert finding.status == RuleStatus.FAIL

    def test_empty_reference_file_warns(self, tmp_path):
        skill_dir = tmp_path / "empty-file-pkg"
        skill_dir.mkdir()
        (skill_dir / "references").mkdir()
        (skill_dir / "references" / "empty.md").write_text("")

        content = """---
name: empty-file-pkg
description: Has empty ref. Use when testing.
---
See `references/empty.md`.
"""
        doc = parse_skill_md(content)
        report = run_static_validation(doc, base_dir=skill_dir)

        finding = next((f for f in report.findings if f.rule == "references.not-empty"), None)
        assert finding is not None
        assert finding.status == RuleStatus.WARN
        assert "empty.md" in finding.message

    def test_peak_token_budget_warns_when_exceeded(self, tmp_path):
        skill_dir = tmp_path / "huge-pkg"
        skill_dir.mkdir()
        (skill_dir / "references").mkdir()
        # Create a file that is ~16,000 tokens (16,000 * 4 = 64,000 chars)
        (skill_dir / "references" / "huge.md").write_text("word " * 16000)

        content = """---
name: huge-pkg
description: Has huge ref. Use when testing.
---
See `references/huge.md`.
"""
        doc = parse_skill_md(content)
        report = run_static_validation(doc, base_dir=skill_dir)

        finding = next((f for f in report.findings if f.rule == "references.peak-token-budget"), None)
        assert finding is not None
        assert finding.status == RuleStatus.WARN

