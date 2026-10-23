"""
AI Skill Validator — FastAPI Backend
"""
from __future__ import annotations

import logging

from typing import Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.parser import ParseError, parse_skill_md
from app.package import resolve_skill_package, SkillPackage
from app.validators.static import run_static_validation
from app.validators.llm_judge import ProviderConfig, run_llm_validation
from app.repair import DeterministicRepairEngine, LLMRepairEngine
from app.scenarios import ScenarioGenerator, export_as_json, export_as_pytest, export_as_markdown
from app.scenarios.models import ScenarioSuite
from app.profiler import TrajectoryProfiler, parse_trace_from_raw

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Skill Validator & Profiler",
    description="Validates, auto-fixes, profiles trajectories, and generates synthetic tests for agentskills.io SKILL.md files.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────

class StaticValidateRequest(BaseModel):
    content: str
    base_dir: str | None = None


class LLMValidateRequest(BaseModel):
    content: str
    provider: str
    model: str
    api_key: str | None = None
    base_url: str | None = None
    base_dir: str | None = None


class PackageInspectRequest(BaseModel):
    base_dir: str
    content: str | None = None


class ParseErrorResponse(BaseModel):
    error: str
    type: str = "parse_error"


class RepairPlanRequest(BaseModel):
    content: str


class RepairApplyRequest(BaseModel):
    content: str


class LLMRefactorRequest(BaseModel):
    content: str
    provider: str
    model: str
    api_key: str | None = None
    base_url: str | None = None
    issues: list[str] | None = None


class ScenarioGenerateRequest(BaseModel):
    content: str
    count: int = 12
    provider: str | None = None
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None


class ScenarioExportRequest(BaseModel):
    suite: dict[str, Any]
    format: str = "json"  # json | pytest | markdown


class TrajectoryProfileRequest(BaseModel):
    trace: Any  # JSON object, list of tool calls, or JSONL string
    skill_content: str | None = None
    baseline_steps: int | None = None
    base_dir: str | None = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "skill-validator"}


@app.post("/skill/package")
def inspect_package(request: PackageInspectRequest):
    """
    Inspect, discover, and resolve a skill package from a base directory.
    Audits all referenced files, calculates multi-tier context economy,
    and runs static validation.
    """
    if not request.base_dir or not request.base_dir.strip():
        raise HTTPException(status_code=422, detail="base_dir must not be empty.")

    try:
        pkg = resolve_skill_package(request.base_dir, skill_content=request.content)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except NotADirectoryError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except ParseError as exc:
        raise HTTPException(status_code=422, detail=f"Parse error: {exc.message}")
    except Exception as exc:
        logger.exception("Failed to inspect skill package: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

    report = run_static_validation(pkg.skill_doc, package=pkg)

    return {
        "base_dir": pkg.base_dir,
        "skill_doc": {
            "name": pkg.skill_doc.name,
            "description": pkg.skill_doc.description,
            "frontmatter": pkg.skill_doc.frontmatter,
            "body": pkg.skill_doc.body,
            "raw": pkg.skill_doc.raw,
        },
        "resolved_files": [r.model_dump() for r in pkg.resolved_files],
        "tokens": pkg.tokens.model_dump(),
        "missing_files_count": pkg.missing_files_count,
        "found_files_count": pkg.found_files_count,
        "validation": {
            "findings": [f.model_dump() for f in report.findings],
            "overall_status": report.overall_status.value,
            "score": report.score,
        },
    }


@app.post("/validate/static")
def validate_static(request: StaticValidateRequest):
    """
    Run static structural validation on SKILL.md content.
    Returns a ValidationReport with findings, status, and score.
    If base_dir is provided, also validates package file integrity and token budget.
    """
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=422, detail="Content must not be empty.")

    try:
        doc = parse_skill_md(request.content)
    except ParseError as exc:
        return {
            "error": exc.message,
            "type": "parse_error",
            "findings": [],
            "overall_status": "fail",
            "score": 0,
        }

    pkg = None
    if request.base_dir:
        try:
            pkg = resolve_skill_package(request.base_dir, skill_content=request.content)
        except Exception as exc:
            logger.warning("Failed to resolve package in /validate/static: %s", exc)

    report = run_static_validation(doc, base_dir=request.base_dir, package=pkg)
    response_data: dict[str, Any] = {
        "findings": [f.model_dump() for f in report.findings],
        "overall_status": report.overall_status.value,
        "score": report.score,
        "skill_tokens": doc.token_estimate,
        "referenced_files": [ref.model_dump() for ref in doc.referenced_files],
    }
    if pkg is not None:
        response_data["package"] = {
            "base_dir": pkg.base_dir,
            "resolved_files": [r.model_dump() for r in pkg.resolved_files],
            "tokens": pkg.tokens.model_dump(),
            "missing_files_count": pkg.missing_files_count,
            "found_files_count": pkg.found_files_count,
        }
    return response_data


