"""
Static validation engine for agentskills.io SKILL.md format.

Implements all rules from the official specification:
https://agentskills.io/specification
"""
from __future__ import annotations

import logging
import re
from enum import Enum
from pathlib import Path
from typing import Any, Literal, Optional

from pydantic import BaseModel

from app.parser import SkillDocument
from app.package import ReferenceFileStatus, SkillPackage, PEAK_TOKEN_WARN_THRESHOLD

logger = logging.getLogger(__name__)


# ── Constants from spec ──────────────────────────────────────────────────────

NAME_MAX_LEN = 64
DESCRIPTION_MAX_LEN = 1024
COMPATIBILITY_MAX_LEN = 500
BODY_LINE_WARN_THRESHOLD = 500
BODY_TOKEN_WARN_THRESHOLD = 5000

# name: lowercase alphanumeric + hyphens, no leading/trailing/consecutive hyphens
_NAME_PATTERN = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")
_CONSECUTIVE_HYPHENS = re.compile(r"--")


# ── Report models ─────────────────────────────────────────────────────────────

class RuleStatus(str, Enum):
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"


FixKind = Literal["frontmatter_field", "body_section", "text_replace"]


class Finding(BaseModel):
    dimension: str
    rule: str
    status: RuleStatus
    message: str
    suggestion: str
    # Structured fix fields for one-click Apply in the UI
    fix_snippet: Optional[str] = None   # ready-to-paste YAML/text snippet
    fix_kind: Optional[FixKind] = None  # how the frontend should apply the fix
    fix_field: Optional[str] = None     # for frontmatter_field: the key name
    fix_replace_target: Optional[str] = None  # for text_replace: text to find


class StaticValidationReport(BaseModel):
    findings: list[Finding]
    overall_status: RuleStatus
    score: int  # 0–100

    @property
    def passes(self) -> list[Finding]:
        return [f for f in self.findings if f.status == RuleStatus.PASS]

    @property
    def warnings(self) -> list[Finding]:
        return [f for f in self.findings if f.status == RuleStatus.WARN]

    @property
    def failures(self) -> list[Finding]:
        return [f for f in self.findings if f.status == RuleStatus.FAIL]


# ── Individual rule checkers ──────────────────────────────────────────────────

