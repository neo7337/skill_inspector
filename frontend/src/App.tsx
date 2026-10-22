import { useState, useCallback, useRef, useEffect } from 'react'
import axios from 'axios'
import type {
  StaticValidationResult,
  LLMValidationResult,
  ProviderConfig,
  ApplyableFix,
  RepairPlanResult,
} from './types'
import { DEFAULT_MODELS } from './types'
import { validateStatic, validateLLM, getRepairPlan } from './api'
import { StaticReport } from './components/StaticReport'
import { LLMReport } from './components/LLMReport'
import { ProviderConfigPanel } from './components/ProviderConfigPanel'
import { ThemeToggle } from './components/ThemeToggle'
import { DiffViewer } from './components/DiffViewer'
import { ScenarioMatrix } from './components/ScenarioMatrix'
import { TrajectoryReport } from './components/TrajectoryReport'
import { VALID_SKILL_EXAMPLE, BROKEN_SKILL_EXAMPLE } from './examples'
import { useTheme } from './hooks/useTheme'
import { applyFix } from './utils/applyFix'

const DEBOUNCE_MS = 350

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

const enableSyntheticTests = import.meta.env.VITE_ENABLE_SYNTHETIC_TESTS === '1'
const enableTrajectoryProfiler = import.meta.env.VITE_ENABLE_TRAJECTORY_PROFILER === '1'

// ── Toast Notification System ──────────────────────────────────────────────

interface ToastState {
  id: number
  message: string
  type: 'info' | 'success' | 'warning'
}

let toastCounter = 0

