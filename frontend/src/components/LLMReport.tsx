import { useState } from 'react'
import type {
  LLMValidationResult,
  ReferencedFile,
  SkillTokenEstimate,
  ApplyableFix,
  SkillPackageSummary,
  ResolvedFileReference,
} from '../types'
import { StatusBadge } from './StatusBadge'
import { ScoreBar, OverallScoreRing } from './ScoreBar'
import { SkillTokenBreakdown } from './SkillTokenBreakdown'

export interface LLMReportProps {
  result: LLMValidationResult | null
  isLoading: boolean
  error: string | null
  skillTokens?: SkillTokenEstimate
  referencedFiles?: ReferencedFile[]
  packageSummary?: SkillPackageSummary | null
  onSelectFile?: (file: ResolvedFileReference | ReferencedFile) => void
  isDark?: boolean
  onApplyFix?: (fix: ApplyableFix, resolvedRule?: string) => void
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
  packageSummary,
  onSelectFile,
  onApplyFix,
}: LLMReportProps) {
  const [expandedDim, setExpandedDim] = useState<DimensionKey | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null)

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedIndex(key)
    setTimeout(() => setCopiedIndex(null), 1500)
  }

  const pkg = packageSummary ?? result?.package
  const tokenCard =
    skillTokens || (referencedFiles && referencedFiles.length > 0) || pkg ? (
      <SkillTokenBreakdown
        tokens={skillTokens}
        referencedFiles={referencedFiles}
        packageSummary={pkg}
        onSelectFile={onSelectFile}
      />
    ) : null

  if (isLoading) {
    return (
      <div className="space-y-4">
        {tokenCard}
        <div className="flex flex-col items-center justify-center py-12 px-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md text-center space-y-3">
          <div className="relative flex items-center justify-center">
            <div className="w-10 h-10 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
            <div className="absolute w-2 h-2 rounded-full bg-violet-500 animate-ping" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Consulting LLM Judge…
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-0.5">
              Evaluating instruction clarity, description triggers, and edge-cases (typically 10–45s).
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        {tokenCard}
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/30 p-5 shadow-lg backdrop-blur-sm">
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 font-bold">
              ✗
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">
                LLM Analysis Execution Failed
              </h3>
              <p className="text-xs text-rose-800/80 dark:text-rose-300/80 mt-1 font-mono break-words">
                {error}
              </p>
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
        <div className="flex flex-col items-center justify-center py-12 px-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/20 text-center select-none">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 dark:bg-violet-500/20 border border-violet-500/20 flex items-center justify-center text-violet-500 dark:text-violet-400 mb-3 shadow-glow-sm">
            ✨
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            LLM Judge Not Executed Yet
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
            Configure your provider and model above, then click <strong>Run LLM Analysis</strong> to trigger the qualitative AI diagnostic.
          </p>
        </div>
      </div>
    )
  }

  const dims = Object.keys(DIMENSION_LABELS) as DimensionKey[]

  return (
    <div className="space-y-4">
      {tokenCard}

      {/* Summary Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs backdrop-blur-md flex flex-col sm:flex-row items-center gap-5">
        <OverallScoreRing score={result.overall_score} size="md" />

        <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <StatusBadge status={result.overall_status} size="md" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              LLM Judge Evaluation
            </h2>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20 truncate">
              {result.provider_used} / {result.model_used}
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Evaluates qualitative prompt strength, boundaries, and phrasing clarity.
            Scores typically vary ±5–10 points across stochastic model runs.
          </p>
        </div>
      </div>

      {/* Dimension Score Bars Card */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs backdrop-blur-md space-y-3">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Dimension Scores
        </h3>
        <div className="space-y-2.5">
          {dims.map(dim => (
            <ScoreBar
              key={dim}
              score={result[dim].score}
              label={DIMENSION_LABELS[dim]}
            />
          ))}
        </div>
      </div>

      {/* Per-dimension accordion */}
      <div className="space-y-2.5">
        {dims.map(dim => {
          const d = result[dim]
          const isExpanded = expandedDim === dim

          return (
            <div
              key={dim}
              className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 overflow-hidden shadow-xs backdrop-blur-sm transition-all duration-200"
            >
              <button
                type="button"
                onClick={() => setExpandedDim(isExpanded ? null : dim)}
                className="w-full flex items-center justify-between p-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <StatusBadge status={d.status} size="sm" />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {DIMENSION_LABELS[dim]}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                    {d.score}/100
                  </span>
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
                <div className="border-t border-slate-200/80 dark:border-slate-800/80 p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
                  {/* Qualitative Findings List */}
                  {d.findings.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Qualitative Findings
                      </h4>
                      <div className="space-y-2">
                        {d.findings.map((finding, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/60 text-xs text-slate-800 dark:text-slate-200 leading-relaxed flex items-start gap-2.5"
                          >
                            <span className="text-slate-400 dark:text-slate-500 font-bold shrink-0 mt-0.5">
                              •
                            </span>
                            <span className="flex-1">{finding}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions & Code Snippet Action Cards */}
                  {d.suggestions.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        Recommendations & Concrete Improvements
                      </h4>
                      <div className="space-y-3">
                        {d.suggestions.map((sug, i) => {
                          const suggestionText = typeof sug === 'string' ? sug : sug?.text ?? ''
                          const suggestionExample =
                            typeof sug === 'object' && sug !== null ? sug.example : null
                          const itemKey = `${dim}-${i}`
                          const isCopied = copiedIndex === itemKey

                          return (
                            <div
                              key={i}
                              className="p-3.5 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2.5"
                            >
                              <div className="flex items-start gap-2 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                                <span className="text-indigo-500 dark:text-indigo-400 font-bold shrink-0 mt-0.5">
                                  💡
                                </span>
                                <span className="flex-1">{suggestionText}</span>
                              </div>

                              {/* Code Snippet Box & Actions */}
                              {suggestionExample && (
                                <div className="mt-2 space-y-2 pt-1 border-t border-indigo-200/50 dark:border-indigo-900/30">
                                  <div className="relative group">
                                    <div className="px-3 py-1 bg-slate-800 dark:bg-slate-900 text-slate-400 rounded-t-lg text-[10px] font-mono flex items-center justify-between border-b border-slate-700/60">
                                      <span>Suggested SKILL.md Snippet</span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopy(itemKey, suggestionExample)}
                                        className="hover:text-white transition-colors"
                                      >
                                        {isCopied ? '✓ Copied' : 'Copy'}
                                      </button>
                                    </div>
                                    <pre className="text-xs bg-slate-900 dark:bg-slate-950 text-slate-100 p-3 rounded-b-lg font-mono overflow-x-auto scrollbar-thin border border-slate-800 whitespace-pre-wrap leading-relaxed">
                                      <code>{suggestionExample}</code>
                                    </pre>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(itemKey, suggestionExample)}
                                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5 active:scale-95"
                                    >
                                      <span>{isCopied ? '✓' : '📋'}</span>
                                      <span>{isCopied ? 'Copied to Clipboard' : 'Copy Snippet'}</span>
                                    </button>

                                    {onApplyFix && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onApplyFix({
                                            kind: 'body_section',
                                            snippet: suggestionExample,
                                          })
                                        }
                                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                                        title="Append this section directly to the editor markdown"
                                      >
                                        <span>+</span>
                                        <span>Append to SKILL.md</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
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
