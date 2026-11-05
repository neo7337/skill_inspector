import { useState, useCallback, useRef, useEffect } from 'react'
import axios from 'axios'
import type {
  StaticValidationResult,
  LLMValidationResult,
  ProviderConfig,
  ApplyableFix,
  RepairPlanResult,
  SkillPackageSummary,
  ResolvedFileReference,
  ReferencedFile,
  ProjectScanResult,
} from './types'
import { DEFAULT_MODELS } from './types'
import { validateStatic, validateLLM, getRepairPlan, scanProject, resolveSkill } from './api'
import { StaticReport } from './components/StaticReport'
import { LLMReport } from './components/LLMReport'
import { ProviderConfigPanel } from './components/ProviderConfigPanel'
import { ThemeToggle } from './components/ThemeToggle'
import { DiffViewer } from './components/DiffViewer'
import { ScenarioMatrix } from './components/ScenarioMatrix'
import { TrajectoryReport } from './components/TrajectoryReport'
import { ReferenceFileDrawer } from './components/ReferenceFileDrawer'
import { FileTreePanel } from './components/FileTreePanel'
import { TopologyView } from './components/TopologyView'
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
              'bg-slate-900/90 dark:bg-slate-900/95 text-slate-100 border-blue-500/40 shadow-[0_8px_24px_rgba(37,99,235,0.2)]',
            icon: (
              <svg className="w-4 h-4 text-blue-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
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
  const [mainView, setMainView] = useState<'inspector' | 'topology'>('inspector')
  const [repairPlan, setRepairPlan] = useState<RepairPlanResult | null>(null)
  const [repairLoading, setRepairLoading] = useState(false)
  const [backendStatus, setBackendStatus] = useState<'unknown' | 'ok' | 'error'>('unknown')
  const [toasts, setToasts] = useState<ToastState[]>([])

  // ── Project / file-tree state ───────────────────────────────────────────────
  const [projectRoot, setProjectRoot] = useState<string>(() => localStorage.getItem('skill_project_root') || '')
  const [scanResult, setScanResult] = useState<ProjectScanResult | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  const [selectedSkillPath, setSelectedSkillPath] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)

  // base_dir for validators = skill's own directory (set by resolveSkill)
  const [baseDir, setBaseDir] = useState<string>('')
  const [packageSummary, setPackageSummary] = useState<SkillPackageSummary | null>(null)

  // Reference file drawer
  const [selectedFile, setSelectedFile] = useState<ResolvedFileReference | ReferencedFile | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

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

  const handleSelectFile = useCallback((file: ResolvedFileReference | ReferencedFile | string) => {
    if (typeof file === 'string') {
      // Plain relative path from FileTreePanel click on a non-skill file
      setSelectedFile({ path: file, kind: 'other' } as ReferencedFile)
    } else {
      setSelectedFile(file)
    }
    setDrawerOpen(true)
  }, [])

  // ── Persist project root ─────────────────────────────────────────────────────
  useEffect(() => {
    if (projectRoot.trim()) {
      localStorage.setItem('skill_project_root', projectRoot.trim())
    } else {
      localStorage.removeItem('skill_project_root')
    }
  }, [projectRoot])

  // ── Open project: scan entire tree ───────────────────────────────────────────
  const handleOpenProject = useCallback(async (rootOverride?: string) => {
    const root = (rootOverride ?? projectRoot).trim()
    if (!root) return
    setIsScanning(true)
    setScanError(null)
    setScanResult(null)
    setSelectedSkillPath(null)
    setPackageSummary(null)
    setBaseDir('')
    try {
      const result = await scanProject(root)
      setScanResult(result)
      showToast(`✓ Project opened: ${result.total_files} files, ${result.skill_files.length} skill(s) found`, 'success')
      // Auto-select if only one skill found
      if (result.skill_files.length === 1) {
        handleSelectSkill(root, result.skill_files[0])
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to scan project'
      setScanError(msg)
      showToast(`⚠ ${msg}`, 'warning')
    } finally {
      setIsScanning(false)
    }
  }, [projectRoot, showToast])

  // ── Select skill: resolve its references ─────────────────────────────────────
  const handleSelectSkill = useCallback(async (rootDir: string, skillPath: string) => {
    setSelectedSkillPath(skillPath)
    setIsResolving(true)
    try {
      const result = await resolveSkill(rootDir, skillPath)
      setContent(result.skill_content)
      setBaseDir(result.base_dir)
      setPackageSummary({
        base_dir: result.base_dir,
        resolved_files: result.resolved_files,
        tokens: result.tokens,
        missing_files_count: result.missing_files_count,
        found_files_count: result.found_files_count,
      })
      setLlmResult(null)
      setLlmContentStale(false)
      showToast(`✓ Loaded ${skillPath.split('/').pop()}`, 'success')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to resolve skill'
      showToast(`⚠ ${msg}`, 'warning')
    } finally {
      setIsResolving(false)
    }
  }, [showToast])

  // ── Restore previous project root on mount ───────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('skill_project_root')
    if (saved?.trim()) {
      handleOpenProject(saved.trim())
    }
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
      abortRef.current?.abort()
      Promise.resolve().then(() => {
        setStaticResult(null)
        setStaticLoading(false)
      })
      return
    }

    // Cancel previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) setStaticLoading(true)
    })

    validateStatic(debouncedContent, baseDir.trim() || undefined)
      .then(result => {
        if (!cancelled) {
          setStaticResult(result)
          if (result.package) {
            setPackageSummary(result.package)
          }
          setStaticLoading(false)
        }
      })
      .catch(err => {
        if (!axios.isCancel(err) && !cancelled) {
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

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [debouncedContent, baseDir])

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
    let cancelled = false
    if (!debouncedContent.trim()) {
      Promise.resolve().then(() => {
        if (!cancelled) setRepairPlan(null)
      })
      return
    }

    Promise.resolve().then(() => {
      if (!cancelled) setRepairLoading(true)
    })

    getRepairPlan(debouncedContent)
      .then(plan => {
        if (!cancelled) {
          setRepairPlan(plan)
          setRepairLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setRepairLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedContent])

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
      const result = await validateLLM(content, providerConfig, baseDir.trim() || undefined)
      setLlmResult(result)
      if (result.package) {
        setPackageSummary(result.package)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'LLM request failed'
      setLlmError(msg)
    } finally {
      setLlmLoading(false)
    }
  }, [content, providerConfig, baseDir])

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
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Header */}
      <header className="shrink-0 z-40 px-5 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-sm transition-colors duration-200">
        {/* Brand Mark */}
        <div className="flex items-center gap-3 select-none">
          <div className="relative group flex items-center justify-center">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-105">
              <div className="w-full h-full rounded-xl flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
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
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full badge-brand">
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
              inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300
              ${
                backendStatus === 'ok'
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : backendStatus === 'error'
                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
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

      {/* Project Root Toolbar */}
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-2 flex items-center gap-2 text-xs">
        <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span className="font-semibold text-slate-600 dark:text-slate-400 shrink-0">Project Root:</span>
        <div className="relative flex-1">
          <input
            type="text"
            value={projectRoot}
            onChange={e => setProjectRoot(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleOpenProject() }}
            placeholder="/path/to/your/project  (any directory — skills found anywhere inside)"
            className="w-full px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
          />
          {projectRoot && (
            <button
              type="button"
              onClick={() => {
                setProjectRoot('')
                setScanResult(null)
                setScanError(null)
                setSelectedSkillPath(null)
                setPackageSummary(null)
                setBaseDir('')
              }}
              className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
            >✕</button>
          )}
        </div>
        <button
          type="button"
          onClick={() => handleOpenProject()}
          disabled={isScanning || !projectRoot.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
        >
          {isScanning ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Scanning…</span>
            </>
          ) : (
            <span>{scanResult ? 'Rescan' : 'Open Project'}</span>
          )}
        </button>
        {/* Status pill */}
        {scanResult && !isScanning && (
          <div className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium badge-emerald">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {scanResult.skill_files.length} skill{scanResult.skill_files.length !== 1 ? 's' : ''} · {scanResult.total_files} files
          </div>
        )}
        {scanError && !isScanning && (
          <div className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium badge-amber">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Scan failed
          </div>
        )}
      </div>

      {/* View Switcher */}
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-1.5 flex items-center gap-1.5">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-2 select-none">View:</span>
        <button
          type="button"
          onClick={() => setMainView('inspector')}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-200 select-none ${
            mainView === 'inspector'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Inspector
        </button>
        <button
          type="button"
          onClick={() => setMainView('topology')}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-200 select-none flex items-center gap-1.5 ${
            mainView === 'topology'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span>Topology</span>
          {packageSummary && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md badge-brand font-semibold">
              {packageSummary.found_files_count + packageSummary.missing_files_count}
            </span>
          )}
        </button>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* File Tree Panel — shown when a project is scanned */}
        {scanResult && (
          <FileTreePanel
            scanResult={scanResult}
            isScanning={isScanning}
            scanError={scanError}
            selectedSkillPath={selectedSkillPath}
            onSelectSkill={(skillPath) => handleSelectSkill(scanResult!.root_dir, skillPath)}
            onSelectFile={(p) => handleSelectFile(p)}
            isResolving={isResolving}
          />
        )}
        {mainView === 'inspector' ? (
          <>
        {/* Left: Editor Workspace */}
        <div className="w-1/2 flex flex-col min-h-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          {/* Editor toolbar */}
          <div className="shrink-0 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
            {/* Breadcrumb Chip */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono font-medium shadow-xs">
                <svg
                  className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0"
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
                  className="px-3 py-1 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition-all duration-200 animate-pulse active:scale-95"
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
          <div className="flex-1 min-h-0 relative bg-white dark:bg-slate-950">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={`Paste your SKILL.md content here…\n\nMinimal example:\n---\nname: my-skill\ndescription: What this skill does. Use when the user asks about X.\n---\n\n## Instructions\n\nStep 1: …`}
              spellCheck={false}
              className={`
                absolute inset-0 w-full h-full text-sm font-mono
                p-5 resize-none focus:outline-none scrollbar-thin overflow-y-auto
                leading-relaxed transition-all duration-300
                bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-600 dark:placeholder-slate-400 placeholder:opacity-85
                ${applyFlash
                  ? 'ring-2 ring-emerald-500/80 dark:ring-emerald-400/80 bg-emerald-500/5 shadow-[0_0_24px_rgba(16,185,129,0.2)]'
                  : ''
                }
              `}
            />
          </div>

          {/* Editor Stats Bar with Token Gauge */}
          <div className="shrink-0 px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs select-none">
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
        <div className="w-1/2 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950">
          {/* Segmented Tab Bar */}
          <div className="shrink-0 px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
            <button
              type="button"
              onClick={() => setActiveTab('static')}
              className={`
                px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 whitespace-nowrap flex items-center gap-2 select-none
                ${activeTab === 'static'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
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
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
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
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }
              `}
            >
              <span>Diff & Repair</span>
              {repairPlan?.diff.has_changes && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold badge-emerald">
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
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }
                `}
              >
                <span>Synthetic Tests</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md badge-brand font-semibold">
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
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }
                `}
              >
                <span>Trajectory Profiler</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md badge-brand font-semibold">
                  Beta
                </span>
              </button>
            )}
          </div>

          {/* Panel content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 scrollbar-thin space-y-4">
            {activeTab === 'static' && (
              <StaticReport
                result={staticResult}
                isLoading={staticLoading}
                isDark={isDark}
                onApplyFix={handleApplyFix}
                packageSummary={packageSummary}
                onSelectFile={handleSelectFile}
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
                  packageSummary={packageSummary}
                  onSelectFile={handleSelectFile}
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
                baseDir={baseDir.trim() || undefined}
              />
            )}
          </div>
        </div>
          </>
        ) : (
          <TopologyView
            packageSummary={packageSummary}
            selectedSkillPath={selectedSkillPath}
            skillContent={content}
            baseDir={baseDir.trim() || undefined}
            isDark={isDark}
            onSelectFile={handleSelectFile}
          />
        )}
      </div>

      {/* Slide-over reference file drawer */}
      <ReferenceFileDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        file={selectedFile}
        baseDir={baseDir.trim() || undefined}
        projectRoot={projectRoot.trim() || undefined}
      />

      {/* Toast container */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
