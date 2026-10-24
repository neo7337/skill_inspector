"""
Data models for the Trajectory & Step-Economy Profiler.
"""
from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class ToolCallRecord(BaseModel):
    step_index: int
    tool_name: str
    tool_arguments: dict[str, Any] = Field(default_factory=dict)
    tool_output: Any = None
    is_error: bool = False
    tokens_prompt: int = 0
    tokens_completion: int = 0
    duration_ms: float = 0.0


class TrajectoryTrace(BaseModel):
    task_id: str = "task_01"
    task_description: str = ""
    skill_name: str = "custom-skill"
    skill_content: str | None = None
    tool_calls: list[ToolCallRecord] = Field(default_factory=list)
    final_status: Literal["success", "failure", "timeout", "aborted"] = "success"
    baseline_step_budget: int | None = None  # Expected optimal steps (e.g. 3)


RedundancyKind = Literal[
    "repeated_search",
    "subsumed_file_read",
    "error_ping_pong",
    "no_op_mutation",
    "duplicate_tool_call",
    "undeclared_file_access",
    "redundant_reference_read",
]


class RedundantCallFinding(BaseModel):
    step_indices: list[int]
    kind: RedundancyKind
    severity: Literal["warn", "fail"]
    title: str
    detail: str
    suggested_skill_fix: str


class StepBudgetAnalysis(BaseModel):
    actual_steps: int
    baseline_steps: int
    variance_ratio: float  # actual / baseline
    status: Literal["pass", "warn", "fail"]
    message: str


class TokenEfficiencyAnalysis(BaseModel):
    total_tokens: int
    redundant_tokens: int
    skill_context_tokens: int
    bloat_ratio: float
    score: int  # 0-100
    message: str


class ReferenceAccessAudit(BaseModel):
    declared_references: list[str] = Field(default_factory=list)
    accessed_files: list[str] = Field(default_factory=list)
    referenced_files_accessed: list[str] = Field(default_factory=list)
    unaccessed_references: list[str] = Field(default_factory=list)
    undeclared_accesses: list[str] = Field(default_factory=list)
    coverage_ratio: float = 1.0  # 0.0 - 1.0
    coverage_pct: float = 100.0  # 0.0 - 100.0
    redundant_reference_reads: list[str] = Field(default_factory=list)
    summary: str = ""


class TrajectoryProfileReport(BaseModel):
    task_id: str
    skill_name: str
    overall_efficiency_score: int  # 0-100
    status: Literal["pass", "warn", "fail"]
    step_budget: StepBudgetAnalysis
    token_efficiency: TokenEfficiencyAnalysis
    redundancies: list[RedundantCallFinding]
    timeline_summary: list[dict[str, Any]]
    reference_audit: ReferenceAccessAudit | None = None

