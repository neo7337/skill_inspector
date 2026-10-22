import React, { useState } from 'react'
import type { RepairPlanResult, LLMRefactorResult, ProviderConfig } from '../types'
import { refactorWithLLM } from '../api'

export interface DiffViewerProps {
  content: string
  repairPlan: RepairPlanResult | null
  loading: boolean
  onApplyRepairs: (repairedContent: string) => void
  onRefreshPlan: () => void
  providerConfig: ProviderConfig
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  content,
  repairPlan,
  loading,
  onApplyRepairs,
  onRefreshPlan,
  providerConfig,
}) => {
  const [llmRefactorLoading, setLlmRefactorLoading] = useState(false)
  const [llmRefactorResult, setLlmRefactorResult] = useState<LLMRefactorResult | null>(null)
  const [llmError, setLlmError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'deterministic' | 'llm'>('deterministic')
  const [copied, setCopied] = useState(false)

  const activeDiff =
    activeView === 'llm' && llmRefactorResult ? llmRefactorResult.diff : repairPlan?.diff
  const activeRepairs = repairPlan?.repairs_applied || []
  const repairedContent =
    activeView === 'llm' && llmRefactorResult
      ? llmRefactorResult.refactored_content
      : repairPlan?.repaired_content

  const handleRunLLMRefactor = async () => {
    try {
      setLlmRefactorLoading(true)
      setLlmError(null)
      const res = await refactorWithLLM(content, providerConfig)
      setLlmRefactorResult(res)
      setActiveView('llm')
    } catch (err: any) {
      setLlmError(err?.response?.data?.detail || err.message || 'LLM Refactor failed')
    } finally {
      setLlmRefactorLoading(false)
    }
  }

  const handleCopyDiff = () => {
    if (activeDiff?.unified_diff) {
      navigator.clipboard.writeText(activeDiff.unified_diff)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Action Header Card */}
      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 shadow-xs backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Interactive Diff & Auto-Fixer
              </h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                --fix ready
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Preview and apply one-click deterministic fixes and AI prompt refactoring.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRunLLMRefactor}
              disabled={llmRefactorLoading || !content.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:via-indigo-500 hover:to-cyan-400 text-white shadow-glow-violet disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all"
            >
              {llmRefactorLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Refactoring…</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Refactor with AI</span>
                </>
              )}
            </button>

            {repairedContent && activeDiff?.has_changes && (
              <button
                type="button"
                onClick={() => onApplyRepairs(repairedContent)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-glow-emerald active:scale-95 transition-all"
              >
                <span>✓</span>
                <span>Apply Fixes to Editor</span>
              </button>
            )}
          </div>
        </div>

        {/* Segmented Mode Selector & Stats Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
          {/* Segmented Mode Control */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveView('deterministic')}
              className={`
                px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 select-none
                ${
                  activeView === 'deterministic'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }
              `}
            >
              <span>Schema Auto-Fix</span>
              {activeRepairs.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  {activeRepairs.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveView('llm')}
              className={`
                px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 flex items-center gap-1.5 select-none
                ${
                  activeView === 'llm'
                    ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 shadow-xs border border-slate-200/80 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }
              `}
            >
              <span>AI Prompt Refactor</span>
              {llmRefactorResult && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              )}
            </button>
          </div>

          {/* Diff Add/Del Stat Badges */}
          <div className="flex items-center gap-2">
            {activeDiff?.has_changes ? (
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  +{activeDiff.additions_count}
                </span>
                <span className="px-2 py-0.5 rounded-md font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  -{activeDiff.deletions_count}
                </span>
              </div>
            ) : (
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                No differences
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {llmError && (
        <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>✗</span>
            <span className="font-mono">{llmError}</span>
          </div>
          <button
            type="button"
            onClick={() => setLlmError(null)}
            className="text-xs underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Repairs Applied Cards Grid (Deterministic) */}
      {activeView === 'deterministic' && activeRepairs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Automatic Repairs Applied ({activeRepairs.length})
            </h3>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              Safe deterministic AST modifications
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {activeRepairs.map(repair => (
              <div
                key={repair.id}
                className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/70 shadow-xs space-y-1.5 transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                    {repair.title}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {repair.field_or_section}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {repair.description}
                </p>
                {repair.is_safe && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <span>🛡️</span>
                    <span>Safe Fix</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Changes Summary Box */}
      {activeView === 'llm' && llmRefactorResult && (
        <div className="p-4 rounded-xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20 text-xs text-violet-900 dark:text-violet-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold">Summary of AI Refactoring Improvements:</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
              {llmRefactorResult.provider_used}:{llmRefactorResult.model_used}
            </span>
          </div>
          <ul className="space-y-1 pl-1">
            {llmRefactorResult.summary_of_changes.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-violet-500 dark:text-violet-400 font-bold shrink-0">•</span>
                <span className="leading-relaxed">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* High-Contrast Code / Diff Container */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-950 text-slate-100 overflow-hidden shadow-md font-mono text-xs">
        {/* Diff Top Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-200 text-xs">Unified Diff</span>
            {activeDiff?.has_changes && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-emerald-400 font-bold">+{activeDiff.additions_count}</span>
                <span className="text-rose-400 font-bold">-{activeDiff.deletions_count}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyDiff}
              disabled={!activeDiff?.unified_diff}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1 active:scale-95"
            >
              <span>{copied ? '✓' : '📋'}</span>
              <span>{copied ? 'Copied' : 'Copy Diff'}</span>
            </button>
            <button
              type="button"
              onClick={onRefreshPlan}
              disabled={loading}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1 active:scale-95"
            >
              <span>↻</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Diff Line View / Hunks */}
        <div className="max-h-[520px] overflow-y-auto p-3 sm:p-4 space-y-3.5 scrollbar-thin">
          {activeDiff && activeDiff.hunks && activeDiff.hunks.length > 0 ? (
            activeDiff.hunks.map((hunk, hunkIdx) => (
              <div
                key={hunkIdx}
                className="border border-slate-800/90 rounded-xl bg-slate-900/40 overflow-hidden"
              >
                {/* Hunk Header */}
                <div className="px-3.5 py-1.5 bg-slate-800/60 text-indigo-300 dark:text-indigo-400 text-[11px] select-none border-b border-slate-800/80 font-mono">
                  {hunk.header}
                </div>

                {/* Hunk Lines */}
                <div className="divide-y divide-slate-900/50">
                  {hunk.lines.map((line, lIdx) => {
                    const isAdd = line.type === 'add'
                    const isDel = line.type === 'del'

                    return (
                      <div
                        key={lIdx}
                        className={`flex items-start px-2 sm:px-3 py-1 leading-relaxed transition-colors ${
                          isAdd
                            ? 'bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500'
                            : isDel
                            ? 'bg-rose-950/40 text-rose-300 border-l-2 border-rose-500'
                            : 'text-slate-400 hover:bg-slate-900/40 border-l-2 border-transparent'
                        }`}
                      >
                        {/* Old Line Number */}
                        <span className="w-9 sm:w-10 select-none text-right pr-2 sm:pr-3 text-slate-600 shrink-0 font-mono text-[11px]">
                          {line.line_number_old || ''}
                        </span>

                        {/* New Line Number */}
                        <span className="w-9 sm:w-10 select-none text-right pr-2 sm:pr-3 text-slate-600 shrink-0 font-mono text-[11px]">
                          {line.line_number_new || ''}
                        </span>

                        {/* Sign Indicator */}
                        <span
                          className={`w-4 select-none font-bold shrink-0 ${
                            isAdd ? 'text-emerald-400' : isDel ? 'text-rose-400' : 'text-slate-600'
                          }`}
                        >
                          {isAdd ? '+' : isDel ? '-' : ' '}
                        </span>

                        {/* Code Content */}
                        <span className="whitespace-pre-wrap break-all flex-1 font-mono">
                          {line.content}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="py-14 text-center text-slate-400 select-none space-y-2">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                  <span className="text-xs">Computing diff and repair plan…</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-base">
                    ✓
                  </div>
                  <p className="text-xs font-semibold text-slate-200">
                    SKILL.md is Clean & Valid
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-sm">
                    No schema repairs or automatic diff changes required for this skill.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