def _check_name(name: Any) -> list[Finding]:
    findings: list[Finding] = []

    # Required
    if name is None:
        findings.append(Finding(
            dimension="Schema",
            rule="name.required",
            status=RuleStatus.FAIL,
            message="Required field 'name' is missing.",
            suggestion="Add a 'name' field to your frontmatter: name: my-skill-name",
            fix_kind="frontmatter_field",
            fix_field="name",
            fix_snippet="my-skill-name",
        ))
        return findings  # All subsequent name checks are moot

    if not isinstance(name, str):
        findings.append(Finding(
            dimension="Schema",
            rule="name.type",
            status=RuleStatus.FAIL,
            message=f"'name' must be a string, got {type(name).__name__}.",
            suggestion="Set name to a plain string value, e.g. name: my-skill",
            fix_kind="frontmatter_field",
            fix_field="name",
            fix_snippet="my-skill",
        ))
        return findings

    # Empty
    if not name.strip():
        findings.append(Finding(
            dimension="Schema",
            rule="name.non-empty",
            status=RuleStatus.FAIL,
            message="'name' must not be empty.",
            suggestion="Provide a non-empty name, e.g. name: my-skill",
            fix_kind="frontmatter_field",
            fix_field="name",
            fix_snippet="my-skill",
        ))
        return findings

    # Max length
    if len(name) > NAME_MAX_LEN:
        shortened = name[:NAME_MAX_LEN]
        findings.append(Finding(
            dimension="Schema",
            rule="name.max-length",
            status=RuleStatus.FAIL,
            message=f"'name' is {len(name)} characters; maximum is {NAME_MAX_LEN}.",
            suggestion=f"Shorten the name to {NAME_MAX_LEN} characters or fewer.",
            fix_kind="frontmatter_field",
            fix_field="name",
            fix_snippet=shortened,
        ))
    else:
        findings.append(Finding(
            dimension="Schema",
            rule="name.max-length",
            status=RuleStatus.PASS,
            message=f"'name' length is {len(name)} characters (max {NAME_MAX_LEN}).",
            suggestion="",
        ))

    # Character set: lowercase alphanumeric + hyphens only
    if not re.match(r"^[a-z0-9-]+$", name):
        # Build a slug-fixed version
        slugified = re.sub(r"[^a-z0-9-]", "-", name.lower())
        slugified = re.sub(r"-+", "-", slugified).strip("-") or "my-skill"
        findings.append(Finding(
            dimension="Schema",
            rule="name.charset",
            status=RuleStatus.FAIL,
            message=f"'name' contains invalid characters: '{name}'. Only lowercase letters (a-z), digits (0-9), and hyphens (-) are allowed.",
            suggestion="Use only lowercase alphanumeric characters and hyphens, e.g. my-skill-2",
            fix_kind="frontmatter_field",
            fix_field="name",
            fix_snippet=slugified,
        ))
    else:
        # Starts/ends with hyphen
        if name.startswith("-") or name.endswith("-"):
            fixed_name = name.strip("-")
            findings.append(Finding(
                dimension="Schema",
                rule="name.hyphen-boundaries",
                status=RuleStatus.FAIL,
                message=f"'name' must not start or end with a hyphen. Got: '{name}'.",
                suggestion="Remove the leading or trailing hyphen from the name.",
                fix_kind="frontmatter_field",
                fix_field="name",
                fix_snippet=fixed_name or "my-skill",
            ))
        else:
            findings.append(Finding(
                dimension="Schema",
                rule="name.charset",
                status=RuleStatus.PASS,
                message="'name' uses only allowed characters (lowercase alphanumeric and hyphens).",
                suggestion="",
            ))

        # Consecutive hyphens
        if _CONSECUTIVE_HYPHENS.search(name):
            fixed_name = re.sub(r"-+", "-", name)
            findings.append(Finding(
                dimension="Schema",
                rule="name.consecutive-hyphens",
                status=RuleStatus.FAIL,
                message=f"'name' contains consecutive hyphens: '{name}'.",
                suggestion="Replace consecutive hyphens (--) with a single hyphen (-).",
                fix_kind="frontmatter_field",
                fix_field="name",
                fix_snippet=fixed_name,
            ))
        else:
            findings.append(Finding(
                dimension="Schema",
                rule="name.consecutive-hyphens",
                status=RuleStatus.PASS,
                message="'name' contains no consecutive hyphens.",
                suggestion="",
            ))

    # Full pattern check (consolidates boundary + charset for clean one-pass)
    if re.match(r"^[a-z0-9-]+$", name) and not name.startswith("-") and not name.endswith("-"):
        if not _CONSECUTIVE_HYPHENS.search(name):
            findings.append(Finding(
                dimension="Schema",
                rule="name.valid",
                status=RuleStatus.PASS,
                message=f"'name' value '{name}' is valid.",
                suggestion="",
            ))

    return findings


