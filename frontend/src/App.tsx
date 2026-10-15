import { useState, useCallback, useRef, useEffect } from 'react'
import axios from 'axios'
import type { StaticValidationResult, LLMValidationResult, ProviderConfig, ApplyableFix } from './types'
import { DEFAULT_MODELS } from './types'
import { validateStatic, validateLLM } from './api'
import { StaticReport } from './components/StaticReport'
import { LLMReport } from './components/LLMReport'
import { ProviderConfigPanel } from './components/ProviderConfigPanel'
import { ThemeToggle } from './components/ThemeToggle'
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

// ── Toast ──────────────────────────────────────────────────────────────────

interface ToastState {
  id: number
  message: string
  type: 'info' | 'success' | 'warning'
}

let toastCounter = 0

function Toast({ toasts, onDismiss }: { toasts: ToastState[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`
            pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg
            text-sm font-medium border backdrop-blur-sm
            animate-[fadeInUp_0.2s_ease-out]
            ${t.type === 'success'
              ? 'bg-emerald-500/90 dark:bg-emerald-600/90 text-white border-emerald-400/50'
              : t.type === 'warning'
              ? 'bg-amber-500/90 dark:bg-amber-600/90 text-white border-amber-400/50'
              : 'bg-gray-800/95 dark:bg-gray-700/95 text-gray-100 border-gray-600/50'
            }
          `}
          onClick={() => onDismiss(t.id)}
        >
          <span>{t.message}</span>
        </div>
      ))}
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

  const [activeTab, setActiveTab] = useState<'static' | 'llm'>('static')
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
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className={`border-b px-6 py-4 flex items-center justify-between ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-blue-500 rounded flex items-center justify-center text-white text-sm font-bold">
            ✓
          </div>
          <div>
            <h1 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Skill Inspector</h1>
            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>agentskills.io format</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs ${backendStatus === 'ok' ? 'text-emerald-500' :
              backendStatus === 'error' ? 'text-red-400' : isDark ? 'text-gray-500' : 'text-gray-400'
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'ok' ? 'bg-emerald-500' :
                backendStatus === 'error' ? 'bg-red-400' : 'bg-gray-400'
              }`} />
            {backendStatus === 'ok' ? 'Backend connected' :
              backendStatus === 'error' ? 'Backend offline' : 'Connecting…'}
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
          <div className={`px-4 py-2 border-b flex items-center gap-1 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
            <button
              onClick={() => setActiveTab('static')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${activeTab === 'static'
                  ? isDark ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-900'
                  : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              Static Analysis
              {staticResult && (
                <span className={`ml-1.5 w-2 h-2 rounded-full inline-block ${staticResult.overall_status === 'pass' ? 'bg-emerald-500' :
                    staticResult.overall_status === 'warn' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
              )}
            </button>
            <button
              onClick={() => setActiveTab('llm')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${activeTab === 'llm'
                  ? isDark ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-900'
                  : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                }`}
            >
              LLM Analysis
              {llmResult && (
                <span className={`ml-1.5 w-2 h-2 rounded-full inline-block ${llmResult.overall_status === 'pass' ? 'bg-emerald-500' :
                    llmResult.overall_status === 'warn' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
              )}
              {llmContentStale && !llmLoading && (
                <span className="ml-1 text-amber-400 text-xs">●</span>
              )}
            </button>
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
          </div>
        </div>
      </div>

      {/* Toast container */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
