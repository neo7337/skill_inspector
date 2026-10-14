import { useState, useCallback, useRef, useEffect } from 'react'
import axios from 'axios'
import type { StaticValidationResult, LLMValidationResult, ProviderConfig } from './types'
import { DEFAULT_MODELS } from './types'
import { validateStatic, validateLLM } from './api'
import { StaticReport } from './components/StaticReport'
import { LLMReport } from './components/LLMReport'
import { ProviderConfigPanel } from './components/ProviderConfigPanel'
import { VALID_SKILL_EXAMPLE, BROKEN_SKILL_EXAMPLE } from './examples'

const DEBOUNCE_MS = 350

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

export default function App() {
  const [content, setContent] = useState('')
  const [staticResult, setStaticResult] = useState<StaticValidationResult | null>(null)
  const [staticLoading, setStaticLoading] = useState(false)

  const [llmResult, setLlmResult] = useState<LLMValidationResult | null>(null)
  const [llmLoading, setLlmLoading] = useState(false)
  const [llmError, setLlmError] = useState<string | null>(null)

  const [providerConfig, setProviderConfig] = useState<ProviderConfig>({
    provider: 'openai',
    model: DEFAULT_MODELS.openai,
    api_key: '',
    base_url: '',
  })

  const [activeTab, setActiveTab] = useState<'static' | 'llm'>('static')
  const [backendStatus, setBackendStatus] = useState<'unknown' | 'ok' | 'error'>('unknown')

  const debouncedContent = useDebounce(content, DEBOUNCE_MS)
  const abortRef = useRef<AbortController | null>(null)

  // Check backend health on mount
  useEffect(() => {
    fetch('http://localhost:8000/health')
      .then(r => r.ok ? setBackendStatus('ok') : setBackendStatus('error'))
      .catch(() => setBackendStatus('error'))
  }, [])

  // Auto-run static validation on content change
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

  const handleRunLLM = useCallback(async () => {
    if (!content.trim()) return
    setLlmLoading(true)
    setLlmError(null)
    setLlmResult(null)
    setActiveTab('llm')
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

  const loadExample = (broken: boolean) => {
    setContent(broken ? BROKEN_SKILL_EXAMPLE : VALID_SKILL_EXAMPLE)
    setLlmResult(null)
    setLlmError(null)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-blue-500 rounded flex items-center justify-center text-white text-sm font-bold">
            ✓
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Skill Inspector</h1>
            <p className="text-xs text-gray-500">agentskills.io format</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 text-xs ${backendStatus === 'ok' ? 'text-emerald-400' :
              backendStatus === 'error' ? 'text-red-400' : 'text-gray-500'
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'ok' ? 'bg-emerald-400' :
                backendStatus === 'error' ? 'bg-red-400' : 'bg-gray-500'
              }`} />
            {backendStatus === 'ok' ? 'Backend connected' :
              backendStatus === 'error' ? 'Backend offline' : 'Connecting…'}
          </div>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Editor */}
        <div className="w-1/2 flex flex-col border-r border-gray-800">
          {/* Editor toolbar */}
          <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-mono">SKILL.md</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Load example:</span>
              <button
                onClick={() => loadExample(false)}
                className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
              >
                ✓ Valid
              </button>
              <button
                onClick={() => loadExample(true)}
                className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
              >
                ✗ Broken
              </button>
              {content && (
                <button
                  onClick={() => { setContent(''); setStaticResult(null); setLlmResult(null) }}
                  className="text-xs px-2 py-1 text-gray-600 hover:text-gray-400 transition-colors"
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
              className="absolute inset-0 w-full h-full bg-gray-950 text-gray-200 text-sm font-mono
                p-4 resize-none focus:outline-none placeholder-gray-700 scrollbar-thin
                leading-relaxed"
            />
          </div>

          {/* Character count */}
          {content && (
            <div className="px-4 py-1.5 border-t border-gray-800 flex gap-4 text-xs text-gray-600">
              <span>{content.length} chars</span>
              <span>{content.split('\n').length} lines</span>
              <span>~{Math.round(content.length / 4)} tokens</span>
            </div>
          )}
        </div>

        {/* Right: Report panel */}
        <div className="w-1/2 flex flex-col">
          {/* Tab bar */}
          <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-1">
            <button
              onClick={() => setActiveTab('static')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${activeTab === 'static'
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:text-gray-300'
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
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              LLM Analysis
              {llmResult && (
                <span className={`ml-1.5 w-2 h-2 rounded-full inline-block ${llmResult.overall_status === 'pass' ? 'bg-emerald-500' :
                    llmResult.overall_status === 'warn' ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
              )}
            </button>
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin space-y-4">
            {activeTab === 'static' && (
              <StaticReport result={staticResult} isLoading={staticLoading} />
            )}

            {activeTab === 'llm' && (
              <>
                <ProviderConfigPanel
                  config={providerConfig}
                  onChange={setProviderConfig}
                  onRun={handleRunLLM}
                  isRunning={llmLoading}
                  disabled={!content.trim()}
                />
                <LLMReport
                  result={llmResult}
                  isLoading={llmLoading}
                  error={llmError}
                  skillTokens={staticResult?.skill_tokens ?? llmResult?.skill_tokens}
                  referencedFiles={staticResult?.referenced_files ?? llmResult?.referenced_files}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