def _check_description(description: Any) -> list[Finding]:
    findings: list[Finding] = []

    if description is None:
        findings.append(Finding(
            dimension="Schema",
            rule="description.required",
            status=RuleStatus.FAIL,
            message="Required field 'description' is missing.",
            suggestion="Add a 'description' field explaining what this skill does and when to use it.",
            fix_kind="frontmatter_field",
            fix_field="description",
            fix_snippet="Describe what this skill does. Use when the user asks about X.",
        ))
        return findings

    if not isinstance(description, str):
        findings.append(Finding(
            dimension="Schema",
            rule="description.type",
            status=RuleStatus.FAIL,
            message=f"'description' must be a string, got {type(description).__name__}.",
            suggestion="Set description to a plain string value.",
            fix_kind="frontmatter_field",
            fix_field="description",
            fix_snippet="Describe what this skill does. Use when the user asks about X.",
        ))
        return findings

    if not description.strip():
        findings.append(Finding(
            dimension="Schema",
            rule="description.non-empty",
            status=RuleStatus.FAIL,
            message="'description' must not be empty.",
            suggestion="Provide a meaningful description that says what the skill does and when to use it.",
            fix_kind="frontmatter_field",
            fix_field="description",
            fix_snippet="Describe what this skill does. Use when the user asks about X.",
        ))
        return findings

    findings.append(Finding(
        dimension="Schema",
        rule="description.non-empty",
        status=RuleStatus.PASS,
        message="'description' is non-empty.",
        suggestion="",
    ))

    if len(description) > DESCRIPTION_MAX_LEN:
        findings.append(Finding(
            dimension="Schema",
            rule="description.max-length",
            status=RuleStatus.FAIL,
            message=f"'description' is {len(description)} characters; maximum is {DESCRIPTION_MAX_LEN}.",
            suggestion=f"Shorten the description to {DESCRIPTION_MAX_LEN} characters or fewer.",
            fix_kind="frontmatter_field",
            fix_field="description",
            fix_snippet=description[:DESCRIPTION_MAX_LEN].rstrip(),
        ))
    else:
        findings.append(Finding(
            dimension="Schema",
            rule="description.max-length",
            status=RuleStatus.PASS,
            message=f"'description' length is {len(description)} characters (max {DESCRIPTION_MAX_LEN}).",
            suggestion="",
        ))

    # Quality hint: description should mention "when to use"
    lower = description.lower()
    use_keywords = ["use when", "when to use", "when the user", "for when", "whenever", "use for"]
    if not any(kw in lower for kw in use_keywords):
        appended = description.rstrip(". ") + ". Use when the user asks about <topic>."
        findings.append(Finding(
            dimension="Instruction Quality",
            rule="description.when-to-use",
            status=RuleStatus.WARN,
            message="'description' doesn't appear to mention when to use this skill.",
            suggestion="Add trigger context, e.g. 'Use when the user asks about X' or 'Use when working with Y files'.",
            fix_kind="frontmatter_field",
            fix_field="description",
            fix_snippet=appended,
        ))
    else:
        findings.append(Finding(
            dimension="Instruction Quality",
            rule="description.when-to-use",
            status=RuleStatus.PASS,
            message="'description' includes usage context (when to use).",
            suggestion="",
        ))

    return findings


def _check_compatibility(compatibility: Any) -> list[Finding]:
    if compatibility is None:
        return []  # Optional field

    if not isinstance(compatibility, str):
        return [Finding(
            dimension="Schema",
            rule="compatibility.type",
            status=RuleStatus.FAIL,
            message=f"'compatibility' must be a string, got {type(compatibility).__name__}.",
            suggestion="Set compatibility to a plain string, e.g. compatibility: Requires Python 3.11+",
        )]

    if len(compatibility) > COMPATIBILITY_MAX_LEN:
        return [Finding(
            dimension="Schema",
            rule="compatibility.max-length",
            status=RuleStatus.FAIL,
            message=f"'compatibility' is {len(compatibility)} characters; maximum is {COMPATIBILITY_MAX_LEN}.",
            suggestion=f"Shorten the compatibility field to {COMPATIBILITY_MAX_LEN} characters or fewer.",
        )]

    return [Finding(
        dimension="Schema",
        rule="compatibility.valid",
        status=RuleStatus.PASS,
        message=f"'compatibility' is valid ({len(compatibility)} characters).",
        suggestion="",
    )]


