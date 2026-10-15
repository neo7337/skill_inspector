"""
Data models for synthetic test scenarios and evaluation suites.
"""
from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


ScenarioCategory = Literal[
    "happy_path",
    "adversarial",
    "tool_failure",
    "scope_boundary",
]


class MockToolCall(BaseModel):
    tool_name: str
    expected_args_pattern: dict[str, Any] | None = None
    mock_status: Literal["success", "error", "timeout", "rate_limit", "not_found"] = "success"
    mock_output: Any = "OK"
    simulated_error_message: str | None = None


class TestScenario(BaseModel):
    id: str
    category: ScenarioCategory
    title: str
    description: str
    user_prompt: str
    mock_tools: list[MockToolCall] = Field(default_factory=list)
    expected_assertions: list[str] = Field(
        default_factory=list,
        description="Assertions the agent must satisfy, e.g. 'Handles error cleanly', 'Does not invoke shell'"
    )
    max_step_budget: int = 5


class ScenarioSuite(BaseModel):
    skill_name: str
    description: str
    total_scenarios: int
    categories_breakdown: dict[str, int]
    scenarios: list[TestScenario]
    provider_used: str | None = None
    model_used: str | None = None