@app.post("/validate/llm")
async def validate_llm(request: LLMValidateRequest):
    """
    Run LLM-as-a-Judge evaluation on SKILL.md content.
    Returns scores, findings, and suggestions per dimension.
    """
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=422, detail="Content must not be empty.")

    valid_providers = {"openai", "anthropic", "ollama"}
    if request.provider not in valid_providers:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid provider '{request.provider}'. Must be one of: {sorted(valid_providers)}",
        )

    if not request.model or not request.model.strip():
        raise HTTPException(status_code=422, detail="Model name must not be empty.")

    logger.info(
        "POST /validate/llm provider=%s model=%s content_chars=%d",
        request.provider,
        request.model.strip(),
        len(request.content),
    )

    try:
        doc = parse_skill_md(request.content)
    except ParseError as exc:
        logger.warning("POST /validate/llm parse error: %s", exc.message)
        raise HTTPException(status_code=422, detail=f"Parse error: {exc.message}")

    config = ProviderConfig(
        provider=request.provider,  # type: ignore[arg-type]
        model=request.model.strip(),
        api_key=request.api_key or None,
        base_url=request.base_url or None,
    )

    report = await run_llm_validation(doc, config)
    logger.info(
        "POST /validate/llm done provider=%s model=%s overall_status=%s overall_score=%s",
        report.provider_used,
        report.model_used,
        report.overall_status,
        report.overall_score,
    )
    result = report.model_dump()
    if request.base_dir:
        try:
            pkg = resolve_skill_package(request.base_dir, skill_content=request.content)
            result["package"] = {
                "base_dir": pkg.base_dir,
                "resolved_files": [r.model_dump() for r in pkg.resolved_files],
                "tokens": pkg.tokens.model_dump(),
                "missing_files_count": pkg.missing_files_count,
                "found_files_count": pkg.found_files_count,
            }
        except Exception as exc:
            logger.warning("Failed to resolve package in /validate/llm: %s", exc)
    return result


# ── Repair Endpoints ──────────────────────────────────────────────────────────

@app.post("/repair/plan")
def repair_plan(request: RepairPlanRequest):
    """
    Generate deterministic repair plan and unified diff without modifying original text.
    """
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=422, detail="Content must not be empty.")

    engine = DeterministicRepairEngine()
    result = engine.repair(request.content)
    return result.model_dump()


@app.post("/repair/apply")
def repair_apply(request: RepairApplyRequest):
    """
    Apply all deterministic repairs to SKILL.md content and return repaired content.
    """
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=422, detail="Content must not be empty.")

    engine = DeterministicRepairEngine()
    result = engine.repair(request.content)
    return {
        "repaired_content": result.repaired_content,
        "repairs_count": len(result.repairs_applied),
        "diff": result.diff.model_dump(),
    }


@app.post("/repair/refactor-llm")
async def repair_refactor_llm(request: LLMRefactorRequest):
    """
    Use LLM to refactor ambiguous instructions, add clear step structure and explicit boundaries.
    """
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=422, detail="Content must not be empty.")

    config = ProviderConfig(
        provider=request.provider,  # type: ignore[arg-type]
        model=request.model.strip(),
        api_key=request.api_key or None,
        base_url=request.base_url or None,
    )

    engine = LLMRepairEngine()
    result = await engine.refactor(request.content, config, issues=request.issues)
    return result.model_dump()


# ── Synthetic Scenario Endpoints ──────────────────────────────────────────────

@app.post("/scenarios/generate")
async def generate_scenarios(request: ScenarioGenerateRequest):
    """
    Generate synthetic test scenarios across Happy Path, Adversarial, Tool Failure, and Scope Boundaries.
    """
    if not request.content or not request.content.strip():
        raise HTTPException(status_code=422, detail="Content must not be empty.")

    config = None
    if request.provider and request.model:
        config = ProviderConfig(
            provider=request.provider,  # type: ignore[arg-type]
            model=request.model.strip(),
            api_key=request.api_key or None,
            base_url=request.base_url or None,
        )

    generator = ScenarioGenerator()
    suite = await generator.generate(request.content, config=config, count=request.count)
    return suite.model_dump()


@app.post("/scenarios/export")
def export_scenarios(request: ScenarioExportRequest):
    """
    Export scenario suite to JSON, Pytest test script, or Markdown.
    """
    try:
        suite = ScenarioSuite(**request.suite)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid scenario suite format: {exc}")

    fmt = request.format.lower().strip()
    if fmt == "pytest":
        content = export_as_pytest(suite)
        content_type = "text/x-python"
        filename = f"test_{suite.skill_name.replace('-', '_')}.py"
    elif fmt == "markdown":
        content = export_as_markdown(suite)
        content_type = "text/markdown"
        filename = f"test_matrix_{suite.skill_name}.md"
    else:
        content = export_as_json(suite)
        content_type = "application/json"
        filename = f"scenarios_{suite.skill_name}.json"

    return {
        "content": content,
        "format": fmt,
        "filename": filename,
        "content_type": content_type,
    }


# ── Trajectory Profiler Endpoint ──────────────────────────────────────────────

@app.post("/profiler/trajectory")
def profile_trajectory(request: TrajectoryProfileRequest):
    """
    Profile agent execution trajectory for redundant calls, step budget, and token economy.
    """
    if not request.trace:
        raise HTTPException(status_code=422, detail="Trace must not be empty.")

    profiler = TrajectoryProfiler()
    try:
        report = profiler.profile(
            request.trace,
            skill_content=request.skill_content,
            custom_baseline_steps=request.baseline_steps,
        )
        return report.model_dump()
    except Exception as exc:
        logger.exception("Failed to profile trajectory: %s", exc)
        raise HTTPException(status_code=422, detail=f"Trajectory parsing error: {exc}")
