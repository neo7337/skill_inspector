import React, { useState } from 'react'
import type { ScenarioSuite, ScenarioCategory, ProviderConfig } from '../types'
import { generateScenarios, exportScenarios } from '../api'

interface ScenarioMatrixProps {
  content: string
  providerConfig: ProviderConfig
}

export const ScenarioMatrix: React.FC<ScenarioMatrixProps> = ({ content, providerConfig }) => {
  const [suite, setSuite] = useState<ScenarioSuite | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<ScenarioCategory | 'all'>('all')
  const [scenarioCount, setScenarioCount] = useState(12)
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!content.trim()) return
    try {
      setLoading(true)
      const res = await generateScenarios(content, scenarioCount, providerConfig)
      setSuite(res)
    } catch (err: any) {
      alert(`Scenario Generation Error: ${err?.response?.data?.detail || err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: 'json' | 'pytest' | 'markdown') => {
    if (!suite) return
    try {
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
      alert(`Export error: ${err?.response?.data?.detail || err.message}`)
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
      alert(`Copy error: ${err.message}`)
    }
  }

  const filteredScenarios =
    suite?.scenarios.filter(s => selectedCategory === 'all' || s.category === selectedCategory) || []

  const categoryColor = (cat: ScenarioCategory) => {
    switch (cat) {
      case 'happy_path':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300/40'
      case 'adversarial':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300/40'
      case 'tool_failure':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300/40'
      case 'scope_boundary':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border-purple-300/40'
    }
  }

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <span>Synthetic Scenario & Edge-Case Generator</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
              Red-Teaming
            </span>
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Automatically synthesizes realistic test cases across happy paths, adversarial inputs, tool failure modes, and scope boundaries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <span>Count:</span>
            <select
              value={scenarioCount}
              onChange={e => setScenarioCount(Number(e.target.value))}
              className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-xs"
            >
              <option value={8}>8 tests</option>
              <option value={12}>12 tests</option>
              <option value={16}>16 tests</option>
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !content.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm disabled:opacity-50 transition-all"
          >
            {loading ? (
              <>
                <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                <span>Generating Suite...</span>
              </>
            ) : (
              <span>⚡ Generate Synthetic Scenarios</span>
            )}
          </button>
        </div>
      </div>

      {/* Filter and export toolbar */}
      {suite && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/40 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-gray-500 mr-1">Filter:</span>
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'bg-gray-200/60 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              All ({suite.total_scenarios})
            </button>
            <button
              onClick={() => setSelectedCategory('happy_path')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                selectedCategory === 'happy_path'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              Happy Path ({suite.categories_breakdown.happy_path || 0})
            </button>
            <button
              onClick={() => setSelectedCategory('adversarial')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                selectedCategory === 'adversarial'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
              }`}
            >
              Adversarial ({suite.categories_breakdown.adversarial || 0})
            </button>
            <button
              onClick={() => setSelectedCategory('tool_failure')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                selectedCategory === 'tool_failure'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
              }`}
            >
              Tool Failure ({suite.categories_breakdown.tool_failure || 0})
            </button>
            <button
              onClick={() => setSelectedCategory('scope_boundary')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                selectedCategory === 'scope_boundary'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
              }`}
            >
              Scope ({suite.categories_breakdown.scope_boundary || 0})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-500">Export:</span>
            <button
              onClick={() => handleExport('pytest')}
              className="px-2.5 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-mono"
            >
              Pytest (.py)
            </button>
            <button
              onClick={() => handleExport('json')}
              className="px-2.5 py-1 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-mono"
            >
              JSON
            </button>
            <button
              onClick={() => handleCopyCode('pytest')}
              className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors"
            >
              {copiedFormat === 'pytest' ? '✓ Copied Code' : 'Copy Test Code'}
            </button>
          </div>
        </div>
      )}

      {/* Scenario cards grid */}
      {suite ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredScenarios.map((scenario, index) => (
            <div
              key={scenario.id}
              className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-gray-400">#{index + 1}</span>
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{scenario.title}</h4>
                </div>
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${categoryColor(
                    scenario.category,
                  )}`}
                >
                  {scenario.category.replace('_', ' ')}
                </span>
              </div>

              <p className="text-xs text-gray-600 dark:text-gray-400">{scenario.description}</p>

              {/* User prompt simulation */}
              <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700/60">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-1">
                  User Prompt
                </span>
                <p className="text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  "{scenario.user_prompt}"
                </p>
              </div>

              {/* Mock tool failure simulation */}
              {scenario.mock_tools.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                    Simulated Tool Behavior
                  </span>
                  <div className="space-y-1">
                    {scenario.mock_tools.map((m, mIdx) => (
                      <div
                        key={mIdx}
                        className="flex items-center justify-between text-xs px-2.5 py-1 rounded bg-gray-100/70 dark:bg-gray-800 border border-gray-200 dark:border-gray-700/50"
                      >
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-medium">
                          {m.tool_name}()
                        </span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            m.mock_status === 'success'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {m.mock_status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Assertions checklist */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    Expected Assertions
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">
                    Max Steps: {scenario.max_step_budget}
                  </span>
                </div>
                <ul className="space-y-1">
                  {scenario.expected_assertions.map((a, aIdx) => (
                    <li key={aIdx} className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-1.5">
                      <span className="text-emerald-500 font-bold shrink-0">✓</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl text-gray-500">
          <p className="text-sm font-medium">No scenarios generated yet.</p>
          <p className="text-xs text-gray-400 mt-1">
            Click "Generate Synthetic Scenarios" to automatically generate Happy Path, Adversarial, and Tool Failure tests.
          </p>
        </div>
      )}
    </div>
  )
}
