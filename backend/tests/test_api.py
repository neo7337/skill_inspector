"""API integration tests and LLM judge unit tests."""
import json
import pytest
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch

from app.main import app


VALID_SKILL = """\
---
name: my-skill
description: Extracts text from PDFs. Use when working with PDF documents.
---

## Instructions

Step 1: Open the PDF file.
Step 2: Extract text content.
Step 3: Return results to user.
"""

BROKEN_SKILL = """\
---
description: Some description
---
body content
"""

SKILL_WITH_REFS = """\
---
name: my-skill
description: Extracts text from PDFs. Use when working with PDF documents.
---

See [the guide](references/guide.md) for details.
Run `scripts/extract.py`.
"""


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


class TestHealthEndpoint:
    async def test_health_returns_ok(self, client: AsyncClient):
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


class TestStaticValidateEndpoint:
    async def test_valid_skill_returns_200(self, client: AsyncClient):
        from app.parser import parse_skill_md

        response = await client.post("/validate/static", json={"content": VALID_SKILL})
        assert response.status_code == 200
        data = response.json()
        assert "findings" in data
        assert "overall_status" in data
        assert "score" in data
        assert data["skill_tokens"] == parse_skill_md(VALID_SKILL).token_estimate
        assert data["referenced_files"] == []

    async def test_static_includes_referenced_files(self, client: AsyncClient):
        response = await client.post("/validate/static", json={"content": SKILL_WITH_REFS})
        assert response.status_code == 200
        assert response.json()["referenced_files"] == [
            {"path": "references/guide.md", "kind": "reference"},
            {"path": "scripts/extract.py", "kind": "script"},
        ]

    async def test_empty_content_returns_422(self, client: AsyncClient):
        response = await client.post("/validate/static", json={"content": ""})
        assert response.status_code == 422

    async def test_missing_content_field_returns_422(self, client: AsyncClient):
        response = await client.post("/validate/static", json={})
        assert response.status_code == 422

    async def test_broken_skill_returns_parse_error(self, client: AsyncClient):
        response = await client.post("/validate/static", json={"content": "no frontmatter here"})
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "parse_error"
        assert data["overall_status"] == "fail"

    async def test_missing_name_finds_failure(self, client: AsyncClient):
        response = await client.post("/validate/static", json={"content": BROKEN_SKILL})
        assert response.status_code == 200
        data = response.json()
        assert data["overall_status"] == "fail"
        rules = [f["rule"] for f in data["findings"]]
        assert "name.required" in rules

    async def test_static_with_base_dir_includes_package_details(self, client: AsyncClient, tmp_path):
        skill_dir = tmp_path / "pkg"
        skill_dir.mkdir()
        (skill_dir / "references").mkdir()
        (skill_dir / "scripts").mkdir()
        (skill_dir / "references" / "guide.md").write_text("# Guide\nSome non-empty content here.")
        (skill_dir / "scripts" / "extract.py").write_text("print('extract')")

        response = await client.post(
            "/validate/static",
            json={"content": SKILL_WITH_REFS, "base_dir": str(skill_dir)},
        )
        assert response.status_code == 200
        data = response.json()
        assert "package" in data
        assert data["package"]["found_files_count"] == 2
        assert data["package"]["missing_files_count"] == 0
        assert data["package"]["tokens"]["total_on_demand_tokens"] > 0
        assert data["package"]["tokens"]["budget_status"] == "within_budget"


class TestLLMValidateEndpoint:
    async def test_missing_provider_returns_422(self, client: AsyncClient):
        response = await client.post("/validate/llm", json={"content": VALID_SKILL, "model": "gpt-4o"})
        assert response.status_code == 422

    async def test_invalid_provider_returns_422(self, client: AsyncClient):
        response = await client.post("/validate/llm", json={
            "content": VALID_SKILL,
            "provider": "unknown-provider",
            "model": "some-model",
        })
        assert response.status_code == 422

    async def test_empty_content_returns_422(self, client: AsyncClient):
        response = await client.post("/validate/llm", json={
            "content": "",
            "provider": "openai",
            "model": "gpt-4o",
        })
        assert response.status_code == 422

    async def test_ollama_no_api_key_accepted(self, client: AsyncClient):
        """Ollama config without API key should be structurally valid (no 422)."""
        from app.validators.llm_judge import LLMReport, LLMDimensionResult

        mock_dim = LLMDimensionResult(score=80, status="pass", findings=["Good"], suggestions=[])
        mock_report = LLMReport(
            description_quality=mock_dim,
            instruction_clarity=mock_dim,
            scope_and_boundaries=mock_dim,
            token_efficiency=mock_dim,
            overall_score=80,
            overall_status="pass",
            model_used="ollama/llama3",
            provider_used="ollama",
        )

        with patch("app.main.run_llm_validation", new=AsyncMock(return_value=mock_report)):
            response = await client.post("/validate/llm", json={
                "content": VALID_SKILL,
                "provider": "ollama",
                "model": "llama3",
            })
        assert response.status_code == 200

    async def test_llm_response_structure(self, client: AsyncClient):
        """Mocked LLM call returns correct report structure."""
        from app.validators.llm_judge import LLMReport, LLMDimensionResult

        mock_dim = LLMDimensionResult(score=80, status="pass", findings=["Good"], suggestions=[])
        mock_report = LLMReport(
            description_quality=mock_dim,
            instruction_clarity=mock_dim,
            scope_and_boundaries=mock_dim,
            token_efficiency=mock_dim,
            overall_score=80,
            overall_status="pass",
            model_used="gpt-4o",
            provider_used="openai",
        )

        from app.validators import llm_judge
        with patch("app.main.run_llm_validation", new=AsyncMock(return_value=mock_report)):
            response = await client.post("/validate/llm", json={
                "content": VALID_SKILL,
                "provider": "openai",
                "model": "gpt-4o",
                "api_key": "sk-test-key",
            })

        assert response.status_code == 200
        data = response.json()
        assert "description_quality" in data
        assert "instruction_clarity" in data
        assert "scope_and_boundaries" in data
        assert "token_efficiency" in data
        assert "overall_score" in data
        assert data["overall_status"] == "pass"


