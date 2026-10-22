import React, { useState } from 'react'
import type { ScenarioSuite, ScenarioCategory, ProviderConfig, MockToolCall } from '../types'
import { generateScenarios, exportScenarios } from '../api'

interface ScenarioMatrixProps {
  content: string
  providerConfig: ProviderConfig
}

export const ScenarioMatrix: React.FC<ScenarioMatrixProps> = ({ content, providerConfig }) => {
  const [suite, setSuite] = useState<ScenarioSuite | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | 'all'>('all')
  const [scenarioCount, setScenarioCount] = useState(12)
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)

  const handleGenerate = async () => {
    if (!content.trim()) return
    try {
      setLoading(true)
      setErrorMessage(null)
      const res = await generateScenarios(content, scenarioCount, providerConfig)
      setSuite(res)
      setSelectedCategory('all')
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.detail || err.message || 'Failed to generate scenario suite')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: 'json' | 'pytest' | 'markdown') => {
    if (!suite) return
    try {
      setExportMenuOpen(false)
      const res = await exportScenarios(suite, format)
      const blob = new Blob([res.content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = res.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setErrorMessage(`Export error: ${err?.response?.data?.detail || err.message}`)
    }
  }

  const handleCopyCode = async (format: 'json' | 'pytest' | 'markdown') => {
    if (!suite) return
    try {
      const res = await exportScenarios(suite, format)
      await navigator.clipboard.writeText(res.content)
      setCopiedFormat(format)
      setTimeout(() => setCopiedFormat(null), 2000)
    } catch (err: any) {
      setErrorMessage(`Copy error: ${err.message}`)
    }
  }

  const handleCopyPrompt = async (id: string, promptText: string) => {
    try {
      await navigator.clipboard.writeText(promptText)
      setCopiedPromptId(id)
      setTimeout(() => setCopiedPromptId(null), 2000)
    } catch (err: any) {
      setErrorMessage(`Failed to copy prompt: ${err.message}`)
    }
  }

  const filteredScenarios =
    suite?.scenarios.filter(s => selectedCategory === 'all' || s.category === selectedCategory) || []

  const getCategoryMeta = (cat: ScenarioCategory) => {
    switch (cat) {
      case 'happy_path':
        return {
          label: 'Happy Path',
          icon: '✓',
          badgeClass:
            'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
          activeChipClass: 'bg-emerald-600 text-white shadow-xs',
        }
      case 'adversarial':
        return {
          label: 'Adversarial',
          icon: '⚠️',
          badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
          activeChipClass: 'bg-amber-600 text-white shadow-xs',
        }
      case 'tool_failure':
        return {
          label: 'Tool Failure',
          icon: '⚡',
          badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
          activeChipClass: 'bg-rose-600 text-white shadow-xs',
        }
      case 'scope_boundary':
        return {
          label: 'Scope Boundary',
          icon: '⛔',
          badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
          activeChipClass: 'bg-purple-600 text-white shadow-xs',
        }
    }
  }

  const getToolStatusBadge = (status: MockToolCall['mock_status']) => {
    switch (status) {
      case 'success':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
      case 'error':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
      case 'timeout':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
      case 'rate_limit':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
      case 'not_found':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
    }
  }

  return (
    <div className="space-y-4">
      {/* Top Action Header Card */}
      <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 shadow-xs backdrop-blur-md space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Synthetic Scenario Matrix & Red-Teaming Studio
              </h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                Red-Teaming
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Automated synthesis of adversarial edge-cases, mock tool failures, and scope boundary tests
              to evaluate agent robustness before deployment.
            </p>
          </div>

          {/* Controls: Count Selector & Generate Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
              <span className="text-slate-400 font-medium">Tests:</span>
              <select
                value={scenarioCount}
                onChange={e => setScenarioCount(Number(e.target.value))}
                className="bg-transparent text-slate-900 dark:text-white font-semibold text-xs focus:outline-none cursor-pointer"
              >
                <option value={8} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">8 tests</option>
                <option value={12} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">12 tests</option>
                <option value={16} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">16 tests</option>
                <option value={20} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">20 tests</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !content.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 hover:from-rose-500 hover:via-pink-500 hover:to-indigo-500 text-white shadow-glow-rose disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating Suite…</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Generate Synthetic Scenarios</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Suite Summary Strip (When loaded) */}
        {suite && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Suite for <span className="font-mono text-indigo-600 dark:text-indigo-400">{suite.skill_name || 'SKILL.md'}</span>:
              </span>
              <span className="px-2 py-0.5 rounded-full font-mono text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                {suite.total_scenarios} scenarios generated
              </span>
              {suite.provider_used && (
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 hidden sm:inline">
                  via {suite.provider_used}:{suite.model_used}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="text-slate-400">Distribution:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                {suite.categories_breakdown.happy_path || 0} happy
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="font-mono text-amber-600 dark:text-amber-400">
                {suite.categories_breakdown.adversarial || 0} adv
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="font-mono text-rose-600 dark:text-rose-400">
                {suite.categories_breakdown.tool_failure || 0} fail
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="font-mono text-purple-600 dark:text-purple-400">
                {suite.categories_breakdown.scope_boundary || 0} scope
              </span>
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

      {/* Filter and Export Toolbar */}
      {suite && (
        <div className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Category Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 font-medium mr-1 text-[11px]">Filter:</span>

            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 select-none ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60'
              }`}
            >
              <span>All</span>
              <span className="text-[10px] opacity-75 font-mono">({suite.total_scenarios})</span>
            </button>

            {(['happy_path', 'adversarial', 'tool_failure', 'scope_boundary'] as ScenarioCategory[]).map(cat => {
              const meta = getCategoryMeta(cat)
              const count = suite.categories_breakdown[cat] || 0
              const isActive = selectedCategory === cat

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 select-none ${
                    isActive
                      ? meta.activeChipClass
                      : 'bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60'
                  }`}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.label}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              )
            })}
          </div>

          {/* Export Actions & Code Copy */}
          <div className="flex items-center gap-2">
            {/* Quick Copy Pytest */}
            <button
              type="button"
              onClick={() => handleCopyCode('pytest')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 transition-colors active:scale-95"
            >
              <span>{copiedFormat === 'pytest' ? '✓' : '📋'}</span>
              <span>{copiedFormat === 'pytest' ? 'Copied PyTest' : 'Copy PyTest'}</span>
            </button>

            {/* Export Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setExportMenuOpen(prev => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
              >
                <span>💾 Export Suite</span>
                <span className="text-[10px]">▼</span>
              </button>

              {exportMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-20 py-1 font-mono text-xs overflow-hidden animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => handleExport('pytest')}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-between"
                  >
                    <span>Pytest (.py)</span>
                    <span className="text-[10px] text-slate-400">code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('json')}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-between"
                  >
                    <span>JSON (.json)</span>
                    <span className="text-[10px] text-slate-400">data</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport('markdown')}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-between"
                  >
                    <span>Markdown (.md)</span>
                    <span className="text-[10px] text-slate-400">doc</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scenario Cards Grid */}
      {suite ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredScenarios.map((scenario, index) => {
            const meta = getCategoryMeta(scenario.category)
            const isPromptCopied = copiedPromptId === scenario.id

            return (
              <div
                key={scenario.id}
                className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all p-4 sm:p-5 flex flex-col justify-between space-y-4"
              >
                {/* Header: Number, Title, Category Badge */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500">
                        #{index + 1}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                        {scenario.title}
                      </h3>
                    </div>

                    <span
                      className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${meta.badgeClass}`}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {scenario.description}
                  </p>
                </div>

                {/* Simulated User Prompt Box */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                      User Prompt / Trigger
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(scenario.id, scenario.user_prompt)}
                      className="text-[10px] font-mono px-2 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                      {isPromptCopied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed select-text">
                    "{scenario.user_prompt}"
                  </p>
                </div>

                {/* Mock Tool Call Simulation (if present) */}
                {scenario.mock_tools.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-mono font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                        Simulated Tool Behavior
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {scenario.mock_tools.length} mock{scenario.mock_tools.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {scenario.mock_tools.map((m, mIdx) => (
                        <div
                          key={mIdx}
                          className="flex flex-col gap-1 p-2 rounded-lg bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 text-xs font-mono"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-indigo-600 dark:text-indigo-400 font-semibold truncate">
                              {m.tool_name}()
                            </span>
                            <span
                              className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border shrink-0 ${getToolStatusBadge(
                                m.mock_status,
                              )}`}
                            >
                              {m.mock_status}
                            </span>
                          </div>

                          {m.simulated_error_message && (
                            <span className="text-[11px] text-rose-500 dark:text-rose-400 break-words">
                              Error: {m.simulated_error_message}
                            </span>
                          )}

                          {m.expected_args_pattern && Object.keys(m.expected_args_pattern).length > 0 && (
                            <span className="text-[10px] text-slate-400 truncate">
                              Args: {JSON.stringify(m.expected_args_pattern)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expected Assertions & Step Budget */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                      Expected Assertions
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                      ⏱ Max Steps: {scenario.max_step_budget}
                    </span>
                  </div>

                  <ul className="space-y-1.5">
                    {scenario.expected_assertions.map((assertion, aIdx) => (
                      <li key={aIdx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <span className="text-emerald-500 font-bold shrink-0 mt-0.5">✓</span>
                        <span className="leading-relaxed">{assertion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="py-16 px-6 text-center border-2 border-dashed border-slate-200/80 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center text-xl shadow-xs">
            🎯
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              No Red-Teaming Scenarios Generated Yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Synthesize a multi-category test suite to evaluate agent resilience against prompt injections,
              unexpected tool failures, timeouts, and scope boundary violations.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !content.trim()}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white shadow-glow-rose disabled:opacity-50 transition-all active:scale-95"
          >
            <span>⚡ Generate Test Matrix</span>
          </button>
        </div>
      )}
    </div>
  )
}
