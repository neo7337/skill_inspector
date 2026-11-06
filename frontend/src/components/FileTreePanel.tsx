import { useState, useCallback } from 'react'
import type { FileTreeNode, ProjectScanResult } from '../types'

// ── File-type icon helpers ────────────────────────────────────────────────────

function fileIcon(node: FileTreeNode): string {
  if (node.type === 'dir') return '📁'
  if (node.is_skill_file) return '🛡'
  const ext = node.extension ?? ''
  if (ext === '.md' || ext === '.markdown') return '📄'
  if (['.py', '.js', '.ts', '.tsx', '.jsx', '.sh', '.bash'].includes(ext)) return '⚙️'
  if (['.json', '.yaml', '.yml', '.toml'].includes(ext)) return '📋'
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext)) return '🖼'
  if (['.pdf'].includes(ext)) return '📰'
  return '📃'
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

// ── Single tree node ──────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: FileTreeNode
  depth: number
  selectedPath: string | null
  onSelectSkill: (path: string) => void
  onSelectFile: (path: string) => void
}

function TreeNode({ node, depth, selectedPath, onSelectSkill, onSelectFile }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2)

  const isSelected = selectedPath === node.path
  const isDir = node.type === 'dir'
  const isSkill = node.is_skill_file === true
  const hasChildren = isDir && (node.children?.length ?? 0) > 0
  const indentPx = depth * 14

  const handleClick = useCallback(() => {
    if (isDir) {
      setExpanded(e => !e)
    } else if (isSkill) {
      onSelectSkill(node.path)
    } else {
      onSelectFile(node.path)
    }
  }, [isDir, isSkill, node.path, onSelectSkill, onSelectFile])

  return (
    <div>
      <div
        onClick={handleClick}
        style={{ paddingLeft: `${indentPx + 6}px` }}
        className={`
          group flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer select-none rounded-md mx-1 text-xs
          transition-colors duration-100
          ${isSelected
            ? 'bg-blue-600 text-white'
            : isSkill
            ? 'text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }
        `}
        title={isSkill ? `Skill file — click to load: ${node.path}` : node.path}
      >
        {/* Expand/collapse chevron for dirs */}
        <span className="w-3 shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
          {isDir && hasChildren ? (expanded ? '▾' : '▸') : ' '}
        </span>

        {/* Icon */}
        <span className="shrink-0 text-[13px] leading-none">{fileIcon(node)}</span>

        {/* Name */}
        <span className={`flex-1 truncate font-${isSkill ? 'semibold' : 'normal'} text-[11px] leading-snug`}>
          {node.name}
        </span>

        {/* Skill badge */}
        {isSkill && !isSelected && (
          <span className="shrink-0 text-[9px] font-bold px-1 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700">
            SKILL
          </span>
        )}

        {/* File size */}
        {node.type === 'file' && node.size_bytes != null && !isSkill && (
          <span className={`shrink-0 text-[10px] font-mono ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
            {formatBytes(node.size_bytes)}
          </span>
        )}
      </div>

      {/* Children */}
      {isDir && expanded && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectSkill={onSelectSkill}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Collapsible skills list ───────────────────────────────────────────────────

/** Readable name: parent folder for SKILL.md files, otherwise the file name. */
function skillDisplayName(path: string): string {
  const parts = path.split('/').filter(Boolean)
  const file = parts[parts.length - 1] ?? path
  if (/^skill\.md$/i.test(file) && parts.length > 1) return parts[parts.length - 2]
  return file
}

interface SkillsSectionProps {
  skillFiles: string[]
  selectedSkillPath: string | null
  isResolving: boolean
  onSelectSkill: (path: string) => void
}

function SkillsSection({ skillFiles, selectedSkillPath, isResolving, onSelectSkill }: SkillsSectionProps) {
  const [open, setOpen] = useState(true)
  const listId = 'skills-section-list'
  const active = selectedSkillPath && skillFiles.includes(selectedSkillPath) ? selectedSkillPath : null

  return (
    <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-indigo-50/50 dark:bg-indigo-950/20">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={listId}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-indigo-100/60 dark:hover:bg-indigo-900/30 transition-colors"
      >
        <span className="w-3 text-[10px] text-indigo-500 dark:text-indigo-400 select-none">{open ? '▾' : '▸'}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          Skills
        </span>
        <span className="text-[10px] font-mono text-indigo-500/80 dark:text-indigo-400/80">({skillFiles.length})</span>
        {!open && active && (
          <span className="ml-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
            · {skillDisplayName(active)}
          </span>
        )}
      </button>

      {open && (
        <div id={listId} className="max-h-48 overflow-y-auto scrollbar-thin px-2 pb-1.5">
          {skillFiles.map(sf => {
            const isActive = selectedSkillPath === sf
            return (
              <button
                key={sf}
                type="button"
                onClick={() => onSelectSkill(sf)}
                title={sf}
                className={`
                  w-full text-left px-2 py-1 rounded flex items-center gap-1.5 transition-colors
                  ${isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
                  }
                `}
              >
                <span className="text-[11px] shrink-0">🛡</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold truncate">{skillDisplayName(sf)}</span>
                  <span className={`block text-[9px] font-mono truncate ${isActive ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                    {sf}
                  </span>
                </span>
                {isResolving && isActive && (
                  <svg className="w-3 h-3 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export interface FileTreePanelProps {
  scanResult: ProjectScanResult | null
  isScanning?: boolean
  scanError?: string | null
  selectedSkillPath: string | null
  isResolving: boolean
  onSelectSkill: (relativePath: string) => void
  onSelectFile: (relativePath: string) => void
}

export function FileTreePanel({
  scanResult,
  isScanning = false,
  scanError = null,
  selectedSkillPath,
  isResolving,
  onSelectSkill,
  onSelectFile,
}: FileTreePanelProps) {

  if (isScanning) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-slate-500 dark:text-slate-400">
        <svg className="w-5 h-5 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-xs font-medium">Scanning project…</span>
      </div>
    )
  }

  if (scanError) {
    return (
      <div className="mx-2 mt-3 p-3 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-xs text-rose-700 dark:text-rose-300">
        <div className="font-semibold mb-1">Scan failed</div>
        <div className="font-mono text-[10px] break-all">{scanError}</div>
      </div>
    )
  }

  if (!scanResult) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl">
          📂
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Enter a project root path above and click <strong className="text-slate-700 dark:text-slate-300">Open Project</strong> to browse the file tree.
        </p>
      </div>
    )
  }

  const { tree, skill_files, total_files, total_dirs, truncated } = scanResult

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Summary bar */}
      <div className="shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2">
        <span className="font-mono">
          {total_dirs}d / {total_files}f
          {truncated && <span className="text-amber-500 ml-1">· truncated</span>}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-indigo-500 font-semibold">{skill_files.length}</span>
          <span>skill{skill_files.length !== 1 ? 's' : ''} found</span>
        </div>
      </div>

      {/* Collapsible list of skills found in the project */}
      {skill_files.length > 0 && (
        <SkillsSection
          skillFiles={skill_files}
          selectedSkillPath={selectedSkillPath}
          isResolving={isResolving}
          onSelectSkill={onSelectSkill}
        />
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-1">
        {tree.children && tree.children.length > 0 ? (
          tree.children.map(child => (
            <TreeNode
              key={child.path}
              node={child}
              depth={0}
              selectedPath={selectedSkillPath}
              onSelectSkill={onSelectSkill}
              onSelectFile={onSelectFile}
            />
          ))
        ) : (
          <div className="text-xs text-slate-400 text-center py-6 italic">
            Directory is empty
          </div>
        )}
      </div>

      {selectedSkillPath && (
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-900/60 text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
          <span className="text-slate-400 dark:text-slate-500 select-none">active: </span>
          {selectedSkillPath}
        </div>
      )}
    </div>
  )
}