JUDGE_JSON = json.dumps({
    "description_quality": {"score": 80, "status": "pass", "findings": [], "suggestions": []},
    "instruction_clarity": {"score": 80, "status": "pass", "findings": [], "suggestions": []},
    "scope_and_boundaries": {"score": 80, "status": "pass", "findings": [], "suggestions": []},
    "token_efficiency": {"score": 80, "status": "pass", "findings": [], "suggestions": []},
})


class TestLLMSkillTokens:
    async def test_llm_skill_tokens_match_parsed_document(self, client: AsyncClient):
        from app.parser import parse_skill_md

        expected = parse_skill_md(VALID_SKILL).token_estimate
        with patch("app.validators.llm_judge._call_openai", new=AsyncMock(return_value=JUDGE_JSON)):
            response = await client.post("/validate/llm", json={
                "content": VALID_SKILL,
                "provider": "openai",
                "model": "gpt-4o",
                "api_key": "sk-test-key",
            })

        assert response.status_code == 200
        assert response.json()["skill_tokens"] == expected

    async def test_llm_skill_tokens_present_when_provider_fails(self, client: AsyncClient):
        from app.parser import parse_skill_md

        expected = parse_skill_md(VALID_SKILL).token_estimate
        with patch(
            "app.validators.llm_judge._call_openai",
            new=AsyncMock(side_effect=ConnectionError("provider down")),
        ):
            response = await client.post("/validate/llm", json={
                "content": VALID_SKILL,
                "provider": "openai",
                "model": "gpt-4o",
                "api_key": "sk-test-key",
            })

        assert response.status_code == 200
        data = response.json()
        assert data["skill_tokens"] == expected
        assert data["overall_status"] == "fail"

    async def test_provider_failure_is_logged(self, client: AsyncClient, caplog):
        import logging

        with caplog.at_level(logging.ERROR, logger="app.validators.llm_judge"):
            with patch(
                "app.validators.llm_judge._call_openai",
                new=AsyncMock(side_effect=ConnectionError("provider down")),
            ):
                await client.post("/validate/llm", json={
                    "content": VALID_SKILL,
                    "provider": "openai",
                    "model": "gpt-4o",
                    "api_key": "sk-test-key",
                })

        assert any("provider call failed" in rec.message for rec in caplog.records)

    async def test_parse_failure_is_logged(self, client: AsyncClient, caplog):
        import logging

        with caplog.at_level(logging.ERROR, logger="app.validators.llm_judge"):
            with patch(
                "app.validators.llm_judge._call_openai",
                new=AsyncMock(return_value="not valid json"),
            ):
                await client.post("/validate/llm", json={
                    "content": VALID_SKILL,
                    "provider": "openai",
                    "model": "gpt-4o",
                    "api_key": "sk-test-key",
                })

        assert any("parse failed" in rec.message for rec in caplog.records)

    async def test_retries_once_on_truncated_json(self, client: AsyncClient):
        truncated = (
            '{"description_quality": {"score": 95, "status": "pass", "findings": ["The description'
        )
        mock = AsyncMock(side_effect=[truncated, JUDGE_JSON])
        with patch("app.validators.llm_judge._call_openai", new=mock):
            response = await client.post("/validate/llm", json={
                "content": VALID_SKILL,
                "provider": "openai",
                "model": "gpt-4o",
                "api_key": "sk-test-key",
            })

        assert response.status_code == 200
        assert response.json()["overall_status"] == "pass"
        assert mock.await_count == 2


