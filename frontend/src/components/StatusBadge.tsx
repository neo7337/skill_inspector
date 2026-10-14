import type { RuleStatus } from '../types'

interface StatusBadgeProps {
  status: RuleStatus
  size?: 'sm' | 'md'
}

const config = {
  pass: { label: 'PASS', classes: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' },
  warn: { label: 'WARN', classes: 'bg-amber-500/15 text-amber-400 border border-amber-500/30' },
  fail: { label: 'FAIL', classes: 'bg-red-500/15 text-red-400 border border-red-500/30' },
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const { label, classes } = config[status]
  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1'
  return (
    <span className={`inline-flex items-center rounded font-mono font-semibold tracking-wider ${sizeClasses} ${classes}`}>
      {label}
    </span>
  )
}

export function StatusIcon({ status }: { status: RuleStatus }) {
  if (status === 'pass') return <span className="text-emerald-400 text-base">✓</span>
  if (status === 'warn') return <span className="text-amber-400 text-base">⚠</span>
  return <span className="text-red-400 text-base">✗</span>
}
