"""
LLM-as-a-Judge validator for agentskills.io SKILL.md files.

Evaluates 4 dimensions using a configurable LLM provider:
1. Description Quality — does it state what AND when?
2. Instruction Clarity — are steps unambiguous?
3. Scope & Boundaries — does it state what it won't do?
4. Token Efficiency — is the body concise or bloated?

Supports OpenAI, Anthropic (via openai-compatible client), and Ollama (local).
"""
from __future__ import annotations

import json
import logging
import re
import time
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.parser import FileReference, SkillDocument

logger = logging.getLogger(__name__)

MAX_OUTPUT_TOKENS = 4000


# ── Provider config ───────────────────────────────────────────────────────────

class ProviderConfig(BaseModel):
    provider: Literal["openai", "anthropic", "ollama"]
    model: str
    api_key: str | None = None
    base_url: str | None = None  # Used for Ollama, e.g. http://localhost:11434


# ── Report models ─────────────────────────────────────────────────────────────

class LLMSuggestion(BaseModel):
    text: str                         # human-readable recommendation
    example: Optional[str] = None     # optional rewritten snippet


class LLMDimensionResult(BaseModel):
    score: int = Field(ge=0, le=100)
    status: Literal["pass", "warn", "fail"]
    findings: list[str]
    suggestions: list[LLMSuggestion]  # was list[str]

    @field_validator("suggestions", mode="before")
    @classmethod
    def normalize_suggestions(cls, v):
        if not isinstance(v, list):
            return []
        normalized = []
        for item in v:
            if isinstance(item, str):
                normalized.append(LLMSuggestion(text=item))
            elif isinstance(item, dict):
                normalized.append(LLMSuggestion(**item))
            elif isinstance(item, LLMSuggestion):
                normalized.append(item)
            else:
                normalized.append(LLMSuggestion(text=str(item)))
        return normalized


class SkillTokenEstimate(BaseModel):
    """Approximate skill context cost. 1 token ≈ 4 characters."""

    catalog: int = 0  # name + description
    body: int = 0  # instructions loaded on activation
    total: int = 0  # full SKILL.md file


class LLMReport(BaseModel):
    description_quality: LLMDimensionResult
    instruction_clarity: LLMDimensionResult
    scope_and_boundaries: LLMDimensionResult
    token_efficiency: LLMDimensionResult
    overall_score: int = Field(ge=0, le=100)
    overall_status: Literal["pass", "warn", "fail"]
    model_used: str
    provider_used: str
    skill_tokens: SkillTokenEstimate = Field(default_factory=SkillTokenEstimate)
    referenced_files: list[FileReference] = Field(default_factory=list)


# ── Prompt engineering ────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert evaluator of AI agent skill files (SKILL.md format from agentskills.io).

You will be given the content of a SKILL.md file delimited by <skill_content> tags.
Your job is to evaluate it across 4 dimensions and return ONLY valid JSON.

Evaluation dimensions:

1. **description_quality** (0-100): Does the description clearly state BOTH what the skill does AND when to use it?
   - 90-100: Crystal clear what + when, includes trigger keywords
   - 70-89: States what it does, loosely implies when to use
   - 50-69: States what but unclear when to use
   - 0-49: Vague, missing, or too short to be useful

2. **instruction_clarity** (0-100): Are the body instructions clear, unambiguous, and structured for an LLM to follow reliably?
   - 90-100: Step-by-step, no ambiguous pronouns, clear expected outcomes
   - 70-89: Mostly clear with minor ambiguities
   - 50-69: Some steps are vague or could be misinterpreted
   - 0-49: Instructions are unclear, contradictory, or absent

3. **scope_and_boundaries** (0-100): Does the skill define what it should NOT do or its limitations?
   - 90-100: Explicitly states limitations, edge cases, out-of-scope tasks
   - 70-89: Implies some boundaries
   - 50-69: Boundaries exist but are not explicit
   - 0-49: No mention of scope limits or edge cases

4. **token_efficiency** (0-100): Is the body content concise and necessary, or bloated with redundant/irrelevant content?
   - 90-100: Every sentence adds value, no repetition
   - 70-89: Mostly concise with minor redundancy
   - 50-69: Some padding or repetition that should be cut
   - 0-49: Significantly bloated, repetitive, or off-topic sections

Status rules:
- score >= 75: "pass"
- score >= 50: "warn"
- score < 50: "fail"