class TestLLMJudgeUnit:
    async def test_parse_valid_json_response(self):
        """_parse_llm_response parses valid JSON into LLMReport."""
        from app.validators.llm_judge import _parse_llm_response

        raw = json.dumps({
            "description_quality": {"score": 85, "status": "pass", "findings": ["Good desc"], "suggestions": []},
            "instruction_clarity": {"score": 72, "status": "warn", "findings": ["Step 2 vague"], "suggestions": ["Be more specific"]},
            "scope_and_boundaries": {"score": 60, "status": "warn", "findings": ["No limits defined"], "suggestions": ["Add what it won't do"]},
            "token_efficiency": {"score": 90, "status": "pass", "findings": ["Very concise"], "suggestions": []},
        })
        report = _parse_llm_response(raw, "gpt-4o", "openai")
        assert report.description_quality.score == 85
        assert report.instruction_clarity.status == "warn"
        assert report.overall_score == round((85 + 72 + 60 + 90) / 4)

    async def test_parse_json_in_code_fence(self):
        """_parse_llm_response handles JSON wrapped in markdown code blocks."""
        from app.validators.llm_judge import _parse_llm_response

        inner = json.dumps({
            "description_quality": {"score": 80, "status": "pass", "findings": [], "suggestions": []},
            "instruction_clarity": {"score": 80, "status": "pass", "findings": [], "suggestions": []},
            "scope_and_boundaries": {"score": 80, "status": "pass", "findings": [], "suggestions": []},
            "token_efficiency": {"score": 80, "status": "pass", "findings": [], "suggestions": []},
        })
        raw = f"```json\n{inner}\n```"
        report = _parse_llm_response(raw, "gpt-4o", "openai")
        assert report.overall_score == 80

    async def test_parse_invalid_json_raises(self):
        """_parse_llm_response raises ValueError on invalid JSON."""
        from app.validators.llm_judge import _parse_llm_response

        with pytest.raises(ValueError, match="invalid JSON"):
            _parse_llm_response("this is not json", "gpt-4o", "openai")

    async def test_parse_missing_dimension_raises(self):
        """_parse_llm_response raises ValueError when a dimension is missing."""
        from app.validators.llm_judge import _parse_llm_response

        raw = json.dumps({
            "description_quality": {"score": 80, "status": "pass", "findings": [], "suggestions": []},
            # Missing other 3 dimensions
        })
        with pytest.raises(ValueError, match="missing dimension"):
            _parse_llm_response(raw, "gpt-4o", "openai")

    async def test_make_error_report_structure(self):
        """_make_error_report returns a structured fail report."""
        from app.validators.llm_judge import _make_error_report

        report = _make_error_report("Connection refused", "ollama/llama3", "ollama")
        assert report.overall_status == "fail"
        assert report.overall_score == 0
        assert "Connection refused" in report.description_quality.findings[0]


class TestSkillPackageEndpoint:
    async def test_inspect_package_success(self, client: AsyncClient, tmp_path):
        pkg_dir = tmp_path / "pdf-skill"
        pkg_dir.mkdir()
        (pkg_dir / "references").mkdir()
        (pkg_dir / "references" / "doc.md").write_text("# PDF Spec\nDetails on extraction.")
        (pkg_dir / "SKILL.md").write_text("""---
name: pdf-tool
description: Inspects PDF tools. Use when handling PDFs.
---
See [references/doc.md](references/doc.md).
""")

        response = await client.post("/skill/package", json={"base_dir": str(pkg_dir)})
        assert response.status_code == 200
        data = response.json()
        assert data["base_dir"] == str(pkg_dir.resolve())
        assert data["skill_doc"]["name"] == "pdf-tool"
        assert data["found_files_count"] == 1
        assert data["missing_files_count"] == 0
        assert len(data["resolved_files"]) == 1
        assert data["resolved_files"][0]["status"] == "found"
        assert "tokens" in data
        assert "validation" in data
        assert data["validation"]["score"] >= 80

    async def test_inspect_package_content_override(self, client: AsyncClient, tmp_path):
        pkg_dir = tmp_path / "override-skill"
        pkg_dir.mkdir()

        override = """---
name: custom-override
description: Overridden skill. Use when testing overrides.
---
Body content without references.
"""
        response = await client.post(
            "/skill/package",
            json={"base_dir": str(pkg_dir), "content": override},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["skill_doc"]["name"] == "custom-override"

    async def test_inspect_package_not_found(self, client: AsyncClient, tmp_path):
        response = await client.post(
            "/skill/package",
            json={"base_dir": str(tmp_path / "nonexistent-dir")},
        )
        assert response.status_code == 404

    async def test_inspect_package_empty_base_dir(self, client: AsyncClient):
        response = await client.post("/skill/package", json={"base_dir": "   "})
        assert response.status_code == 422
