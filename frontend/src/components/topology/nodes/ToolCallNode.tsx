import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { TrajectoryTimelineStep } from '../../../types'

export interface ToolCallNodeData {
  step: TrajectoryTimelineStep
  isDark: boolean
}

export function ToolCallNode({ data, selected }: NodeProps) {
  const d = data as ToolCallNodeData
  const { step } = d

  const isRedundant = step.is_redundant
  const isError = step.is_error

  let bg: string
  let borderColor: string
  let badgeColor: string

  if (isError) {
    bg = d.isDark ? 'rgba(136,19,55,0.45)' : 'rgba(254,226,226,0.95)'
    borderColor = `rgba(244,63,94,${selected ? '0.7' : '0.4'})`
    badgeColor = '#f43f5e'
  } else if (isRedundant) {
    bg = d.isDark ? 'rgba(120,53,15,0.45)' : 'rgba(254,243,199,0.95)'
    borderColor = `rgba(245,158,11,${selected ? '0.7' : '0.4'})`
    badgeColor = '#f59e0b'
  } else {
    bg = d.isDark ? 'rgba(15,23,42,0.80)' : 'rgba(255,255,255,0.97)'
    borderColor = `rgba(100,116,139,${selected ? '0.5' : '0.25'})`
    badgeColor = '#64748b'
  }

  const containerStyle: React.CSSProperties = {
    width: 168,
    background: bg,
    backdropFilter: 'blur(8px)',
    border: `1px solid ${borderColor}`,
    borderRadius: 10,
    boxShadow: selected ? '0 6px 20px rgba(0,0,0,0.4)' : '0 3px 12px rgba(0,0,0,0.25)',
    padding: '8px 10px',
    fontFamily: 'inherit',
  }

  const textPrimary = d.isDark ? '#f1f5f9' : '#0f172a'
  const textMuted = d.isDark ? '#64748b' : '#94a3b8'

  return (
    <div style={containerStyle}>
      {/* Step badge + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, fontFamily: 'ui-monospace, monospace',
          padding: '2px 6px', borderRadius: 4,
          background: `${badgeColor}20`, color: badgeColor, letterSpacing: '0.02em',
        }}>
          #{step.step_index}
        </span>
        {(isError || isRedundant) && (
          <span style={{ fontSize: 9, color: badgeColor, fontWeight: 600 }}>
            {isError ? '✗ error' : '↺ redundant'}
          </span>
        )}
      </div>

      {/* Tool name */}
      <div style={{
        fontSize: 11, fontFamily: 'ui-monospace, monospace', fontWeight: 600,
        color: textPrimary, marginBottom: 7,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {step.tool_name}
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: textMuted }}>{step.duration_ms}ms</span>
        <span style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', color: textMuted }}>{step.tokens.toLocaleString()} tok</span>
      </div>

      <Handle type="target" position={Position.Left} style={{ background: badgeColor, border: `2px solid ${badgeColor}40`, width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right} style={{ background: badgeColor, border: `2px solid ${badgeColor}40`, width: 8, height: 8 }} />
    </div>
  )
}