Output rules:
- Return ONLY valid JSON. No markdown, no explanation, no trailing text.
- Complete the entire JSON object. Never truncate a string or omit a closing brace.
- Each finding is one short sentence (max 25 words) describing a specific observation.
- Each suggestion has a "text" field (max 25 words) and an optional "example" field with a ready-to-paste snippet.
- At most 2 findings and 2 suggestions per dimension.
- If there are no suggestions, use [] — never write "None needed".

You MUST respond with ONLY this JSON structure:
{
  "description_quality": {
    "score": <0-100>,
    "status": "<pass|warn|fail>",
    "findings": ["<specific observation about what was found>"],
    "suggestions": [
      {
        "text": "<specific actionable recommendation>",
        "example": "<optional: ready-to-paste rewrite or null>"
      }
    ]
  },
  "instruction_clarity": {
    "score": <0-100>,
    "status": "<pass|warn|fail>",
    "findings": ["<specific observation>"],
    "suggestions": [
      { "text": "<specific actionable recommendation>", "example": "<optional rewrite or null>" }
    ]
  },
  "scope_and_boundaries": {
    "score": <0-100>,
    "status": "<pass|warn|fail>",
    "findings": ["<specific observation>"],
    "suggestions": [
      { "text": "<specific actionable recommendation>", "example": "<optional rewrite or null>" }
    ]
  },
  "token_efficiency": {
    "score": <0-100>,
    "status": "<pass|warn|fail>",
    "findings": ["<specific observation>"],
    "suggestions": [
      { "text": "<specific actionable recommendation>", "example": "<optional rewrite or null>" }
    ]
  }
}"""

USER_PROMPT_TEMPLATE = """Please evaluate this SKILL.md content:

<skill_content>
{skill_content}
</skill_content>

