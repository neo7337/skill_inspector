import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { ResolvedFileReference } from '../../../types'

export interface FileNodeData {
  file: ResolvedFileReference
  onSelectFile?: (file: ResolvedFileReference) => void
  isDark: boolean
}

export const KIND_COLORS: Record<string, string> = {
  reference: '#3b82f6',
  script: '#8b5cf6',
  asset: '#10b981',
  other: '#64748b',
}

const STATUS_DOT: Record<string, string> = {
  found: '#22c55e',
  missing: '#f43f5e',
  unreadable: '#f59e0b',
  outside_root: '#f97316',
}

const KIND_ICON: Record<string, React.ReactNode> = {
  reference: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  script: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  asset: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  other: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  ),
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function truncatePath(path: string): string {
  const parts = path.split('/')
  if (parts.length <= 2) return path
  return `…/${parts.slice(-2).join('/')}`
}

export function FileNode({ data, selected }: NodeProps) {
  const d = data as unknown as FileNodeData
  const { file } = d
  const kindColor = KIND_COLORS[file.kind] ?? KIND_COLORS.other
  const statusColor = STATUS_DOT[file.status] ?? '#64748b'

  const containerStyle: React.CSSProperties = d.isDark
    ? {
        width: 190,
        background: 'rgba(15,23,42,0.75)',
        backdropFilter: 'blur(8px)',
        border: `1px solid rgba(255,255,255,${selected ? '0.15' : '0.08'})`,
        borderLeft: `3px solid ${kindColor}`,
        borderRadius: 12,
        boxShadow: selected ? '0 8px 24px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.3)',
        padding: '10px 12px 10px 10px',
        cursor: 'pointer',
        transition: 'transform 150ms, box-shadow 150ms',
        fontFamily: 'inherit',
      }
    : {
        width: 190,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(8px)',
        border: `1px solid rgba(0,0,0,${selected ? '0.15' : '0.08'})`,
        borderLeft: `3px solid ${kindColor}`,
        borderRadius: 12,
        boxShadow: selected ? '0 8px 24px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.06)',
        padding: '10px 12px 10px 10px',
        cursor: 'pointer',
        transition: 'transform 150ms, box-shadow 150ms',
        fontFamily: 'inherit',
      }

  const textPrimary = d.isDark ? '#f1f5f9' : '#0f172a'
  const textMuted = d.isDark ? '#64748b' : '#94a3b8'

  return (
    <div
      style={containerStyle}
      onClick={() => d.onSelectFile?.(file)}
    >
      {/* Kind icon + path */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 7 }}>
        <div style={{ color: kindColor, flexShrink: 0, marginTop: 1 }}>
          {KIND_ICON[file.kind] ?? KIND_ICON.other}
        </div>
        <div style={{
          fontSize: 11,
          fontFamily: 'ui-monospace, monospace',
          fontWeight: 500,
          color: textPrimary,
          wordBreak: 'break-all',
          lineHeight: 1.4,
        }}>
          {truncatePath(file.relative_path)}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: textMuted, textTransform: 'capitalize' }}>{file.status.replace('_', ' ')}</span>
        </div>
        <span style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', color: textMuted }}>
          {file.token_count > 0 ? `${file.token_count.toLocaleString()} tok` : formatBytes(file.size_bytes)}
        </span>
      </div>

      {/* Kind badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', marginTop: 7,
        padding: '2px 7px', borderRadius: 20,
        background: `${kindColor}18`,
        fontSize: 9, fontWeight: 600, color: kindColor, letterSpacing: '0.03em', textTransform: 'uppercase',
      }}>
        {file.kind}
      </div>

      <Handle type="target" position={Position.Top} style={{ background: kindColor, border: `2px solid ${kindColor}40`, width: 8, height: 8 }} />
    </div>
  )
}
