import { useState } from 'react'
import type { LLMProvider, ProviderConfig } from '../types'
import { DEFAULT_MODELS } from '../types'

export interface ProviderConfigPanelProps {
  config: ProviderConfig
  onChange: (config: ProviderConfig) => void
  onRun: () => void
  isRunning: boolean
  disabled: boolean
  isDark?: boolean
}

const PROVIDER_METADATA: Record<
  LLMProvider,
  {
    label: string
    badge: string
    icon: string
    hint: string
    defaultBaseUrl?: string
  }
> = {
  openai: {
    label: 'OpenAI',
    badge: 'GPT-4o',
    icon: '⚡',
    hint: 'Requires OpenAI API key. Evaluates using standard chat completions.',
  },
  anthropic: {
    label: 'Anthropic',
    badge: 'Claude 3.5',
    icon: '✦',
    hint: 'Requires Anthropic API key. Uses Claude 3.5 Haiku or Sonnet.',
  },
  ollama: {
    label: 'Ollama',
    badge: 'Local',
    icon: '🦙',
    hint: 'Runs locally on port 11434 with zero API key or data transfer.',
    defaultBaseUrl: 'http://localhost:11434',
  },
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
      base_url: provider === 'ollama' ? 'http://localhost:11434' : '',
    })
  }

  const currentProvider = PROVIDER_METADATA[config.provider]

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/80 shadow-xs backdrop-blur-md overflow-hidden transition-all duration-200">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsOpen(p => !p)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white text-sm shadow-glow-sm shrink-0">
            {currentProvider.icon}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                LLM Judge Configuration
              </span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                {currentProvider.label}
              </span>
            </div>
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
              Model: {config.model || DEFAULT_MODELS[config.provider]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-3 shrink-0">
          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium hidden sm:inline">
            {isOpen ? 'Hide settings' : 'Configure'}
          </span>
          <svg
            className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : 'rotate-0'
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </button>

      {/* Expanded Configuration Panel */}
      {isOpen && (
        <div className="border-t border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            The LLM Judge evaluates qualitative aspects: instruction precision, prompt edge-cases,
            unintended side-effects, and description trigger quality.
          </p>

          {/* Segmented Provider Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
              AI Provider
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-200/60 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              {(Object.keys(PROVIDER_METADATA) as LLMProvider[]).map(p => {
                const meta = PROVIDER_METADATA[p]
                const isSelected = config.provider === p

                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleProviderChange(p)}
                    className={`
                      py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 select-none
                      ${
                        isSelected
                          ? 'bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-xs border border-slate-200/80 dark:border-violet-500'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-800/60'
                      }
                    `}
                  >
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
              {currentProvider.hint}
            </p>
          </div>

          {/* Model Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
              Model Identifier
            </label>
            <input
              type="text"
              value={config.model}
              onChange={e => onChange({ ...config, model: e.target.value })}
              placeholder={DEFAULT_MODELS[config.provider]}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 transition-all"
            />
          </div>

          {/* Masked API Key Input (OpenAI / Anthropic) */}
          {config.provider !== 'ollama' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={config.api_key}
                  onChange={e => onChange({ ...config, api_key: e.target.value })}
                  placeholder="sk-..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 pr-16 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(p => !p)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {showKey ? 'Hide' : 'Peek'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Key is sent exclusively in the authorization header to execute this evaluation and is never saved to disk.
              </p>
            </div>
          )}

          {/* Base URL (Ollama) */}
          {config.provider === 'ollama' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                Ollama Endpoint URL
              </label>
              <input
                type="text"
                value={config.base_url}
                onChange={e => onChange({ ...config, base_url: e.target.value })}
                placeholder="http://localhost:11434"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 transition-all"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Ollama server address. Default: http://localhost:11434
              </p>
              <div
                className="flex items-center gap-2 p-3 text-xs text-amber-800 dark:text-amber-300 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50"
                role="alert"
              >
                <span className="shrink-0 text-base">💡</span>
                <span>
                  <strong>Docker Note:</strong> If running inside docker-compose, leave the base URL empty to resolve host networking automatically.
                </span>
              </div>
            </div>
          )}

          {/* Vibrant Action Button */}
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning || disabled}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs transition-all duration-200
              bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:via-indigo-500 hover:to-cyan-400 text-white shadow-glow-violet
              active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
              flex items-center justify-center gap-2"
          >
            {isRunning ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Running LLM Judge Evaluation…</span>
              </>
            ) : (
              <>
                <span className="text-sm">✨</span>
                <span>Run LLM Analysis</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
