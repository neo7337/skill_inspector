import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

export interface SkillNodeData {
  skillName: string
  catalogTokens: number
  activationTokens: number
  budgetStatus: 'within_budget' | 'approaching_limit' | 'exceeds_budget'
  resolvedCount: number
  missingCount: number
  isDark: boolean
}

const budgetConfig = {
  within_budget: { label: 'Within Budget', color: '#22c55e', bg: 'rgba(21,128,61,0.2)', border: 'rgba(34,197,94,0.3)' },
  approaching_limit: { label: 'Approaching Limit', color: '#f59e0b', bg: 'rgba(120,53,15,0.2)', border: 'rgba(245,158,11,0.3)' },
  exceeds_budget: { label: 'Exceeds Budget', color: '#f43f5e', bg: 'rgba(136,19,55,0.2)', border: 'rgba(244,63,94,0.3)' },
}

export function SkillNode({ data, selected }: NodeProps) {
  const d = data as SkillNodeData
  const budget = budgetConfig[d.budgetStatus]
  const glow = selected
    ? '0 0 0 1px rgba(59,130,246,0.6), 0 8px 32px rgba(59,130,246,0.3), 0 0 60px rgba(59,130,246,0.15)'
    : '0 0 0 1px rgba(59,130,246,0.2), 0 8px 32px rgba(59,130,246,0.15), 0 0 60px rgba(59,130,246,0.08)'

  const containerStyle: React.CSSProperties = d.isDark
    ? {
        width: 260,
        background: 'rgba(15,23,42,0.9)',
        backdropFilter: 'blur(12px)',
        border: `1px solid rgba(59,130,246,${selected ? '0.7' : '0.4'})`,
        borderRadius: 16,
        boxShadow: glow,
        padding: '14px 16px',
        fontFamily: 'inherit',
      }
    : {
        width: 260,
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(12px)',
        border: `1px solid rgba(59,130,246,${selected ? '0.5' : '0.3'})`,
        borderRadius: 16,
        boxShadow: selected
          ? '0 4px 24px rgba(59,130,246,0.25), 0 1px 3px rgba(0,0,0,0.08)'
          : '0 4px 24px rgba(59,130,246,0.12), 0 1px 3px rgba(0,0,0,0.06)',
        padding: '14px 16px',
        fontFamily: 'inherit',
      }

  const textPrimary = d.isDark ? '#f1f5f9' : '#0f172a'
  const textMuted = d.isDark ? '#64748b' : '#94a3b8'
  const dividerColor = d.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  const shortName = d.skillName.split('/').pop() ?? d.skillName

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(37,99,235,0.15)',
          border: '1px solid rgba(59,130,246,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: textPrimary, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shortName || 'SKILL.md'}
          </div>
          <div style={{ fontSize: 10, color: textMuted, marginTop: 1 }}>Skill Package</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: dividerColor, marginBottom: 10 }} />

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1, background: 'rgba(21,128,61,0.1)', borderRadius: 8, padding: '6px 8px', border: '1px solid rgba(34,197,94,0.15)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e', lineHeight: 1 }}>{d.resolvedCount}</div>
          <div style={{ fontSize: 10, color: textMuted, marginTop: 2 }}>resolved</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(136,19,55,0.1)', borderRadius: 8, padding: '6px 8px', border: '1px solid rgba(244,63,94,0.15)' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f43f5e', lineHeight: 1 }}>{d.missingCount}</div>
          <div style={{ fontSize: 10, color: textMuted, marginTop: 2 }}>missing</div>
        </div>
      </div>

      {/* Token row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: textMuted }}>Catalog</span>
        <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'ui-monospace, monospace', color: textPrimary }}>{d.catalogTokens.toLocaleString()} tok</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: textMuted }}>Activation</span>
        <span style={{ fontSize: 11, fontWeight: 600, fontFamily: 'ui-monospace, monospace', color: textPrimary }}>{d.activationTokens.toLocaleString()} tok</span>
      </div>

      {/* Budget badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 8px', borderRadius: 20,
        background: budget.bg, border: `1px solid ${budget.border}`,
        fontSize: 10, fontWeight: 600, color: budget.color,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: budget.color, flexShrink: 0 }} />
        {budget.label}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#3b82f6', border: '2px solid rgba(59,130,246,0.4)', width: 10, height: 10 }} />
    </div>
  )
}
