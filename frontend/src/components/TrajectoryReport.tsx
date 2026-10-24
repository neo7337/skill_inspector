import React, { useState } from 'react'
import type { TrajectoryProfileReport, TrajectoryTimelineStep, RedundantCallFinding } from '../types'
import { profileTrajectory } from '../api'

interface TrajectoryReportProps {
  skillContent: string
  baseDir?: string
}

const SAMPLE_THRASHING_TRACE = {
  task_id: 'pdf_table_extract_01',
  task_description: 'Extract monthly balance table from statement.pdf',
  skill_name: 'pdf-extractor',
  baseline_step_budget: 3,
  final_status: 'success',
  tool_calls: [
    {
      step_index: 1,
      tool_name: 'view_file',
      tool_arguments: { AbsolutePath: '/workspace/config.py' },
      tool_output: "PDF_ENGINE='pypdf'",
      is_error: false,
      tokens_prompt: 1100,
      tokens_completion: 40,
      duration_ms: 110,
    },
    {
      step_index: 2,
      tool_name: 'grep_search',
      tool_arguments: { Query: 'extract_table', SearchPath: '/workspace' },
      tool_output: '0 matches found',
      is_error: false,
      tokens_prompt: 1350,
      tokens_completion: 45,
      duration_ms: 220,
    },
    {
      step_index: 3,
      tool_name: 'grep_search',
      tool_arguments: { Query: 'extract table', SearchPath: '/workspace' },
      tool_output: '0 matches found',
      is_error: false,
      tokens_prompt: 1450,
      tokens_completion: 45,
      duration_ms: 210,
    },
    {
      step_index: 4,
      tool_name: 'view_file',
      tool_arguments: { AbsolutePath: '/workspace/config.py' },
      tool_output: "PDF_ENGINE='pypdf'",
      is_error: false,
      tokens_prompt: 1600,
      tokens_completion: 40,
      duration_ms: 105,
    },
    {
      step_index: 5,
      tool_name: 'extract_pdf',
      tool_arguments: { file_path: '/invalid/statement.pdf' },
      tool_output: 'FileNotFoundError: /invalid/statement.pdf',
      is_error: true,
      tokens_prompt: 1800,
      tokens_completion: 55,
      duration_ms: 380,
    },
    {
      step_index: 6,
      tool_name: 'extract_pdf',
      tool_arguments: { file_path: '/invalid/statement.pdf' },
      tool_output: 'FileNotFoundError: /invalid/statement.pdf',
      is_error: true,
      tokens_prompt: 1950,
      tokens_completion: 55,
      duration_ms: 370,
    },
    {
      step_index: 7,
      tool_name: 'extract_pdf',
      tool_arguments: { file_path: '/workspace/statement.pdf' },
      tool_output: "{ 'tables': 2, 'rows': 45 }",
      is_error: false,
      tokens_prompt: 2200,
      tokens_completion: 130,
      duration_ms: 510,
    },
  ],
}

