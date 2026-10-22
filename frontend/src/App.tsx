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
        {/* Left: Editor Workspace */}
        <div className="w-1/2 flex flex-col border-r border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#070b14]">
          {/* Editor toolbar */}
          <div className="px-4 py-2.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#090e1c]/70 backdrop-blur-sm flex items-center justify-between">
            {/* Breadcrumb Chip */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 text-xs font-mono font-medium shadow-xs">
                <svg
                  className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0"
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
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                <span>SKILL.md</span>
              </div>
            </div>

            {/* Actions: Load examples, Auto-fix, Clear */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
                Examples:
              </span>
              <button
                type="button"
                onClick={() => loadExample(false)}
                className="px-2.5 py-1 rounded-md text-xs font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition-all"
                title="Load a valid agentskills.io example"
              >
                ✓ Valid
              </button>
              <button
                type="button"
                onClick={() => loadExample(true)}
                className="px-2.5 py-1 rounded-md text-xs font-medium border border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 active:scale-95 transition-all"
                title="Load a skill with intentional schema and prompt flaws"
              >
                ✗ Broken
              </button>

              {repairPlan?.diff.has_changes && (
                <button
                  type="button"
                  onClick={() => setActiveTab('repair')}
                  className="px-3 py-1 rounded-md text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-glow-emerald flex items-center gap-1.5 transition-all duration-200 animate-pulse active:scale-95"
                  title="View proposed fixes in Diff & Repair tab"
                >
                  <span>✨ Auto-Fix ({repairPlan.repairs_applied.length})</span>
                </button>
              )}

              {content && (
                <button
                  type="button"
                  onClick={() => {
                    setContent('')
                    setStaticResult(null)
                    setLlmResult(null)
                    setLlmContentStale(false)
                  }}
                  className="px-2 py-1 rounded-md text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1 active:scale-95"
                  title="Clear editor content"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 001.5.06l.3-7.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Textarea Editor Container */}
          <div className="flex-1 relative bg-white dark:bg-[#070b14]">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={`Paste your SKILL.md content here…\n\nMinimal example:\n---\nname: my-skill\ndescription: What this skill does. Use when the user asks about X.\n---\n\n## Instructions\n\nStep 1: …`}
              spellCheck={false}
              className={`
                absolute inset-0 w-full h-full text-sm font-mono
                p-5 resize-none focus:outline-none scrollbar-thin
                leading-relaxed transition-all duration-300
                bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600
                ${applyFlash
                  ? 'ring-2 ring-emerald-500/80 dark:ring-emerald-400/80 bg-emerald-500/5 shadow-[0_0_24px_rgba(16,185,129,0.2)]'
                  : ''
                }
              `}
            />
          </div>

          {/* Editor Stats Bar with Token Gauge */}
          <div className="px-4 py-2 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#090e1c]/70 backdrop-blur-sm flex items-center justify-between text-xs select-none">
            <div className="flex items-center gap-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              <span>{content.length.toLocaleString()} chars</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>{content ? content.split('\n').length : 0} lines</span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px]">Tokens:</span>
                <span
                  className={`font-mono text-[11px] font-semibold ${
                    Math.round(content.length / 4) > 5000
                      ? 'text-rose-600 dark:text-rose-400'
                      : Math.round(content.length / 4) > 3500
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  ~{Math.round(content.length / 4).toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">/ 5k</span>
              </div>

              {/* Mini token gauge */}
              <div
                className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
                title={`Token usage: ~${Math.round(content.length / 4).toLocaleString()} / 5,000 tokens (${Math.min(
                  100,
                  Math.round((Math.round(content.length / 4) / 5000) * 100),
                )}%)`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    Math.round(content.length / 4) > 5000
                      ? 'bg-rose-500'
                      : Math.round(content.length / 4) > 3500
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.round((Math.round(content.length / 4) / 5000) * 100))}%`,
                  }}
                />
              </div>

              {Math.round(content.length / 4) > 5000 && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  Budget Exceeded
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Report Panel */}
        <div className="w-1/2 flex flex-col bg-slate-50/50 dark:bg-[#070b12]/50">
          {/* Segmented Tab Bar */}
          <div className="px-3.5 py-2 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-100/50 dark:bg-[#090e1c]/50 backdrop-blur-md flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
            <button
              type="button"
              onClick={() => setActiveTab('static')}
              className={`
                px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex items-center gap-2 select-none
                ${activeTab === 'static'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
                }
              `}
            >
              <span>Static Rules</span>
              {staticResult && (
                <span
                  className={`w-2 h-2 rounded-full shrink-0 shadow-xs ${
                    staticResult.overall_status === 'pass'
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                      : staticResult.overall_status === 'warn'
                      ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                      : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                  }`}
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('llm')}
              className={`
                px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex items-center gap-2 select-none
                ${activeTab === 'llm'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
                }
              `}
            >
              <span>LLM Judge</span>
              {llmResult && (
                <span
                  className={`w-2 h-2 rounded-full shrink-0 shadow-xs ${
                    llmResult.overall_status === 'pass'
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                      : llmResult.overall_status === 'warn'
                      ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                      : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                  }`}
                />
              )}
              {llmContentStale && !llmLoading && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Stale
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('repair')}
              className={`
                px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex items-center gap-2 select-none
                ${activeTab === 'repair'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
                }
              `}
            >
              <span>Diff & Repair</span>
              {repairPlan?.diff.has_changes && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  {repairPlan.repairs_applied.length}
                </span>
              )}
            </button>

            {enableSyntheticTests && (
              <button
                type="button"
                onClick={() => setActiveTab('scenarios')}
                className={`
                  px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex items-center gap-2 select-none
                  ${activeTab === 'scenarios'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
                  }
                `}
              >
                <span>Synthetic Tests</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-semibold">
                  Beta
                </span>
              </button>
            )}

            {enableTrajectoryProfiler && (
              <button
                type="button"
                onClick={() => setActiveTab('profiler')}
                className={`
                  px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex items-center gap-2 select-none
                  ${activeTab === 'profiler'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-slate-700/80'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border border-transparent'
                  }
                `}
              >
                <span>Trajectory Profiler</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-semibold">
                  Beta
                </span>
              </button>
            )}
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
