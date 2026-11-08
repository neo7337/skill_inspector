"""
Skill Inspector CLI.
Command-line companion for validating, auto-fixing, profiling, and generating tests for agent skills.
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax
from rich.table import Table

from app import __version__
from app.config import CONFIG_FILE, CLIConfig, init_default_config, load_config
from app.package import ReferenceFileStatus, SkillPackage, resolve_skill_package
from app.parser import ParseError, parse_skill_md
from app.profiler import TrajectoryProfiler
from app.repair import DeterministicRepairEngine, LLMRepairEngine
from app.scenarios import (
    ScenarioGenerator,
    export_as_json,
    export_as_markdown,
    export_as_pytest,
)
from app.validators.llm_judge import ProviderConfig, run_llm_validation
from app.validators.static import run_static_validation

app = typer.Typer(
    name="skill-inspector",
    help="Inspector, auto-fixer, trajectory profiler, and synthetic test generator for agent skills.",
    add_completion=False,
)
console = Console()

def version_callback(value: bool):
    if value:
        typer.echo(f"skill-inspector cli version: {__version__}")
        raise typer.Exit()

def resolve_llm_credentials(
    provider: str | None,
    model: str | None,
    api_key: str | None,
    cfg: CLIConfig,
) -> tuple[str, str, str | None]:
    """Resolve provider, model, and API key using CLI flags, config.json, and env vars."""
    resolved_provider = provider or cfg.llm.default_provider or "openai"
    resolved_model = model or cfg.llm.default_model or "gpt-4o"
    
    # Priority: explicit flag -> config api_keys[provider] -> env var (e.g. OPENAI_API_KEY)
    resolved_api_key = (
        api_key
        or cfg.llm.api_keys.get(resolved_provider)
        or os.getenv(f"{resolved_provider.upper()}_API_KEY")
    )
    return resolved_provider, resolved_model, resolved_api_key


@app.callback()
def root_callback(
    version: bool = typer.Option(
        None, "--version", "-v", callback=version_callback, is_eager=True, help="Show the application version"
    )
):
    """Skill Inspector CLI"""

@app.command("validate")
def validate_command(
    file: Path = typer.Argument(..., help="Path to SKILL.md file", exists=True),
    base_dir: Path | None = typer.Option(
        None, "--base-dir", "-d", help="Base directory of the skill package (defaults to parent folder of SKILL.md or config.json)"
    ),
    llm: bool = typer.Option(False, "--llm", help="Also run LLM-as-a-Judge validation"),
    provider: str | None = typer.Option(None, "--provider", help="LLM provider (openai, anthropic, ollama)"),
    model: str | None = typer.Option(None, "--model", help="LLM model name"),
    api_key: str | None = typer.Option(None, "--api-key", help="API key for provider"),
    mode: str = typer.Option("standard", "--mode", "-m", help="Linting mode: 'standard' (agentskills.io spec) or 'claude-code' (also accepts Claude Code / plugin fields)"),
):
    """Run structural and quality validation on a SKILL.md file."""
    cli_cfg = load_config()
    content = file.read_text(encoding="utf-8")
    console.print(f"\n[bold cyan]Validating:[/] {file.resolve()}")
    if mode == "claude-code":
        console.print("[bold blue]Mode:[/] Claude Code / Plugin (Claude Code-specific fields accepted)")
    else:
        console.print("[dim]Mode:[/] Standard (agentskills.io spec)")

    try:
        doc = parse_skill_md(content)
    except ParseError as exc:
        console.print(f"[bold red]Parse Error:[/] {exc.message}")
        raise typer.Exit(code=1)

    configured_base = Path(cli_cfg.validation.base_dir) if cli_cfg.validation.base_dir else None
    resolved_base = (base_dir or configured_base or file.parent).resolve()
    pkg: SkillPackage | None = None
    if resolved_base.is_dir():
        try:
            pkg = resolve_skill_package(resolved_base, skill_content=content)
        except Exception as exc:
            console.print(f"[bold yellow]Warning:[/] Could not resolve package in {resolved_base}: {exc}")

    static_report = run_static_validation(doc, base_dir=resolved_base, package=pkg, mode=mode)

    # Render static table
    table = Table(title=f"Static Validation (Score: {static_report.score}/100 - {static_report.overall_status.value.upper()})")
    table.add_column("Rule", style="cyan")
    table.add_column("Status", style="bold")
    table.add_column("Message")

    for f in static_report.findings:
        color = "green" if f.status.value == "pass" else "yellow" if f.status.value == "warn" else "red"
        table.add_row(f.rule, f"[{color}]{f.status.value.upper()}[/{color}]", f.message)

    console.print(table)

    # Render package references & token economy
    if pkg is not None and pkg.resolved_files:
        ref_table = Table(title=f"Referenced Files & Package Integrity ({pkg.found_files_count} found, {pkg.missing_files_count} missing)")
        ref_table.add_column("Referenced File", style="cyan")
        ref_table.add_column("Kind")
        ref_table.add_column("Status", style="bold")
        ref_table.add_column("Size", justify="right")
        ref_table.add_column("Tokens", justify="right")

        for ref in pkg.resolved_files:
            if ref.status == ReferenceFileStatus.FOUND:
                status_text = "[green]FOUND[/]"
                size_text = f"{ref.size_bytes / 1024:.1f} KB" if ref.size_bytes >= 1024 else f"{ref.size_bytes} B"
                tokens_text = f"~{ref.token_count:,}"
            elif ref.status == ReferenceFileStatus.MISSING:
                status_text = "[red]MISSING[/]"
                size_text = "—"
                tokens_text = "—"
            elif ref.status == ReferenceFileStatus.OUTSIDE_ROOT:
                status_text = "[red]OUTSIDE ROOT[/]"
                size_text = "—"
                tokens_text = "—"
            else:
                status_text = "[yellow]UNREADABLE[/]"
                size_text = "—"
                tokens_text = "—"

            ref_table.add_row(ref.relative_path, ref.kind.upper(), status_text, size_text, tokens_text)

        console.print(ref_table)

        budget_color = (
            "green" if pkg.tokens.budget_status == "within_budget"
            else "yellow" if pkg.tokens.budget_status == "caution"
            else "red"
        )
        summary_text = (
            f"[bold]Inactive Catalog:[/] ~{pkg.tokens.catalog_tokens:,} tokens  |  "
            f"[bold]Active Body:[/] ~{pkg.tokens.activation_tokens:,} tokens  |  "
            f"[bold]On-Demand References:[/] ~{pkg.tokens.total_on_demand_tokens:,} tokens\n"
            f"[bold]Peak Context Footprint:[/] [{budget_color}]~{pkg.tokens.peak_context_footprint:,} tokens "
            f"({pkg.tokens.budget_status.replace('_', ' ').upper()})[/{budget_color}]"
        )
        console.print(Panel(summary_text, title="Context & Token Economy Footprint", border_style="cyan"))
    else:
        est = doc.token_estimate
        summary_text = (
            f"[bold]Catalog:[/] ~{est['catalog']:,} tokens  |  "
            f"[bold]Active Body:[/] ~{est['body']:,} tokens  |  "
            f"[bold]Total File:[/] ~{est['total']:,} tokens"
        )
        console.print(Panel(summary_text, title="Skill Token Estimate", border_style="cyan"))

    if llm:
        prov, mdl, key = resolve_llm_credentials(provider, model, api_key, cli_cfg)
        console.print(f"\n[bold cyan]Running LLM Judge ({prov}:{mdl})...[/]")
        cfg = ProviderConfig(provider=prov, model=mdl, api_key=key)  # type: ignore
        llm_report = asyncio.run(run_llm_validation(doc, cfg))

        llm_table = Table(title=f"LLM Judge Evaluation (Overall Score: {llm_report.overall_score}/100)")
        llm_table.add_column("Dimension", style="cyan")
        llm_table.add_column("Score", justify="right")
        llm_table.add_column("Status")
        llm_table.add_column("Findings & Advice")

        dims = [
            ("Description Quality", llm_report.description_quality),
            ("Instruction Clarity", llm_report.instruction_clarity),
            ("Scope & Boundaries", llm_report.scope_and_boundaries),
            ("Token Efficiency", llm_report.token_efficiency),
        ]
        for name, dim in dims:
            color = "green" if dim.status == "pass" else "yellow" if dim.status == "warn" else "red"
            summary = "\n".join(f"• {f}" for f in dim.findings[:2])
            llm_table.add_row(name, f"{dim.score}", f"[{color}]{dim.status.upper()}[/{color}]", summary)

        console.print(llm_table)


@app.command("fix")
def fix_command(
    file: Path = typer.Argument(..., help="Path to SKILL.md file", exists=True),
    apply: bool = typer.Option(False, "--apply", "-a", help="Overwrite file with repaired content"),
    safe_only: bool = typer.Option(True, "--safe/--all", help="Apply only safe deterministic repairs"),
    dry_run: bool = typer.Option(False, "--dry-run", help="Display unified diff without changing file"),
    llm_refactor: bool = typer.Option(False, "--llm", help="Use LLM to refactor ambiguous instructions"),
    provider: str | None = typer.Option(None, "--provider", help="LLM provider for refactor"),
    model: str | None = typer.Option(None, "--model", help="LLM model name"),
    api_key: str | None = typer.Option(None, "--api-key", help="API key for provider"),
):
    """Automatically repair frontmatter schema errors and refactor instructions."""
    cli_cfg = load_config()
    content = file.read_text(encoding="utf-8")
    console.print(f"\n[bold cyan]Analyzing & Repairing:[/] {file.resolve()}")

    engine = DeterministicRepairEngine()
    result = engine.repair(content)

    repaired_text = result.repaired_content

    if llm_refactor:
        prov, mdl, key = resolve_llm_credentials(provider, model, api_key, cli_cfg)
        console.print(f"[bold cyan]Running LLM Refactor ({prov}:{mdl})...[/]")
        llm_engine = LLMRepairEngine()
        cfg = ProviderConfig(provider=prov, model=mdl, api_key=key)  # type: ignore
        refactor_res = asyncio.run(llm_engine.refactor(repaired_text, cfg))
        repaired_text = refactor_res.refactored_content
        # Recompute diff against original
        from app.repair.diff_utils import parse_diff_to_structured
        result.diff = parse_diff_to_structured(content, repaired_text)

    if not result.diff.has_changes:
        console.print("[bold green]✓ File is already compliant. No changes needed.[/]")
        return

    console.print(f"\n[bold yellow]Proposed Repairs ({len(result.repairs_applied)} changes):[/]")
    for r in result.repairs_applied:
        console.print(f"  • [bold]{r.title}[/]: {r.description}")

    # Render Unified Diff with syntax highlighting
    console.print(Panel(Syntax(result.diff.unified_diff, "diff", theme="monokai", line_numbers=True), title="Unified Diff"))

    if dry_run or not apply:
        console.print("\n[dim]Dry run complete. Use [bold]--apply[/bold] to write changes to disk.[/]")
    else:
        file.write_text(repaired_text, encoding="utf-8")
        console.print(f"\n[bold green]✓ Successfully applied fixes to {file.name}![/]")


@app.command("profile")
def profile_command(
    trace_file: Path = typer.Argument(..., help="Path to trajectory trace JSON or JSONL", exists=True),
    skill_file: Path | None = typer.Option(None, "--skill", "-s", help="Path to SKILL.md content for bloat analysis"),
    baseline: int | None = typer.Option(None, "--baseline", "-b", help="Expected optimal step budget"),
    base_dir: Path | None = typer.Option(None, "--base-dir", "-d", help="Path to skill package root directory"),
):
    """Profile agent execution path against baselines, flagging redundancy and token bloat."""
    cli_cfg = load_config()
    trace_raw = trace_file.read_text(encoding="utf-8")
    skill_content = skill_file.read_text(encoding="utf-8") if skill_file else None

    # Resolve baseline from flag or config
    effective_baseline = baseline
    if effective_baseline is None and cli_cfg.profiler.default_baseline_steps is not None:
        try:
            effective_baseline = int(cli_cfg.profiler.default_baseline_steps)
        except ValueError:
            pass

    configured_base = Path(cli_cfg.validation.base_dir) if cli_cfg.validation.base_dir else None
    resolved_base_dir = base_dir or configured_base
    if resolved_base_dir is None and skill_file is not None:
        resolved_base_dir = skill_file.parent.resolve()

    profiler = TrajectoryProfiler()
    report = profiler.profile(
        trace_raw,
        skill_content=skill_content,
        custom_baseline_steps=effective_baseline,
        base_dir=str(resolved_base_dir) if resolved_base_dir else None,
    )

    color = "green" if report.status == "pass" else "yellow" if report.status == "warn" else "red"

    console.print(f"\n[bold cyan]Trajectory Profile Report:[/] {trace_file.name}")
    console.print(f"Overall Efficiency Score: [{color} bold]{report.overall_efficiency_score}/100 ({report.status.upper()})[/{color} bold]\n")

    # Step budget & token efficiency tables
    metrics_table = Table(title="Execution Economy Metrics")
    metrics_table.add_column("Metric", style="cyan")
    metrics_table.add_column("Value", justify="right")
    metrics_table.add_column("Evaluation")

    metrics_table.add_row(
        "Actual Steps vs Baseline",
        f"{report.step_budget.actual_steps} / {report.step_budget.baseline_steps}",
        f"[{report.step_budget.status}]{report.step_budget.message}[/]",
    )
    metrics_table.add_row(
        "Redundant Calls Flagged",
        str(len(report.redundancies)),
        "0 clean" if not report.redundancies else f"[bold red]{len(report.redundancies)} wasteful call patterns detected[/]",
    )
    metrics_table.add_row(
        "Token Efficiency Score",
        f"{report.token_efficiency.score}/100",
        report.token_efficiency.message,
    )
    console.print(metrics_table)

    if report.reference_audit:
        audit = report.reference_audit
        ref_table = Table(title="Package Reference Access Audit")
        ref_table.add_column("Metric", style="cyan")
        ref_table.add_column("Value", justify="right")
        ref_table.add_column("Details")

        ref_table.add_row(
            "Reference Coverage",
            f"{audit.coverage_pct}%",
            f"{len(audit.referenced_files_accessed)}/{len(audit.declared_references)} declared references accessed",
        )
        ref_table.add_row(
            "Undeclared File Accesses",
            str(len(audit.undeclared_accesses)),
            ", ".join(audit.undeclared_accesses) if audit.undeclared_accesses else "None (clean)",
        )
        ref_table.add_row(
            "Redundant Reference Reads",
            str(len(audit.redundant_reference_reads)),
            ", ".join(audit.redundant_reference_reads) if audit.redundant_reference_reads else "0 clean",
        )
        console.print(ref_table)

    if report.redundancies:
        console.print("\n[bold red]Redundant Tool Patterns Detected:[/]")
        for idx, red in enumerate(report.redundancies, 1):
            sev_color = "red" if red.severity == "fail" else "yellow"
            console.print(f"\n  [bold {sev_color}]{idx}. [{red.kind.upper()}] {red.title} (Steps: {red.step_indices})[/]")
            console.print(f"     [dim]{red.detail}[/]")
            console.print(f"     [bold green]→ Skill Fix Advice:[/] {red.suggested_skill_fix}")



@app.command("generate-tests")
def generate_tests_command(
    file: Path = typer.Argument(..., help="Path to SKILL.md file", exists=True),
    output: Path | None = typer.Option(None, "--output", "-o", help="Destination file for generated test suite"),
    format: str | None = typer.Option(None, "--format", "-f", help="Output format: json, pytest, markdown"),
    count: int | None = typer.Option(None, "--count", "-c", help="Number of scenarios to generate"),
    provider: str | None = typer.Option(None, "--provider", help="LLM provider (openai, anthropic, ollama)"),
    model: str | None = typer.Option(None, "--model", help="LLM model name"),
    api_key: str | None = typer.Option(None, "--api-key", help="API key for provider"),
):
    """Generate 10–20 realistic synthetic test scenarios (Happy Path, Adversarial, Tool Failure)."""
    cli_cfg = load_config()
    content = file.read_text(encoding="utf-8")
    console.print(f"\n[bold cyan]Generating Synthetic Test Scenarios for:[/] {file.name}")

    target_format = format or cli_cfg.scenarios.default_format or "json"
    target_count = count if count is not None else cli_cfg.scenarios.default_count

    cfg = None
    if provider or model or api_key:
        prov, mdl, key = resolve_llm_credentials(provider, model, api_key, cli_cfg)
        cfg = ProviderConfig(provider=prov, model=mdl, api_key=key)  # type: ignore

    generator = ScenarioGenerator()
    suite = asyncio.run(generator.generate(content, config=cfg, count=target_count))

    console.print(f"[bold green]✓ Generated {suite.total_scenarios} scenarios:[/]")
    for cat, num in suite.categories_breakdown.items():
        console.print(f"  • {cat.replace('_', ' ').title()}: [bold]{num}[/]")

    # Format output
    if target_format == "pytest":
        formatted_output = export_as_pytest(suite)
        ext = ".py"
    elif target_format == "markdown":
        formatted_output = export_as_markdown(suite)
        ext = ".md"
    else:
        formatted_output = export_as_json(suite)
        ext = ".json"

    if output:
        output.write_text(formatted_output, encoding="utf-8")
        console.print(f"\n[bold green]✓ Exported suite to:[/] {output.resolve()}")
    else:
        out_name = f"tests_for_{suite.skill_name}{ext}"
        Path(out_name).write_text(formatted_output, encoding="utf-8")
        console.print(f"\n[bold green]✓ Exported suite to:[/] {out_name}")

@app.command("version")
def version_command():
    """Show Skill Inspector version."""
    console.print(f"Skill Inspector Version: [bold green]{__version__}[/]")

@app.command("help")
def help_command():
    """Show help message."""
    console.print(f"Skill Inspector Version: [bold green]{__version__}[/]")
    console.print("Use [bold]--help[/bold] for more information.")

@app.command("config")
def config_command(
    init: bool = typer.Option(False, "--init", help="Initialize ~/.skill-inspector/config.json with default settings"),
    path: bool = typer.Option(False, "--path", help="Show path to configuration file"),
    ):
    """View or initialize Skill Inspector CLI Conifiguration."""
    if path:
        console.print(f"Config path: [bold cyan]{CONFIG_FILE.resolve()}[/]")
        return

    if init:
        target = init_default_config(overwrite=True)
        console.print(f"[bold green] Initialised configuration file at: [/]{target.resolve()}")
        return

    # Default: Show active config
    cfg = load_config()
    console.print(f"[bold cyan]Configuration File:[/] {CONFIG_FILE.resolve()} {'[green](found)[/]' if CONFIG_FILE.exists() else '[yellow](<using defaults>)[/]'}")
    console.print_json(cfg.model_dump_json(indent=2))

def main():
    app()

if __name__ == "__main__":
    main()
