"""
Skill Inspector CLI.
Command-line companion for validating, auto-fixing, profiling, and generating tests for agent skills.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional
import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.syntax import Syntax
import asyncio

from app.parser import parse_skill_md, ParseError
from app.validators.static import run_static_validation
from app.validators.llm_judge import ProviderConfig, run_llm_validation
from app.repair import DeterministicRepairEngine, LLMRepairEngine
from app.profiler import TrajectoryProfiler
from app.scenarios import ScenarioGenerator, export_as_json, export_as_pytest, export_as_markdown

app = typer.Typer(
    name="skill-inspector",
    help="Inspector, auto-fixer, trajectory profiler, and synthetic test generator for agent skills.",
    add_completion=False,
)
console = Console()

with open('version.txt', 'r') as f:
    __cli_version__ = f.read()

@app.command("validate")
def validate_command(
    file: Path = typer.Argument(..., help="Path to SKILL.md file", exists=True),
    llm: bool = typer.Option(False, "--llm", help="Also run LLM-as-a-Judge validation"),
    provider: str = typer.Option("openai", "--provider", help="LLM provider (openai, anthropic, ollama)"),
    model: str = typer.Option("gpt-4o", "--model", help="LLM model name"),
    api_key: Optional[str] = typer.Option(None, "--api-key", help="API key for provider"),
):
    """Run structural and quality validation on a SKILL.md file."""
    content = file.read_text(encoding="utf-8")
    console.print(f"\n[bold cyan]Validating:[/] {file.resolve()}")

    try:
        doc = parse_skill_md(content)
    except ParseError as exc:
        console.print(f"[bold red]Parse Error:[/] {exc.message}")
        raise typer.Exit(code=1)

    static_report = run_static_validation(doc)

    # Render static table
    table = Table(title=f"Static Validation (Score: {static_report.score}/100 - {static_report.overall_status.value.upper()})")
    table.add_column("Rule", style="cyan")
    table.add_column("Status", style="bold")
    table.add_column("Message")

    for f in static_report.findings:
        color = "green" if f.status.value == "pass" else "yellow" if f.status.value == "warn" else "red"
        table.add_row(f.rule, f"[{color}]{f.status.value.upper()}[/{color}]", f.message)

    console.print(table)

    if llm:
        console.print(f"\n[bold cyan]Running LLM Judge ({provider}:{model})...[/]")
        cfg = ProviderConfig(provider=provider, model=model, api_key=api_key)  # type: ignore
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
    provider: str = typer.Option("openai", "--provider", help="LLM provider for refactor"),
    model: str = typer.Option("gpt-4o", "--model", help="LLM model name"),
    api_key: Optional[str] = typer.Option(None, "--api-key", help="API key for provider"),
):
    """Automatically repair frontmatter schema errors and refactor instructions."""
    content = file.read_text(encoding="utf-8")
    console.print(f"\n[bold cyan]Analyzing & Repairing:[/] {file.resolve()}")

    engine = DeterministicRepairEngine()
    result = engine.repair(content)

    repaired_text = result.repaired_content

    if llm_refactor:
        console.print(f"[bold cyan]Running LLM Refactor ({provider}:{model})...[/]")
        llm_engine = LLMRepairEngine()
        cfg = ProviderConfig(provider=provider, model=model, api_key=api_key)  # type: ignore
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
    skill_file: Optional[Path] = typer.Option(None, "--skill", help="Path to SKILL.md content for bloat analysis"),
    baseline: Optional[int] = typer.Option(None, "--baseline", "-b", help="Expected optimal step budget"),
):
    """Profile agent execution path against baselines, flagging redundancy and token bloat."""
    trace_raw = trace_file.read_text(encoding="utf-8")
    skill_content = skill_file.read_text(encoding="utf-8") if skill_file else None

    profiler = TrajectoryProfiler()
    report = profiler.profile(trace_raw, skill_content=skill_content, custom_baseline_steps=baseline)

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
    output: Optional[Path] = typer.Option(None, "--output", "-o", help="Destination file for generated test suite"),
    format: str = typer.Option("json", "--format", "-f", help="Output format: json, pytest, markdown"),
    count: int = typer.Option(12, "--count", "-c", help="Number of scenarios to generate"),
    provider: Optional[str] = typer.Option(None, "--provider", help="LLM provider (openai, anthropic, ollama)"),
    model: Optional[str] = typer.Option(None, "--model", help="LLM model name"),
    api_key: Optional[str] = typer.Option(None, "--api-key", help="API key for provider"),
):
    """Generate 10–20 realistic synthetic test scenarios (Happy Path, Adversarial, Tool Failure)."""
    content = file.read_text(encoding="utf-8")
    console.print(f"\n[bold cyan]Generating Synthetic Test Scenarios for:[/] {file.name}")

    cfg = None
    if provider and model:
        cfg = ProviderConfig(provider=provider, model=model, api_key=api_key)  # type: ignore

    generator = ScenarioGenerator()
    suite = asyncio.run(generator.generate(content, config=cfg, count=count))

    console.print(f"[bold green]✓ Generated {suite.total_scenarios} scenarios:[/]")
    for cat, num in suite.categories_breakdown.items():
        console.print(f"  • {cat.replace('_', ' ').title()}: [bold]{num}[/]")

    # Format output
    if format == "pytest":
        formatted_output = export_as_pytest(suite)
        ext = ".py"
    elif format == "markdown":
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
    console.print(f"Skill Inspector Version: [bold green]{__cli_version__}[/]")

@app.command("help")
def help_command():
    """Show help message."""
    console.print(f"Skill Inspector Version: [bold green]{__cli_version__}[/]")
    console.print(f"Use [bold]--help[/bold] for more information.")

if __name__ == "__main__":
    app()
