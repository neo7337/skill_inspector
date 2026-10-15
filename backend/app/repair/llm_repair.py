"""
LLM-assisted prompt refactoring engine for SKILL.md files.
Rewrites ambiguous, unstructured instructions into clear, structured steps
with explicit boundaries and token-efficient formatting.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Literal
from pydantic import BaseModel

from app.validators.llm_judge import ProviderConfig, call_provider_chat, extract_json_from_text
from app.repair.diff_utils import parse_diff_to_structured, DiffReport

logger = logging.getLogger(__name__)

REFACTOR_SYSTEM_PROMPT = """\
You are an expert prompt engineer specializing in agent skills and instructions (agentskills.io format).
Your job is to refactor and optimize SKILL.md files that have ambiguous, bloated, or unstructured instructions.

Apply the following refactoring rules:
1. Preserve the valid frontmatter (name, description, etc.). Keep the frontmatter compliant with agentskills.io.
2. Structure instructions into clear numbered steps (Step 1, Step 2, etc.) with explicit preconditions and postconditions.
3. Add a dedicated "## Scope & Boundaries" section specifying what the skill should NOT do or when to decline.
4. Eliminate conversational fluff, repetitive phrasing, and redundant filler to optimize token efficiency.
5. Preserve all concrete code snippets, paths, or tool invocations from the original.

You must respond ONLY with a valid JSON object in this exact schema:
{
  "summary_of_changes": ["string explaining change 1", "string explaining change 2"],
  "refactored_content": "The full complete refactored SKILL.md text starting with ---"
}
"""

REFACTOR_USER_TEMPLATE = """\
Please refactor this SKILL.md content:

```markdown
{content}
```

Known issues to address:
{issues}
"""


class LLMRefactorResult(BaseModel):
    original_content: str
    refactored_content: str
    summary_of_changes: list[str]
    diff: DiffReport
    provider_used: str
    model_used: str


class LLMRepairEngine:
    """Refactors SKILL.md prompts using an LLM provider."""

    async def refactor(
        self,
        content: str,
        config: ProviderConfig,
        issues: list[str] | None = None,
    ) -> LLMRefactorResult:
        issues_text = "\n".join(f"- {issue}" for issue in (issues or [
            "Instructions lack clear sequential step-by-step numbering.",
            "Missing explicit Scope & Boundaries / When NOT to use section.",
            "Token bloat or conversational filler present."
        ]))

        user_prompt = REFACTOR_USER_TEMPLATE.format(
            content=content,
            issues=issues_text,
        )

        raw_response = await call_provider_chat(
            config,
            system_prompt=REFACTOR_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )

        try:
            parsed = extract_json_from_text(raw_response)
            refactored_text = parsed.get("refactored_content", "").strip()
            changes = parsed.get("summary_of_changes", [])
            if not refactored_text:
                raise ValueError("LLM response did not contain 'refactored_content'")
        except Exception as exc:
            logger.warning("Failed to parse LLM refactor JSON: %s. Using raw response fallback.", exc)
            # Fallback: check if the model returned markdown directly
            if raw_response.startswith("---") or "---" in raw_response:
                match = re.search(r"(---\s*\n.*)", raw_response, re.DOTALL)
                refactored_text = match.group(1).strip() if match else raw_response.strip()
            else:
                refactored_text = raw_response.strip()
            changes = ["Refactored instructions for clarity and boundaries."]

        diff_report = parse_diff_to_structured(content, refactored_text)

        return LLMRefactorResult(
            original_content=content,
            refactored_content=refactored_text,
            summary_of_changes=changes,
            diff=diff_report,
            provider_used=config.provider,
            model_used=config.model,
        )
