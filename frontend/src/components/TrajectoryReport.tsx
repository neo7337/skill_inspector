import React, { useState } from 'react'
import type { TrajectoryProfileReport } from '../types'
import { profileTrajectory } from '../api'

interface TrajectoryReportProps {
  skillContent: string
}

const SAMPLE_THRASHING_TRACE = {
  task_id: "pdf_table_extract_01",
  task_description: "Extract monthly balance table from statement.pdf",
  skill_name: "pdf-extractor",
  baseline_step_budget: 3,
  final_status: "success",
  tool_calls: [
    {
      step_index: 1,
      tool_name: "view_file",
      tool_arguments: { AbsolutePath: "/workspace/config.py" },
      tool_output: "PDF_ENGINE='pypdf'",
      is_error: false,
      tokens_prompt: 1100,
      tokens_completion: 40,
      duration_ms: 110
    },
    {
      step_index: 2,
      tool_name: "grep_search",
      tool_arguments: { Query: "extract_table", SearchPath: "/workspace" },
      tool_output: "0 matches found",
      is_error: false,
      tokens_prompt: 1350,
      tokens_completion: 45,
      duration_ms: 220
    },
    {
      step_index: 3,
      tool_name: "grep_search",
      tool_arguments: { Query: "extract table", SearchPath: "/workspace" },
      tool_output: "0 matches found",
      is_error: false,
      tokens_prompt: 1450,
      tokens_completion: 45,
      duration_ms: 210
    },
    {
      step_index: 4,
      tool_name: "view_file",
      tool_arguments: { AbsolutePath: "/workspace/config.py" },
      tool_output: "PDF_ENGINE='pypdf'",
      is_error: false,
      tokens_prompt: 1600,
      tokens_completion: 40,
      duration_ms: 105
    },
    {
      step_index: 5,
      tool_name: "extract_pdf",
      tool_arguments: { file_path: "/invalid/statement.pdf" },
      tool_output: "FileNotFoundError: /invalid/statement.pdf",
      is_error: true,
      tokens_prompt: 1800,
      tokens_completion: 55,
      duration_ms: 380
    },
    {
      step_index: 6,
      tool_name: "extract_pdf",
      tool_arguments: { file_path: "/invalid/statement.pdf" },
      tool_output: "FileNotFoundError: /invalid/statement.pdf",
      is_error: true,
      tokens_prompt: 1950,
      tokens_completion: 55,
      duration_ms: 370
    },
    {
      step_index: 7,
      tool_name: "extract_pdf",
      tool_arguments: { file_path: "/workspace/statement.pdf" },
      tool_output: "{ 'tables': 2, 'rows': 45 }",
      is_error: false,
      tokens_prompt: 2200,
      tokens_completion: 130,
      duration_ms: 510
    }
  ]
}