def _check_metadata(metadata: Any) -> list[Finding]:
    if metadata is None:
        return []  # Optional

    if not isinstance(metadata, dict):
        return [Finding(
            dimension="Schema",
            rule="metadata.type",
            status=RuleStatus.FAIL,
            message=f"'metadata' must be a YAML mapping (dict), got {type(metadata).__name__}.",
            suggestion="Format metadata as key-value pairs:\nmetadata:\n  author: my-org\n  version: '1.0'",
        )]

    non_string_keys = [k for k in metadata if not isinstance(k, str)]
    non_string_values = [k for k, v in metadata.items() if not isinstance(v, str)]

    findings: list[Finding] = []

    if non_string_keys:
        findings.append(Finding(
            dimension="Schema",
            rule="metadata.string-keys",
            status=RuleStatus.FAIL,
            message=f"'metadata' keys must be strings. Non-string keys: {non_string_keys}",
            suggestion="Use only string keys in the metadata mapping.",
        ))

    if non_string_values:
        findings.append(Finding(
            dimension="Schema",
            rule="metadata.string-values",
            status=RuleStatus.WARN,
            message=f"'metadata' values should be strings. Non-string values for keys: {non_string_values}",
            suggestion="Wrap non-string values in quotes, e.g. version: '1.0'",
        ))

    if not findings:
        findings.append(Finding(
            dimension="Schema",
            rule="metadata.valid",
            status=RuleStatus.PASS,
            message=f"'metadata' is a valid string→string mapping with {len(metadata)} entries.",
            suggestion="",
        ))

    return findings


def _check_allowed_tools(allowed_tools: Any) -> list[Finding]:
    if allowed_tools is None:
        return []  # Optional, experimental

    if not isinstance(allowed_tools, str):
        return [Finding(
            dimension="Schema",
            rule="allowed-tools.type",
            status=RuleStatus.FAIL,
            message=f"'allowed-tools' must be a space-separated string, got {type(allowed_tools).__name__}.",
            suggestion="Format as a space-separated string: allowed-tools: Bash(git:*) Read Write",
        )]

    return [Finding(
        dimension="Schema",
        rule="allowed-tools.valid",
        status=RuleStatus.PASS,
        message=f"'allowed-tools' is a valid string.",
        suggestion="",
    )]


def _check_body(doc: SkillDocument) -> list[Finding]:
    findings: list[Finding] = []

    if not doc.body.strip():
        findings.append(Finding(
            dimension="Body",
            rule="body.non-empty",
            status=RuleStatus.FAIL,
            message="The skill body (instructions after frontmatter) is empty.",
            suggestion="Add step-by-step instructions, examples, and edge cases after the --- delimiter.",
            fix_kind="body_section",
            fix_snippet="## Instructions\n\nStep 1: Understand the user's request.\nStep 2: Apply the relevant logic.\nStep 3: Return a clear, concise result.\n\n## Out of Scope\n\nThis skill does not handle cases outside of its described purpose.",
        ))
        return findings

    findings.append(Finding(
        dimension="Body",
        rule="body.non-empty",
        status=RuleStatus.PASS,
        message=f"Body has content ({doc.body_line_count} lines).",
        suggestion="",
    ))

    # Line count warning
    if doc.body_line_count > BODY_LINE_WARN_THRESHOLD:
        findings.append(Finding(
            dimension="Body",
            rule="body.line-count",
            status=RuleStatus.WARN,
            message=f"Body is {doc.body_line_count} lines; the spec recommends keeping SKILL.md under 500 lines.",
            suggestion="Move detailed reference material to references/ directory files and link to them from the body.",
            fix_kind="body_section",
            fix_snippet="## References\n\nSee [references/details.md](references/details.md) for extended documentation.",
        ))
    else:
        findings.append(Finding(
            dimension="Body",
            rule="body.line-count",
            status=RuleStatus.PASS,
            message=f"Body is {doc.body_line_count} lines (recommended max 500).",
            suggestion="",
        ))

    # Token count warning
    if doc.estimated_token_count > BODY_TOKEN_WARN_THRESHOLD:
        findings.append(Finding(
            dimension="Body",
            rule="body.token-count",
            status=RuleStatus.WARN,
            message=f"Body is estimated at ~{doc.estimated_token_count} tokens; the spec recommends under 5,000.",
            suggestion="Trim or split long sections into referenced files to reduce context footprint.",
            fix_kind="body_section",
            fix_snippet="## References\n\nSee [references/details.md](references/details.md) for extended documentation that has been moved out of the main body.",
        ))
    else:
        findings.append(Finding(
            dimension="Body",
            rule="body.token-count",
            status=RuleStatus.PASS,
            message=f"Body is estimated at ~{doc.estimated_token_count} tokens (recommended max 5,000).",
            suggestion="",
        ))

    return findings


