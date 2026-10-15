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
