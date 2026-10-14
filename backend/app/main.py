"""
AI Skill Validator — FastAPI Backend
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.parser import ParseError, parse_skill_md
from app.validators.static import run_static_validation
from app.validators.llm_judge import ProviderConfig, run_llm_validation

logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Skill Validator",
    description="Validates agentskills.io SKILL.md files via static rules and LLM-as-a-Judge.",
    version="1.0.0",
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


class LLMValidateRequest(BaseModel):
    content: str
    provider: str
    model: str
    api_key: str | None = None
    base_url: str | None = None


class ParseErrorResponse(BaseModel):
    error: str
    type: str = "parse_error"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "skill-validator"}


@app.post("/validate/static")
def validate_static(request: StaticValidateRequest):
    """
    Run static structural validation on SKILL.md content.
    Returns a ValidationReport with findings, status, and score.
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

    report = run_static_validation(doc)
    return {
        "findings": [f.model_dump() for f in report.findings],
        "overall_status": report.overall_status.value,
        "score": report.score,
        "skill_tokens": doc.token_estimate,
        "referenced_files": [ref.model_dump() for ref in doc.referenced_files],
    }


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
    return report.model_dump()
