"""
Parser for agentskills.io SKILL.md format.
Extracts YAML frontmatter and markdown body content.
"""
from __future__ import annotations

import re
from typing import Any, Literal

import yaml
from pydantic import BaseModel


FRONTMATTER_PATTERN = re.compile(r"^---\s*\n(.*?)\n---\s*\n?(.*)", re.DOTALL)
# Matches ---\n--- (empty frontmatter, no content between delimiters)
EMPTY_FRONTMATTER_PATTERN = re.compile(r"^---\s*\n---", re.DOTALL)

_MARKDOWN_LINK = re.compile(r"\[(?:[^\]]*)\]\(([^)]+)\)")
_BACKTICK = re.compile(r"`([^`]+)`")
_BARE_KNOWN_PATH = re.compile(
    r"(?:^|[\s(])((?:references|scripts|assets)/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+)"
)
_KNOWN_DIRS = ("references/", "scripts/", "assets/")


class FileReference(BaseModel):
    path: str
    kind: Literal["reference", "script", "asset", "other"]


class ParseError(Exception):
    """Raised when SKILL.md content cannot be parsed."""

    def __init__(self, message: str, field: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.field = field


class SkillDocument(BaseModel):
    """Parsed representation of a SKILL.md file."""

    frontmatter: dict[str, Any]
    body: str
    raw: str

    # Convenience accessors for typed frontmatter fields
    @property
    def name(self) -> str | None:
        return self.frontmatter.get("name")

    @property
    def description(self) -> str | None:
        return self.frontmatter.get("description")

    @property
    def license(self) -> str | None:
        return self.frontmatter.get("license")

    @property
    def compatibility(self) -> str | None:
        return self.frontmatter.get("compatibility")

    @property
    def metadata_field(self) -> dict[str, Any] | None:
        return self.frontmatter.get("metadata")

    @property
    def allowed_tools(self) -> str | None:
        return self.frontmatter.get("allowed-tools")

    @property
    def body_line_count(self) -> int:
        return len(self.body.splitlines())

    @property
    def body_char_count(self) -> int:
        return len(self.body)

    @property
    def estimated_token_count(self) -> int:
        """Rough estimate: 1 token ≈ 4 characters. Body only."""
        return len(self.body) // 4

    @property
    def token_estimate(self) -> dict[str, int]:
        """Approximate context cost using 1 token ≈ 4 characters.

        catalog: name + description (always loaded, even when inactive)
        body: instructions loaded when the skill is activated
        total: the full SKILL.md file
        """
        catalog_chars = 0
        if isinstance(self.name, str):
            catalog_chars += len(self.name)
        if isinstance(self.description, str):
            catalog_chars += len(self.description)
        return {
            "catalog": catalog_chars // 4,
            "body": len(self.body) // 4,
            "total": len(self.raw) // 4,
        }

    @property
    def referenced_files(self) -> list[FileReference]:
        """Relative files mentioned in the body (loaded on demand, not in body tokens)."""
        return extract_file_references(self.body)


def parse_skill_md(content: str) -> SkillDocument:
    """
    Parse a SKILL.md file content into a SkillDocument.

    Args:
        content: Raw text content of the SKILL.md file.

    Returns:
        SkillDocument with extracted frontmatter dict and body string.

    Raises:
        ParseError: If content is empty, missing frontmatter delimiters,
                    or contains invalid YAML.
    """
    if not content or not content.strip():
        raise ParseError("Content is empty. A SKILL.md file must have frontmatter and body.")

    match = FRONTMATTER_PATTERN.match(content)
    if not match:
        # Check if it's an empty frontmatter block (---\n---) specifically
        if EMPTY_FRONTMATTER_PATTERN.match(content):
            raise ParseError(
                "Frontmatter block is empty. At minimum, 'name' and 'description' are required.\n"
                "Example:\n---\nname: my-skill\ndescription: What this skill does.\n---"
            )
        raise ParseError(
            "No YAML frontmatter found. SKILL.md must start with --- delimiters.\n"
            "Example:\n---\nname: my-skill\ndescription: What this skill does.\n---"
        )

    yaml_text = match.group(1).strip()
    body = match.group(2).strip()

    if not yaml_text:
        raise ParseError(
            "Frontmatter block is empty. At minimum, 'name' and 'description' are required.\n"
            "Example:\n---\nname: my-skill\ndescription: What this skill does.\n---"
        )

    try:
        frontmatter = yaml.safe_load(yaml_text)
    except yaml.YAMLError as exc:
        raise ParseError(f"Invalid YAML in frontmatter: {exc}") from exc

    if not isinstance(frontmatter, dict):
        raise ParseError(
            "Frontmatter must be a YAML mapping (key: value pairs), not a list or scalar."
        )

    return SkillDocument(frontmatter=frontmatter, body=body, raw=content)


def _clean_path(raw: str) -> str | None:
    path = raw.strip().strip("<>").strip()
    if " " in path:
        path = path.split()[0].strip().strip('"').strip("'")
    path = path.split("#")[0].split("?")[0].strip()
    if not path or path.startswith("#"):
        return None
    lowered = path.lower()
    if lowered.startswith(("http://", "https://", "mailto:", "data:")):
        return None
    if "<" in path or ">" in path:
        return None
    path = path.lstrip("./")
    return path or None


def _is_file_ref(path: str) -> bool:
    lowered = path.replace("\\", "/").lower()
    if lowered.startswith(_KNOWN_DIRS):
        return True
    return bool(re.search(r"\.[A-Za-z0-9]+$", path))


def _classify_path(path: str) -> Literal["reference", "script", "asset", "other"]:
    lowered = path.replace("\\", "/").lower()
    if lowered.startswith("references/"):
        return "reference"
    if lowered.startswith("scripts/"):
        return "script"
    if lowered.startswith("assets/"):
        return "asset"
    if lowered.endswith(".md"):
        return "reference"
    return "other"


def extract_file_references(body: str) -> list[FileReference]:
    """Collect unique relative file paths from SKILL.md body, in order of appearance."""
    found: list[str] = []
    seen: set[str] = set()

    def add(raw: str) -> None:
        path = _clean_path(raw)
        if not path or not _is_file_ref(path) or path in seen:
            return
        seen.add(path)
        found.append(path)

    for match in _MARKDOWN_LINK.finditer(body):
        add(match.group(1))
    for match in _BACKTICK.finditer(body):
        token = match.group(1).strip().split()[0] if match.group(1).strip() else ""
        add(token)
    for match in _BARE_KNOWN_PATH.finditer(body):
        add(match.group(1))

    return [FileReference(path=path, kind=_classify_path(path)) for path in found]
