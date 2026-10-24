import type {
  SkillTokenEstimate,
  ReferencedFile,
  SkillPackageSummary,
  ResolvedFileReference,
} from '../types'

export interface SkillTokenBreakdownProps {
  tokens?: SkillTokenEstimate
  referencedFiles?: ReferencedFile[]
  packageSummary?: SkillPackageSummary | null
  onSelectFile?: (file: ResolvedFileReference | ReferencedFile) => void
}

const KIND_LABELS: Record<string, { label: string; badge: string }> = {
  reference: { label: 'Reference Doc', badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  script: { label: 'Executable Script', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  asset: { label: 'Static Asset', badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  other: { label: 'Auxiliary', badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
}

export function SkillTokenBreakdown({
  tokens,
  referencedFiles,
  packageSummary,
  onSelectFile,
}: SkillTokenBreakdownProps) {
  const pkgTokens = packageSummary?.tokens
  const catalogTokens = pkgTokens ? pkgTokens.catalog_tokens : tokens?.catalog ?? 0
  const bodyTokens = pkgTokens ? pkgTokens.activation_tokens : tokens?.body ?? 0
  const onDemandTokens = pkgTokens ? pkgTokens.total_on_demand_tokens : 0
  const peakFootprint = pkgTokens ? pkgTokens.peak_context_footprint : catalogTokens + bodyTokens

  const budgetStatus = pkgTokens
    ? pkgTokens.budget_status
    : bodyTokens > 5000
    ? 'exceeds_budget'
    : bodyTokens > 3500
    ? 'approaching_limit'
    : 'within_budget'

  // Scale calculations for layered token bar (15,000 tokens default benchmark)
  const maxScale = Math.max(15000, peakFootprint > 0 ? peakFootprint * 1.15 : 15000)
  const catalogPercent = (catalogTokens / maxScale) * 100
  const bodyPercent = (bodyTokens / maxScale) * 100
  const onDemandPercent = (onDemandTokens / maxScale) * 100
  const peakPercentOf15k = Math.round((peakFootprint / 15000) * 100)

  // Use resolved files from package summary if available, else fallback to parsed referenced files
  const resolvedFiles = packageSummary?.resolved_files ?? []
  const fallbackFiles = referencedFiles ?? []
  const hasFiles = resolvedFiles.length > 0 || fallbackFiles.length > 0

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 shadow-xs backdrop-blur-md space-y-4">
      <div className="space-y-3">
        {/* Header Title & Status */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Multi-Tier Context Footprint & Token Economy
              </h3>
              {packageSummary && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Package Resolved
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              Three-tier execution model: Inactive Catalog → On-Activation Body → On-Demand References
            </p>
          </div>

          <span
            className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border ${
              budgetStatus === 'exceeds_budget'
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                : budgetStatus === 'approaching_limit'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
            }`}
          >
            {budgetStatus === 'exceeds_budget'
              ? 'Exceeds Budget'
              : budgetStatus === 'approaching_limit'
              ? 'Approaching Limit'
              : 'Within Budget'}
          </span>
        </div>

        {/* Multi-tier layered context cost gauge */}
        <div className="space-y-1.5 pt-1">
          <div className="w-full h-3.5 rounded-full bg-slate-100 dark:bg-slate-950/80 overflow-hidden p-[2px] relative shadow-inner border border-slate-200/60 dark:border-slate-800/60 flex">
            {/* Catalog tokens segment (blue) */}
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-l-full transition-all duration-500"
              style={{ width: `${catalogPercent}%` }}
              title={`Catalog Header: ~${catalogTokens.toLocaleString()} tokens`}
            />
            {/* Activation body tokens segment (emerald) */}
            <div
              className={`h-full transition-all duration-500 ${
                bodyTokens > 5000
                  ? 'bg-gradient-to-r from-rose-500 to-red-500'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
              style={{ width: `${bodyPercent}%` }}
              title={`Activation Body: ~${bodyTokens.toLocaleString()} tokens`}
            />
            {/* On-demand references tokens segment (violet) */}
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-r-full transition-all duration-500"
              style={{ width: `${onDemandPercent}%` }}
              title={`On-Demand References: ~${onDemandTokens.toLocaleString()} tokens`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 dark:text-slate-500 px-0.5">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                <span className="text-slate-600 dark:text-slate-300">Catalog (~{catalogTokens})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span className="text-slate-600 dark:text-slate-300">Body (~{bodyTokens})</span>
              </span>
              {onDemandTokens > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
                  <span className="text-slate-600 dark:text-slate-300">References (~{onDemandTokens})</span>
                </span>
              )}
            </div>
            <span>
              Peak Footprint: <strong className="text-slate-700 dark:text-slate-200 font-bold">~{peakFootprint.toLocaleString()}</strong> ({peakPercentOf15k}% of 15k benchmark)
            </span>
          </div>
        </div>

        {/* 4-Column Token Breakdown Metrics */}
        <div className="grid grid-cols-4 gap-2.5 pt-2">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/60">
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
              1. Inactive Catalog
            </span>
            <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5 block">
              ~{catalogTokens.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Always in system prompt</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/60">
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
              2. On Activation Body
            </span>
            <span
              className={`text-sm font-mono font-bold mt-0.5 block ${
                bodyTokens > 5000 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              ~{bodyTokens.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Loaded when triggered</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/60">
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
              3. On-Demand Refs
            </span>
            <span className="text-sm font-mono font-bold text-violet-600 dark:text-violet-400 mt-0.5 block">
              ~{onDemandTokens.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">Loaded dynamically as needed</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/60">
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
              Peak Context Footprint
            </span>
            <span className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-0.5 block">
              ~{peakFootprint.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">32k / 128k context safe</span>
          </div>
        </div>
      </div>

      {/* Interactive Referenced Files Table */}
      {hasFiles && (
        <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                Referenced Package Files ({resolvedFiles.length || fallbackFiles.length})
              </h4>
              {packageSummary && (
                <span className="text-[10px] text-slate-400">
                  ({packageSummary.found_files_count} found, {packageSummary.missing_files_count} missing)
                </span>
              )}
            </div>
            <span className="text-[11px] text-indigo-500 dark:text-indigo-400 font-medium">
              Click any file row to inspect contents
            </span>
          </div>

          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden bg-white dark:bg-slate-950/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200/80 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-3.5 py-2.5">Relative Path</th>
                  <th className="px-3 py-2.5">Kind</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Size</th>
                  <th className="px-3.5 py-2.5 text-right">Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 font-mono">
                {resolvedFiles.length > 0
                  ? resolvedFiles.map(file => {
                      const kind = KIND_LABELS[file.kind] || KIND_LABELS.other
                      const statusColor =
                        file.status === 'found'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          : file.status === 'missing'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'

                      return (
                        <tr
                          key={file.relative_path}
                          onClick={() => onSelectFile?.(file)}
                          className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors cursor-pointer group"
                        >
                          <td className="px-3.5 py-2 text-slate-800 dark:text-slate-200 break-all font-semibold flex items-center gap-2">
                            <span className="text-slate-400 group-hover:text-indigo-500 transition-colors">
                              📄
                            </span>
                            <span className="group-hover:underline underline-offset-2">
                              {file.relative_path}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-block text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full border ${kind.badge}`}
                            >
                              {kind.label}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-block text-[10px] font-sans font-bold px-2 py-0.5 rounded-full border ${statusColor}`}
                            >
                              {file.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-slate-500">
                            {file.size_bytes > 0 ? `${(file.size_bytes / 1024).toFixed(1)} KB` : '—'}
                          </td>
                          <td className="px-3.5 py-2 text-right font-bold text-indigo-600 dark:text-indigo-400">
                            {file.token_count > 0 ? `~${file.token_count.toLocaleString()}` : '—'}
                          </td>
                        </tr>
                      )
                    })
                  : fallbackFiles.map(file => {
                      const kind = KIND_LABELS[file.kind] || KIND_LABELS.other
                      return (
                        <tr
                          key={file.path}
                          onClick={() => onSelectFile?.(file)}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                        >
                          <td className="px-3.5 py-2 text-slate-800 dark:text-slate-200 break-all">
                            {file.path}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-block text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full border ${kind.badge}`}
                            >
                              {kind.label}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-block text-[10px] font-sans font-medium px-2 py-0.5 rounded-full border bg-slate-500/10 text-slate-500 border-slate-500/20">
                              DECLARED
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-slate-400">—</td>
                          <td className="px-3.5 py-2 text-right text-slate-400">—</td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
