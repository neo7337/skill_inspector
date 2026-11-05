import { useState } from 'react'
import type { GraphLayers, GraphNode } from './graph/buildGraph'

interface Props {
  layers: GraphLayers
  onLayers: (l: GraphLayers) => void
  nodes: GraphNode[]
  onSearchPick: (id: string) => void
  onRelayout: () => void
  onUnpinAll: () => void
  onFit: () => void
}

const chip = (on: boolean) =>
  `px-2 py-1 text-[11px] font-semibold rounded-md border transition-colors select-none ${
    on
      ? 'bg-blue-600 border-blue-600 text-white'
      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
  }`
const action =
  'px-2 py-1 text-[11px] font-semibold rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'

const LEGEND: Array<[string, string]> = [
  ['Skill', '#3b82f6'],
  ['Reference', '#3b82f6'],
  ['Script', '#8b5cf6'],
  ['Asset', '#10b981'],
  ['Finding', '#f59e0b'],
]

export function TopologyToolbar({ layers, onLayers, nodes, onSearchPick, onRelayout, onUnpinAll, onFit }: Props) {
  const [q, setQ] = useState('')
  const matches = q.trim()
    ? nodes.filter((n) => n.label.toLowerCase().includes(q.toLowerCase())).slice(0, 6)
    : []

  return (
    <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 max-w-[calc(100%-1.5rem)]">
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
        <button type="button" className={chip(layers.dirs)} onClick={() => onLayers({ ...layers, dirs: !layers.dirs })}>
          Folders
        </button>
        <button
          type="button"
          className={chip(layers.crossRefs)}
          onClick={() => onLayers({ ...layers, crossRefs: !layers.crossRefs })}
        >
          Links
        </button>
        <button
          type="button"
          className={chip(layers.findings)}
          onClick={() => onLayers({ ...layers, findings: !layers.findings })}
        >
          Findings
        </button>
        <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-0.5" />
        <button type="button" className={action} onClick={onRelayout} title="Re-run the force layout from scratch">
          Re-layout
        </button>
        <button type="button" className={action} onClick={onUnpinAll} title="Release dragged (pinned) nodes">
          Unpin
        </button>
        <button type="button" className={action} onClick={onFit}>
          Fit
        </button>
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find node…"
            className="w-32 px-2 py-1 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          {matches.length > 0 && (
            <ul className="absolute top-full mt-1 left-0 w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
              {matches.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="w-full text-left px-2.5 py-1.5 text-[11px] font-mono text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 truncate"
                    onClick={() => {
                      onSearchPick(m.id)
                      setQ('')
                    }}
                  >
                    {m.file?.relative_path ?? m.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[10px] text-slate-500 dark:text-slate-400 w-fit">
        {LEGEND.map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#06b6d4" strokeWidth="2" strokeDasharray="2 3" /></svg>
          Link
        </span>
        <span>· size = tokens · drag to pin · double-click to release</span>
      </div>
    </div>
  )
}
