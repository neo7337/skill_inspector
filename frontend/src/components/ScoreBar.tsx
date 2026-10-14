interface ScoreBarProps {
  score: number
  label: string
}

function scoreColor(score: number) {
  if (score >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-400' }
  if (score >= 50) return { bar: 'bg-amber-500', text: 'text-amber-400' }
  return { bar: 'bg-red-500', text: 'text-red-400' }
}

export function ScoreBar({ score, label }: ScoreBarProps) {
  const { bar, text } = scoreColor(score)
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-300">{label}</span>
        <span className={`text-sm font-semibold font-mono ${text}`}>{score}/100</span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${bar}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

export function OverallScoreRing({ score }: { score: number }) {
  const { text } = scoreColor(score)
  const circumference = 2 * Math.PI * 36
  const offset = circumference - (score / 100) * circumference
  const strokeColor = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#1f2937" strokeWidth="6" />
          <circle
            cx="40" cy="40" r="36"
            fill="none"
            stroke={strokeColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold font-mono ${text}`}>{score}</span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
    </div>
  )
}
