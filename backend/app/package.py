"""
Skill Package & Reference File Resolver.
Handles base directory attachment, safe path resolution, file existence checks,
metadata extraction, and holistic context token economy accounting.
"""
from __future__ import annotations

import logging
from enum import Enum
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field

from app.parser import FileReference, SkillDocument, parse_skill_md

logger = logging.getLogger(__name__)

# ── Budget thresholds ─────────────────────────────────────────────────────────

PEAK_TOKEN_CAUTION_THRESHOLD = 8000
PEAK_TOKEN_WARN_THRESHOLD = 15000

BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf",
    ".zip", ".tar", ".gz", ".tgz", ".bz2", ".7z", ".bin",
    ".exe", ".dll", ".so", ".dylib", ".woff", ".woff2", ".ttf",
    ".eot", ".mp3", ".mp4", ".wav", ".avi", ".mov", ".wasm",
    ".parquet", ".pickle", ".pkl", ".pyc",
}


# ── Data Models ───────────────────────────────────────────────────────────────

class ReferenceFileStatus(str, Enum):
    FOUND = "found"
    MISSING = "missing"
    UNREADABLE = "unreadable"
    OUTSIDE_ROOT = "outside_root"


class ResolvedFileReference(BaseModel):
    relative_path: str
    kind: Literal["reference", "script", "asset", "other"]
    status: ReferenceFileStatus
    absolute_path: Optional[str] = None
    size_bytes: int = 0
    line_count: int = 0
    token_count: int = 0
    is_binary: bool = False
    content_preview: Optional[str] = None


class PackageTokenEconomy(BaseModel):
    catalog_tokens: int
    activation_tokens: int
    on_demand_tokens_by_file: dict[str, int] = Field(default_factory=dict)
    total_on_demand_tokens: int = 0
    peak_context_footprint: int = 0
    budget_status: Literal["within_budget", "caution", "exceeded"] = "within_budget"


class SkillPackage(BaseModel):
    base_dir: str
    skill_doc: SkillDocument
    resolved_files: list[ResolvedFileReference] = Field(default_factory=list)
    tokens: PackageTokenEconomy
    missing_files_count: int = 0
    found_files_count: int = 0


# ── Path & File Resolver ──────────────────────────────────────────────────────

def is_binary_file(file_path: Path) -> bool:
    """Determine if a file is binary based on suffix or non-text bytes."""
    if file_path.suffix.lower() in BINARY_EXTENSIONS:
        return True
    try:
        with file_path.open("rb") as f:
            chunk = f.read(1024)
            if b"\x00" in chunk:
                return True
    except Exception:
        pass
    return False


def resolve_file_reference(ref: FileReference, base_dir: Path | str) -> ResolvedFileReference:
    """
    Safely resolve a single FileReference against a base directory.

    Checks:
    - Path traversal outside base_dir (OUTSIDE_ROOT)
    - File existence (FOUND vs MISSING)
    - Read permissions / readability (UNREADABLE)
    - Metadata: size, line count, token count, text content preview
    """
    base_path = Path(base_dir).resolve()

    # Clean relative path: strip leading slashes or ./ to avoid treating as absolute
    rel_clean = ref.path.strip().lstrip("/\\")

    # Prevent path traversal
    try:
        target_path = (base_path / rel_clean).resolve()
        target_path.relative_to(base_path)
    except (ValueError, RuntimeError):
        return ResolvedFileReference(
            relative_path=ref.path,
            kind=ref.kind,
            status=ReferenceFileStatus.OUTSIDE_ROOT,
            absolute_path=None,
        )

    if not target_path.exists():
        return ResolvedFileReference(
            relative_path=ref.path,
            kind=ref.kind,
            status=ReferenceFileStatus.MISSING,
            absolute_path=str(target_path),
        )

    if not target_path.is_file():
        # Directory or special file
        return ResolvedFileReference(
            relative_path=ref.path,
            kind=ref.kind,
            status=ReferenceFileStatus.UNREADABLE,
            absolute_path=str(target_path),
        )

    try:
        stat_res = target_path.stat()
        size_bytes = stat_res.st_size
    except Exception as exc:
        logger.warning("Failed to stat %s: %s", target_path, exc)
        return ResolvedFileReference(
            relative_path=ref.path,
            kind=ref.kind,
            status=ReferenceFileStatus.UNREADABLE,
            absolute_path=str(target_path),
        )

    binary = is_binary_file(target_path)

    if binary:
        return ResolvedFileReference(
            relative_path=ref.path,
            kind=ref.kind,
            status=ReferenceFileStatus.FOUND,
            absolute_path=str(target_path),
            size_bytes=size_bytes,
            line_count=0,
            token_count=0,
            is_binary=True,
            content_preview=None,
        )

    # Text file processing
    try:
        text = target_path.read_text(encoding="utf-8", errors="replace")
        line_count = len(text.splitlines())
        token_count = len(text) // 4
        preview = text[:1000] if text else ""
        return ResolvedFileReference(
            relative_path=ref.path,
            kind=ref.kind,
            status=ReferenceFileStatus.FOUND,
            absolute_path=str(target_path),
            size_bytes=size_bytes,
            line_count=line_count,
            token_count=token_count,
            is_binary=False,
            content_preview=preview,
        )
    except Exception as exc:
        logger.warning("Failed to read text from %s: %s", target_path, exc)
        return ResolvedFileReference(
            relative_path=ref.path,
            kind=ref.kind,
            status=ReferenceFileStatus.UNREADABLE,
            absolute_path=str(target_path),
            size_bytes=size_bytes,
        )


