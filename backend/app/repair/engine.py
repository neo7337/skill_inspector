"""
Deterministic repair engine for agentskills.io SKILL.md format.
Fixes frontmatter schema errors, field naming, type mismatches, and markdown structure.
"""
from __future__ import annotations

import re
from typing import Any
import yaml
from pydantic import BaseModel

from app.parser import SkillDocument, parse_skill_md, ParseError
from app.validators.static import NAME_MAX_LEN, DESCRIPTION_MAX_LEN, COMPATIBILITY_MAX_LEN
from app.repair.diff_utils import compute_unified_diff, parse_diff_to_structured, DiffReport


class RepairItem(BaseModel):
    id: str
    field_or_section: str
    title: str
    description: str
    is_safe: bool = True  # True for deterministic 100% safe fixes
    original_value: str | None = None
    repaired_value: str | None = None


class RepairResult(BaseModel):
    original_content: str
    repaired_content: str
    repairs_applied: list[RepairItem]
    diff: DiffReport


def sanitize_skill_name(raw_name: str | None, default_fallback: str = "custom-skill") -> str:
    """
    Sanitize skill name according to agentskills.io spec:
    - Lowercase alphanumeric + hyphens only
    - No leading/trailing hyphens
    - No consecutive hyphens
    - Max 64 characters
    """
    if not raw_name or not str(raw_name).strip():
        return default_fallback

    name = str(raw_name).strip().lower()
    # Replace spaces, underscores, dots with hyphens
    name = re.sub(r"[\s_.]+", "-", name)
    # Remove any characters not [a-z0-9-]
    name = re.sub(r"[^a-z0-9-]", "", name)
    # Collapse multiple hyphens into single
    name = re.sub(r"-+", "-", name)
    # Strip leading and trailing hyphens
    name = name.strip("-")

    if not name:
        name = default_fallback

    if len(name) > NAME_MAX_LEN:
        name = name[:NAME_MAX_LEN].rstrip("-")

    return name


def sanitize_description(raw_desc: str | None, skill_name: str) -> str:
    """
    Sanitize description:
    - Must be non-empty
    - Max 1024 characters
    - Should include 'when to use' guidance
    """
    desc = (raw_desc or "").strip()
    if not desc:
        desc = f"Executes tasks for {skill_name}. Use when this workflow is required."
    else:
        # Check if it mentions when to use
        has_when = bool(re.search(r"\b(when|use case|whenever|used to|triggers)\b", desc, re.IGNORECASE))
        if not has_when:
            desc = f"{desc.rstrip('.')} Use when performing {skill_name} tasks."

    if len(desc) > DESCRIPTION_MAX_LEN:
        # Truncate at last space before max length
        trimmed = desc[:DESCRIPTION_MAX_LEN - 3]
        last_space = trimmed.rfind(" ")
        if last_space > 0:
            desc = trimmed[:last_space] + "..."
        else:
            desc = trimmed + "..."

    return desc


def sanitize_metadata(raw_metadata: Any) -> dict[str, str] | None:
    """Ensure metadata is a dict[str, str]. Convert numbers/booleans to strings."""
    if raw_metadata is None:
        return None
    if not isinstance(raw_metadata, dict):
        return {}

    sanitized: dict[str, str] = {}
    for k, v in raw_metadata.items():
        key_str = str(k)
        if isinstance(v, (str, int, float, bool)):
            sanitized[key_str] = str(v)
        elif isinstance(v, (list, dict)):
            sanitized[key_str] = yaml.safe_dump(v, width=float("inf")).strip()
        else:
            sanitized[key_str] = str(v)
    return sanitized


def sanitize_allowed_tools(raw_tools: Any) -> str | None:
    """Spec requires allowed-tools to be a string. If list given, convert to comma-separated."""
    if raw_tools is None:
        return None
    if isinstance(raw_tools, list):
        return ", ".join(str(item).strip() for item in raw_tools if str(item).strip())
    if isinstance(raw_tools, str):
        return raw_tools.strip()
    return str(raw_tools)