export const TrajectoryReport: React.FC<TrajectoryReportProps> = ({ skillContent }) => {
  const [traceText, setTraceText] = useState('')
  const [customBaseline, setCustomBaseline] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<TrajectoryProfileReport | null>(null)

  const handleProfile = async (traceInput?: any) => {
    const raw = traceInput || traceText
    if (!raw) return
    try {
      setLoading(true)
      let parsedTrace: any = raw
      if (typeof raw === 'string') {
        try {
          parsedTrace = JSON.parse(raw)
        } catch {
          // If not JSON, send as string for backend JSONL parser
          parsedTrace = raw
        }
      }
      const baseline = customBaseline === '' ? undefined : Number(customBaseline)
      const res = await profileTrajectory(parsedTrace, skillContent, baseline)
      setReport(res)
    } catch (err: any) {
      alert(`Profiling error: ${err?.response?.data?.detail || err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadSample = () => {
    const sampleStr = JSON.stringify(SAMPLE_THRASHING_TRACE, null, 2)
    setTraceText(sampleStr)
    setCustomBaseline(3)
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

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span>Trajectory & Step-Economy Profiler</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
              Execution Path Analytics
            </span>
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Measures the agent's actual execution path: detects search loops, redundant file reads, context bloat, and step budget variance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="cursor-pointer px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 text-gray-700 dark:text-gray-200 transition-colors">
            <span>Upload Trace (.json)</span>
            <input type="file" accept=".json,.jsonl,.txt" onChange={handleFileUpload} className="hidden" />
          </label>
          <button
            onClick={handleLoadSample}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all"
          >
            Load Sample Trace
          </button>
        </div>
      </div>

      {/* Input Trace area */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Paste Trace Log (JSON or JSONL)
          </span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Baseline Budget:</span>
            <input
              type="number"
              min={1}
              placeholder="e.g. 3"
              value={customBaseline}
              onChange={e => setCustomBaseline(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-16 px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs"
            />
          </div>
        </div>

        <textarea
          rows={4}
          value={traceText}
          onChange={e => setTraceText(e.target.value)}
          placeholder='{"task_id": "...", "tool_calls": [{"step_index": 1, "tool_name": "view_file", ...}]}'
          className="w-full p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <div className="flex justify-end">
          <button
            onClick={() => handleProfile()}
            disabled={loading || !traceText.trim()}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                <span>Profiling Trajectory...</span>
              </>
            ) : (
              <span>Analyze Trajectory Economy</span>
            )}
          </button>
        </div>
      </div>

      {/* Profile Report Output */}
      {report && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Efficiency Score */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Trajectory Efficiency</span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold font-mono ${
                    report.overall_efficiency_score >= 75
                      ? 'text-emerald-500'
                      : report.overall_efficiency_score >= 50
                      ? 'text-amber-500'
                      : 'text-rose-500'
                  }`}
                >
                  {report.overall_efficiency_score}/100
                </span>
                <span className="text-xs uppercase font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  {report.status}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Composite of step deviation, loop penalties, and token waste.
              </p>
            </div>

            {/* Step Budget */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Step Budget Tracking</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">
                  {report.step_budget.actual_steps} / {report.step_budget.baseline_steps}
                </span>
                <span className="text-xs font-mono text-gray-500">
                  ({report.step_budget.variance_ratio}x budget)
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{report.step_budget.message}</p>
            </div>

            {/* Redundancies Flagged */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Redundant Calls</span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold font-mono ${
                    report.redundancies.length === 0 ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {report.redundancies.length}
                </span>
                <span className="text-xs text-gray-500">patterns</span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {report.redundancies.length === 0
                  ? 'No search loops or subsumed reads.'
                  : `${report.redundancies.length} wasteful loops trapped the agent.`}
              </p>
            </div>

            {/* Token Waste */}
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Token Efficiency Score</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono text-indigo-500">
                  {report.token_efficiency.score}/100
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  Bloat: {report.token_efficiency.bloat_ratio}x
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{report.token_efficiency.message}</p>
            </div>
          </div>

          {/* Redundancy Findings */}
          {report.redundancies.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span className="text-rose-500">⚠️</span>
                <span>Detected Redundant & Thrashing Call Patterns</span>
              </h4>
              <div className="space-y-3">
                {report.redundancies.map((red, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-rose-200 dark:border-rose-950/70 bg-rose-50/50 dark:bg-rose-950/20 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-rose-900 dark:text-rose-200 text-sm">
                        {red.title}
                      </span>
                      <span className="px-2 py-0.5 rounded font-mono text-[10px] uppercase bg-rose-200/70 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 font-bold">
                        Steps: {red.step_indices.join(', ')}
                      </span>
                    </div>
                    <p className="text-rose-800 dark:text-rose-300/90 leading-relaxed">{red.detail}</p>
                    <div className="p-2.5 rounded-lg bg-white/80 dark:bg-gray-900/80 border border-rose-200/60 dark:border-rose-900/40">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-0.5">
                        💡 Suggested Fix in SKILL.md:
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">{red.suggested_skill_fix}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Execution Timeline */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
              Execution Path Timeline ({report.timeline_summary.length} steps)
            </h4>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max pb-2">
                {report.timeline_summary.map((step, sIdx) => {
                  const isRedundant = step.is_redundant
                  const isError = step.is_error
                  return (
                    <div key={sIdx} className="flex items-center">
                      <div
                        className={`p-3 rounded-lg border flex flex-col items-center gap-1 min-w-[110px] ${
                          isRedundant
                            ? 'border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40'
                            : isError
                            ? 'border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40'
                            : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full text-[10px] text-gray-500 font-mono">
                          <span>Step {step.step_index}</span>
                          {isRedundant && <span className="text-rose-500 font-bold">REDUNDANT</span>}
                          {isError && !isRedundant && <span className="text-amber-500 font-bold">ERROR</span>}
                        </div>
                        <span className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100">
                          {step.tool_name}
                        </span>
                        <div className="flex items-center justify-between w-full text-[10px] text-gray-400 font-mono pt-1 border-t border-gray-200/50 dark:border-gray-700/50">
                          <span>{step.duration_ms}ms</span>
                          <span>{step.tokens}t</span>
                        </div>
                      </div>
                      {sIdx < report.timeline_summary.length - 1 && (
                        <span className="text-gray-400 mx-1">→</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
