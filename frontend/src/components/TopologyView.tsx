import { useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type {
  SkillPackageSummary,
  StaticFinding,
  TrajectoryProfileReport,
  ResolvedFileReference,
  ReferencedFile,
} from '../types'
import { profileTrajectory } from '../api'
import { FileNode, KIND_COLORS } from './topology/nodes/FileNode'
import { ToolCallNode } from './topology/nodes/ToolCallNode'
import { GradientEdge } from './topology/edges/GradientEdge'
import { PackageGraph } from './topology/PackageGraph'
import { buildGraph } from './topology/graph/buildGraph'

interface TopologyViewProps {
  packageSummary: SkillPackageSummary | null
  selectedSkillPath: string | null
  findings?: StaticFinding[]
  skillContent: string
  baseDir?: string
  isDark: boolean
  onSelectFile: (file: ResolvedFileReference | ReferencedFile | string) => void
}

const nodeTypes = {
  fileNode: FileNode,
  toolCallNode: ToolCallNode,
}

const edgeTypes = {
  gradientEdge: GradientEdge,
}

const SAMPLE_TRACE = {
  task_id: 'pdf_table_extract_01',
  task_description: 'Extract monthly balance table from statement.pdf',
  skill_name: 'pdf-extractor',
  baseline_step_budget: 3,
  final_status: 'success',
  tool_calls: [
    { step_index: 1, tool_name: 'view_file', tool_arguments: { AbsolutePath: '/workspace/config.py' }, tool_output: "PDF_ENGINE='pypdf'", is_error: false, tokens_prompt: 1100, tokens_completion: 40, duration_ms: 110 },
    { step_index: 2, tool_name: 'grep_search', tool_arguments: { Query: 'extract_table', SearchPath: '/workspace' }, tool_output: '0 matches found', is_error: false, tokens_prompt: 1350, tokens_completion: 45, duration_ms: 220 },
    { step_index: 3, tool_name: 'grep_search', tool_arguments: { Query: 'extract table', SearchPath: '/workspace' }, tool_output: '0 matches found', is_error: false, tokens_prompt: 1450, tokens_completion: 45, duration_ms: 210 },
    { step_index: 4, tool_name: 'view_file', tool_arguments: { AbsolutePath: '/workspace/config.py' }, tool_output: "PDF_ENGINE='pypdf'", is_error: false, tokens_prompt: 1600, tokens_completion: 40, duration_ms: 105 },
    { step_index: 5, tool_name: 'extract_pdf', tool_arguments: { file_path: '/invalid/statement.pdf' }, tool_output: 'FileNotFoundError', is_error: true, tokens_prompt: 1800, tokens_completion: 55, duration_ms: 380 },
    { step_index: 6, tool_name: 'extract_pdf', tool_arguments: { file_path: '/invalid/statement.pdf' }, tool_output: 'FileNotFoundError', is_error: true, tokens_prompt: 1950, tokens_completion: 55, duration_ms: 370 },
    { step_index: 7, tool_name: 'extract_pdf', tool_arguments: { file_path: '/workspace/statement.pdf' }, tool_output: "{ 'tables': 2, 'rows': 45 }", is_error: false, tokens_prompt: 2200, tokens_completion: 130, duration_ms: 510 },
  ],
}

function computeTrajectoryLayout(
  report: TrajectoryProfileReport,
  isDark: boolean,
  onSelectFile: (file: ResolvedFileReference | ReferencedFile | string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const STEP_X_START = 60
  const STEP_SPACING = 220
  const STEP_Y = 160

  const nodes: Node[] = []
  const edges: Edge[] = []

  const steps = report.timeline_summary
  steps.forEach((step, i) => {
    const nodeId = `step-${step.step_index}`
    nodes.push({
      id: nodeId,
      type: 'toolCallNode',
      position: { x: STEP_X_START + i * STEP_SPACING, y: STEP_Y },
      data: { step, isDark },
    })
    if (i > 0) {
      const prevId = `step-${steps[i - 1].step_index}`
      const isRedundant = step.is_redundant
      const isError = step.is_error
      const edgeColor = isError ? '#f43f5e' : isRedundant ? '#f59e0b' : '#64748b'
      edges.push({
        id: `edge-${prevId}-${nodeId}`,
        source: prevId,
        target: nodeId,
        type: 'gradientEdge',
        data: { sourceColor: edgeColor, targetColor: edgeColor, opacity: 0.6 },
      })
    }
  })

  if (report.reference_audit) {
    const accessedFiles = report.reference_audit.accessed_files
    const totalSteps = steps.length
    const FILE_Y = STEP_Y + 160
    const fileStartX = STEP_X_START + ((totalSteps - 1) * STEP_SPACING) / 2 - ((accessedFiles.length - 1) * 180) / 2

    accessedFiles.forEach((filePath, i) => {
      const fileId = `accessed-${i}`
      nodes.push({
        id: fileId,
        type: 'fileNode',
        position: { x: fileStartX + i * 180, y: FILE_Y },
        data: {
          file: {
            relative_path: filePath,
            kind: 'reference',
            status: 'found',
            size_bytes: 0,
            line_count: 0,
            token_count: 0,
            is_binary: false,
          } as ResolvedFileReference,
          isDark,
          onSelectFile,
        },
      })
      const midStepIndex = Math.floor(totalSteps / 2)
      const midStepId = `step-${steps[midStepIndex]?.step_index ?? steps[0].step_index}`
      edges.push({
        id: `edge-access-${fileId}`,
        source: midStepId,
        target: fileId,
        type: 'gradientEdge',
        data: { sourceColor: '#3b82f6', targetColor: '#10b981', opacity: 0.4 },
      })
    })
  }

  return { nodes, edges }
}

export function TopologyView({
  packageSummary,
  selectedSkillPath,
  findings,
  skillContent,
  baseDir,
  isDark,
  onSelectFile,
}: TopologyViewProps) {
  const [mode, setMode] = useState<'package' | 'trajectory'>('package')
  const [trajectoryReport, setTrajectoryReport] = useState<TrajectoryProfileReport | null>(null)
  const [traceText, setTraceText] = useState('')
  const [traceError, setTraceError] = useState<string | null>(null)
  const [traceLoading, setTraceLoading] = useState(false)

  const packageCounts = useMemo(() => {
    const g = buildGraph(packageSummary, findings ?? [])
    return { nodes: g.nodes.length, edges: g.edges.length }
  }, [packageSummary, findings])

  const { nodes: trajectoryNodes, edges: trajectoryEdges } = useMemo(
    () => trajectoryReport
      ? computeTrajectoryLayout(trajectoryReport, isDark, onSelectFile)
      : { nodes: [], edges: [] },
    [trajectoryReport, isDark, onSelectFile],
  )


  const handleAnalyzeTrace = async () => {
    setTraceError(null)
    let trace: unknown
    try {
      trace = JSON.parse(traceText)
    } catch {
      setTraceError('Invalid JSON — paste a valid trajectory trace object.')
      return
    }
    try {
      setTraceLoading(true)
      const report = await profileTrajectory(trace, skillContent, undefined, baseDir)
      setTrajectoryReport(report)
    } catch (err) {
      setTraceError(err instanceof Error ? err.message : 'Analysis failed.')
    } finally {
      setTraceLoading(false)
    }
  }

  const tabClass = (active: boolean) => `
    px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 whitespace-nowrap select-none
    ${active
      ? 'bg-blue-600 text-white shadow-sm'
      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
    }
  `

  const nodeCount = mode === 'package' ? packageCounts.nodes : trajectoryNodes.length
  const edgeCount = mode === 'package' ? packageCounts.edges : trajectoryEdges.length

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Mode tab bar */}
      <div className="shrink-0 px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1.5">
        <button type="button" onClick={() => setMode('package')} className={tabClass(mode === 'package')}>
          Package Topology
        </button>
        <button type="button" onClick={() => setMode('trajectory')} className={tabClass(mode === 'trajectory')}>
          Trajectory Flow
        </button>
        {nodeCount > 0 && (
          <span className="ml-auto text-[11px] font-mono text-slate-400 dark:text-slate-500 select-none">
            {nodeCount} nodes · {edgeCount} edges
          </span>
        )}
        {mode === 'trajectory' && trajectoryReport && (
          <button
            type="button"
            onClick={() => { setTrajectoryReport(null); setTraceText('') }}
            className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-500 transition-colors px-2 py-1 rounded-lg hover:bg-rose-500/10"
          >
            Clear
          </button>
        )}
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative bg-slate-100 dark:bg-slate-950" style={{ minHeight: 0 }}>
        {/* Package empty state */}
        {mode === 'package' && !packageSummary && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className={`
              text-center px-8 py-10 rounded-2xl max-w-xs
              ${isDark
                ? 'bg-slate-900/80 border border-slate-700/50 backdrop-blur-sm'
                : 'bg-white/90 border border-slate-200 shadow-lg backdrop-blur-sm'
              }
            `}>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  <path d="M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
                </svg>
              </div>
              <div className={`text-sm font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                No skill loaded
              </div>
              <div className={`text-xs leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Open a project and select a skill, or paste SKILL.md content to visualize its package topology.
              </div>
            </div>
          </div>
        )}

        {/* Trajectory input card */}
        {mode === 'trajectory' && !trajectoryReport && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className={`
              w-full max-w-md px-6 py-6 rounded-2xl mx-4
              ${isDark
                ? 'bg-slate-900/90 border border-slate-700/50 backdrop-blur-sm'
                : 'bg-white/95 border border-slate-200 shadow-xl backdrop-blur-sm'
              }
            `}>
              <div className={`text-sm font-semibold mb-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Analyze Trajectory
              </div>
              <div className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Paste a JSON trace or load the sample to visualize the agent's execution flow.
              </div>
              <textarea
                value={traceText}
                onChange={e => setTraceText(e.target.value)}
                placeholder='{ "task_id": "...", "tool_calls": [...] }'
                rows={6}
                className={`
                  w-full px-3 py-2.5 rounded-xl text-xs font-mono resize-none mb-3
                  border focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all
                  ${isDark
                    ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder-slate-600'
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                  }
                `}
              />
              {traceError && (
                <div className="text-xs text-rose-500 mb-3 font-medium">{traceError}</div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTraceText(JSON.stringify(SAMPLE_TRACE, null, 2))}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isDark
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Load Sample
                </button>
                <button
                  type="button"
                  onClick={handleAnalyzeTrace}
                  disabled={traceLoading || !traceText.trim()}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all flex items-center justify-center gap-1.5"
                >
                  {traceLoading ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Analyzing…
                    </>
                  ) : 'Analyze'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Package knowledge graph */}
        {mode === 'package' && packageSummary && (
          <PackageGraph
            packageSummary={packageSummary}
            findings={findings ?? []}
            skillName={selectedSkillPath ?? 'SKILL.md'}
            isDark={isDark}
            onSelectFile={onSelectFile}
          />
        )}

        {/* Trajectory flow canvas */}
        {mode === 'trajectory' && trajectoryReport && (
          <ReactFlow
            nodes={trajectoryNodes}
            edges={trajectoryEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            minZoom={0.15}
            maxZoom={2.5}
            colorMode={isDark ? 'dark' : 'light'}
            proOptions={{ hideAttribution: true }}
            nodesConnectable={false}
            nodesDraggable
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1.5}
              color={isDark ? '#1e293b' : '#cbd5e1'}
            />
            <Controls className="!bottom-4 !left-4" showInteractive={false} />
            <MiniMap
              className="!bottom-4 !right-4 !rounded-xl !overflow-hidden !border !border-slate-700/40"
              nodeColor={(node) => {
                if (node.type === 'toolCallNode') {
                  const step = (node.data as { step?: { is_error?: boolean; is_redundant?: boolean } })?.step
                  if (step?.is_error) return '#f43f5e'
                  if (step?.is_redundant) return '#f59e0b'
                  return '#64748b'
                }
                const kind = (node.data as { file?: { kind?: string } })?.file?.kind
                return KIND_COLORS[kind ?? ''] ?? '#64748b'
              }}
              maskColor={isDark ? 'rgba(2,6,23,0.75)' : 'rgba(248,250,252,0.75)'}
              style={{ background: isDark ? '#0f172a' : '#f8fafc' }}
            />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}