function Toast({ toasts, onDismiss }: { toasts: ToastState[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
      {toasts.map(t => {
        const config = {
          success: {
            wrapper:
              'bg-slate-900/90 dark:bg-slate-900/95 text-emerald-100 border-emerald-500/40 shadow-[0_8px_24px_rgba(16,185,129,0.2)]',
            icon: (
              <svg className="w-4 h-4 text-emerald-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
            ),
            closeBtn: 'text-slate-400 hover:text-white hover:bg-white/10',
          },
          warning: {
            wrapper:
              'bg-slate-900/90 dark:bg-slate-900/95 text-amber-100 border-amber-500/40 shadow-[0_8px_24px_rgba(245,158,11,0.2)]',
            icon: (
              <svg className="w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            ),
            closeBtn: 'text-slate-400 hover:text-white hover:bg-white/10',
          },
          info: {
            wrapper:
              'bg-slate-900/90 dark:bg-slate-900/95 text-slate-100 border-indigo-500/40 shadow-[0_8px_24px_rgba(99,102,241,0.2)]',
            icon: (
              <svg className="w-4 h-4 text-indigo-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.247.25v3.25a.75.75 0 001.5 0v-3.5A1.75 1.75 0 009.25 9H9z"
                  clipRule="evenodd"
                />
              </svg>
            ),
            closeBtn: 'text-slate-400 hover:text-white hover:bg-white/10',
          },
        }[t.type]

        return (
          <div
            key={t.id}
            role="alert"
            className={`
              pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border
              backdrop-blur-md text-xs sm:text-sm font-medium animate-fadeInUp transition-all duration-200
              ${config.wrapper}
            `}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {config.icon}
              <span className="truncate">{t.message}</span>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className={`p-1 rounded-lg transition-colors shrink-0 ${config.closeBtn}`}
              aria-label="Dismiss notification"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()

  const [content, setContent] = useState('')
  const [staticResult, setStaticResult] = useState<StaticValidationResult | null>(null)
  const [staticLoading, setStaticLoading] = useState(false)
  const [applyFlash, setApplyFlash] = useState(false)  // green flash on textarea after apply

  const [llmResult, setLlmResult] = useState<LLMValidationResult | null>(null)
  const [llmLoading, setLlmLoading] = useState(false)
  const [llmError, setLlmError] = useState<string | null>(null)
  const [llmContentStale, setLlmContentStale] = useState(false)  // content changed after LLM run

  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
    provider: 'openai',
    model: DEFAULT_MODELS.openai,
    api_key: '',
    base_url: '',
  })

  const [activeTab, setActiveTab] = useState<'static' | 'llm' | 'repair' | 'scenarios' | 'profiler'>('static')
  const [repairPlan, setRepairPlan] = useState<RepairPlanResult | null>(null)
  const [repairLoading, setRepairLoading] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'unknown' | 'ok' | 'error'>('unknown')
  const [toasts, setToasts] = useState<ToastState[]>([])

  // Track content at the time of last LLM run
  const llmRunContentRef = useRef<string>('')

  const debouncedContent = useDebounce(content, DEBOUNCE_MS)
  const abortRef = useRef<AbortController | null>(null)

  // ── Toast helpers ────────────────────────────────────────────────────────

  const showToast = useCallback((message: string, type: ToastState['type'] = 'info', durationMs = 3500) => {
    const id = ++toastCounter
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), durationMs)
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── Backend health ───────────────────────────────────────────────────────

  useEffect(() => {
    fetch('http://localhost:8000/health')
      .then(r => r.ok ? setBackendStatus('ok') : setBackendStatus('error'))
      .catch(() => setBackendStatus('error'))
  }, [])

  // ── Auto-run static validation on content change ─────────────────────────

  useEffect(() => {
    if (!debouncedContent.trim()) {
      setStaticResult(null)
      return
    }

    // Cancel previous request
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setStaticLoading(true)
    validateStatic(debouncedContent)
      .then(result => {
        setStaticResult(result)
        setStaticLoading(false)
      })
      .catch(err => {
        if (!axios.isCancel(err)) {
          setStaticResult({
            findings: [],
            overall_status: 'fail',
            score: 0,
            error: err?.message ?? 'Unknown error',
            type: 'parse_error',
          })
          setStaticLoading(false)
        }
      })
  }, [debouncedContent])

  // ── Auto-generate repair plan on content change ──────────────────────────

  const fetchRepairPlan = useCallback(async () => {
    if (!debouncedContent.trim()) {
      setRepairPlan(null)
      return
    }
    try {
      setRepairLoading(true)
      const plan = await getRepairPlan(debouncedContent)
      setRepairPlan(plan)
    } catch {
      // Ignore background plan error
    } finally {
      setRepairLoading(false)
    }
  }, [debouncedContent])

  useEffect(() => {
    fetchRepairPlan()
  }, [fetchRepairPlan])

  // ── Mark LLM result stale when content changes post-run ──────────────────

  useEffect(() => {
    if (llmResult && content !== llmRunContentRef.current) {
      setLlmContentStale(true)
    }
  }, [content, llmResult])

  // ── LLM run ──────────────────────────────────────────────────────────────

  const handleRunLLM = useCallback(async () => {
    if (!content.trim()) return
    setLlmLoading(true)
    setLlmError(null)
    setLlmResult(null)
    setLlmContentStale(false)
    setActiveTab('llm')
    llmRunContentRef.current = content
    try {
      const result = await validateLLM(content, providerConfig)
      setLlmResult(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'LLM request failed'
      setLlmError(msg)
    } finally {
      setLlmLoading(false)
    }
  }, [content, providerConfig])

  // ── Apply fix ────────────────────────────────────────────────────────────

  const handleApplyFix = useCallback((fix: ApplyableFix, resolvedRule?: string) => {
    const patched = applyFix(content, fix)
    if (patched === content) {
      showToast('⚠ Fix could not be applied automatically', 'warning')
      return
    }

    setContent(patched)

    // Brief green flash on the textarea
    setApplyFlash(true)
    setTimeout(() => setApplyFlash(false), 800)

    showToast('Fix applied — re-validating…', 'info')

    // After debounce+validation completes, check if the rule resolved
    if (resolvedRule) {
      setTimeout(() => {
        setStaticResult(prev => {
          if (!prev) return prev
          const stillFailing = prev.findings.some(
            f => f.rule === resolvedRule && (f.status === 'fail' || f.status === 'warn')
          )
          if (!stillFailing) {
            showToast('✓ Issue resolved', 'success')
          } else {
            showToast('Still failing — check manually', 'warning')
          }
          return prev
        })
      }, DEBOUNCE_MS + 1200)
    }
  }, [content, showToast])

  // ── Load examples ────────────────────────────────────────────────────────

  const loadExample = (broken: boolean) => {
    setContent(broken ? BROKEN_SKILL_EXAMPLE : VALID_SKILL_EXAMPLE)
    setLlmResult(null)
    setLlmError(null)
    setLlmContentStale(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isDark = theme === 'dark'

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#070b12] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Header */}
      <header className="sticky top-0 z-40 px-5 sm:px-6 py-3 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl flex items-center justify-between shadow-xs transition-colors duration-200">
        {/* Brand Mark */}
        <div className="flex items-center gap-3 select-none">
          <div className="relative group flex items-center justify-center">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 p-[1px] shadow-glow-sm transition-transform duration-300 group-hover:scale-105">
              <div className="w-full h-full bg-white dark:bg-slate-950 rounded-[11px] flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-indigo-600 dark:text-indigo-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                Skill Inspector
              </h1>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                agentskills.io
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Agent Skills Validation Studio
            </p>
          </div>
        </div>

        {/* Right Actions: Live Backend Ping Beacon & Theme Toggle */}
        <div className="flex items-center gap-3">
          <div
            className={`
              inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-md transition-all duration-300
              ${
                backendStatus === 'ok'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                  : backendStatus === 'error'
                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                  : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
              }
            `}
            title={
              backendStatus === 'ok'
                ? 'FastAPI backend connected on :8000'
                : backendStatus === 'error'
                ? 'Backend unreachable on :8000'
                : 'Connecting to backend…'
            }
          >
            <span className="relative flex h-2 w-2">
              {backendStatus === 'ok' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  backendStatus === 'ok'
                    ? 'bg-emerald-500'
                    : backendStatus === 'error'
                    ? 'bg-rose-500'
                    : 'bg-slate-400 animate-pulse'
                }`}
              />
            </span>
            <span className="font-mono text-[11px] font-semibold tracking-wide">
              {backendStatus === 'ok'
                ? 'API Connected'
                : backendStatus === 'error'
                ? 'API Offline'
                : 'Connecting…'}
            </span>
          </div>

          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Editor */}
        <div className={`w-1/2 flex flex-col border-r ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
          {/* Editor toolbar */}
          <div className={`px-4 py-2 border-b flex items-center justify-between ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            <span className={`text-xs font-mono ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>SKILL.md</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>Load example:</span>
              <button
                onClick={() => loadExample(false)}
                className={`text-xs px-2 py-1 rounded transition-colors ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
              >
                ✓ Valid
              </button>
              <button
                onClick={() => loadExample(true)}
                className={`text-xs px-2 py-1 rounded transition-colors ${isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
              >
                ✗ Broken
              </button>
              {repairPlan?.diff.has_changes && (
                <button
                  onClick={() => setActiveTab('repair')}
                  className="text-xs px-2.5 py-1 rounded-md font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1 transition-all"
                  title="View proposed fixes in Diff & Repair tab"
                >
                  <span>✨ Auto-Fix ({repairPlan.repairs_applied.length})</span>
                </button>
              )}
              {content && (
                <button
                  onClick={() => { setContent(''); setStaticResult(null); setLlmResult(null); setLlmContentStale(false) }}
                  className={`text-xs px-2 py-1 transition-colors ${isDark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={`Paste your SKILL.md content here…\n\nMinimal example:\n---\nname: my-skill\ndescription: What this skill does. Use when the user asks about X.\n---\n\n## Instructions\n\nStep 1: …`}
              spellCheck={false}
              className={`
                absolute inset-0 w-full h-full text-sm font-mono
                p-4 resize-none focus:outline-none scrollbar-thin
                leading-relaxed transition-all duration-200
                ${isDark
                  ? 'bg-gray-950 text-gray-200 placeholder-gray-700'
                  : 'bg-white text-gray-800 placeholder-gray-300'
                }
                ${applyFlash
                  ? isDark
                    ? 'ring-2 ring-emerald-500/60 ring-inset'
                    : 'ring-2 ring-emerald-400/60 ring-inset'
                  : ''
                }
              `}
            />
          </div>

          {/* Character count */}
          {content && (
            <div className={`px-4 py-1.5 border-t flex gap-4 text-xs ${isDark ? 'border-gray-800 text-gray-600' : 'border-gray-200 text-gray-400'}`}>
              <span>{content.length} chars</span>
              <span>{content.split('\n').length} lines</span>
              <span>~{Math.round(content.length / 4)} tokens</span>
            </div>
          )}
        </div>

        {/* Right: Report panel */}
        <div className="w-1/2 flex flex-col">
          {/* Tab bar */}
          <div className={`px-4 py-2 border-b flex items-center gap-1 overflow-x-auto ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            <button
              onClick={() => setActiveTab('static')}
              className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${activeTab === 'static'
                  ? isDark ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-900'
                  : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              Static Rules
              {staticResult && (
                <span className={`ml-1.5 w-2 h-2 rounded-full inline-block ${staticResult.overall_status === 'pass' ? 'bg-emerald-500' :
                    staticResult.overall_status === 'warn' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
              )}
            </button>
            <button
              onClick={() => setActiveTab('llm')}
              className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${activeTab === 'llm'
                  ? isDark ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-900'
                  : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              LLM Judge
              {llmResult && (
                <span className={`ml-1.5 w-2 h-2 rounded-full inline-block ${llmResult.overall_status === 'pass' ? 'bg-emerald-500' :
                    llmResult.overall_status === 'warn' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
              )}
              {llmContentStale && !llmLoading && (
                <span className="ml-1 text-amber-400 text-xs">●</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('repair')}
              className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'repair'
                  ? isDark ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-900'
                  : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              <span>Diff & Repair</span>
              {repairPlan?.diff.has_changes && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 font-bold">
                  {repairPlan.repairs_applied.length}
                </span>
              )}
            </button>
            {enableSyntheticTests && <button
              onClick={() => setActiveTab('scenarios')}
              className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${activeTab === 'scenarios'
                  ? isDark ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-900'
                  : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              Synthetic Tests
              {(
                <span className="ml-1 text-amber-400 text-xs">Beta</span>
              )}
            </button>}
            {enableTrajectoryProfiler && <button
              onClick={() => setActiveTab('profiler')}
              className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${activeTab === 'profiler'
                  ? isDark ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-900'
                  : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              Trajectory Profiler
              {(
                <span className="ml-1 text-amber-400 text-xs">Beta</span>
              )}
            </button>}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin space-y-4">
            {activeTab === 'static' && (
              <StaticReport
                result={staticResult}
                isLoading={staticLoading}
                isDark={isDark}
                onApplyFix={handleApplyFix}
              />
            )}

            {activeTab === 'llm' && (
              <>
                {/* Stale LLM banner */}
                {llmContentStale && llmResult && !llmLoading && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${isDark
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
                    <span>⚠</span>
                    <span>Content changed. Re-run LLM Analysis to refresh scores.</span>
                    <button
                      onClick={handleRunLLM}
                      className="ml-auto text-xs font-medium underline underline-offset-2 hover:no-underline"
                    >
                      Re-run
                    </button>
                  </div>
                )}
                <ProviderConfigPanel
                  config={providerConfig}
                  onChange={setProviderConfig}
                  onRun={handleRunLLM}
                  isRunning={llmLoading}
                  disabled={!content.trim()}
                  isDark={isDark}
                />
                <LLMReport
                  result={llmResult}
                  isLoading={llmLoading}
                  error={llmError}
                  skillTokens={staticResult?.skill_tokens ?? llmResult?.skill_tokens}
                  referencedFiles={staticResult?.referenced_files ?? llmResult?.referenced_files}
                  isDark={isDark}
                  onApplyFix={handleApplyFix}
                />
              </>
            )}

            {activeTab === 'repair' && (
              <DiffViewer
                content={content}
                repairPlan={repairPlan}
                loading={repairLoading}
                onApplyRepairs={(repaired) => {
                  setContent(repaired)
                  setApplyFlash(true)
                  setTimeout(() => setApplyFlash(false), 800)
                  showToast('✓ Auto-repairs applied to editor', 'success')
                  fetchRepairPlan()
                }}
                onRefreshPlan={fetchRepairPlan}
                providerConfig={providerConfig}
              />
            )}

            {activeTab === 'scenarios' && (
              <ScenarioMatrix
                content={content}
                providerConfig={providerConfig}
              />
            )}

            {activeTab === 'profiler' && (
              <TrajectoryReport
                skillContent={content}
              />
            )}
          </div>
        </div>
      </div>

      {/* Toast container */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
