import type { RuleStatus } from '../types'

export interface StatusBadgeProps {
  status: RuleStatus
  size?: 'sm' | 'md' | 'lg'
  showDot?: boolean
  showIcon?: boolean
  className?: string
}

const statusConfig: Record<
  RuleStatus,
  {
    label: string
    dotClass: string
    pillClass: string
    glowClass: string
    iconColor: string
  }
> = {
  pass: {
    label: 'PASS',
    dotClass: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]',
    pillClass:
      'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 dark:border-emerald-500/35',
    glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.15)]',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
  },
  warn: {
    label: 'WARN',
    dotClass: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]',
    pillClass:
      'bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25 dark:border-amber-500/35',
    glowClass: 'shadow-[0_0_12px_rgba(245,158,11,0.15)]',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  fail: {
    label: 'FAIL',
    dotClass: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]',
    pillClass:
      'bg-rose-500/10 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25 dark:border-rose-500/35',
    glowClass: 'shadow-[0_0_12px_rgba(244,63,94,0.15)]',
    iconColor: 'text-rose-600 dark:text-rose-400',
  },
}

const sizeConfig = {
  sm: {
    wrapper: 'text-[11px] px-2 py-0.5 gap-1.5 font-medium tracking-wide',
    dot: 'w-1.5 h-1.5',
    icon: 'w-3 h-3',
  },
  md: {
    wrapper: 'text-xs px-2.5 py-1 gap-1.5 font-semibold tracking-wider',
    dot: 'w-2 h-2',
    icon: 'w-3.5 h-3.5',
  },
  lg: {
    wrapper: 'text-sm px-3.5 py-1.5 gap-2 font-semibold tracking-wider',
    dot: 'w-2.5 h-2.5',
    icon: 'w-4 h-4',
  },
}

export function StatusBadge({
  status,
  size = 'sm',
  showDot = true,
  showIcon = false,
  className = '',
}: StatusBadgeProps) {
  const config = statusConfig[status]
  const sizeStyle = sizeConfig[size]

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-mono border backdrop-blur-sm transition-all duration-200
        ${sizeStyle.wrapper}
        ${config.pillClass}
        ${config.glowClass}
        ${className}
      `}
    >
      {showDot && !showIcon && (
        <span
          className={`rounded-full shrink-0 animate-pulse ${sizeStyle.dot} ${config.dotClass}`}
          aria-hidden="true"
        />
      )}
      {showIcon && (
        <StatusIcon status={status} className={sizeStyle.icon} />
      )}
      <span>{config.label}</span>
    </span>
  )
}

export function StatusIcon({
  status,
  className = 'w-4 h-4',
}: {
  status: RuleStatus
  className?: string
}) {
  if (status === 'pass') {
    return (
      <svg
        className={`shrink-0 text-emerald-500 dark:text-emerald-400 ${className}`}
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-label="Pass"
      >
        <path
          fillRule="evenodd"
          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  if (status === 'warn') {
    return (
      <svg
        className={`shrink-0 text-amber-500 dark:text-amber-400 ${className}`}
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-label="Warning"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  return (
    <svg
      className={`shrink-0 text-rose-500 dark:text-rose-400 ${className}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-label="Fail"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
        clipRule="evenodd"
      />
    </svg>
  )
}

