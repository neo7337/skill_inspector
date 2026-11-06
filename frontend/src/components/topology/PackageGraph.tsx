import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type {
  ReferencedFile,
  ResolvedFileReference,
  SkillPackageSummary,
  StaticFinding,
} from '../../types'
import { KnowledgeNode, type KnowledgeNodeData } from './nodes/KnowledgeNode'
import { KIND_COLORS } from './nodes/FileNode'
import { RelationEdge, type RelationEdgeData } from './edges/RelationEdge'
import { TopologyToolbar } from './TopologyToolbar'
import {
  buildGraph,
  DEFAULT_LAYERS,
  neighborIds,
  SKILL_ID,
  type GraphLayers,
} from './graph/buildGraph'
import { useForceLayout, type PositionMap } from './graph/useForceLayout'

const nodeTypes = { knowledge: KnowledgeNode }
const edgeTypes = { relation: RelationEdge }

const RELATION_COLOR = { contains: '#64748b', references: '#06b6d4', flags: '#f59e0b' } as const

interface Props {
  packageSummary: SkillPackageSummary
  findings: StaticFinding[]
  skillName: string
  isDark: boolean
  onSelectFile: (file: ResolvedFileReference | ReferencedFile | string) => void
}

function Inner({ packageSummary, findings, skillName, isDark, onSelectFile }: Props) {
  const [layers, setLayers] = useState<GraphLayers>(DEFAULT_LAYERS)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges] = useEdgesState<Edge>([])
  const { fitView } = useReactFlow()
  const fittedFor = useRef<string | null>(null)

  const graph = useMemo(
    () => buildGraph(packageSummary, findings, layers, skillName),
    [packageSummary, findings, layers, skillName],
  )
  const radii = useRef<Map<string, number>>(new Map())
  useEffect(() => {
    radii.current = new Map(graph.nodes.map((n) => [n.id, n.radius]))
  }, [graph])

  const onTick = useCallback(
    (positions: PositionMap) => {
      setNodes((prev) =>
        prev.map((n) => {
          const p = positions.get(n.id)
          const r = radii.current.get(n.id) ?? 0
          return p ? { ...n, position: { x: p.x - r, y: p.y - r } } : n
        }),
      )
    },
    [setNodes],
  )
  const layout = useForceLayout(graph, { onTick })

  // Sync graph structure into React Flow, preserving positions of existing nodes
  const pkgKey = `${packageSummary.base_dir}|${skillName}`
  useEffect(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]))
      return graph.nodes.map((gn) => {
        const old = prevById.get(gn.id)
        const data: KnowledgeNodeData = {
          node: gn,
          budgetStatus: packageSummary.tokens.budget_status,
          missingCount: packageSummary.missing_files_count,
          pinned: layout.isPinned(gn.id),
        }
        return {
          id: gn.id,
          type: 'knowledge',
          position: old?.position ?? { x: -gn.radius, y: -gn.radius },
          data,
          selected: old?.selected,
        } as Node
      })
    })
    setEdges(
      graph.edges.map((ge) => {
        const target = graph.nodes.find((n) => n.id === ge.target)
        const color =
          ge.relation === 'flags'
            ? (graph.nodes.find((n) => n.id === ge.source)?.finding?.status === 'fail' ? '#f43f5e' : '#f59e0b')
            : ge.relation === 'contains' && target?.kind
              ? KIND_COLORS[target.kind]
              : RELATION_COLOR[ge.relation]
        const data: RelationEdgeData = {
          relation: ge.relation,
          weight: ge.weight,
          color,
          dashed: target?.file?.status === 'missing',
        }
        return { id: ge.id, source: ge.source, target: ge.target, type: 'relation', data } as Edge
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, packageSummary, setNodes, setEdges])

  // Fit once per package after the layout has had time to spread out
  useEffect(() => {
    if (fittedFor.current === pkgKey) return
    fittedFor.current = pkgKey
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 700)
    return () => clearTimeout(t)
  }, [pkgKey, fitView])

  // Hover / selection highlight
  const activeId = hoverId ?? selectedId
  useEffect(() => {
    const near = activeId ? neighborIds(graph.edges, activeId) : null
    setNodes((prev) =>
      prev.map((n) => {
        const d = n.data as KnowledgeNodeData
        const dim = near ? !near.has(n.id) : false
        const active = n.id === activeId
        return d.dim === dim && d.active === active ? n : { ...n, data: { ...d, dim, active } }
      }),
    )
    setEdges((prev) =>
      prev.map((e) => {
        const d = e.data as RelationEdgeData
        const highlight = !!activeId && (e.source === activeId || e.target === activeId)
        const dim = !!activeId && !highlight
        return d.dim === dim && d.highlight === highlight ? e : { ...e, data: { ...d, dim, highlight } }
      }),
    )
  }, [activeId, graph.edges, setNodes, setEdges])

  const markPinned = useCallback(
    (id: string, pinned: boolean) =>
      setNodes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, data: { ...(n.data as KnowledgeNodeData), pinned } } : n)),
      ),
    [setNodes],
  )

  const centerOf = (n: Node) => {
    const r = radii.current.get(n.id) ?? 0
    return { x: n.position.x + r, y: n.position.y + r }
  }

  return (
    <div className="absolute inset-0">
      <TopologyToolbar
        layers={layers}
        onLayers={setLayers}
        nodes={graph.nodes}
        onSearchPick={(id) => {
          setSelectedId(id)
          fitView({ nodes: [{ id }], duration: 500, maxZoom: 1.6, padding: 1.5 })
        }}
        onRelayout={() => {
          layout.relayout()
          setNodes((prev) => prev.map((n) => ({ ...n, data: { ...(n.data as KnowledgeNodeData), pinned: false } })))
          setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 700)
        }}
        onUnpinAll={() => {
          layout.releaseAll()
          setNodes((prev) => prev.map((n) => ({ ...n, data: { ...(n.data as KnowledgeNodeData), pinned: false } })))
        }}
        onFit={() => fitView({ padding: 0.2, duration: 400 })}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        minZoom={0.15}
        maxZoom={2.5}
        colorMode={isDark ? 'dark' : 'light'}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        elementsSelectable
        zoomOnDoubleClick={false}
        onNodeMouseEnter={(_, n) => setHoverId(n.id)}
        onNodeMouseLeave={() => setHoverId(null)}
        onNodeDragStart={(_, n) => {
          const c = centerOf(n)
          layout.pin(n.id, c.x, c.y)
          markPinned(n.id, true)
        }}
        onNodeDrag={(_, n) => {
          const c = centerOf(n)
          layout.pin(n.id, c.x, c.y)
        }}
        onNodeDragStop={() => layout.endDrag()}
        onNodeDoubleClick={(_, n) => {
          layout.release(n.id)
          markPinned(n.id, false)
        }}
        onNodeClick={(_, n) => {
          setSelectedId(n.id)
          const gn = (n.data as KnowledgeNodeData).node
          if (gn.file) onSelectFile(gn.file)
        }}
        onPaneClick={() => setSelectedId(null)}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color={isDark ? '#1e293b' : '#cbd5e1'} />
        <Controls className="!bottom-4 !left-4" showInteractive={false} />
        <MiniMap
          className="!bottom-4 !right-4 !rounded-xl !overflow-hidden !border !border-slate-700/40"
          pannable
          zoomable
          nodeColor={(node) => {
            const gn = (node.data as KnowledgeNodeData)?.node
            if (!gn) return '#64748b'
            if (gn.id === SKILL_ID) return '#3b82f6'
            if (gn.type === 'finding') return '#f59e0b'
            return KIND_COLORS[gn.kind ?? 'other'] ?? '#64748b'
          }}
          maskColor={isDark ? 'rgba(2,6,23,0.75)' : 'rgba(248,250,252,0.75)'}
          style={{ background: isDark ? '#0f172a' : '#f8fafc' }}
        />
      </ReactFlow>
    </div>
  )
}

export function PackageGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <Inner {...props} />
    </ReactFlowProvider>
  )
}
