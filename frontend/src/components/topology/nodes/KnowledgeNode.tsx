import { Handle, Position, useStore } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { GraphNode } from '../graph/buildGraph'
import { KIND_COLORS } from './FileNode'

export interface KnowledgeNodeData {
  node: GraphNode
  dim?: boolean
  active?: boolean
  pinned?: boolean
  budgetStatus?: string
  missingCount?: number
  [key: string]: unknown
}

const STATUS_COLOR: Record<string, string> = {
  found: '#22c55e',
  missing: '#f43f5e',
  unreadable: '#f59e0b',
  outside_root: '#f97316',
}
const BUDGET_COLOR: Record<string, string> = {
  within_budget: '#22c55e',
  approaching_limit: '#f59e0b',
  caution: '#f59e0b',
  exceeds_budget: '#f43f5e',
  exceeded: '#f43f5e',
}
const FINDING_COLOR: Record<string, string> = { warn: '#f59e0b', fail: '#f43f5e' }
const BRAND = '#3b82f6'

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function Icon({ node }: { node: GraphNode }) {
  const size = Math.round(node.radius * 0.9)
  const common = { width: size, height: size, ...ICON_PROPS }
  if (node.type === 'skill')
    return (
      <svg {...common}>
        <path d="M12 2l2.4 6.9L21 10l-5.4 4.2L17.3 21 12 17.3 6.7 21l1.7-6.8L3 10l6.6-1.1z" />
      </svg>
    )
  if (node.type === 'dir')
    return (
      <svg {...common}>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    )
  if (node.type === 'finding')
    return (
      <svg {...common}>
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </svg>
    )
  const kind = node.kind
  if (kind === 'script')
    return (
      <svg {...common}>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    )
  if (kind === 'asset')
    return (
      <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    )
  return (
    <svg {...common}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

/** Single circular "knowledge graph" node for skill / kind / dir / file / finding. */
export function KnowledgeNode({ data, selected }: NodeProps) {
  const d = data as KnowledgeNodeData
  const { node } = d
  const zoom = useStore((s) => s.transform[2])

  const kindColor = KIND_COLORS[node.kind ?? 'other'] ?? KIND_COLORS.other
  let accent = kindColor
  if (node.type === 'skill') accent = BRAND
  if (node.type === 'finding') accent = FINDING_COLOR[node.finding?.status ?? 'warn'] ?? '#f59e0b'

  const ring =
    node.type === 'file'
      ? STATUS_COLOR[node.file?.status ?? 'found']
      : node.type === 'skill'
        ? (BUDGET_COLOR[d.budgetStatus ?? ''] ?? BRAND)
        : accent
  const filled = node.type === 'skill' || node.type === 'kind'
  const size = node.radius * 2
  const showLabel = node.type !== 'dir' && node.type !== 'finding' ? zoom > 0.35 : zoom > 0.8
  const showMeta = (zoom > 1.1 || d.active || selected) && node.tokens != null && node.type !== 'dir'

  return (
    <div
      title={node.file?.relative_path ?? node.finding?.message ?? node.label}
      style={{
        width: size,
        height: size,
        position: 'relative',
        opacity: d.dim ? 0.18 : 1,
        transition: 'opacity 160ms',
        cursor: node.type === 'file' ? 'pointer' : 'grab',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: filled ? '#fff' : accent,
          background: filled ? accent : 'var(--surface-raised)',
          border: `${node.type === 'file' ? 2.5 : 2}px ${node.file?.status === 'missing' ? 'dashed' : 'solid'} ${filled ? 'transparent' : ring}`,
          boxShadow:
            node.type === 'skill'
              ? `0 0 0 4px var(--surface-base), 0 0 0 7px ${ring}`
              : selected || d.active
                ? `0 0 0 3px ${accent}55`
                : '0 1px 2px rgba(0,0,0,0.12)',
          transition: 'box-shadow 160ms',
        }}
      >
        <Icon node={node} />
      </div>

      {d.pinned && (
        <span
          style={{
            position: 'absolute',
            top: -3,
            right: -3,
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: 'var(--accent)',
            border: '2px solid var(--surface-base)',
          }}
        />
      )}
      {node.type === 'skill' && (d.missingCount ?? 0) > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -4,
            left: -4,
            minWidth: 18,
            height: 18,
            padding: '0 4px',
            borderRadius: 9,
            background: '#f43f5e',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {d.missingCount}
        </span>
      )}

      {showLabel && (
        <div
          style={{
            position: 'absolute',
            top: size + 5,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: 150,
            textAlign: 'center',
            pointerEvents: 'none',
            lineHeight: 1.25,
          }}
        >
          <div
            style={{
              fontSize: node.type === 'skill' ? 12 : 11,
              fontWeight: node.type === 'skill' || node.type === 'kind' ? 700 : 500,
              fontFamily: node.type === 'file' ? 'ui-monospace, monospace' : 'inherit',
              color: 'var(--label, currentColor)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              padding: '1px 5px',
              borderRadius: 4,
              background: 'color-mix(in srgb, var(--surface-base) 80%, transparent)',
            }}
            className="text-slate-700 dark:text-slate-200"
          >
            {node.label}
          </div>
          {showMeta && (
            <div
              style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace' }}
              className="text-slate-500 dark:text-slate-400"
            >
              {node.tokens!.toLocaleString()} tok
              {node.file && node.file.status !== 'found' ? ` · ${node.file.status.replace('_', ' ')}` : ''}
            </div>
          )}
        </div>
      )}

      {/* Edges attach at the node centre; handles are invisible */}
      <Handle type="target" position={Position.Top} style={centerHandle} isConnectable={false} />
      <Handle type="source" position={Position.Top} style={centerHandle} isConnectable={false} />
    </div>
  )
}

const centerHandle: React.CSSProperties = {
  top: '50%',
  left: '50%',
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  opacity: 0,
  border: 'none',
  background: 'transparent',
  pointerEvents: 'none',
  transform: 'translate(-50%, -50%)',
}