def _check_unknown_fields(frontmatter: dict[str, Any]) -> list[Finding]:
    known = {"name", "description", "license", "compatibility", "metadata", "allowed-tools"}
    unknown = set(frontmatter.keys()) - known
    if unknown:
        metadata_entries = "\n".join(f"  {k}: '{frontmatter[k]}'" for k in sorted(unknown))
        return [Finding(
            dimension="Schema",
            rule="frontmatter.unknown-fields",
            status=RuleStatus.WARN,
            message=f"Unknown frontmatter fields: {sorted(unknown)}. These are not part of the spec.",
            suggestion="Use the 'metadata' field to store custom key-value pairs instead of top-level custom fields.",
            fix_kind="frontmatter_field",
            fix_field="metadata",
            fix_snippet=f"metadata:\n{metadata_entries}",
        )]
    return []


VALID_SCRIPT_EXTENSIONS = {
    ".py", ".sh", ".bash", ".zsh", ".js", ".ts", ".mjs", ".cjs", ".rb", ".pl"
}


def _check_scripts(doc: SkillDocument) -> list[Finding]:
    scripts = [
        ref for ref in doc.referenced_files
        if ref.kind == "script" or ref.path.replace("\\", "/").lower().startswith("scripts/")
    ]
    if not scripts:
        return []

    findings: list[Finding] = []
    invalid_scripts = []
    for s in scripts:
        suffix = Path(s.path).suffix.lower()
        if suffix not in VALID_SCRIPT_EXTENSIONS:
            invalid_scripts.append(s.path)
            findings.append(Finding(
                dimension="Scripts",
                rule="scripts.valid-format",
                status=RuleStatus.WARN,
                message=f"Script '{s.path}' has unrecognized or missing script extension (got '{suffix or 'none'}').",
                suggestion="Use standard executable script extensions like .py, .sh, .bash, or .js.",
                fix_kind="text_replace",
                fix_replace_target=s.path,
                fix_snippet=f"{s.path}.py" if not suffix else s.path,
            ))

    if not invalid_scripts:
        findings.append(Finding(
            dimension="Scripts",
            rule="scripts.valid-format",
            status=RuleStatus.PASS,
            message=f"All {len(scripts)} referenced script(s) have recognizable script extensions.",
            suggestion="",
        ))

    return findings