class DeterministicRepairEngine:
    """Repairs SKILL.md content deterministically against the specification."""

    def repair(self, content: str) -> RepairResult:
        repairs: list[RepairItem] = []
        raw = content.strip()

        # Step 1: Handle frontmatter extraction or repair
        fm_dict: dict[str, Any] = {}
        body = ""

        # Check for frontmatter
        fm_match = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)", raw, re.DOTALL)
        if fm_match:
            fm_text = fm_match.group(1)
            body = fm_match.group(2)
            try:
                loaded = yaml.safe_load(fm_text)
                if isinstance(loaded, dict):
                    fm_dict = loaded
                else:
                    repairs.append(
                        RepairItem(
                            id="fm_not_dict",
                            field_or_section="frontmatter",
                            title="Convert frontmatter to key-value mapping",
                            description="Frontmatter was not a valid dictionary; initialized valid structure.",
                            is_safe=True,
                        )
                    )
            except yaml.YAMLError as exc:
                repairs.append(
                    RepairItem(
                        id="yaml_syntax_repair",
                        field_or_section="frontmatter",
                        title="Fix invalid YAML syntax",
                        description=f"Repaired broken YAML syntax ({str(exc).splitlines()[0]}).",
                        is_safe=True,
                    )
                )
                # Attempt naive key-value recovery
                for line in fm_text.splitlines():
                    if ":" in line:
                        parts = line.split(":", 1)
                        k = parts[0].strip()
                        v = parts[1].strip()
                        if k and not k.startswith("#"):
                            fm_dict[k] = v.strip("'\"")
        else:
            # Check if text contains frontmatter keys without '---' delimiters
            lines = raw.splitlines()
            fm_lines = []
            body_lines = []
            in_fm = True
            for line in lines:
                if in_fm:
                    if line.startswith("#"):
                        in_fm = False
                        body_lines.append(line)
                    else:
                        fm_lines.append(line)
                else:
                    body_lines.append(line)

            candidate_fm = "\n".join(fm_lines)
            try:
                loaded = yaml.safe_load(candidate_fm)
                if isinstance(loaded, dict) and any(k in loaded for k in ("name", "description", "metadata", "allowed-tools")):
                    fm_dict = loaded
                    body = "\n".join(body_lines)
                    repairs.append(
                        RepairItem(
                            id="add_frontmatter",
                            field_or_section="frontmatter",
                            title="Add missing YAML frontmatter delimiters",
                            description="Wrapped un-delimited frontmatter with required '---'.",
                            is_safe=True,
                        )
                    )
                else:
                    body = raw
                    repairs.append(
                        RepairItem(
                            id="add_frontmatter",
                            field_or_section="frontmatter",
                            title="Add missing YAML frontmatter delimiters",
                            description="SKILL.md lacked required '---' frontmatter delimiters.",
                            is_safe=True,
                        )
                    )
            except Exception:
                body = raw
                repairs.append(
                    RepairItem(
                        id="add_frontmatter",
                        field_or_section="frontmatter",
                        title="Add missing YAML frontmatter delimiters",
                        description="SKILL.md lacked required '---' frontmatter delimiters.",
                        is_safe=True,
                    )
                )

        # Step 2: Repair Name
        orig_name = fm_dict.get("name")
        sanitized_name = sanitize_skill_name(orig_name)
        if orig_name != sanitized_name:
            repairs.append(
                RepairItem(
                    id="repair_name",
                    field_or_section="name",
                    title="Normalize skill name",
                    description=f"Formatted name to lowercase alphanumeric + hyphens: '{sanitized_name}'",
                    is_safe=True,
                    original_value=str(orig_name),
                    repaired_value=sanitized_name,
                )
            )
            fm_dict["name"] = sanitized_name

        # Step 3: Repair Description
        orig_desc = fm_dict.get("description")
        sanitized_desc = sanitize_description(orig_desc, sanitized_name)
        if orig_desc != sanitized_desc:
            repairs.append(
                RepairItem(
                    id="repair_description",
                    field_or_section="description",
                    title="Normalize description and add 'when to use'",
                    description="Ensured description is within 1024 characters and explicitly mentions when to use.",
                    is_safe=True,
                    original_value=str(orig_desc) if orig_desc else None,
                    repaired_value=sanitized_desc,
                )
            )
            fm_dict["description"] = sanitized_desc

        # Step 4: Repair Compatibility if present
        if "compatibility" in fm_dict:
            compat = fm_dict["compatibility"]
            if compat is not None:
                compat_str = str(compat).strip()
                if len(compat_str) > COMPATIBILITY_MAX_LEN:
                    compat_str = compat_str[:COMPATIBILITY_MAX_LEN]
                    repairs.append(
                        RepairItem(
                            id="repair_compatibility",
                            field_or_section="compatibility",
                            title="Truncate compatibility",
                            description=f"Truncated compatibility field to max {COMPATIBILITY_MAX_LEN} chars.",
                            is_safe=True,
                            original_value=str(compat),
                            repaired_value=compat_str,
                        )
                    )
                fm_dict["compatibility"] = compat_str

        # Step 5: Repair Metadata if present
        if "metadata" in fm_dict:
            orig_meta = fm_dict["metadata"]
            sanitized_meta = sanitize_metadata(orig_meta)
            if sanitized_meta != orig_meta:
                repairs.append(
                    RepairItem(
                        id="repair_metadata",
                        field_or_section="metadata",
                        title="Normalize metadata key-value strings",
                        description="Converted metadata dictionary values to strings as required by spec.",
                        is_safe=True,
                    )
                )
                fm_dict["metadata"] = sanitized_meta

        # Step 6: Repair allowed-tools
        if "allowed-tools" in fm_dict:
            orig_tools = fm_dict["allowed-tools"]
            sanitized_tools = sanitize_allowed_tools(orig_tools)
            if sanitized_tools != orig_tools:
                repairs.append(
                    RepairItem(
                        id="repair_allowed_tools",
                        field_or_section="allowed-tools",
                        title="Normalize allowed-tools to comma-separated string",
                        description="Converted allowed-tools list/value to string representation.",
                        is_safe=True,
                        original_value=str(orig_tools),
                        repaired_value=sanitized_tools,
                    )
                )
                fm_dict["allowed-tools"] = sanitized_tools

        # Step 7: Order frontmatter keys cleanly
        standard_keys = ["name", "description", "license", "compatibility", "metadata", "allowed-tools"]
        ordered_fm: dict[str, Any] = {}
        for key in standard_keys:
            if key in fm_dict:
                ordered_fm[key] = fm_dict[key]
        for key, val in fm_dict.items():
            if key not in ordered_fm:
                ordered_fm[key] = val

        # Step 8: Check body content
        body_trimmed = body.strip()
        if not body_trimmed:
            body_trimmed = (
                f"## Instructions\n\n"
                f"Execute the steps below when using the {sanitized_name} skill.\n\n"
                f"1. **Analyze Input**: Inspect the input parameters and prerequisites.\n"
                f"2. **Execute Operation**: Perform the core skill logic using permitted tools.\n"
                f"3. **Validate & Return**: Confirm output validity and present concise results to the user.\n"
            )
            repairs.append(
                RepairItem(
                    id="repair_empty_body",
                    field_or_section="body",
                    title="Generate baseline instruction structure",
                    description="SKILL.md had an empty markdown body. Scaffolded structured instructions.",
                    is_safe=True,
                )
            )

        # Assemble clean YAML
        yaml_content = yaml.dump(
            ordered_fm,
            sort_keys=False,
            default_flow_style=False,
            allow_unicode=True,
        ).strip()

        repaired_full = f"---\n{yaml_content}\n---\n\n{body_trimmed}\n"
        diff_report = parse_diff_to_structured(content, repaired_full)

        return RepairResult(
            original_content=content,
            repaired_content=repaired_full,
            repairs_applied=repairs,
            diff=diff_report,
        )
