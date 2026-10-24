"""
Trajectory & Step-Economy Profiler Engine.
Analyzes agent execution paths against baselines, flagging redundant loops,
token bloat, and step budget deviations.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
import re
from typing import Any

from app.profiler.models import (
    TrajectoryTrace,
    ToolCallRecord,
    RedundantCallFinding,
    StepBudgetAnalysis,
    TokenEfficiencyAnalysis,
    TrajectoryProfileReport,
    ReferenceAccessAudit,
)

logger = logging.getLogger(__name__)


def _normalize_path(p: str) -> str:
    """Normalize file path for consistent matching."""
    p = p.strip().replace("\\", "/")
    while p.startswith("./"):
        p = p[2:]
    return p.lstrip("/")


def _extract_file_paths_from_tool_call(call: ToolCallRecord) -> list[str]:
    """Extract candidate file paths targeted by a tool call."""
    paths: list[str] = []
    args = call.tool_arguments or {}

    # 1. Direct path arguments
    for key in (
        "AbsolutePath",
        "TargetFile",
        "path",
        "file_path",
        "file",
        "filename",
        "filepath",
        "doc_path",
        "source_file",
    ):
        val = args.get(key)
        if isinstance(val, str) and val.strip():
            val = val.strip()
            if not val.startswith(("http://", "https://")):
                paths.append(val)

    # 2. Command line arguments (for bash/run_command/exec)
    for cmd_key in ("CommandLine", "command", "cmd", "script"):
        cmd = args.get(cmd_key)
        if isinstance(cmd, str) and cmd.strip():
            matches = re.findall(
                r'(?:cat|head|tail|python\d?|bash|sh|\.\/)\s+(?:-[^\s]+\s+)*([^\s;&|]+)',
                cmd,
            )
            for m in matches:
                m = m.strip().strip("'\"")
                if m and not m.startswith("-") and not m.startswith(("http://", "https://")):
                    paths.append(m)

            direct_scripts = re.findall(
                r'(?:^|[;&|\s])(\.?\.?/[^\s;&|]+\.(?:py|sh|bash|md|txt|json|yaml|yml|js|ts))',
                cmd,
            )
            for s in direct_scripts:
                s = s.strip().strip("'\"")
                if s and not s.startswith(("http://", "https://")):
                    paths.append(s)

    # Deduplicate preserving order
    seen = set()
    deduped = []
    for p in paths:
        if p not in seen:
            seen.add(p)
            deduped.append(p)
    return deduped


def _match_path_to_declared(
    accessed_path: str,
    declared_paths: list[str],
    base_dir: str | None = None,
) -> str | None:
    """Returns the declared reference path if accessed_path matches one, or None."""
    acc_clean = _normalize_path(accessed_path)

    # 1. Exact match against normalized declared paths
    for dec in declared_paths:
        if acc_clean == _normalize_path(dec):
            return dec

    # 2. If base_dir is available, try filesystem-level resolution
    if base_dir:
        try:
            base = Path(base_dir).resolve()
            acc_p = Path(accessed_path)
            if not acc_p.is_absolute():
                acc_p = (base / acc_p).resolve()
            else:
                acc_p = acc_p.resolve()

            for dec in declared_paths:
                dec_p = (base / _normalize_path(dec)).resolve()
                if acc_p == dec_p:
                    return dec
        except Exception:
            pass

    # 3. Path suffix match (e.g. /workspace/skills/my-skill/references/guide.md matches references/guide.md)
    for dec in declared_paths:
        dec_clean = _normalize_path(dec)
        if acc_clean.endswith("/" + dec_clean):
            return dec

    return None



def _jaccard_similarity(str1: str, str2: str) -> float:
    """Computes word-level Jaccard similarity between two strings."""
    s1 = re.sub(r"[_\W]+", " ", str1.lower()).strip()
    s2 = re.sub(r"[_\W]+", " ", str2.lower()).strip()
    tokens1 = set(s1.split())
    tokens2 = set(s2.split())
    if not tokens1 or not tokens2:
        return 0.0
    intersection = len(tokens1.intersection(tokens2))
    union = len(tokens1.union(tokens2))
    return intersection / union if union > 0 else 0.0


def parse_trace_from_raw(data: Any) -> TrajectoryTrace:
    """
    Parses various trace formats into standard TrajectoryTrace.
    Supports:
    - TrajectoryTrace dict
    - List of tool calls
    - Transcript JSON / JSONL dicts
    """
    if isinstance(data, str):
        try:
            data = json.loads(data)
        except json.JSONDecodeError:
            # Try parsing line-by-line JSONL
            records = []
            for line in data.splitlines():
                if line.strip():
                    try:
                        records.append(json.loads(line))
                    except Exception:
                        pass
            data = records

    if isinstance(data, list):
        # List of tool call objects or steps
        records: list[ToolCallRecord] = []
        for idx, item in enumerate(data, 1):
            if isinstance(item, dict):
                # Check if it has 'tool_calls' array (transcript step)
                if "tool_calls" in item and isinstance(item["tool_calls"], list):
                    for tc in item["tool_calls"]:
                        records.append(
                            ToolCallRecord(
                                step_index=len(records) + 1,
                                tool_name=tc.get("tool_name") or tc.get("name") or "unknown_tool",
                                tool_arguments=tc.get("arguments") or tc.get("args") or {},
                                is_error=item.get("status") == "ERROR",
                            )
                        )
                else:
                    # Direct tool call record
                    records.append(
                        ToolCallRecord(
                            step_index=idx,
                            tool_name=item.get("tool_name") or item.get("name") or "unknown_tool",
                            tool_arguments=item.get("tool_arguments") or item.get("args") or item.get("arguments") or {},
                            tool_output=item.get("tool_output") or item.get("output"),
                            is_error=bool(item.get("is_error") or item.get("status") == "ERROR"),
                            tokens_prompt=item.get("tokens_prompt", 0),
                            tokens_completion=item.get("tokens_completion", 0),
                            duration_ms=float(item.get("duration_ms", 0.0)),
                        )
                    )
        return TrajectoryTrace(tool_calls=records)

    if isinstance(data, dict):
        if "tool_calls" in data and isinstance(data["tool_calls"], list):
            try:
                return TrajectoryTrace(**data)
            except Exception:
                # Reconstruct tool_calls
                records = []
                for idx, tc in enumerate(data["tool_calls"], 1):
                    if isinstance(tc, dict):
                        records.append(
                            ToolCallRecord(
                                step_index=tc.get("step_index", idx),
                                tool_name=tc.get("tool_name") or tc.get("name") or "unknown_tool",
                                tool_arguments=tc.get("tool_arguments") or tc.get("args") or tc.get("arguments") or {},
                                tool_output=tc.get("tool_output") or tc.get("output"),
                                is_error=bool(tc.get("is_error") or tc.get("status") == "ERROR"),
                                tokens_prompt=tc.get("tokens_prompt", 0),
                                tokens_completion=tc.get("tokens_completion", 0),
                                duration_ms=float(tc.get("duration_ms", 0.0)),
                            )
                        )
                return TrajectoryTrace(
                    task_id=str(data.get("task_id", "task_01")),
                    task_description=str(data.get("task_description", "")),
                    skill_name=str(data.get("skill_name", "custom-skill")),
                    skill_content=data.get("skill_content"),
                    tool_calls=records,
                    final_status=data.get("final_status", "success"),
                    baseline_step_budget=data.get("baseline_step_budget"),
                )

    return TrajectoryTrace()


class TrajectoryProfiler:
    """Profiles agent execution paths for redundancies, token bloat, and step waste."""

    def profile(
        self,
        trace_data: Any,
        skill_content: str | None = None,
        custom_baseline_steps: int | None = None,
        baseline_steps: int | None = None,
        base_dir: str | None = None,
        skill_package: Any | None = None,
    ) -> TrajectoryProfileReport:
        effective_baseline = custom_baseline_steps if custom_baseline_steps is not None else baseline_steps
        trace = parse_trace_from_raw(trace_data)
        
        # Resolve declared references if skill_content, base_dir, or skill_package is provided
        declared_refs: list[str] = []
        effective_skill_content = skill_content or trace.skill_content

        if skill_package is not None and hasattr(skill_package, "skill_doc"):
            declared_refs = [r.path for r in skill_package.skill_doc.referenced_files]
            if not effective_skill_content:
                effective_skill_content = skill_package.skill_doc.raw
        elif effective_skill_content:
            try:
                from app.parser import parse_skill_md
                doc = parse_skill_md(effective_skill_content)
                declared_refs = [r.path for r in doc.referenced_files]
            except Exception as exc:
                logger.warning("Failed to parse skill_content in profiler: %s", exc)
        elif base_dir:
            try:
                from app.package import resolve_skill_package
                pkg = resolve_skill_package(base_dir)
                declared_refs = [r.path for r in pkg.skill_doc.referenced_files]
                effective_skill_content = pkg.skill_doc.raw
            except Exception as exc:
                logger.warning("Failed to resolve package from base_dir in profiler: %s", exc)

        if effective_skill_content and not trace.skill_content:
            trace.skill_content = effective_skill_content

        tool_calls = trace.tool_calls
        redundancies: list[RedundantCallFinding] = []
        redundant_step_indices: set[int] = set()

        # Step 1: Detect Subsumed File Reads & Redundant Reference Reads
        # Tracks last viewed file and whether a write/mutation occurred in between
        file_reads: dict[str, list[int]] = {}
        file_write_tools = {"write_to_file", "replace_file_content", "multi_replace_file_content", "edit_file"}
        file_read_tools = {"view_file", "read_file", "cat"}

        for call in tool_calls:
            tname = call.tool_name.lower()
            if any(w in tname for w in file_write_tools):
                # File was modified; clear past read caches for this path
                path = str(call.tool_arguments.get("TargetFile") or call.tool_arguments.get("path") or "")
                if path in file_reads:
                    del file_reads[path]
            elif any(r in tname for r in file_read_tools):
                path = str(call.tool_arguments.get("AbsolutePath") or call.tool_arguments.get("path") or "")
                if path:
                    matched_ref = _match_path_to_declared(path, declared_refs, base_dir) if declared_refs else None
                    if path in file_reads:
                        past_indices = file_reads[path]
                        all_indices = past_indices + [call.step_index]
                        redundant_step_indices.add(call.step_index)
                        if matched_ref:
                            redundancies.append(
                                RedundantCallFinding(
                                    step_indices=all_indices,
                                    kind="redundant_reference_read",
                                    severity="warn",
                                    title=f"Redundant reference read on '{matched_ref.split('/')[-1]}'",
                                    detail=(
                                        f"Declared reference '{matched_ref}' was read at step {call.step_index} despite having already been "
                                        f"read at step(s) {past_indices} without any intervening file edits."
                                    ),
                                    suggested_skill_fix=(
                                        f"Instruct the agent in SKILL.md to retain content from '{matched_ref}' in context rather than "
                                        "re-reading the reference file multiple times."
                                    ),
                                )
                            )
                        else:
                            redundancies.append(
                                RedundantCallFinding(
                                    step_indices=all_indices,
                                    kind="subsumed_file_read",
                                    severity="warn",
                                    title=f"Redundant file read on '{path.split('/')[-1]}'",
                                    detail=(
                                        f"File '{path}' was read at step {call.step_index} despite having already been "
                                        f"read at step(s) {past_indices} without any intervening file edits."
                                    ),
                                    suggested_skill_fix=(
                                        "Instruct the agent in SKILL.md to retain file context or read specific "
                                        "line ranges rather than re-reading the entire file multiple times."
                                    ),
                                )
                            )
                        file_reads[path].append(call.step_index)
                    else:
                        file_reads[path] = [call.step_index]

        # Step 2: Detect Repeated Search Loops / Query Thrashing
        search_tools = {"grep_search", "search_web", "find", "search", "semantic_search"}
        search_calls: list[tuple[int, str]] = []

        for call in tool_calls:
            tname = call.tool_name.lower()
            if any(s in tname for s in search_tools):
                query = str(
                    call.tool_arguments.get("Query")
                    or call.tool_arguments.get("query")
                    or call.tool_arguments.get("q")
                    or ""
                ).strip()
                if query:
                    # Check against previous searches
                    for prev_idx, prev_query in search_calls[-3:]:  # check recent search window
                        sim = _jaccard_similarity(query, prev_query)
                        if sim >= 0.7 or query == prev_query:
                            redundant_step_indices.add(call.step_index)
                            redundancies.append(
                                RedundantCallFinding(
                                    step_indices=[prev_idx, call.step_index],
                                    kind="repeated_search",
                                    severity="warn" if sim < 1.0 else "fail",
                                    title=f"Search loop detected: '{query[:30]}...'",
                                    detail=(
                                        f"Step {call.step_index} repeated search query '{query}' which has "
                                        f"{int(sim * 100)}% similarity to previous query at step {prev_idx}."
                                    ),
                                    suggested_skill_fix=(
                                        "Add an explicit guideline in SKILL.md: 'If initial search returns 0 results, "
                                        "do not retry with minor variants; inspect directory structure or broaden regex.'"
                                    ),
                                )
                            )
                            break
                    search_calls.append((call.step_index, query))

        # Step 3: Detect Error Ping-Pong (Uncorrected Retries)
        for i in range(1, len(tool_calls)):
            prev = tool_calls[i - 1]
            curr = tool_calls[i]
            if prev.is_error and prev.tool_name == curr.tool_name:
                # Compare arguments
                prev_args = json.dumps(prev.tool_arguments, sort_keys=True)
                curr_args = json.dumps(curr.tool_arguments, sort_keys=True)
                if prev_args == curr_args:
                    redundant_step_indices.add(curr.step_index)
                    redundancies.append(
                        RedundantCallFinding(
                            step_indices=[prev.step_index, curr.step_index],
                            kind="error_ping_pong",
                            severity="fail",
                            title=f"Error ping-pong retry in {curr.tool_name}",
                            detail=(
                                f"Step {curr.step_index} invoked '{curr.tool_name}' with identical arguments "
                                f"immediately after step {prev.step_index} failed with an error."
                            ),
                            suggested_skill_fix=(
                                "Add explicit error recovery instructions in SKILL.md: "
                                "'If a tool returns an error, analyze the error parameters before re-attempting.'"
                            ),
                        )
                    )

        # Step 3b: Reference Access Audit (Trace vs Declared Skill References)
        reference_audit: ReferenceAccessAudit | None = None
        if declared_refs or effective_skill_content or base_dir:
            accessed_files_set: set[str] = set()
            accessed_declared: set[str] = set()
            undeclared_set: set[str] = set()
            ref_reads_map: dict[str, list[int]] = {}

            for call in tool_calls:
                paths = _extract_file_paths_from_tool_call(call)
                for p in paths:
                    p_norm = _normalize_path(p)
                    # Ignore the skill document itself
                    if p_norm.lower() == "skill.md" or p_norm.lower().endswith("/skill.md"):
                        continue

                    accessed_files_set.add(p)
                    matched_ref = _match_path_to_declared(p, declared_refs, base_dir) if declared_refs else None
                    if matched_ref:
                        accessed_declared.add(matched_ref)
                        if matched_ref not in ref_reads_map:
                            ref_reads_map[matched_ref] = []
                        ref_reads_map[matched_ref].append(call.step_index)
                    else:
                        # Undeclared file access
                        if p not in undeclared_set:
                            undeclared_set.add(p)
                            redundancies.append(
                                RedundantCallFinding(
                                    step_indices=[call.step_index],
                                    kind="undeclared_file_access",
                                    severity="warn",
                                    title=f"Undeclared file access: '{p.split('/')[-1]}'",
                                    detail=(
                                        f"Step {call.step_index} accessed file '{p}', which is not declared "
                                        "in SKILL.md referenced files."
                                    ),
                                    suggested_skill_fix=(
                                        f"Declare '{p}' in SKILL.md references or links if this file is a required dependency."
                                    ),
                                )
                            )

            # Redundant reference reads from commands/tools not caught by Step 1
            existing_ref_findings = {
                f.title for f in redundancies if f.kind == "redundant_reference_read"
            }
            for r, steps in ref_reads_map.items():
                if len(steps) > 1:
                    title = f"Redundant reference read on '{r.split('/')[-1]}'"
                    if title not in existing_ref_findings:
                        redundant_step_indices.update(steps[1:])
                        redundancies.append(
                            RedundantCallFinding(
                                step_indices=steps,
                                kind="redundant_reference_read",
                                severity="warn",
                                title=title,
                                detail=(
                                    f"Declared reference '{r}' was accessed {len(steps)} times "
                                    f"at steps {steps} without retaining context."
                                ),
                                suggested_skill_fix=(
                                    f"Instruct the agent in SKILL.md to retain content from '{r}' "
                                    "in context rather than re-reading it."
                                ),
                            )
                        )

            unaccessed = [r for r in declared_refs if r not in accessed_declared]
            redundant_refs = [r for r, steps in ref_reads_map.items() if len(steps) > 1]

            coverage_ratio = round(len(accessed_declared) / len(declared_refs), 2) if declared_refs else 1.0
            coverage_pct = round((len(accessed_declared) / len(declared_refs)) * 100, 1) if declared_refs else 100.0

            summary_parts = []
            if declared_refs:
                summary_parts.append(
                    f"{len(accessed_declared)}/{len(declared_refs)} declared references accessed ({coverage_pct}% coverage)."
                )
            else:
                summary_parts.append("0 declared references in skill.")

            if undeclared_set:
                summary_parts.append(f"{len(undeclared_set)} undeclared file access(es) flagged.")
            if redundant_refs:
                summary_parts.append(f"{len(redundant_refs)} declared reference(s) read redundantly.")
            summary = " ".join(summary_parts)

            reference_audit = ReferenceAccessAudit(
                declared_references=declared_refs,
                accessed_files=sorted(list(accessed_files_set)),
                referenced_files_accessed=sorted(list(accessed_declared)),
                unaccessed_references=sorted(unaccessed),
                undeclared_accesses=sorted(list(undeclared_set)),
                coverage_ratio=coverage_ratio,
                coverage_pct=coverage_pct,
                redundant_reference_reads=sorted(redundant_refs),
                summary=summary,
            )

        # Step 4: Step Budget Tracking
        actual_steps = len(tool_calls)
        baseline = effective_baseline or trace.baseline_step_budget
        if not baseline or baseline <= 0:
            # Heuristic baseline: productive steps without redundancies, minimum 2
            baseline = max(2, actual_steps - len(redundant_step_indices))

        variance_ratio = round(actual_steps / baseline, 2) if baseline > 0 else 1.0

        if variance_ratio > 2.5:
            budget_status = "fail"
            budget_msg = (
                f"Step explosion: Agent took {actual_steps} steps vs expected baseline of {baseline} "
                f"({variance_ratio}x budget)."
            )
        elif variance_ratio > 1.4:
            budget_status = "warn"
            budget_msg = (
                f"Step budget elevated: Agent took {actual_steps} steps vs baseline of {baseline} "
                f"({variance_ratio}x budget)."
            )
        else:
            budget_status = "pass"
            budget_msg = f"Step budget healthy: {actual_steps} steps within baseline {baseline}."

        step_budget_analysis = StepBudgetAnalysis(
            actual_steps=actual_steps,
            baseline_steps=baseline,
            variance_ratio=variance_ratio,
            status=budget_status,
            message=budget_msg,
        )

        # Step 5: Token Efficiency & Context Bloat Scorer
        total_tokens = sum(c.tokens_prompt + c.tokens_completion for c in tool_calls)
        redundant_tokens = sum(
            c.tokens_prompt + c.tokens_completion
            for c in tool_calls
            if c.step_index in redundant_step_indices
        )

        # Skill context tokens estimate
        skill_chars = len(trace.skill_content or "")
        skill_tokens_est = skill_chars // 4

        # Calculate bloat ratio: skill context vs task payload
        if total_tokens > 0:
            bloat_ratio = round((skill_tokens_est * actual_steps) / max(total_tokens, 1), 2)
        else:
            bloat_ratio = 1.0

        # Score calculation (0-100)
        # Deduct for redundancies and step explosion
        penalty = (len(redundant_step_indices) * 15) + max(0, int((variance_ratio - 1.0) * 25))
        score = max(0, min(100, 100 - penalty))

        if score >= 75:
            token_status_msg = "Execution trajectory is concise and token-efficient."
        elif score >= 50:
            token_status_msg = "Moderate token waste detected from repeated tool invocations or query loops."
        else:
            token_status_msg = "High token waste and context bloat detected. Agent is thrashing across tool calls."

        token_analysis = TokenEfficiencyAnalysis(
            total_tokens=total_tokens,
            redundant_tokens=redundant_tokens,
            skill_context_tokens=skill_tokens_est,
            bloat_ratio=bloat_ratio,
            score=score,
            message=token_status_msg,
        )

        # Overall Status
        if budget_status == "fail" or score < 50:
            overall_status = "fail"
        elif budget_status == "warn" or score < 75 or len(redundancies) > 0:
            overall_status = "warn"
        else:
            overall_status = "pass"

        # Timeline Summary
        timeline = []
        for call in tool_calls:
            is_redundant = call.step_index in redundant_step_indices
            timeline.append({
                "step_index": call.step_index,
                "tool_name": call.tool_name,
                "is_error": call.is_error,
                "is_redundant": is_redundant,
                "duration_ms": call.duration_ms,
                "tokens": call.tokens_prompt + call.tokens_completion,
            })

        return TrajectoryProfileReport(
            task_id=trace.task_id,
            skill_name=trace.skill_name,
            overall_efficiency_score=score,
            status=overall_status,
            step_budget=step_budget_analysis,
            token_efficiency=token_analysis,
            redundancies=redundancies,
            timeline_summary=timeline,
            reference_audit=reference_audit,
        )
