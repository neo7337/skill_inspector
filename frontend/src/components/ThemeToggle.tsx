export interface ThemeToggleProps {
  theme: 'dark' | 'light'
  onToggle: () => void
  className?: string
}

export function ThemeToggle({ theme, onToggle, className = '' }: ThemeToggleProps) {
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={onToggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`
        relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center
        bg-white/80 dark:bg-slate-900/80 backdrop-blur-md
        border border-slate-200/80 dark:border-slate-800/80 shadow-sm
        hover:border-slate-300 dark:hover:border-slate-700
        hover:shadow-glow-sm hover:scale-[1.03] active:scale-[0.97]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50
        transition-all duration-300 group overflow-hidden
        ${className}
      `}
    >
      {/* Sun icon (shown in dark mode, switches to light) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`
          w-5 h-5 absolute transition-all duration-500 ease-out
          ${
            isDark
              ? 'opacity-100 rotate-0 scale-100 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]'
              : 'opacity-0 rotate-90 scale-0 text-amber-300 pointer-events-none'
          }
        `}
      >
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.166 17.834a.75.75 0 00-1.06 1.06l1.59 1.591a.75.75 0 001.061-1.06l-1.59-1.591zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.166 6.166a.75.75 0 001.06 1.06l-1.59 1.591a.75.75 0 00-1.061-1.06l1.59-1.591z" />
      </svg>

      {/* Moon icon (shown in light mode, switches to dark) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`
          w-5 h-5 absolute transition-all duration-500 ease-out
          ${
            !isDark
              ? 'opacity-100 rotate-0 scale-100 text-indigo-600 drop-shadow-[0_0_8px_rgba(99,102,241,0.35)]'
              : 'opacity-0 -rotate-90 scale-0 text-indigo-400 pointer-events-none'
          }
        `}
      >
        <path
          fillRule="evenodd"
          d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  )
}
