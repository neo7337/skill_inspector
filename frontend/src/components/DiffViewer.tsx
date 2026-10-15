import React, { useState } from 'react'
import type { RepairPlanResult, LLMRefactorResult, ProviderConfig } from '../types'
import { refactorWithLLM } from '../api'

interface DiffViewerProps {
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
  const [activeView, setActiveView] = useState<'deterministic' | 'llm'>('deterministic')
  const [copied, setCopied] = useState(false)

  const activeDiff = activeView === 'llm' && llmRefactorResult ? llmRefactorResult.diff : repairPlan?.diff
  const activeRepairs = repairPlan?.repairs_applied || []
  const repairedContent =
    activeView === 'llm' && llmRefactorResult
      ? llmRefactorResult.refactored_content
      : repairPlan?.repaired_content

  const handleRunLLMRefactor = async () => {
    try {
      setLlmRefactorLoading(true)
      const res = await refactorWithLLM(content, providerConfig)
      setLlmRefactorResult(res)
      setActiveView('llm')
    } catch (err: any) {
      alert(`LLM Refactor error: ${err?.response?.data?.detail || err.message}`)
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
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span>Interactive Diff & Auto-Fixer</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              ESLint-style --fix
            </span>
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Preview and apply one-click deterministic fixes and AI-assisted instruction refactoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode switch */}
          <div className="flex bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveView('deterministic')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeView === 'deterministic'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              Schema Auto-Fix ({activeRepairs.length})
            </button>
            <button
              onClick={() => setActiveView('llm')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeView === 'llm'
                  ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              AI Prompt Refactor {llmRefactorResult ? '✓' : ''}
            </button>
          </div>

          <button
            onClick={handleRunLLMRefactor}
            disabled={llmRefactorLoading || !content.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-sm disabled:opacity-50 transition-all"
          >
            {llmRefactorLoading ? (
              <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <span>✨ Refactor with AI</span>
            )}
          </button>

          {repairedContent && activeDiff?.has_changes && (
            <button
              onClick={() => onApplyRepairs(repairedContent)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
            >
              <span>Apply Fixes to Editor</span>
            </button>
          )}
        </div>
      </div>

      {/* Changes list cards */}
      {activeView === 'deterministic' && activeRepairs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activeRepairs.map(repair => (
            <div
              key={repair.id}
              className="p-3.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 text-xs"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-900 dark:text-gray-200">{repair.title}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                  {repair.field_or_section}
                </span>
              </div>
              <p className="text-gray-600 dark:text-gray-400">{repair.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* AI changes summary */}
      {activeView === 'llm' && llmRefactorResult && (
        <div className="p-4 rounded-lg border border-purple-200 dark:border-purple-900/60 bg-purple-50/60 dark:bg-purple-950/20 text-xs text-purple-900 dark:text-purple-200">
          <div className="font-semibold mb-2 flex items-center gap-2">
            <span>Summary of AI Refactoring Changes:</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-200/70 dark:bg-purple-900/80">
              {llmRefactorResult.provider_used}:{llmRefactorResult.model_used}
            </span>
          </div>
          <ul className="list-disc list-inside space-y-1">
            {llmRefactorResult.summary_of_changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Diff display box */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-900 text-gray-100 overflow-hidden shadow-inner font-mono text-xs">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-800/80 border-b border-gray-700/80">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-200">Unified Diff</span>
            {activeDiff?.has_changes ? (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-emerald-400 font-bold">+{activeDiff.additions_count}</span>
                <span className="text-rose-400 font-bold">-{activeDiff.deletions_count}</span>
              </div>
            ) : (
              <span className="text-gray-400 text-[11px]">No differences</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyDiff}
              disabled={!activeDiff?.unified_diff}
              className="px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 text-[11px] disabled:opacity-40 transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy Diff'}
            </button>
            <button
              onClick={onRefreshPlan}
              disabled={loading}
              className="px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 text-[11px] transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="max-h-[500px] overflow-y-auto p-4 space-y-4">
          {activeDiff && activeDiff.hunks && activeDiff.hunks.length > 0 ? (
            activeDiff.hunks.map((hunk, hunkIdx) => (
              <div key={hunkIdx} className="border border-gray-800 rounded bg-gray-950/60 overflow-hidden">
                <div className="px-3 py-1 bg-gray-800/50 text-gray-400 text-[11px] select-none border-b border-gray-800">
                  {hunk.header}
                </div>
                <div className="divide-y divide-gray-900/40">
                  {hunk.lines.map((line, lIdx) => {
                    const isAdd = line.type === 'add'
                    const isDel = line.type === 'del'
                    return (
                      <div
                        key={lIdx}
                        className={`flex items-start px-3 py-0.5 leading-relaxed ${
                          isAdd
                            ? 'bg-emerald-950/40 text-emerald-300'
                            : isDel
                            ? 'bg-rose-950/40 text-rose-300'
                            : 'text-gray-400'
                        }`}
                      >
                        <span className="w-10 select-none text-right pr-3 text-gray-600 shrink-0">
                          {line.line_number_old || ''}
                        </span>
                        <span className="w-10 select-none text-right pr-3 text-gray-600 shrink-0">
                          {line.line_number_new || ''}
                        </span>
                        <span className="w-4 select-none font-bold shrink-0">
                          {isAdd ? '+' : isDel ? '-' : ' '}
                        </span>
                        <span className="whitespace-pre-wrap break-all flex-1">{line.content}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-gray-500">
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <span className="animate-spin inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full" />
                  <span>Computing diff and repair plan...</span>
                </div>
              ) : (
                <p>✓ SKILL.md is clean. No repairs or schema diffs required.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
