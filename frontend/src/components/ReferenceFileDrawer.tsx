import { useEffect, useState, useCallback } from 'react'
import type { ResolvedFileReference, ReferencedFile } from '../types'
import { fetchFileContent } from '../api'

export interface ReferenceFileDrawerProps {
  isOpen: boolean
  onClose: () => void
  file: ResolvedFileReference | ReferencedFile | null
  baseDir?: string
}

const PREVIEW_CAP = 4000  // must match backend's text[:4000]

export function ReferenceFileDrawer({
  isOpen,
  onClose,
  file,
  baseDir,
}: ReferenceFileDrawerProps) {
  const [copied, setCopied] = useState(false)
  const [fullContent, setFullContent] = useState<string | null>(null)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Reset fetch state whenever the file changes
  useEffect(() => {
    setFullContent(null)
    setFetchError(null)
    setFetchLoading(false)
  }, [file])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !file) return null

  // Discriminate between ResolvedFileReference (has 'status') and ReferencedFile
  const resolved = 'status' in file ? (file as ResolvedFileReference) : null
  const relativePath = resolved ? resolved.relative_path : (file as ReferencedFile).path
  const kind = file.kind
  const isBinary = resolved?.is_binary ?? false
  const status = resolved?.status ?? null   // null = unresolved (no package scanned yet)
  const previewContent = resolved?.content_preview ?? ''
  const isPreviewTruncated = previewContent.length >= PREVIEW_CAP

  // The content we actually display: full (fetched) > preview (from resolved ref)
  const displayContent = fullContent ?? previewContent

  const handleFetchFull = useCallback(async () => {
    if (!baseDir) return
    setFetchLoading(true)
    setFetchError(null)
    try {
      const result = await fetchFileContent(baseDir, relativePath)
      setFullContent(result.content)
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Failed to load file'
      setFetchError(msg)
    } finally {
      setFetchLoading(false)
    }
  }, [baseDir, relativePath])

  // Auto-fetch when: file is unresolved (fallback ReferencedFile) but baseDir is set
  useEffect(() => {
    if (!isOpen || !file) return
    if (!resolved && baseDir && !fullContent && !fetchLoading && !fetchError) {
      handleFetchFull()
    }
  }, [isOpen, file, resolved, baseDir, fullContent, fetchLoading, fetchError, handleFetchFull])

  const handleCopy = () => {
    if (displayContent) {
      navigator.clipboard.writeText(displayContent)
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
              {status ? (
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
              ) : (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border bg-slate-500/10 text-slate-500 border-slate-500/20">
                  DECLARED
                </span>
              )}
              {fullContent && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                  FULL FILE
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
              {resolved ? `${(resolved.size_bytes / 1024).toFixed(1)} KB` : '—'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800/60">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Lines</span>
            <span className="font-mono text-slate-700 dark:text-slate-200">
              {resolved ? resolved.line_count : '—'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800/60">
            <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Tokens</span>
            <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
              {resolved ? `~${resolved.token_count.toLocaleString()}` : '—'}
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

          {/* ── CASE 1: File declared but status = missing ── */}
          {status === 'missing' && (
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
          )}

          {/* ── CASE 2: Binary file ── */}
          {status !== 'missing' && isBinary && (
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
          )}

          {/* ── CASE 3: Unresolved / fallback ReferencedFile — no package scanned ── */}
          {!resolved && !baseDir && !fetchLoading && !fetchError && !fullContent && (
            <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/40 space-y-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center mx-auto">
                <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Package Directory Set</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                This file is declared in the skill but no package root has been scanned yet.
                Enter the package directory path in the toolbar above and click{' '}
                <strong className="text-slate-700 dark:text-slate-300">Scan Package</strong> to resolve
                file references and load content.
              </p>
              <code className="inline-block text-[11px] font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300">
                {relativePath}
              </code>
            </div>
          )}

          {/* ── CASE 4: Loading (auto-fetch or manual fetch) ── */}
          {fetchLoading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
              <svg className="w-7 h-7 animate-spin text-indigo-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-sm font-medium">Loading file content…</span>
              <span className="text-xs font-mono text-slate-400">{relativePath}</span>
            </div>
          )}

          {/* ── CASE 5: Fetch error ── */}
          {fetchError && !fetchLoading && (
            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Failed to Load File
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">{fetchError}</p>
              {baseDir && (
                <button
                  onClick={handleFetchFull}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* ── CASE 6: Content (preview or full) ── */}
          {!fetchLoading && !fetchError && displayContent && status !== 'missing' && !isBinary && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <div className="flex items-center gap-2">
                  <span>{fullContent ? 'Full File Content' : 'Content Preview'}</span>
                  {isPreviewTruncated && !fullContent && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      Truncated at 1 000 chars
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isPreviewTruncated && !fullContent && baseDir && (
                    <button
                      onClick={handleFetchFull}
                      className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Load Full File
                    </button>
                  )}
                  <button
                    onClick={handleCopy}
                    className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <pre className="p-4 rounded-xl bg-white dark:bg-[#090d18] border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 overflow-x-auto leading-relaxed shadow-inner">
                <code>{displayContent}</code>
              </pre>
              {isPreviewTruncated && !fullContent && !baseDir && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 italic text-center">
                  Preview truncated. Set a Package Root directory to load the full file.
                </p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
