"""Tests for Trajectory & Step-Economy Profiler."""
import pytest
from app.profiler import TrajectoryProfiler, parse_trace_from_raw


SAMPLE_TRACE = {
    "task_id": "test_01",
    "skill_name": "test-skill",
    "baseline_step_budget": 2,
    "tool_calls": [
        {
            "step_index": 1,
            "tool_name": "view_file",
            "tool_arguments": {"AbsolutePath": "/workspace/main.py"},
            "tokens_prompt": 100,
            "tokens_completion": 20,
        },
        {
            "step_index": 2,
            "tool_name": "grep_search",
            "tool_arguments": {"Query": "find_function"},
            "tokens_prompt": 100,
            "tokens_completion": 20,
        },
        {
            "step_index": 3,
            "tool_name": "grep_search",
            "tool_arguments": {"Query": "find function"},
            "tokens_prompt": 100,
            "tokens_completion": 20,
        },
        {
            "step_index": 4,
            "tool_name": "view_file",
            "tool_arguments": {"AbsolutePath": "/workspace/main.py"},
            "tokens_prompt": 100,
            "tokens_completion": 20,
        },
        {
            "step_index": 5,
            "tool_name": "run_command",
            "tool_arguments": {"CommandLine": "invalid_cmd"},
            "is_error": True,
            "tokens_prompt": 100,
            "tokens_completion": 20,
        },
        {
            "step_index": 6,
            "tool_name": "run_command",
            "tool_arguments": {"CommandLine": "invalid_cmd"},
            "is_error": True,
            "tokens_prompt": 100,
            "tokens_completion": 20,
        },
    ],
}


def test_parse_trace_from_raw():
    trace = parse_trace_from_raw(SAMPLE_TRACE)
    assert trace.task_id == "test_01"
    assert len(trace.tool_calls) == 6


def test_profiler_detects_subsumed_file_read():
    profiler = TrajectoryProfiler()
    report = profiler.profile(SAMPLE_TRACE, baseline_steps=2 if hasattr(profiler, "custom_baseline_steps") else None)

    kinds = [r.kind for r in report.redundancies]
    assert "subsumed_file_read" in kinds


def test_profiler_detects_search_loop():
    profiler = TrajectoryProfiler()
    report = profiler.profile(SAMPLE_TRACE)

    kinds = [r.kind for r in report.redundancies]
    assert "repeated_search" in kinds


def test_profiler_detects_error_ping_pong():
    profiler = TrajectoryProfiler()
    report = profiler.profile(SAMPLE_TRACE)

    kinds = [r.kind for r in report.redundancies]
    assert "error_ping_pong" in kinds


def test_profiler_step_budget_variance():
    profiler = TrajectoryProfiler()
    report = profiler.profile(SAMPLE_TRACE, custom_baseline_steps=2)

    assert report.step_budget.actual_steps == 6
    assert report.step_budget.baseline_steps == 2
    assert report.step_budget.variance_ratio == 3.0
    assert report.step_budget.status == "fail"


SKILL_WITH_REFS = """---
name: ref-audit-skill
description: Skill for testing reference access audit.
---
# Instructions
Read the [guide](references/guide.md) and execute `scripts/deploy.sh`.
See optional [schema](references/schema.json).
"""


def test_profiler_reference_coverage_and_unaccessed():
    trace = {
        "task_id": "ref_test_01",
        "tool_calls": [
            {
                "step_index": 1,
                "tool_name": "view_file",
                "tool_arguments": {"AbsolutePath": "references/guide.md"},
            },
        ],
    }
    profiler = TrajectoryProfiler()
    report = profiler.profile(trace, skill_content=SKILL_WITH_REFS)

    assert report.reference_audit is not None
    audit = report.reference_audit
    assert set(audit.declared_references) == {"references/guide.md", "scripts/deploy.sh", "references/schema.json"}
    assert audit.referenced_files_accessed == ["references/guide.md"]
    assert set(audit.unaccessed_references) == {"scripts/deploy.sh", "references/schema.json"}
    assert audit.coverage_ratio == 0.33
    assert audit.coverage_pct == 33.3
    assert audit.undeclared_accesses == []