Return only the JSON evaluation."""


# ── LLM client helpers ────────────────────────────────────────────────────────

def _get_openai_client(config: ProviderConfig):
    """Build an AsyncOpenAI client for OpenAI or Ollama (OpenAI-compatible)."""
    from openai import AsyncOpenAI

    kwargs: dict = {}
    if config.api_key:
        kwargs["api_key"] = config.api_key
    else:
        kwargs["api_key"] = "ollama"  # Ollama requires a non-empty key

    if config.provider == "ollama":
        base_url = config.base_url or "http://localhost:11434"
        kwargs["base_url"] = f"{base_url.rstrip('/')}/v1"

    return AsyncOpenAI(**kwargs)


async def _call_openai(config: ProviderConfig, messages: list[dict]) -> str:
    """Call OpenAI or Ollama using the OpenAI SDK."""
    client = _get_openai_client(config)
    logger.info(
        "Calling chat.completions provider=%s model=%s base_url=%s max_tokens=%d",
        config.provider,
        config.model,
        getattr(client, "base_url", None) or "(sdk default)",
        MAX_OUTPUT_TOKENS,
    )
    kwargs: dict = {
        "model": config.model,
        "messages": messages,
        "temperature": 0.1,
        "max_tokens": MAX_OUTPUT_TOKENS,
        "response_format": {"type": "json_object"},
    }
    try:
        response = await client.chat.completions.create(**kwargs)
    except Exception as exc:
        if "response_format" not in str(exc).lower() and "json_object" not in str(exc).lower():
            raise
        logger.warning("response_format unsupported, retrying without it: %s", exc)
        kwargs.pop("response_format")
        response = await client.chat.completions.create(**kwargs)

    choice = response.choices[0]
    logger.info("LLM completion finish_reason=%s", getattr(choice, "finish_reason", None))
    return choice.message.content or ""


async def _call_anthropic(config: ProviderConfig, messages: list[dict]) -> str:
    """Call Anthropic API using the anthropic SDK."""
    import anthropic

    system_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
    user_msgs = [m for m in messages if m["role"] != "system"]

    client = anthropic.AsyncAnthropic(api_key=config.api_key or "")
    logger.info("Calling Anthropic messages provider=%s model=%s", config.provider, config.model)
    response = await client.messages.create(
        model=config.model,
        max_tokens=MAX_OUTPUT_TOKENS,
        system=system_msg,
        messages=user_msgs,  # type: ignore[arg-type]
    )
    return response.content[0].text if response.content else ""


async def _invoke_provider(config: ProviderConfig, messages: list[dict]) -> str:
    if config.provider == "anthropic":
        return await _call_anthropic(config, messages)
    return await _call_openai(config, messages)


# ── Response parsing ──────────────────────────────────────────────────────────

def _parse_llm_response(raw: str, model_used: str, provider_used: str) -> LLMReport:
    """
    Parse raw LLM response string into LLMReport.
    Handles JSON extraction from markdown code blocks if needed.
    """
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
        cleaned = cleaned.strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM returned invalid JSON: {exc}\nRaw response: {raw[:500]}") from exc

    required_dims = ["description_quality", "instruction_clarity", "scope_and_boundaries", "token_efficiency"]
    for dim in required_dims:
        if dim not in data:
            raise ValueError(f"LLM response missing dimension: '{dim}'")

    dims = {k: LLMDimensionResult(**data[k]) for k in required_dims}

    scores = [dims[k].score for k in required_dims]
    overall_score = round(sum(scores) / len(scores))

    if overall_score >= 75:
        overall_status = "pass"
    elif overall_score >= 50:
        overall_status = "warn"
    else:
        overall_status = "fail"

    return LLMReport(
        description_quality=dims["description_quality"],
        instruction_clarity=dims["instruction_clarity"],
        scope_and_boundaries=dims["scope_and_boundaries"],
        token_efficiency=dims["token_efficiency"],
        overall_score=overall_score,
        overall_status=overall_status,
        model_used=model_used,
        provider_used=provider_used,
    )


def _make_error_report(
    error_message: str,
    model: str,
    provider: str,
    skill_tokens: SkillTokenEstimate | None = None,
    referenced_files: list[FileReference] | None = None,
) -> LLMReport:
    """Return a structured error report when LLM call fails."""
    error_dim = LLMDimensionResult(
        score=0,
        status="fail",
        findings=[f"LLM evaluation failed: {error_message}"],
        suggestions=[LLMSuggestion(text="Check your API key, model name, and provider configuration.")],
    )
    return LLMReport(
        description_quality=error_dim,
        instruction_clarity=error_dim,
        scope_and_boundaries=error_dim,
        token_efficiency=error_dim,
        overall_score=0,
        overall_status="fail",
        model_used=model,
        provider_used=provider,
        skill_tokens=skill_tokens or SkillTokenEstimate(),
        referenced_files=referenced_files or [],
    )


# ── Main entry point ──────────────────────────────────────────────────────────

async def run_llm_validation(doc: SkillDocument, config: ProviderConfig) -> LLMReport:
    """
    Run LLM-as-a-Judge evaluation on a parsed SkillDocument.

    Supports OpenAI, Anthropic, and Ollama via provider-specific clients.

    Args:
        doc: Parsed SkillDocument.
        config: LLM provider configuration.

    Returns:
        LLMReport with per-dimension scores, findings, and suggestions.
    """
    skill_tokens = SkillTokenEstimate(**doc.token_estimate)
    referenced_files = doc.referenced_files
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": USER_PROMPT_TEMPLATE.format(skill_content=doc.raw)},
    ]
    prompt_chars = sum(len(m["content"]) for m in messages)

    logger.info(
        "LLM judge start provider=%s model=%s base_url=%s skill_tokens=%s prompt_chars=%d",
        config.provider,
        config.model,
        config.base_url or "(default)",
        skill_tokens.model_dump(),
        prompt_chars,
    )
    t0 = time.perf_counter()

    try:
        raw_content = await _invoke_provider(config, messages)
    except Exception as exc:
        logger.exception(
            "LLM judge provider call failed provider=%s model=%s after %.1fs",
            config.provider,
            config.model,
            time.perf_counter() - t0,
        )
        return _make_error_report(
            str(exc),
            config.model,
            config.provider,
            skill_tokens=skill_tokens,
            referenced_files=referenced_files,
        )

    logger.info(
        "LLM judge response received provider=%s model=%s in %.1fs chars=%d",
        config.provider,
        config.model,
        time.perf_counter() - t0,
        len(raw_content or ""),
    )

    try:
        report = _parse_llm_response(raw_content, config.model, config.provider)
    except Exception as first_exc:
        logger.warning(
            "LLM judge parse failed, retrying once provider=%s model=%s error=%s",
            config.provider,
            config.model,
            first_exc,
        )
        try:
            raw_content = await _invoke_provider(config, messages)
            report = _parse_llm_response(raw_content, config.model, config.provider)
        except Exception as exc:
            logger.exception(
                "LLM judge parse failed after retry provider=%s model=%s raw_preview=%r",
                config.provider,
                config.model,
                (raw_content or "")[:500],
            )
            return _make_error_report(
                str(exc),
                config.model,
                config.provider,
                skill_tokens=skill_tokens,
                referenced_files=referenced_files,
            )

    logger.info(
        "LLM judge parsed provider=%s model=%s overall_score=%s overall_status=%s",
        config.provider,
        config.model,
        report.overall_score,
        report.overall_status,
    )
    return report.model_copy(update={
        "skill_tokens": skill_tokens,
        "referenced_files": referenced_files,
    })
