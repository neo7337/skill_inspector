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
