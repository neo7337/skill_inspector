import { useEffect, useState } from 'react'
import type { ResolvedFileReference, ReferencedFile } from '../types'

export interface ReferenceFileDrawerProps {
  isOpen: boolean
  onClose: () => void
  file: ResolvedFileReference | ReferencedFile | null
  baseDir?: string
}

export function ReferenceFileDrawer({
  isOpen,
  onClose,
  file,
  baseDir,
}: ReferenceFileDrawerProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !file) return null

  // Check if it's a resolved reference with full metadata
  const resolved = 'status' in file ? (file as ResolvedFileReference) : null
  const relativePath = 'path' in file ? file.path : (resolved ? resolved.relative_path : '')
  const kind = file.kind
  const isBinary = resolved?.is_binary ?? false
  const status = resolved?.status ?? 'found'
  const content = resolved?.content_preview ?? ''

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/40">
          <div className="space-y-1 min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                Referenced Package File
              </span>
              {resolved && (
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    status === 'found'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : status === 'missing'
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  }`}
                >
                  {status.toUpperCase()}
                </span>
              )}
            </div>
            <h2 className="text-base font-bold font-mono text-slate-900 dark:text-white truncate">
              {relativePath}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close drawer (Esc)"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* File Meta Cards */}
        <div className="grid grid-cols-4 gap-2.5 px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 text-xs">
          <div className="p-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800/60">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Kind</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">{kind}</span>
          </div>
          <div className="p-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800/60">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Size</span>
            <span className="font-mono text-slate-700 dark:text-slate-200">
              {resolved ? `${(resolved.size_bytes / 1024).toFixed(1)} KB` : 'N/A'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800/60">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Lines</span>
            <span className="font-mono text-slate-700 dark:text-slate-200">
              {resolved ? resolved.line_count : 'N/A'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800/60">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Tokens</span>
            <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
              {resolved ? `~${resolved.token_count.toLocaleString()}` : 'N/A'}
            </span>
          </div>
        </div>

        {resolved?.absolute_path && (
          <div className="px-6 py-2 bg-slate-100/50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500 truncate">
            <span className="text-slate-400 select-none">Path: </span>
            {resolved.absolute_path}
          </div>
        )}

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50/30 dark:bg-[#060a12]">
          {status === 'missing' ? (
            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-600 dark:text-rose-400 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <svg className="w-5 h-5 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Reference File Not Found</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                This file was declared in the skill instructions but could not be found at{' '}
                <code className="font-mono bg-rose-500/10 px-1 py-0.5 rounded text-rose-700 dark:text-rose-300">{relativePath}</code>
                {baseDir ? ` inside base directory ${baseDir}` : ''}.
              </p>
            </div>
          ) : isBinary ? (
            <div className="p-8 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/50 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Binary Asset File</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                This file contains binary content (e.g. an image, document, or archive). Its contents are not injected into text context.
              </p>
            </div>
          ) : content ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <span>File Content Preview</span>
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-white dark:bg-[#090d18] border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 overflow-x-auto leading-relaxed shadow-inner">
                <code>{content}</code>
              </pre>
            </div>
          ) : (
            <div className="p-6 text-center text-slate-400 italic text-xs">
              No content preview available for this file.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
