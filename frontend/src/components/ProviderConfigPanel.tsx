import { useState } from 'react'
import type { LLMProvider, ProviderConfig } from '../types'
import { DEFAULT_MODELS } from '../types'

interface ProviderConfigPanelProps {
  config: ProviderConfig
  onChange: (config: ProviderConfig) => void
  onRun: () => void
  isRunning: boolean
  disabled: boolean
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
    <div className="rounded-lg border border-gray-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(p => !p)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-purple-400">⚡</span>
          <span className="text-sm font-medium text-gray-200">LLM Analysis</span>
          <span className="text-xs text-gray-500 font-mono bg-gray-800 px-1.5 py-0.5 rounded">
            {PROVIDER_LABELS[config.provider]} / {config.model}
          </span>
        </div>
        <span className="text-gray-600 text-xs">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="border-t border-gray-800 p-4 space-y-4 bg-gray-900/50">
          <p className="text-xs text-gray-500">
            Uses a language model to evaluate instruction clarity, description quality, scope
            definition, and token efficiency. Results vary between runs.
          </p>

          {/* Provider select */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PROVIDER_LABELS) as LLMProvider[]).map(p => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                    config.provider === p
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {PROVIDER_LABELS[p]}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-600 italic">{PROVIDER_HINTS[config.provider]}</p>
          </div>

          {/* Model input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">Model</label>
            <input
              type="text"
              value={config.model}
              onChange={e => onChange({ ...config, model: e.target.value })}
              placeholder={DEFAULT_MODELS[config.provider]}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 font-mono"
            />
          </div>

          {/* API key — only for OpenAI / Anthropic */}
          {config.provider !== 'ollama' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={config.api_key}
                  onChange={e => onChange({ ...config, api_key: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 pr-16 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 font-mono"
                />
                <button
                  onClick={() => setShowKey(p => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300"
                >
                  {showKey ? 'hide' : 'show'}
                </button>
              </div>
              <p className="text-xs text-gray-600">
                Key is used only for this request and never stored.
              </p>
            </div>
          )}

          {/* Base URL — only for Ollama */}
          {config.provider === 'ollama' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Ollama Base URL</label>
              <input
                type="text"
                value={config.base_url}
                onChange={e => onChange({ ...config, base_url: e.target.value })}
                placeholder="http://localhost:11434"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          )}

          {/* Run button */}
          <button
            onClick={onRun}
            disabled={isRunning || disabled}
            className="w-full py-2.5 rounded font-medium text-sm transition-all
              bg-purple-600 hover:bg-purple-500 text-white
              disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {isRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-purple-400 border-t-white rounded-full animate-spin" />
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