def _check_package_references(package: SkillPackage) -> list[Finding]:
    findings: list[Finding] = []
    resolved = package.resolved_files
    if not resolved:
        return findings

    # 1. Path traversal check
    traversed = [r for r in resolved if r.status == ReferenceFileStatus.OUTSIDE_ROOT]
    if traversed:
        for r in traversed:
            findings.append(Finding(
                dimension="Security",
                rule="references.path-traversal",
                status=RuleStatus.FAIL,
                message=f"Reference '{r.relative_path}' attempts to traverse outside the skill base directory.",
                suggestion="Keep all referenced files within the skill root directory or subdirectories.",
            ))
    else:
        findings.append(Finding(
            dimension="Security",
            rule="references.path-traversal",
            status=RuleStatus.PASS,
            message="All referenced files reside safely within the skill base directory.",
            suggestion="",
        ))

    # 2. File exists check
    missing = [r for r in resolved if r.status == ReferenceFileStatus.MISSING]
    if missing:
        for r in missing:
            findings.append(Finding(
                dimension="References",
                rule="references.file-exists",
                status=RuleStatus.FAIL,
                message=f"Referenced file does not exist: '{r.relative_path}'.",
                suggestion=f"Create '{r.relative_path}' or update the reference in SKILL.md to point to an existing file.",
                fix_kind="text_replace",
                fix_replace_target=r.relative_path,
                fix_snippet=r.relative_path,
            ))
    else:
        findings.append(Finding(
            dimension="References",
            rule="references.file-exists",
            status=RuleStatus.PASS,
            message=f"All {len(resolved)} referenced file(s) exist on disk.",
            suggestion="",
        ))

    # 3. Not empty check
    found = [r for r in resolved if r.status == ReferenceFileStatus.FOUND]
    empty = [r for r in found if r.size_bytes == 0]
    if empty:
        for r in empty:
            findings.append(Finding(
                dimension="References",
                rule="references.not-empty",
                status=RuleStatus.WARN,
                message=f"Referenced file '{r.relative_path}' is empty (0 bytes).",
                suggestion=f"Populate '{r.relative_path}' with instructions or data, or remove the reference.",
            ))
    elif found:
        findings.append(Finding(
            dimension="References",
            rule="references.not-empty",
            status=RuleStatus.PASS,
            message="All found referenced files contain non-empty content.",
            suggestion="",
        ))

    # 4. Peak token budget check
    peak = package.tokens.peak_context_footprint
    if peak > PEAK_TOKEN_WARN_THRESHOLD:
        findings.append(Finding(
            dimension="Context",
            rule="references.peak-token-budget",
            status=RuleStatus.WARN,
            message=f"Peak context footprint is ~{peak:,} tokens, exceeding the recommended {PEAK_TOKEN_WARN_THRESHOLD:,} token limit.",
            suggestion="Split reference documentation into focused files or trim instructions to prevent agent context window saturation.",
        ))
    else:
        findings.append(Finding(
            dimension="Context",
            rule="references.peak-token-budget",
            status=RuleStatus.PASS,
            message=f"Peak context footprint is ~{peak:,} tokens (within {PEAK_TOKEN_WARN_THRESHOLD:,} token budget).",
            suggestion="",
        ))

    return findings


# ── Main entry point ──────────────────────────────────────────────────────────

def run_static_validation(
    doc: SkillDocument,
    base_dir: Optional[str | Path] = None,
    package: Optional[SkillPackage] = None,
) -> StaticValidationReport:
    """
    Run all agentskills.io spec validation rules against a parsed SkillDocument.

    If base_dir or package is provided, also validates package file integrity,
    path traversal safety, and peak context token economy.

    Returns a StaticValidationReport with individual findings, overall status,
    and a 0-100 score.
    """
    findings: list[Finding] = []

    if package is None and base_dir is not None:
        try:
            from app.package import resolve_skill_package
            package = resolve_skill_package(base_dir, skill_content=doc.raw)
        except Exception as exc:
            logger.warning("Failed to resolve package for static validation: %s", exc)

    findings.extend(_check_name(doc.name))
    findings.extend(_check_description(doc.description))
    findings.extend(_check_compatibility(doc.compatibility))
    findings.extend(_check_metadata(doc.metadata_field))
    findings.extend(_check_allowed_tools(doc.allowed_tools))
    findings.extend(_check_body(doc))
    findings.extend(_check_unknown_fields(doc.frontmatter))
    findings.extend(_check_scripts(doc))

    if package is not None:
        findings.extend(_check_package_references(package))

    # Overall status: fail if any failures, warn if any warnings, else pass
    has_fail = any(f.status == RuleStatus.FAIL for f in findings)
    has_warn = any(f.status == RuleStatus.WARN for f in findings)

    if has_fail:
        overall_status = RuleStatus.FAIL
    elif has_warn:
        overall_status = RuleStatus.WARN
    else:
        overall_status = RuleStatus.PASS

    # Score: start at 100, subtract 15 per failure, 5 per warning
    fail_count = sum(1 for f in findings if f.status == RuleStatus.FAIL)
    warn_count = sum(1 for f in findings if f.status == RuleStatus.WARN)
    score = max(0, 100 - (fail_count * 15) - (warn_count * 5))

    return StaticValidationReport(
        findings=findings,
        overall_status=overall_status,
        score=score,
    )

