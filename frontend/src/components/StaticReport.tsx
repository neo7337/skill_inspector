import { useState } from 'react'
import type { StaticValidationResult, RuleStatus, ApplyableFix, StaticFinding } from '../types'
import { StatusBadge, StatusIcon } from './StatusBadge'
import { OverallScoreRing } from './ScoreBar'

export interface StaticReportProps {
  result: StaticValidationResult | null
  isLoading: boolean
  isDark?: boolean
  onApplyFix?: (fix: ApplyableFix, resolvedRule?: string) => void
}

function groupByDimension(findings: StaticValidationResult['findings']) {
  const groups: Record<string, StaticFinding[]> = {}
  for (const f of findings) {
    if (!groups[f.dimension]) groups[f.dimension] = []
    groups[f.dimension].push(f)
  }
  return groups
}

function dimensionStatus(findings: StaticFinding[]): RuleStatus {
  if (findings.some(f => f.status === 'fail')) return 'fail'
  if (findings.some(f => f.status === 'warn')) return 'warn'
  return 'pass'
}

export function StaticReport({ result, isLoading, onApplyFix }: StaticReportProps) {
  const [expandedDims, setExpandedDims] = useState<Set<string>>(new Set())
  const [appliedRules, setAppliedRules] = useState<Set<string>>(new Set())

  const toggle = (dim: string) => {
    setExpandedDims(prev => {
      const next = new Set(prev)
      if (next.has(dim)) next.delete(dim)
      else next.add(dim)
      return next
    })
  }

  const toggleAll = (allDims: string[]) => {
    if (expandedDims.size === allDims.length) {
      setExpandedDims(new Set())
    } else {
      setExpandedDims(new Set(allDims))
    }
  }

  const handleApply = (f: StaticFinding) => {
    if (!onApplyFix || !f.fix_snippet || !f.fix_kind) return
    onApplyFix(
      {
        kind: f.fix_kind,
        field: f.fix_field,
        snippet: f.fix_snippet,
        replaceTarget: f.fix_replace_target,
      },
      f.rule,
    )
    setAppliedRules(prev => new Set(prev).add(f.rule))
    setTimeout(() => {
      setAppliedRules(prev => {
        const next = new Set(prev)
        next.delete(f.rule)
        return next
      })
    }, 2000)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md text-center space-y-3">
        <div className="relative flex items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <div className="absolute w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Validating SKILL.md Rules…
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Checking deterministic frontmatter, structure, and token budgets
          </p>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-14 px-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/20 text-center select-none">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-3 shadow-glow-sm">
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          No SKILL.md Loaded
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
          Paste your agent skill instructions on the left or load an example to trigger static rule validation.
        </p>
      </div>
    )
  }

  if (result.type === 'parse_error') {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/30 p-5 shadow-lg backdrop-blur-sm">
        <div className="flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 font-bold">
            ✗
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">
                Frontmatter Parse Error
              </h3>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300">
                FATAL
              </span>
            </div>
            <p className="text-xs text-rose-800/80 dark:text-rose-300/80 mt-1">
              The skill markdown document could not be parsed. Check YAML frontmatter formatting (missing delimiters or invalid keys).
            </p>
            <div className="mt-3 p-3 rounded-xl bg-slate-950 text-rose-300 font-mono text-xs overflow-x-auto scrollbar-thin border border-rose-500/20">
              {result.error}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const groups = groupByDimension(result.findings)
  const allDims = Object.keys(groups)
  const failCount = result.findings.filter(f => f.status === 'fail').length
  const warnCount = result.findings.filter(f => f.status === 'warn').length
  const passCount = result.findings.filter(f => f.status === 'pass').length
  const allExpanded = expandedDims.size === allDims.length

  return (
    <div className="space-y-4">
      {/* Summary Overview Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs backdrop-blur-md flex flex-col sm:flex-row items-center gap-5">
        <OverallScoreRing score={result.score} size="md" />

        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <StatusBadge status={result.overall_status} size="md" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Static Analysis Rules
            </h2>
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
              ({result.findings.length} checks)
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Deterministic validation covering frontmatter schema, specification compliance, and token budgets.
          </p>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
            {failCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {failCount} {failCount === 1 ? 'failure' : 'failures'}
              </span>
            )}
            {warnCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {warnCount} {warnCount === 1 ? 'warning' : 'warnings'}
              </span>
            )}
            {passCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {passCount} passed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Accordion Controls Header */}
      <div className="flex items-center justify-between px-1 text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
          Rule Dimensions ({allDims.length})
        </span>
        <button
          type="button"
          onClick={() => toggleAll(allDims)}
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors"
        >
          {allExpanded ? 'Collapse All' : 'Expand All'}
        </button>
      </div>

      {/* Per-dimension accordion */}
      <div className="space-y-2.5">
        {Object.entries(groups).map(([dim, findings]) => {
          const status = dimensionStatus(findings)
          const isExpanded = expandedDims.has(dim)
          const dimFails = findings.filter(f => f.status === 'fail').length
          const dimWarns = findings.filter(f => f.status === 'warn').length

          return (
            <div
              key={dim}
              className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 overflow-hidden shadow-xs backdrop-blur-sm transition-all duration-200"
            >
              <button
                type="button"
                onClick={() => toggle(dim)}
                className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusIcon status={status} className="w-4 h-4" />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {dim}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    {dimFails > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/20">
                        {dimFails} fail
                      </span>
                    )}
                    {dimWarns > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
                        {dimWarns} warn
                      </span>
                    )}
                    {dimFails === 0 && dimWarns === 0 && (
                      <span className="text-slate-400 dark:text-slate-500">
                        ({findings.length} passed)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 ml-3">
                  <StatusBadge status={status} size="sm" />
                  <svg
                    className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : 'rotate-0'
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200/80 dark:border-slate-800/80 p-3.5 space-y-3 bg-slate-50/50 dark:bg-slate-950/40">
                  {findings.map((f, i) => {
                    const isApplied = appliedRules.has(f.rule)

                    return (
                      <div
                        key={`${f.rule}-${i}`}
                        className="p-3 rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/70 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2"
                      >
                        {/* Header: Rule Code + Status Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700/80">
                            {f.rule}
                          </span>
                          <StatusBadge status={f.status} size="sm" />
                        </div>

                        {/* Finding Message */}
                        <p className="text-xs text-slate-800 dark:text-slate-200 font-mono leading-relaxed">
                          {f.message}
                        </p>

                        {/* Highlighted Suggestion Block */}
                        {f.suggestion && f.status !== 'pass' && (
                          <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/50 flex items-start gap-2 text-xs text-indigo-900 dark:text-indigo-300">
                            <span className="text-indigo-500 dark:text-indigo-400 font-bold shrink-0 mt-0.5 select-none">
                              💡
                            </span>
                            <div className="flex-1 leading-relaxed">
                              <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                                Recommendation:{' '}
                              </span>
                              <span>{f.suggestion}</span>
                            </div>
                          </div>
                        )}

                        {/* Quick Apply Action Button */}
                        {f.fix_snippet && f.fix_kind && onApplyFix && f.status !== 'pass' && (
                          <div className="pt-1 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => handleApply(f)}
                              disabled={isApplied}
                              className={`
                                inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm
                                transition-all duration-200 active:scale-95
                                ${
                                  isApplied
                                    ? 'bg-emerald-600 text-white cursor-default'
                                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-glow-emerald'
                                }
                              `}
                              title={`Apply proposed fix: ${f.fix_field ?? f.rule}`}
                            >
                              <span>{isApplied ? '✓' : '⚡'}</span>
                              <span>{isApplied ? 'Applied!' : 'Quick Apply'}</span>
                            </button>

                            {f.fix_field && (
                              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                                Target: {f.fix_field}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
