export interface ScoreBarProps {
  score: number
  label: string
  max?: number
  className?: string
  showValue?: boolean
}

function getScoreTier(score: number) {
  if (score >= 80) {
    return {
      tier: 'high',
      gradient: 'from-emerald-500 to-teal-400',
      strokeGradStart: '#10b981',
      strokeGradEnd: '#2dd4bf',
      glow: 'shadow-[0_0_12px_rgba(16,185,129,0.35)]',
      text: 'text-emerald-600 dark:text-emerald-400',
      badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
      radialGlow: 'rgba(16, 185, 129, 0.15)',
    }
  }
  if (score >= 50) {
    return {
      tier: 'mid',
      gradient: 'from-amber-500 to-yellow-400',
      strokeGradStart: '#f59e0b',
      strokeGradEnd: '#facc15',
      glow: 'shadow-[0_0_12px_rgba(245,158,11,0.35)]',
      text: 'text-amber-600 dark:text-amber-400',
      badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25',
      radialGlow: 'rgba(245, 158, 11, 0.15)',
    }
  }
  return {
    tier: 'low',
    gradient: 'from-rose-500 to-red-500',
    strokeGradStart: '#f43f5e',
    strokeGradEnd: '#e11d48',
    glow: 'shadow-[0_0_12px_rgba(244,63,94,0.35)]',
    text: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25',
    radialGlow: 'rgba(244, 63, 94, 0.15)',
  }
}

export function ScoreBar({
  score,
  label,
  max = 100,
  className = '',
  showValue = true,
}: ScoreBarProps) {
  const percentage = Math.min(100, Math.max(0, Math.round((score / max) * 100)))
  const tier = getScoreTier(percentage)

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex justify-between items-center text-xs sm:text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {label}
        </span>
        {showValue && (
          <span
            className={`font-mono font-bold px-2 py-0.5 rounded-full text-xs border ${tier.badge}`}
          >
            {score}/{max}
          </span>
        )}
      </div>

      <div className="w-full h-2.5 bg-slate-200/80 dark:bg-slate-800/80 rounded-full overflow-hidden p-[1px] relative shadow-inner">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r ${tier.gradient} ${tier.glow}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export interface OverallScoreRingProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
}

export function OverallScoreRing({
  score,
  size = 'md',
  label = 'SCORE',
  className = '',
}: OverallScoreRingProps) {
  const clampedScore = Math.min(100, Math.max(0, Math.round(score)))
  const tier = getScoreTier(clampedScore)

  const dimensions = {
    sm: { box: 68, radius: 28, stroke: 5, text: 'text-lg', subtext: 'text-[9px]' },
    md: { box: 88, radius: 36, stroke: 6.5, text: 'text-2xl', subtext: 'text-[10px]' },
    lg: { box: 112, radius: 46, stroke: 8, text: 'text-3xl', subtext: 'text-xs' },
  }[size]

  const circumference = 2 * Math.PI * dimensions.radius
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference
  const center = dimensions.box / 2
  const gradId = `ring-grad-${tier.tier}-${size}`

  return (
    <div className={`relative flex flex-col items-center justify-center shrink-0 ${className}`}>
      {/* Subtle radial ambient glow */}
      <div
        className="absolute inset-0 rounded-full blur-xl pointer-events-none opacity-40 transition-colors duration-700"
        style={{ background: tier.radialGlow }}
      />

      <div className="relative" style={{ width: dimensions.box, height: dimensions.box }}>
        <svg
          className="w-full h-full -rotate-90 transform drop-shadow-sm"
          viewBox={`0 0 ${dimensions.box} ${dimensions.box}`}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={tier.strokeGradStart} />
              <stop offset="100%" stopColor={tier.strokeGradEnd} />
            </linearGradient>
          </defs>

          {/* Background track circle */}
          <circle
            cx={center}
            cy={center}
            r={dimensions.radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={dimensions.stroke}
            className="text-slate-200/70 dark:text-slate-800/80 transition-colors"
          />

          {/* Animated active progress circle */}
          <circle
            cx={center}
            cy={center}
            r={dimensions.radius}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={dimensions.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Centered Score Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
          <span
            className={`font-mono font-extrabold tracking-tight transition-colors duration-300 leading-none ${dimensions.text} ${tier.text}`}
          >
            {clampedScore}
          </span>
          <span
            className={`font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500 mt-0.5 ${dimensions.subtext}`}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}
