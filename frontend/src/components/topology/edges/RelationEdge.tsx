import type { EdgeProps } from '@xyflow/react'
import type { EdgeRelation } from '../graph/buildGraph'

export interface RelationEdgeData {
  relation: EdgeRelation
  weight: number
  color: string
  dashed?: boolean
  dim?: boolean
  highlight?: boolean
  [key: string]: unknown
}

/** Straight (contains/flags) or gently curved (references) line between node centres. */
export function RelationEdge({ id, sourceX, sourceY, targetX, targetY, data }: EdgeProps) {
  const d = data as RelationEdgeData
  const curved = d.relation === 'references'
  let path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
  if (curved) {
    const mx = (sourceX + targetX) / 2
    const my = (sourceY + targetY) / 2
    const dx = targetX - sourceX
    const dy = targetY - sourceY
    const len = Math.hypot(dx, dy) || 1
    const bend = Math.min(60, len * 0.25)
    path = `M ${sourceX} ${sourceY} Q ${mx - (dy / len) * bend} ${my + (dx / len) * bend} ${targetX} ${targetY}`
  }
  const width = Math.max(1, Math.min(3.5, 0.9 + d.weight * 0.45)) + (d.highlight ? 0.8 : 0)
  const opacity = d.dim ? 0.06 : d.highlight ? 0.95 : d.relation === 'contains' ? 0.4 : 0.65
  return (
    <path
      id={id}
      d={path}
      fill="none"
      stroke={d.color}
      strokeWidth={width}
      strokeOpacity={opacity}
      strokeLinecap="round"
      strokeDasharray={d.dashed ? '6 4' : curved ? '2 5' : undefined}
      className={d.dashed ? 'animated-dash' : undefined}
      style={{ transition: 'stroke-opacity 160ms' }}
    />
  )
}
