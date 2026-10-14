import { useState } from 'react'
import type { LLMValidationResult, ReferencedFile, SkillTokenEstimate } from '../types'
import { StatusBadge } from './StatusBadge'
import { ScoreBar, OverallScoreRing } from './ScoreBar'

const BODY_TOKEN_WARN_THRESHOLD = 5000

interface LLMReportProps {
  result: LLMValidationResult | null
  isLoading: boolean
  error: string | null
  skillTokens?: SkillTokenEstimate
  referencedFiles?: ReferencedFile[]
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
    <div className="p-4 rounded-lg bg-gray-900 border border-gray-800 space-y-3">
      {tokens && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Skill context cost
          </p>
          <p className="text-xs text-gray-600 italic">Approximate (~4 characters per token)</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-gray-400">Catalog (name + description)</span>
              <span className="font-mono text-gray-200 shrink-0">~{tokens.catalog.toLocaleString()}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className={bodyOverLimit ? 'text-amber-400' : 'text-gray-400'}>
                On activation (body)
              </span>
              <span className={`font-mono shrink-0 ${bodyOverLimit ? 'text-amber-400' : 'text-gray-200'}`}>
                ~{tokens.body.toLocaleString()}
                <span className={`ml-1.5 text-xs font-sans ${bodyOverLimit ? 'text-amber-500/80' : 'text-gray-600'}`}>
                  / {BODY_TOKEN_WARN_THRESHOLD.toLocaleString()} recommended
                </span>
              </span>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-gray-400">Full file</span>
              <span className="font-mono text-gray-200 shrink-0">~{tokens.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Referenced files (on demand)
          </p>
          <p className="text-xs text-gray-600 italic">
            Not included in the body token count. Loaded only if the agent reads them.
          </p>
          <ul className="space-y-1">
            {files.map(file => (
              <li key={file.path} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-mono text-gray-200 break-all">{file.path}</span>
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

export function LLMReport({ result, isLoading, error, skillTokens, referencedFiles }: LLMReportProps) {
  const [expandedDim, setExpandedDim] = useState<DimensionKey | null>(null)

  const tokenCard = (skillTokens || (referencedFiles && referencedFiles.length > 0))
    ? <SkillTokenBreakdown tokens={skillTokens} referencedFiles={referencedFiles} />
    : null

  if (isLoading) {
    return (
      <div className="space-y-4">
        {tokenCard}
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 text-gray-500">
            <div className="w-4 h-4 border-2 border-gray-600 border-t-purple-500 rounded-full animate-spin" />
            <span className="text-sm">Consulting LLM judge…</span>
          </div>
          <p className="text-xs text-gray-600 italic">
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
            <span className="text-red-400 text-lg">✗</span>
            <div>
              <p className="text-sm font-medium text-red-300">LLM Analysis Failed</p>
              <p className="text-sm text-red-400/80 mt-1">{error}</p>
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
          <p className="text-gray-600 text-sm">LLM analysis not run yet</p>
          <p className="text-gray-700 text-xs">
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
      <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-900 border border-gray-800">
        <OverallScoreRing score={result.overall_score} />
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <StatusBadge status={result.overall_status} size="md" />
            <span className="text-sm text-gray-400">LLM Analysis</span>
          </div>
          <p className="text-xs text-gray-600 font-mono">
            {result.provider_used} / {result.model_used}
          </p>
          <p className="text-xs text-gray-600 italic">
            Scores may vary ±5–10 pts between runs. Focus on the findings.
          </p>
        </div>
      </div>

      {/* Score bars */}
      <div className="p-4 rounded-lg bg-gray-900 border border-gray-800 space-y-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Scores</p>
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
            <div key={dim} className="rounded-lg border border-gray-800 overflow-hidden">
              <button
                onClick={() => setExpandedDim(isExpanded ? null : dim)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <StatusBadge status={d.status} />
                  <span className="text-sm text-gray-200">{DIMENSION_LABELS[dim]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400">{d.score}/100</span>
                  <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-800 p-4 space-y-4 bg-gray-900/30">
                  {/* Findings */}
                  {d.findings.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Findings</p>
                      <ul className="space-y-1.5">
                        {d.findings.map((finding, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                            <span className="text-gray-600 mt-0.5 shrink-0">•</span>
                            {finding}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggestions */}
                  {d.suggestions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-blue-400/70 uppercase tracking-wider">
                        Suggestions
                      </p>
                      <ul className="space-y-2">
                        {d.suggestions.map((sug, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5 shrink-0">→</span>
                            <span className="text-sm text-blue-300/80">{sug}</span>
                          </li>
                        ))}
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
