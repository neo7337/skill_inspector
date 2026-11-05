import { useCallback, useEffect, useRef } from 'react'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import type { BuiltGraph, GraphEdge, GraphNode } from './buildGraph'
import { SKILL_ID } from './buildGraph'

export interface SimNode extends SimulationNodeDatum {
  id: string
  radius: number
  parentId?: string
}

type SimLink = SimulationLinkDatum<SimNode> & { relation: GraphEdge['relation']; weight: number }

export type PositionMap = Map<string, { x: number; y: number }>

interface Options {
  /** Called on every simulation tick with node CENTER positions. */
  onTick: (positions: PositionMap) => void
}

const LINK_DISTANCE: Record<GraphEdge['relation'], number> = {
  contains: 95,
  references: 170,
  flags: 70,
}
const LINK_STRENGTH: Record<GraphEdge['relation'], number> = {
  contains: 0.9,
  references: 0.04, // weak: cross-links shouldn't distort the hierarchy
  flags: 0.6,
}

/**
 * d3-force layout that survives data refreshes: existing nodes keep their
 * position / pin, only new nodes are seeded (near their parent).
 */
export function useForceLayout(graph: BuiltGraph, { onTick }: Options) {
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null)
  const nodesRef = useRef<Map<string, SimNode>>(new Map())
  const userPinned = useRef<Set<string>>(new Set())
  const onTickRef = useRef(onTick)
  useEffect(() => {
    onTickRef.current = onTick
  }, [onTick])

  const emit = useCallback(() => {
    const out: PositionMap = new Map()
    nodesRef.current.forEach((n, id) => out.set(id, { x: n.x ?? 0, y: n.y ?? 0 }))
    onTickRef.current(out)
  }, [])

  const rebuild = useCallback(
    (g: BuiltGraph, reset: boolean) => {
      const prev = reset ? new Map<string, SimNode>() : nodesRef.current
      if (reset) userPinned.current.clear()
      const next = new Map<string, SimNode>()
      let added = 0

      const make = (n: GraphNode): SimNode => {
        const old = prev.get(n.id)
        if (old) return { ...old, radius: n.radius, parentId: n.parentId }
        added++
        const parent = n.parentId ? prev.get(n.parentId) ?? next.get(n.parentId) : undefined
        const angle = Math.random() * Math.PI * 2
        const dist = 60 + Math.random() * 40
        return {
          id: n.id,
          radius: n.radius,
          parentId: n.parentId,
          x: (parent?.x ?? 0) + Math.cos(angle) * dist,
          y: (parent?.y ?? 0) + Math.sin(angle) * dist,
        }
      }
      // Parents first so children can be seeded near them
      const ordered = [...g.nodes].sort((a, b) => (a.id === SKILL_ID ? -1 : b.id === SKILL_ID ? 1 : 0))
      for (const n of ordered) next.set(n.id, make(n))

      // Drop pins for nodes that disappeared
      userPinned.current.forEach((id) => {
        if (!next.has(id)) userPinned.current.delete(id)
      })
      // Anchor the hub so the graph doesn't drift, unless the user moved it
      const skill = next.get(SKILL_ID)
      if (skill && !userPinned.current.has(SKILL_ID)) {
        skill.fx = 0
        skill.fy = 0
      }
      nodesRef.current = next

      const links: SimLink[] = g.edges
        .filter((e) => next.has(e.source) && next.has(e.target))
        .map((e) => ({ source: e.source, target: e.target, relation: e.relation, weight: e.weight }))

      simRef.current?.stop()
      const sim = forceSimulation<SimNode>([...next.values()])
        .force(
          'link',
          forceLink<SimNode, SimLink>(links)
            .id((d) => d.id)
            .distance((l) => LINK_DISTANCE[l.relation])
            .strength((l) => LINK_STRENGTH[l.relation]),
        )
        .force('charge', forceManyBody<SimNode>().strength((d) => -120 - d.radius * 6).distanceMax(420))
        .force('collide', forceCollide<SimNode>().radius((d) => d.radius + 14).strength(0.9))
        .force('x', forceX<SimNode>(0).strength(0.02))
        .force('y', forceY<SimNode>(0).strength(0.02))
        .alphaDecay(0.035)
        .on('tick', emit)
      sim.alpha(reset || added > 0 ? (reset ? 1 : 0.5) : 0.15).restart()
      simRef.current = sim
      emit()
    },
    [emit],
  )

  useEffect(() => {
    rebuild(graph, false)
  }, [graph, rebuild])

  useEffect(
    () => () => {
      simRef.current?.stop()
    },
    [],
  )

  const pin = useCallback(
    (id: string, x: number, y: number) => {
      const n = nodesRef.current.get(id)
      if (!n) return
      n.fx = x
      n.fy = y
      userPinned.current.add(id)
      simRef.current?.alphaTarget(0.25).restart()
    },
    [],
  )

  const endDrag = useCallback(() => {
    simRef.current?.alphaTarget(0)
  }, [])

  const release = useCallback((id: string) => {
    const n = nodesRef.current.get(id)
    if (!n) return
    userPinned.current.delete(id)
    if (id === SKILL_ID) {
      n.fx = 0
      n.fy = 0
    } else {
      n.fx = null
      n.fy = null
    }
    simRef.current?.alpha(0.4).restart()
  }, [])

  const releaseAll = useCallback(() => {
    userPinned.current.forEach((id) => release(id))
    userPinned.current.clear()
  }, [release])

  const relayout = useCallback(() => rebuild(graph, true), [graph, rebuild])

  const isPinned = useCallback((id: string) => userPinned.current.has(id), [])

  return { pin, endDrag, release, releaseAll, relayout, isPinned }
}
