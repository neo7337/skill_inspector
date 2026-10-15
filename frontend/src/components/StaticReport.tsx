import { useState } from 'react'
import type { StaticValidationResult, RuleStatus, ApplyableFix } from '../types'
import { StatusBadge, StatusIcon } from './StatusBadge'
import { OverallScoreRing } from './ScoreBar'

interface StaticReportProps {
  result: StaticValidationResult | null
  isLoading: boolean
  isDark?: boolean
  onApplyFix?: (fix: ApplyableFix, resolvedRule?: string) => void
}

function groupByDimension(findings: StaticValidationResult['findings']) {
  const groups: Record<string, typeof findings> = {}
  for (const f of findings) {
    if (!groups[f.dimension]) groups[f.dimension] = []
    groups[f.dimension].push(f)
  }
  return groups
}

function dimensionStatus(findings: StaticValidationResult['findings']): RuleStatus {
  if (findings.some(f => f.status === 'fail')) return 'fail'
  if (findings.some(f => f.status === 'warn')) return 'warn'
  return 'pass'
}

export function StaticReport({ result, isLoading, onApplyFix }: StaticReportProps) {
  const [expandedDims, setExpandedDims] = useState<Set<string>>(new Set())

  const toggle = (dim: string) => {
    setExpandedDims(prev => {
      const next = new Set(prev)
      if (next.has(dim)) next.delete(dim)
      else next.add(dim)
      return next
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 py-4">
        <div className="w-4 h-4 border-2 border-gray-400 dark:border-gray-600 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm font-medium">Validating…</span>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="py-8 text-center text-gray-500 dark:text-gray-500 text-sm">
        Paste a SKILL.md to see validation results
      </div>
    )
  }

  if (result.type === 'parse_error') {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
        <div className="flex items-start gap-3">
          <span className="text-red-500 dark:text-red-400 text-lg mt-0.5">✗</span>
          <div>
            <p className="text-sm font-semibold text-red-600 dark:text-red-300">Parse Error</p>
            <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1 font-mono whitespace-pre-wrap">{result.error}</p>
          </div>
        </div>
      </div>
    )
  }

  const groups = groupByDimension(result.findings)
  const failCount = result.findings.filter(f => f.status === 'fail').length
  const warnCount = result.findings.filter(f => f.status === 'warn').length

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm dark:shadow-none">
        <OverallScoreRing score={result.score} />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={result.overall_status} size="md" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Static Analysis</span>
          </div>
          <div className="flex gap-4 text-sm font-medium">
            {failCount > 0 && (
              <span className="text-red-600 dark:text-red-400">{failCount} failure{failCount !== 1 ? 's' : ''}</span>
            )}
            {warnCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400">{warnCount} warning{warnCount !== 1 ? 's' : ''}</span>
            )}
            {failCount === 0 && warnCount === 0 && (
              <span className="text-emerald-600 dark:text-emerald-400">All checks passed</span>
            )}
          </div>
        </div>
      </div>

      {/* Per-dimension accordion */}
      <div className="space-y-2">
        {Object.entries(groups).map(([dim, findings]) => {
          const status = dimensionStatus(findings)
          const isExpanded = expandedDims.has(dim)

          return (
            <div key={dim} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 overflow-hidden shadow-sm dark:shadow-none">
              <button
                type="button"
                onClick={() => toggle(dim)}
                className="w-full flex items-center justify-between p-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <StatusIcon status={status} />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{dim}</span>
                  <span className="text-xs text-gray-500">
                    {findings.filter(f => f.status === 'fail').length > 0 &&
                      `${findings.filter(f => f.status === 'fail').length} fail`}
                    {findings.filter(f => f.status === 'warn').length > 0 &&
                      ` ${findings.filter(f => f.status === 'warn').length} warn`}
                  </span>
                </div>
                <span className="text-gray-400 dark:text-gray-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-800 p-3.5 space-y-3 bg-gray-50/50 dark:bg-gray-900/60">
                  {findings.map((f, i) => (
                    <div key={i} className="space-y-1.5 p-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <div className="flex items-start gap-2">
                        <StatusBadge status={f.status} />
                        <span className="text-xs text-gray-800 dark:text-gray-300 leading-relaxed font-mono flex-1">
                          {f.message}
                        </span>
                      </div>

                      {f.suggestion && f.status !== 'pass' && (
                        <div className="ml-14 text-xs text-blue-600 dark:text-blue-400/90 italic">
                          → {f.suggestion}
                        </div>
                      )}

                      {/* Quick Apply button if structured fix available */}
                      {f.fix_snippet && f.fix_kind && onApplyFix && f.status !== 'pass' && (
                        <div className="ml-14 mt-1">
                          <button
                            type="button"
                            onClick={() =>
                              onApplyFix(
                                {
                                  kind: f.fix_kind!,
                                  field: f.fix_field,
                                  snippet: f.fix_snippet!,
                                  replaceTarget: f.fix_replace_target,
                                },
                                f.rule
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
                          >
                            <span>⚡ Apply Fix</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
