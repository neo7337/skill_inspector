"""
Project-level file tree scanner and skill resolver.

Supports large multi-skill project roots: walks the whole tree, identifies
skill files anywhere in the hierarchy, and resolves a selected skill's
references relative to its own directory.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from app.package import (
    ResolvedFileReference,
    SkillPackage,
    compute_package_token_economy,
    resolve_file_reference,
)
from app.parser import parse_skill_md

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

# Directories to skip entirely during tree walk
IGNORE_DIRS: set[str] = {
    ".git", ".hg", ".svn",
    "node_modules", "__pycache__", ".venv", "venv", "env",
    "dist", "build", ".next", ".nuxt", ".output",
    ".mypy_cache", ".pytest_cache", ".ruff_cache",
    "coverage", ".coverage",
    ".DS_Store",
}

MAX_FILES = 2000       # safety cap: stop walking if tree exceeds this
MAX_DEPTH = 12         # safety cap: ignore directories deeper than this

# File extensions considered as potential skill candidates
SKILL_EXTENSIONS = {".md", ".markdown"}


# ── Data Models ───────────────────────────────────────────────────────────────

class FileTreeNode(BaseModel):
    name: str
    path: str                                    # relative to project root
    type: Literal["file", "dir"]
    children: list[FileTreeNode] = Field(default_factory=list)
    is_skill_file: bool = False                  # True if detected as a valid SKILL.md
    size_bytes: int | None = None
    extension: str | None = None


FileTreeNode.model_rebuild()  # required for self-referential model


class ProjectScanResult(BaseModel):
    root_dir: str
    tree: FileTreeNode                           # root node (type=dir)
    skill_files: list[str]                       # relative paths of detected skill files
    total_files: int
    total_dirs: int
    truncated: bool = False                      # True if MAX_FILES was hit


# ── Scanner ───────────────────────────────────────────────────────────────────

def _is_skill_file(path: Path) -> bool:
    """Quick heuristic: .md file whose first non-empty line starts with '---'."""
    if path.suffix.lower() not in SKILL_EXTENSIONS:
        return False
    try:
        with path.open("r", encoding="utf-8", errors="replace") as f:
            for line in f:
                stripped = line.strip()
                if stripped:
                    return stripped == "---"
    except Exception:
        pass
    return False


def scan_project(root_dir: Path | str) -> ProjectScanResult:
    """
    Walk the entire project directory tree and return a FileTreeNode hierarchy.

    Skips ignored directories, respects MAX_FILES / MAX_DEPTH limits, and
    identifies skill files anywhere in the tree.
    """
    root_path = Path(root_dir).resolve()
    if not root_path.exists():
        raise FileNotFoundError(f"Project root does not exist: {root_path}")
    if not root_path.is_dir():
        raise NotADirectoryError(f"Project root is not a directory: {root_path}")

    total_files = 0
    total_dirs = 0
    truncated = False
    skill_files: list[str] = []

    def walk(dir_path: Path, depth: int) -> FileTreeNode:
        nonlocal total_files, total_dirs, truncated

        node = FileTreeNode(
            name=dir_path.name or root_path.name,
            path=str(dir_path.relative_to(root_path)) if dir_path != root_path else ".",
            type="dir",
        )

        if depth > MAX_DEPTH:
            return node

        try:
            entries = sorted(dir_path.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
        except PermissionError:
            return node

        dirs: list[Path] = []
        files: list[Path] = []
        for entry in entries:
            if entry.is_symlink():
                continue
            if entry.is_dir():
                if entry.name not in IGNORE_DIRS:
                    dirs.append(entry)
            elif entry.is_file():
                files.append(entry)

        # Dirs first, then files
        for d in dirs:
            if total_files >= MAX_FILES:
                truncated = True
                break
            total_dirs += 1
            child = walk(d, depth + 1)
            node.children.append(child)

        for f in files:
            if total_files >= MAX_FILES:
                truncated = True
                break
            total_files += 1
            rel = str(f.relative_to(root_path))
            is_skill = _is_skill_file(f)
            if is_skill:
                skill_files.append(rel)

            child = FileTreeNode(
                name=f.name,
                path=rel,
                type="file",
                is_skill_file=is_skill,
                size_bytes=f.stat().st_size,
                extension=f.suffix.lower() or None,
            )
            node.children.append(child)

        return node

    root_node = walk(root_path, depth=0)
    root_node.name = root_path.name
    root_node.path = "."

    return ProjectScanResult(
        root_dir=str(root_path),
        tree=root_node,
        skill_files=skill_files,
        total_files=total_files,
        total_dirs=total_dirs,
        truncated=truncated,
    )


# ── Skill Resolver ────────────────────────────────────────────────────────────

def resolve_skill_in_project(
    root_dir: Path | str,
    skill_relative_path: str,
) -> SkillPackage:
    """
    Read and resolve a skill file found anywhere inside root_dir.

    References inside the skill are resolved relative to the skill file's own
    directory (not the project root), which matches agentskills.io convention.
    For example, a skill at plugins/deploy/SKILL.md whose body references
    'references/guide.md' will look for plugins/deploy/references/guide.md.

    Args:
        root_dir: Absolute path to the project root.
        skill_relative_path: Path of the skill file relative to root_dir.

    Returns:
        SkillPackage with resolved references and token economy.
    """
    root_path = Path(root_dir).resolve()
    rel_clean = skill_relative_path.strip().lstrip("/\\")

    # Path-traversal guard
    try:
        skill_abs = (root_path / rel_clean).resolve()
        skill_abs.relative_to(root_path)
    except (ValueError, RuntimeError):
        raise ValueError(f"Path traversal detected in skill path: {skill_relative_path}")

    if not skill_abs.exists():
        raise FileNotFoundError(f"Skill file not found: {skill_abs}")
    if not skill_abs.is_file():
        raise ValueError(f"Skill path is not a file: {skill_abs}")

    raw = skill_abs.read_text(encoding="utf-8", errors="replace")
    doc = parse_skill_md(raw)

    # References resolve relative to the skill's own directory
    skill_dir = skill_abs.parent

    resolved: list[ResolvedFileReference] = [
        resolve_file_reference(ref, skill_dir) for ref in doc.referenced_files
    ]

    tokens = compute_package_token_economy(doc, resolved)
    from app.package import ReferenceFileStatus
    found_count = sum(1 for r in resolved if r.status == ReferenceFileStatus.FOUND)
    missing_count = sum(1 for r in resolved if r.status == ReferenceFileStatus.MISSING)

    return SkillPackage(
        base_dir=str(skill_dir),
        skill_doc=doc,
        resolved_files=resolved,
        tokens=tokens,
        found_files_count=found_count,
        missing_files_count=missing_count,
    )