export const TrajectoryReport: React.FC<TrajectoryReportProps> = ({ skillContent, baseDir }) => {
  const [traceText, setTraceText] = useState('')
  const [customBaseline, setCustomBaseline] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<TrajectoryProfileReport | null>(null)
  const [parsedTraceData, setParsedTraceData] = useState<any | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  const [inputCollapsed, setInputCollapsed] = useState(false)

  const parseTraceInput = (raw: any): any => {
    if (typeof raw === 'object' && raw !== null) return raw
    if (typeof raw !== 'string') return raw

    const trimmed = raw.trim()
    try {
      return JSON.parse(trimmed)
    } catch {
      // Check if JSONL format
      const lines = trimmed.split('\n').filter(l => l.trim().length > 0)
      if (lines.length > 1) {
        try {
          const records = lines.map(l => JSON.parse(l))
          return {
            task_id: 'jsonl_trace',
            tool_calls: records.filter((r: any) => r.tool_name || r.step_index),
          }
        } catch {
          return raw
        }
      }
      return raw
    }
  }

  const handleProfile = async (traceInput?: any) => {
    const raw = traceInput !== undefined ? traceInput : traceText
    if (!raw || (typeof raw === 'string' && !raw.trim())) return

    try {
      setLoading(true)
      setErrorMessage(null)

      const parsedTrace = parseTraceInput(raw)
      if (parsedTrace && typeof parsedTrace === 'object') {
        setParsedTraceData(parsedTrace)
      } else {
        setParsedTraceData(null)
      }

      const baseline = customBaseline === '' ? undefined : Number(customBaseline)
      const res = await profileTrajectory(parsedTrace, skillContent, baseline, baseDir)
      setReport(res)
      setInputCollapsed(true)
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.detail || err.message || 'Failed to profile trajectory')
    } finally {
      setLoading(false)
    }
  }

  const handleLoadSample = () => {
    const sampleStr = JSON.stringify(SAMPLE_THRASHING_TRACE, null, 2)
    setTraceText(sampleStr)
    setCustomBaseline(3)
    setParsedTraceData(SAMPLE_THRASHING_TRACE)
    handleProfile(SAMPLE_THRASHING_TRACE)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = event => {
      const text = event.target?.result as string
      setTraceText(text)
      handleProfile(text)
    }
    reader.readAsText(file)
  }

  const toggleStepExpanded = (stepIdx: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev)
      if (next.has(stepIdx)) {
        next.delete(stepIdx)
      } else {
        next.add(stepIdx)
      }
      return next
    })
  }

  const toggleAllSteps = () => {
    if (!report) return
    if (expandedSteps.size === report.timeline_summary.length) {
      setExpandedSteps(new Set())
    } else {
      setExpandedSteps(new Set(report.timeline_summary.map(s => s.step_index)))
    }
  }

  // Calculate maximum duration to render proportional waterfall bars
  const maxStepDuration = Math.max(
    1,
    ...(report?.timeline_summary.map(s => s.duration_ms) || [100]),
  )

  const getRedundancyBadge = (kind: RedundantCallFinding['kind']) => {
    switch (kind) {
      case 'repeated_search':
        return { label: 'Repeated Search', icon: '🔍' }
      case 'subsumed_file_read':
        return { label: 'Subsumed Read', icon: '📄' }
      case 'error_ping_pong':
        return { label: 'Error Ping-Pong', icon: '🏓' }
      case 'no_op_mutation':
        return { label: 'No-Op Mutation', icon: '🔁' }
      case 'duplicate_tool_call':
        return { label: 'Duplicate Call', icon: '👯' }
      default:
        return { label: String(kind).replace(/_/g, ' '), icon: '⚠️' }
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 shadow-xs backdrop-blur-md space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Trajectory & Step-Economy Profiler
              </h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                Execution Analytics
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Analyzes an agent's actual tool invocation path to detect repetitive loops, subsumed file reads,
              context token bloat, and step-budget thrashing.
            </p>
          </div>

          {/* Quick Actions: Upload & Load Sample */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors active:scale-95 select-none">
              <span>📂</span>
              <span>Upload Trace (.json)</span>
              <input type="file" accept=".json,.jsonl,.txt" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              type="button"
              onClick={handleLoadSample}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:via-blue-500 hover:to-indigo-500 text-white shadow-glow-cyan transition-all active:scale-95"
            >
              <span>🧪</span>
              <span>Load Sample Thrashing Trace</span>
            </button>
          </div>
        </div>
      </div>

      {/* Input Trace Collapsible Card */}
      <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setInputCollapsed(prev => !prev)}
            className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <span className={`text-[10px] transform transition-transform ${inputCollapsed ? '' : 'rotate-90'}`}>
              ▶
            </span>
            <span className="uppercase tracking-wider">Trace Log Input (JSON / JSONL)</span>
            {traceText && inputCollapsed && (
              <span className="text-[10px] font-mono text-slate-400 font-normal">
                ({traceText.split('\n').length} lines)
              </span>
            )}
          </button>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 text-xs">Step Budget:</span>
            <input
              type="number"
              min={1}
              placeholder="e.g. 3"
              value={customBaseline}
              onChange={e => setCustomBaseline(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 text-center"
            />
          </div>
        </div>

        {!inputCollapsed && (
          <div className="space-y-3 pt-1">
            <textarea
              rows={5}
              value={traceText}
              onChange={e => setTraceText(e.target.value)}
              placeholder='Paste JSON trace: {"task_id": "...", "baseline_step_budget": 3, "tool_calls": [{"step_index": 1, "tool_name": "view_file", "tool_arguments": {...}, "tool_output": "...", "duration_ms": 120}]}'
              className="w-full p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all scrollbar-thin"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Supports single-task JSON traces or newline-delimited JSONL execution steps.
              </span>

              <div className="flex items-center gap-2">
                {traceText && (
                  <button
                    type="button"
                    onClick={() => {
                      setTraceText('')
                      setReport(null)
                      setParsedTraceData(null)
                    }}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleProfile()}
                  disabled={loading || !traceText.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-glow-cyan disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all"
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Profiling Trajectory…</span>
                    </>
                  ) : (
                    <>
                      <span>📊</span>
                      <span>Analyze Trajectory Economy</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>✗</span>
            <span className="font-mono">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-xs underline hover:no-underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Profile Report Output */}
      {report && (
        <div className="space-y-4">
          {/* Key Metrics KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Trajectory Efficiency Score */}
            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 shadow-xs space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Trajectory Efficiency
              </span>
              <div className="flex items-baseline justify-between">
                <span
                  className={`text-2xl font-bold font-mono ${
                    report.overall_efficiency_score >= 75
                      ? 'text-emerald-500'
                      : report.overall_efficiency_score >= 50
                      ? 'text-amber-500'
                      : 'text-rose-500'
                  }`}
                >
                  {report.overall_efficiency_score}
                  <span className="text-xs text-slate-400 font-sans font-normal">/100</span>
                </span>
                <span
                  className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full border ${
                    report.status === 'pass'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : report.status === 'warn'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  }`}
                >
                  {report.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                Composite of step variance, thrashing penalties, and context bloat.
              </p>
            </div>

            {/* 2. Step Budget Tracking */}
            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 shadow-xs space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Step Budget
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                  {report.step_budget.actual_steps}
                  <span className="text-xs text-slate-400 font-normal"> / {report.step_budget.baseline_steps} steps</span>
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                    report.step_budget.variance_ratio <= 1.0
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : report.step_budget.variance_ratio <= 1.5
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {report.step_budget.variance_ratio}x
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug truncate">
                {report.step_budget.message}
              </p>
            </div>

            {/* 3. Redundant Patterns */}
            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 shadow-xs space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Thrashing Loops
              </span>
              <div className="flex items-baseline justify-between">
                <span
                  className={`text-2xl font-bold font-mono ${
                    report.redundancies.length === 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {report.redundancies.length}
                  <span className="text-xs text-slate-400 font-sans font-normal"> loop{report.redundancies.length !== 1 ? 's' : ''}</span>
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    report.redundancies.length === 0
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {report.redundancies.length === 0 ? '✓ Clean' : '⚠️ Thrashing'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                {report.redundancies.length === 0
                  ? 'No search loops or subsumed reads detected.'
                  : `${report.redundancies.length} wasteful execution loops trapped the agent.`}
              </p>
            </div>

            {/* 4. Token Efficiency */}
            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 shadow-xs space-y-1.5">
              <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Token Economy
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-cyan-600 dark:text-cyan-400">
                  {report.token_efficiency.total_tokens.toLocaleString()}
                  <span className="text-xs text-slate-400 font-sans font-normal"> tokens</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  {report.token_efficiency.bloat_ratio}x bloat
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug truncate">
                {report.token_efficiency.redundant_tokens > 0
                  ? `${report.token_efficiency.redundant_tokens.toLocaleString()} redundant tokens`
                  : report.token_efficiency.message}
              </p>
            </div>
          </div>

          {/* Reference Access Audit Card */}
          {report.reference_audit && (
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">📦</span>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Package Reference Access Audit
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {report.reference_audit.coverage_pct}% Coverage
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {report.reference_audit.summary}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Declared vs Accessed</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                    {report.reference_audit.referenced_files_accessed.length} / {report.reference_audit.declared_references.length} files
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Undeclared Accesses</span>
                  <span className={`font-mono font-bold mt-0.5 block ${report.reference_audit.undeclared_accesses.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {report.reference_audit.undeclared_accesses.length} {report.reference_audit.undeclared_accesses.length === 1 ? 'file' : 'files'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Redundant Reads</span>
                  <span className={`font-mono font-bold mt-0.5 block ${report.reference_audit.redundant_reference_reads.length > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {report.reference_audit.redundant_reference_reads.length} {report.reference_audit.redundant_reference_reads.length === 1 ? 'file' : 'files'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Detected Redundant Patterns / Thrashing Warnings */}
          {report.redundancies.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <span className="text-rose-500">⚠️</span>
                  <span>Detected Thrashing & Redundant Call Patterns ({report.redundancies.length})</span>
                </h3>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                  Recommended fixes for SKILL.md
                </span>
              </div>

              <div className="space-y-3">
                {report.redundancies.map((red, idx) => {
                  const badge = getRedundancyBadge(red.kind)
                  return (
                    <div
                      key={idx}
                      className="p-4 sm:p-5 rounded-2xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 shadow-xs space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{badge.icon}</span>
                          <span className="font-bold text-sm text-rose-900 dark:text-rose-200">
                            {red.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                            {badge.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                            Steps: {red.step_indices.join(', ')}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-rose-800/90 dark:text-rose-300/90 leading-relaxed">
                        {red.detail}
                      </p>

                      {/* Suggested Fix */}
                      <div className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-rose-200/60 dark:border-rose-900/40 space-y-1">
                        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                          <span>💡</span>
                          <span>Suggested Fix in SKILL.md:</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans pl-5">
                          {red.suggested_skill_fix}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Execution Path Waterfall Timeline */}
          <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Execution Step Waterfall</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-semibold">
                    {report.timeline_summary.length} steps
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Chronological timeline of tool executions with latency metrics, token consumption, and inspection payloads.
                </p>
              </div>

              <button
                type="button"
                onClick={toggleAllSteps}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors"
              >
                {expandedSteps.size === report.timeline_summary.length ? 'Collapse All' : 'Expand All Details'}
              </button>
            </div>

            {/* Horizontal Mini Step Chain */}
            <div className="overflow-x-auto pb-2 scrollbar-thin">
              <div className="flex items-center gap-2 min-w-max py-1">
                {report.timeline_summary.map((step, sIdx) => {
                  const isRedundant = step.is_redundant
                  const isError = step.is_error
                  const isExpanded = expandedSteps.has(step.step_index)

                  return (
                    <React.Fragment key={sIdx}>
                      <button
                        type="button"
                        onClick={() => toggleStepExpanded(step.step_index)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col gap-1 min-w-[120px] transition-all duration-150 select-none ${
                          isExpanded
                            ? 'ring-2 ring-indigo-500/40 shadow-sm'
                            : 'hover:shadow-xs hover:border-slate-300 dark:hover:border-slate-600'
                        } ${
                          isRedundant
                            ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30'
                            : isError
                            ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30'
                            : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full text-[10px] font-mono">
                          <span className="text-slate-400 dark:text-slate-500 font-bold">#{step.step_index}</span>
                          {isRedundant ? (
                            <span className="text-rose-600 dark:text-rose-400 font-bold">REDUNDANT</span>
                          ) : isError ? (
                            <span className="text-amber-600 dark:text-amber-400 font-bold">ERROR</span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">OK</span>
                          )}
                        </div>

                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {step.tool_name}()
                        </span>

                        <div className="flex items-center justify-between w-full text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-200/60 dark:border-slate-800">
                          <span>{step.duration_ms}ms</span>
                          <span>{step.tokens}t</span>
                        </div>
                      </button>

                      {sIdx < report.timeline_summary.length - 1 && (
                        <span className="text-slate-300 dark:text-slate-700 font-bold select-none text-xs">
                          →
                        </span>
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            </div>

            {/* Detailed Step Waterfall List */}
            <div className="space-y-2.5 pt-2">
              {report.timeline_summary.map((step: TrajectoryTimelineStep) => {
                const isRedundant = step.is_redundant
                const isError = step.is_error
                const isExpanded = expandedSteps.has(step.step_index)

                // Match with raw trace tool call for payload inspector
                const matchedCall = parsedTraceData?.tool_calls?.find(
                  (c: any) => c.step_index === step.step_index,
                )

                // Latency bar percentage
                const durationPct = Math.min(100, Math.max(8, (step.duration_ms / maxStepDuration) * 100))

                return (
                  <div
                    key={step.step_index}
                    className={`rounded-xl border transition-all ${
                      isRedundant
                        ? 'border-rose-300/80 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10'
                        : isError
                        ? 'border-amber-300/80 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10'
                        : 'border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50'
                    }`}
                  >
                    {/* Step Row Header */}
                    <div
                      onClick={() => toggleStepExpanded(step.step_index)}
                      className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/60 dark:hover:bg-slate-800/30 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg font-mono text-xs font-bold flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          #{step.step_index}
                        </span>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                              {step.tool_name}
                            </span>
                            {isRedundant && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                Redundant Call
                              </span>
                            )}
                            {isError && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                Error Response
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-0.5">
                            <span>⏱ {step.duration_ms} ms</span>
                            <span>•</span>
                            <span>🪙 {step.tokens} tokens</span>
                          </div>
                        </div>
                      </div>

                      {/* Latency Bar & Expand Indicator */}
                      <div className="flex items-center gap-4">
                        <div className="w-32 hidden md:block">
                          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isRedundant
                                  ? 'bg-rose-500'
                                  : isError
                                  ? 'bg-amber-500'
                                  : 'bg-cyan-500'
                              }`}
                              style={{ width: `${durationPct}%` }}
                            />
                          </div>
                        </div>

                        <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                          <span>{isExpanded ? 'Hide Payload' : 'Inspect'}</span>
                          <span className={`text-[10px] transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            ▼
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Collapsible Arguments & Output Inspector */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/80 space-y-3 font-mono text-xs">
                        {matchedCall ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                            {/* Arguments */}
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                                Arguments
                              </span>
                              <pre className="p-3 rounded-xl bg-slate-950 text-slate-200 overflow-x-auto text-[11px] leading-relaxed border border-slate-800 max-h-48 scrollbar-thin">
                                {JSON.stringify(matchedCall.tool_arguments, null, 2)}
                              </pre>
                            </div>

                            {/* Output */}
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                                Output / Return Value
                              </span>
                              <pre className={`p-3 rounded-xl overflow-x-auto text-[11px] leading-relaxed border max-h-48 scrollbar-thin ${
                                isError
                                  ? 'bg-rose-950/40 text-rose-300 border-rose-900/60'
                                  : 'bg-slate-950 text-slate-200 border-slate-800'
                              }`}>
                                {typeof matchedCall.tool_output === 'object'
                                  ? JSON.stringify(matchedCall.tool_output, null, 2)
                                  : String(matchedCall.tool_output || 'No output recorded')}
                              </pre>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs">
                            Detailed arguments and output payloads not included in this trace summary.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Empty State when no trace analyzed */}
      {!report && !loading && (
        <div className="py-16 px-6 text-center border-2 border-dashed border-slate-200/80 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 flex items-center justify-center text-xl shadow-xs">
            🧭
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No Trajectory Trace Analyzed Yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Upload an execution log or load the sample thrashing trace to profile step efficiency,
              catch redundant tool calls, and analyze latency bottlenecks.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLoadSample}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-glow-cyan transition-all active:scale-95"
          >
            <span>🧪 Load Sample Trace</span>
          </button>
        </div>
      )}
    </div>
  )
}
