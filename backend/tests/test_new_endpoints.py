"""Integration tests for new endpoints: repair, scenarios, and profiler."""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

VALID_SKILL = """\
---
name: my-skill
description: Extracts text from PDFs. Use when working with PDF documents.
---

## Instructions

Step 1: Open the PDF file.
Step 2: Extract text content.
"""

BROKEN_SKILL = """\
name: Bad_Name
description: No when
"""


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


class TestRepairEndpoints:
    async def test_repair_plan(self, client: AsyncClient):
        response = await client.post("/repair/plan", json={"content": BROKEN_SKILL})
        assert response.status_code == 200
        data = response.json()
        assert "diff" in data
        assert "repairs_applied" in data
        assert len(data["repairs_applied"]) >= 2

    async def test_repair_apply(self, client: AsyncClient):
        response = await client.post("/repair/apply", json={"content": BROKEN_SKILL})
        assert response.status_code == 200
        data = response.json()
        assert "repaired_content" in data
        assert "name: bad-name" in data["repaired_content"]


class TestScenarioEndpoints:
    async def test_scenarios_generate(self, client: AsyncClient):
        response = await client.post("/scenarios/generate", json={"content": VALID_SKILL, "count": 6})
        assert response.status_code == 200
        data = response.json()
        assert data["skill_name"] == "my-skill"
        assert len(data["scenarios"]) >= 4

    async def test_scenarios_export(self, client: AsyncClient):
        gen_resp = await client.post("/scenarios/generate", json={"content": VALID_SKILL, "count": 6})
        suite = gen_resp.json()

        exp_resp = await client.post("/scenarios/export", json={"suite": suite, "format": "pytest"})
        assert exp_resp.status_code == 200
        exp_data = exp_resp.json()
        assert "content" in exp_data
        assert "pytest" in exp_data["format"]


class TestProfilerEndpoint:
    async def test_profiler_trajectory(self, client: AsyncClient):
        trace = {
            "task_id": "test_endpoint",
            "skill_name": "my-skill",
            "baseline_step_budget": 2,
            "tool_calls": [
                {"step_index": 1, "tool_name": "view_file", "tool_arguments": {"path": "a.txt"}},
                {"step_index": 2, "tool_name": "view_file", "tool_arguments": {"path": "a.txt"}},
            ],
        }
        response = await client.post("/profiler/trajectory", json={"trace": trace, "skill_content": VALID_SKILL})
        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == "test_endpoint"
        assert len(data["redundancies"]) >= 1
