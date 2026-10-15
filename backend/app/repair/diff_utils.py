"""
Diff utilities for generating unified diffs and structured line patches.
"""
from __future__ import annotations

import difflib
from pydantic import BaseModel


class DiffLine(BaseModel):
    type: str  # "add", "del", "context"
    line_number_old: int | None = None
    line_number_new: int | None = None
    content: str


class DiffHunk(BaseModel):
    header: str
    lines: list[DiffLine]


class DiffReport(BaseModel):
    unified_diff: str
    has_changes: bool
    additions_count: int
    deletions_count: int
    hunks: list[DiffHunk]


def compute_unified_diff(
    original: str,
    modified: str,
    from_file: str = "original/SKILL.md",
    to_file: str = "repaired/SKILL.md",
) -> str:
    """Generate a standard unified diff between two text strings."""
    orig_lines = original.splitlines(keepends=True)
    mod_lines = modified.splitlines(keepends=True)

    diff = difflib.unified_diff(
        orig_lines,
        mod_lines,
        fromfile=from_file,
        tofile=to_file,
        lineterm="",
    )
    return "\n".join(diff)


def parse_diff_to_structured(
    original: str,
    modified: str,
) -> DiffReport:
    """
    Computes a unified diff and parses it into structured hunks with line numbers
    for rich rendering in web UIs and CLI.
    """
    orig_lines = original.splitlines()
    mod_lines = modified.splitlines()

    unified = compute_unified_diff(original, modified)
    if not unified.strip():
        return DiffReport(
            unified_diff="",
            has_changes=False,
            additions_count=0,
            deletions_count=0,
            hunks=[],
        )

    # Use difflib.SequenceMatcher for structured hunk extraction
    matcher = difflib.SequenceMatcher(None, orig_lines, mod_lines)
    hunks: list[DiffHunk] = []
    additions = 0
    deletions = 0

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue

        hunk_lines: list[DiffLine] = []
        # Include up to 2 lines of preceding context if available
        pre_ctx_start = max(0, i1 - 2)
        pre_ctx_j_start = max(0, j1 - (i1 - pre_ctx_start))
        for idx in range(pre_ctx_start, i1):
            hunk_lines.append(
                DiffLine(
                    type="context",
                    line_number_old=idx + 1,
                    line_number_new=pre_ctx_j_start + (idx - pre_ctx_start) + 1,
                    content=orig_lines[idx],
                )
            )

        if tag in ("delete", "replace"):
            for idx in range(i1, i2):
                deletions += 1
                hunk_lines.append(
                    DiffLine(
                        type="del",
                        line_number_old=idx + 1,
                        line_number_new=None,
                        content=orig_lines[idx],
                    )
                )

        if tag in ("insert", "replace"):
            for idx in range(j1, j2):
                additions += 1
                hunk_lines.append(
                    DiffLine(
                        type="add",
                        line_number_old=None,
                        line_number_new=idx + 1,
                        content=mod_lines[idx],
                    )
                )

        # Include up to 2 lines of succeeding context
        post_ctx_end = min(len(orig_lines), i2 + 2)
        post_ctx_j_start = j2
        for offset, idx in enumerate(range(i2, post_ctx_end)):
            hunk_lines.append(
                DiffLine(
                    type="context",
                    line_number_old=idx + 1,
                    line_number_new=post_ctx_j_start + offset + 1,
                    content=orig_lines[idx],
                )
            )

        header = f"@@ -{i1 + 1},{i2 - i1} +{j1 + 1},{j2 - j1} @@"
        hunks.append(DiffHunk(header=header, lines=hunk_lines))

    return DiffReport(
        unified_diff=unified,
        has_changes=True,
        additions_count=additions,
        deletions_count=deletions,
        hunks=hunks,
    )
