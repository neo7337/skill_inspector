import { useState } from 'react'
import type { LLMValidationResult, ReferencedFile, SkillTokenEstimate, ApplyableFix } from '../types'
import { StatusBadge } from './StatusBadge'
import { ScoreBar, OverallScoreRing } from './ScoreBar'

const BODY_TOKEN_WARN_THRESHOLD = 5000

interface LLMReportProps {
  result: LLMValidationResult | null
  isLoading: boolean
  error: string | null
  skillTokens?: SkillTokenEstimate
  referencedFiles?: ReferencedFile[]
  isDark?: boolean
  onApplyFix?: (fix: ApplyableFix, resolvedRule?: string) => void
}

const KIND_LABELS: Record<ReferencedFile['kind'], string> = {
  reference: 'reference',
  script: 'script',
  asset: 'asset',
  other: 'other',
}

function SkillTokenBreakdown({
  tokens,
  referencedFiles,
}: {
  tokens?: SkillTokenEstimate
  referencedFiles?: ReferencedFile[]
}) {
  const bodyOverLimit = (tokens?.body ?? 0) > BODY_TOKEN_WARN_THRESHOLD
  const files = referencedFiles ?? []

  return (
    <div className="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-3">
      {tokens && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Skill context cost
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">Approximate (~4 characters per token)</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Catalog (name + description)</span>
              <span className="font-mono text-gray-900 dark:text-gray-200 shrink-0">~{tokens.catalog.toLocaleString()}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className={bodyOverLimit ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-600 dark:text-gray-400'}>
                On activation (body)
              </span>
              <span className={`font-mono shrink-0 ${bodyOverLimit ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-200'}`}>
                ~{tokens.body.toLocaleString()}
                <span className={`ml-1.5 text-xs font-sans ${bodyOverLimit ? 'text-amber-600/80 dark:text-amber-500/80' : 'text-gray-400 dark:text-gray-600'}`}>
                  / {BODY_TOKEN_WARN_THRESHOLD.toLocaleString()} recommended
                </span>
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-gray-600 dark:text-gray-400">Full file</span>
              <span className="font-mono text-gray-900 dark:text-gray-200 shrink-0">~{tokens.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Referenced files (on demand)
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            Not included in the body token count. Loaded only if the agent reads them.
          </p>
          <ul className="space-y-1">
            {files.map(file => (
              <li key={file.path} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-mono text-gray-800 dark:text-gray-200 break-all">{file.path}</span>
                <span className="text-xs text-gray-500 shrink-0">{KIND_LABELS[file.kind]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const DIMENSION_LABELS = {
  description_quality: 'Description Quality',
  instruction_clarity: 'Instruction Clarity',
  scope_and_boundaries: 'Scope & Boundaries',
  token_efficiency: 'Token Efficiency',
} as const

type DimensionKey = keyof typeof DIMENSION_LABELS

export function LLMReport({
  result,
  isLoading,
  error,
  skillTokens,
  referencedFiles,
  onApplyFix,
}: LLMReportProps) {
  const [expandedDim, setExpandedDim] = useState<DimensionKey | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null)

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(key)
    setTimeout(() => setCopiedIndex(null), 1500)
  }

  const tokenCard = (skillTokens || (referencedFiles && referencedFiles.length > 0))
    ? <SkillTokenBreakdown tokens={skillTokens} referencedFiles={referencedFiles} />
    : null

  if (isLoading) {
    return (
      <div className="space-y-4">
        {tokenCard}
        <div className="space-y-3 py-4 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
            <div className="w-5 h-5 border-2 border-purple-300 dark:border-gray-600 border-t-purple-600 dark:border-t-purple-500 rounded-full animate-spin" />
            <span className="text-sm font-medium">Consulting LLM judge…</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500 italic">
            This may take 10–60 seconds depending on the provider and model.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        {tokenCard}
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-500 dark:text-red-400 text-lg">✗</span>
            <div>
              <p className="text-sm font-semibold text-red-600 dark:text-red-300">LLM Analysis Failed</p>
              <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="space-y-4">
        {tokenCard}
        <div className="py-6 text-center space-y-2">
          <p className="text-gray-500 dark:text-gray-500 text-sm">LLM analysis not run yet</p>
          <p className="text-gray-400 dark:text-gray-600 text-xs">
            Configure a provider above and click "Run LLM Analysis"
          </p>
        </div>
      </div>
    )
  }

  const dims = (Object.keys(DIMENSION_LABELS) as DimensionKey[])

  return (
    <div className="space-y-4">
      {tokenCard}

      {/* Summary */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm dark:shadow-none">
        <OverallScoreRing score={result.overall_score} />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={result.overall_status} size="md" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">LLM Analysis</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {result.provider_used} / {result.model_used}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            Scores may vary ±5–10 pts between runs. Focus on the findings.
          </p>
        </div>
      </div>

      {/* Score bars */}
      <div className="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-3 shadow-sm dark:shadow-none">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Scores</p>
        {dims.map(dim => (
          <ScoreBar
            key={dim}
            score={result[dim].score}
            label={DIMENSION_LABELS[dim]}
          />
        ))}
      </div>

      {/* Per-dimension accordion */}
      <div className="space-y-2">
        {dims.map(dim => {
          const d = result[dim]
          const isExpanded = expandedDim === dim

          return (
            <div key={dim} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 overflow-hidden shadow-sm dark:shadow-none">
              <button
                type="button"
                onClick={() => setExpandedDim(isExpanded ? null : dim)}
                className="w-full flex items-center justify-between p-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <StatusBadge status={d.status} />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{DIMENSION_LABELS[dim]}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{d.score}/100</span>
                  <span className="text-gray-400 dark:text-gray-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/60">
                  {/* Findings */}
                  {d.findings.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Findings</p>
                      <ul className="space-y-2">
                        {d.findings.map((finding, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            <span className="text-gray-400 dark:text-gray-600 mt-1 shrink-0">•</span>
                            <span>{finding}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggestions */}
                  {d.suggestions.length > 0 && (
                    <div className="space-y-2.5">
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Suggestions & Improvements
                      </p>
                      <ul className="space-y-3">
                        {d.suggestions.map((sug, i) => {
                          const suggestionText = typeof sug === 'string' ? sug : (sug?.text ?? '')
                          const suggestionExample = typeof sug === 'object' && sug !== null ? sug.example : null
                          const itemKey = `${dim}-${i}`

                          return (
                            <li key={i} className="p-3 rounded-lg border border-blue-200/60 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-950/20 space-y-2">
                              <div className="flex items-start gap-2">
                                <span className="text-blue-500 mt-0.5 shrink-0">→</span>
                                <span className="text-sm text-gray-800 dark:text-blue-200 leading-relaxed flex-1">
                                  {suggestionText}
                                </span>
                              </div>

                              {suggestionExample && (
                                <div className="ml-5 mt-2 space-y-2">
                                  <div className="relative group">
                                    <pre className="text-xs bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded-md font-mono overflow-x-auto border border-gray-800 whitespace-pre-wrap">
                                      <code>{suggestionExample}</code>
                                    </pre>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(itemKey, suggestionExample)}
                                      className="text-xs px-2.5 py-1 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium transition-colors"
                                    >
                                      {copiedIndex === itemKey ? '✓ Copied' : 'Copy Snippet'}
                                    </button>
                                    {onApplyFix && (
                                      <button
                                        type="button"
                                        onClick={() => onApplyFix({
                                          kind: 'body_section',
                                          snippet: suggestionExample,
                                        })}
                                        className="text-xs px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors flex items-center gap-1 shadow-sm"
                                      >
                                        <span>+ Append to SKILL.md</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
