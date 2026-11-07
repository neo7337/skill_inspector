import { getBezierPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

export interface GradientEdgeData {
  sourceColor?: string
  targetColor?: string
  animated?: boolean
  opacity?: number
}

export function GradientEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const gradId = `grad-${id}`
  const srcColor = (data as GradientEdgeData)?.sourceColor ?? '#3b82f6'
  const tgtColor = (data as GradientEdgeData)?.targetColor ?? '#64748b'
  const isAnimated = (data as GradientEdgeData)?.animated ?? false
  const opacity = (data as GradientEdgeData)?.opacity ?? 0.55

  return (
    <>
      <defs>
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1={sourceX} y1={sourceY} x2={targetX} y2={targetY}>
          <stop offset="0%" stopColor={srcColor} stopOpacity="0.8" />
          <stop offset="100%" stopColor={tgtColor} stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={1.5}
        strokeOpacity={opacity}
        strokeDasharray={isAnimated ? '6 3' : undefined}
        className={isAnimated ? 'animated-dash' : undefined}
      />
    </>
  )
}
