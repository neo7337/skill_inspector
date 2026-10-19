import { useState } from 'react'
import type { LLMProvider, ProviderConfig } from '../types'
import { DEFAULT_MODELS } from '../types'

interface ProviderConfigPanelProps {
  config: ProviderConfig
  onChange: (config: ProviderConfig) => void
  onRun: () => void
  isRunning: boolean
  disabled: boolean
  isDark?: boolean
}

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  ollama: 'Ollama (local)',
}

const PROVIDER_HINTS: Record<LLMProvider, string> = {
  openai: 'API key required. Uses /v1/chat/completions.',
  anthropic: 'API key required. Uses claude-3-5-haiku-20241022 or similar.',
  ollama: 'No API key needed. Requires Ollama running locally on port 11434.',
}

export function ProviderConfigPanel({
  config,
  onChange,
  onRun,
  isRunning,
  disabled,
}: ProviderConfigPanelProps) {
  const [showKey, setShowKey] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleProviderChange = (provider: LLMProvider) => {
    onChange({
      ...config,
      provider,
      model: DEFAULT_MODELS[provider],
      api_key: '',
      base_url: 'http://localhost:11434',
    })
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm dark:shadow-none">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(p => !p)}
        className="w-full flex items-center justify-between p-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-purple-600 dark:text-purple-400">⚡</span>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">LLM Analysis</span>
          <span className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded">
            {PROVIDER_LABELS[config.provider]} / {config.model}
          </span>
        </div>
        <span className="text-gray-400 dark:text-gray-600 text-xs">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/50">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Uses a language model to evaluate instruction clarity, description quality, scope
            definition, and token efficiency. Results vary between runs.
          </p>

          {/* Provider select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PROVIDER_LABELS) as LLMProvider[]).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleProviderChange(p)}
                  className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                    config.provider === p
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {PROVIDER_LABELS[p]}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">{PROVIDER_HINTS[config.provider]}</p>
          </div>

          {/* Model input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Model</label>
            <input
              type="text"
              value={config.model}
              onChange={e => onChange({ ...config, model: e.target.value })}
              placeholder={DEFAULT_MODELS[config.provider]}
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-3 py-2 text-sm text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono"
            />
          </div>

          {/* API key — only for OpenAI / Anthropic */}
          {config.provider !== 'ollama' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={config.api_key}
                  onChange={e => onChange({ ...config, api_key: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-3 py-2 pr-16 text-sm text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(p => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-1 py-0.5"
                >
                  {showKey ? 'hide' : 'show'}
                </button>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Key is used only for this request and never stored.
              </p>
            </div>
          )}

          {/* Base URL — only for Ollama */}
          {config.provider === 'ollama' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Ollama Base URL</label>
              <input
                type="text"
                value={config.base_url}
                onChange={e => onChange({ ...config, base_url: e.target.value })}
                placeholder="http://localhost:11434"
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-3 py-2 text-sm text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-mono"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Ollama must be running locally. Default: http://localhost:11434
              </p>
              <div className="flex items-center p-4 mb-4 text-sm text-yellow-800 border-l-4 border-yellow-500 bg-yellow-50" role="alert">
                <svg className="flex-shrink-0 inline w-4 h-4 me-3" aria-hidden="true" xmlns="http://w3.org" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM10 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-4H9V5h2v6Z"/>
                </svg>
                <div>
                  <span className="font-medium">Warning!</span> If you are using docker-compose to run the app, leave the URL empty.
                </div>
              </div>
            </div>
          )}

          {/* Run button */}
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning || disabled}
            className="w-full py-2.5 rounded font-medium text-sm transition-all
              bg-purple-600 hover:bg-purple-500 text-white shadow-sm
              disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:text-gray-500 dark:disabled:text-gray-600 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {isRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-purple-300 border-t-white rounded-full animate-spin" />
                <span>Running LLM Analysis…</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Run LLM Analysis</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