# ── Token Economy Accounting ──────────────────────────────────────────────────

def compute_package_token_economy(
    doc: SkillDocument,
    resolved_files: list[ResolvedFileReference],
) -> PackageTokenEconomy:
    """
    Computes multi-tier context economy:
    - catalog: name + description (always present in agent skill index)
    - activation: SKILL.md body (loaded when activated)
    - on_demand: breakdown of tokens across found referenced files
    - peak_context_footprint: activation + sum(on_demand)
    """
    catalog_chars = 0
    if doc.name is not None:
        catalog_chars += len(str(doc.name))
    if doc.description is not None:
        catalog_chars += len(str(doc.description))
    catalog_tokens = catalog_chars // 4

    activation_tokens = len(doc.body) // 4

    on_demand_by_file: dict[str, int] = {}
    total_on_demand = 0

    for ref in resolved_files:
        if ref.status == ReferenceFileStatus.FOUND:
            on_demand_by_file[ref.relative_path] = ref.token_count
            total_on_demand += ref.token_count

    peak_context = activation_tokens + total_on_demand

    if peak_context > PEAK_TOKEN_WARN_THRESHOLD:
        budget_status = "exceeded"
    elif peak_context > PEAK_TOKEN_CAUTION_THRESHOLD:
        budget_status = "caution"
    else:
        budget_status = "within_budget"

    return PackageTokenEconomy(
        catalog_tokens=catalog_tokens,
        activation_tokens=activation_tokens,
        on_demand_tokens_by_file=on_demand_by_file,
        total_on_demand_tokens=total_on_demand,
        peak_context_footprint=peak_context,
        budget_status=budget_status,
    )


# ── Full Skill Package Resolver ───────────────────────────────────────────────

def resolve_skill_package(
    base_dir: Path | str,
    skill_content: Optional[str] = None,
) -> SkillPackage:
    """
    Discovers, parses, resolves and audits an entire skill package from a directory.

    Args:
        base_dir: Directory containing the skill or reference files.
        skill_content: Optional raw content of SKILL.md. If omitted, attempts to read
                       SKILL.md or skill.md from base_dir.

    Returns:
        SkillPackage with resolved file references, token economy, and file counts.
    """
    base_path = Path(base_dir).resolve()
    if not base_path.exists():
        raise FileNotFoundError(f"Base directory does not exist: {base_path}")
    if not base_path.is_dir():
        raise NotADirectoryError(f"Provided base path is not a directory: {base_path}")

    if skill_content is not None:
        doc = parse_skill_md(skill_content)
    else:
        candidates = [base_path / "SKILL.md", base_path / "skill.md"]
        skill_file = next((f for f in candidates if f.exists() and f.is_file()), None)
        if not skill_file:
            raise FileNotFoundError(f"No SKILL.md or skill.md found in base directory: {base_path}")
        raw = skill_file.read_text(encoding="utf-8")
        doc = parse_skill_md(raw)

    resolved: list[ResolvedFileReference] = [
        resolve_file_reference(ref, base_path) for ref in doc.referenced_files
    ]

    tokens = compute_package_token_economy(doc, resolved)

    found_count = sum(1 for r in resolved if r.status == ReferenceFileStatus.FOUND)
    missing_count = sum(1 for r in resolved if r.status == ReferenceFileStatus.MISSING)

    return SkillPackage(
        base_dir=str(base_path),
        skill_doc=doc,
        resolved_files=resolved,
        tokens=tokens,
        missing_files_count=missing_count,
        found_files_count=found_count,
    )