def test_profiler_detects_undeclared_file_access():
    trace = {
        "task_id": "ref_test_02",
        "tool_calls": [
            {
                "step_index": 1,
                "tool_name": "view_file",
                "tool_arguments": {"AbsolutePath": "references/guide.md"},
            },
            {
                "step_index": 2,
                "tool_name": "read_file",
                "tool_arguments": {"path": "config/secret.env"},
            },
            {
                "step_index": 3,
                "tool_name": "view_file",
                "tool_arguments": {"AbsolutePath": "SKILL.md"},  # Self skill file should NOT be flagged as undeclared
            },
        ],
    }
    profiler = TrajectoryProfiler()
    report = profiler.profile(trace, skill_content=SKILL_WITH_REFS)

    assert report.reference_audit is not None
    audit = report.reference_audit
    assert "config/secret.env" in audit.undeclared_accesses
    assert "SKILL.md" not in audit.undeclared_accesses

    kinds = [r.kind for r in report.redundancies]
    assert "undeclared_file_access" in kinds
    undeclared_finding = next(r for r in report.redundancies if r.kind == "undeclared_file_access")
    assert undeclared_finding.step_indices == [2]
    assert "secret.env" in undeclared_finding.title


def test_profiler_detects_redundant_reference_reads():
    trace = {
        "task_id": "ref_test_03",
        "tool_calls": [
            {
                "step_index": 1,
                "tool_name": "view_file",
                "tool_arguments": {"AbsolutePath": "references/guide.md"},
            },
            {
                "step_index": 2,
                "tool_name": "grep_search",
                "tool_arguments": {"Query": "api endpoint"},
            },
            {
                "step_index": 3,
                "tool_name": "view_file",
                "tool_arguments": {"AbsolutePath": "references/guide.md"},
            },
        ],
    }
    profiler = TrajectoryProfiler()
    report = profiler.profile(trace, skill_content=SKILL_WITH_REFS)

    assert report.reference_audit is not None
    audit = report.reference_audit
    assert "references/guide.md" in audit.redundant_reference_reads

    kinds = [r.kind for r in report.redundancies]
    assert "redundant_reference_read" in kinds
    redundant_finding = next(r for r in report.redundancies if r.kind == "redundant_reference_read")
    assert redundant_finding.step_indices == [1, 3]


def test_profiler_script_command_line_matching():
    trace = {
        "task_id": "ref_test_04",
        "tool_calls": [
            {
                "step_index": 1,
                "tool_name": "run_command",
                "tool_arguments": {"CommandLine": "bash ./scripts/deploy.sh --prod"},
            },
        ],
    }
    profiler = TrajectoryProfiler()
    report = profiler.profile(trace, skill_content=SKILL_WITH_REFS)

    assert report.reference_audit is not None
    audit = report.reference_audit
    assert "scripts/deploy.sh" in audit.referenced_files_accessed
    assert audit.undeclared_accesses == []


def test_profiler_with_base_dir_resolution(tmp_path):
    skill_dir = tmp_path / "test-skill"
    skill_dir.mkdir()
    (skill_dir / "SKILL.md").write_text(SKILL_WITH_REFS)
    refs_dir = skill_dir / "references"
    refs_dir.mkdir()
    (refs_dir / "guide.md").write_text("# Guide Content")

    absolute_guide = str(refs_dir / "guide.md")
    trace = {
        "task_id": "ref_test_05",
        "tool_calls": [
            {
                "step_index": 1,
                "tool_name": "view_file",
                "tool_arguments": {"AbsolutePath": absolute_guide},
            },
        ],
    }
    profiler = TrajectoryProfiler()
    report = profiler.profile(trace, base_dir=str(skill_dir))

    assert report.reference_audit is not None
    audit = report.reference_audit
    assert "references/guide.md" in audit.referenced_files_accessed
    assert audit.undeclared_accesses == []

