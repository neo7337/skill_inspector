import type { ResolvedFileReference, SkillPackageSummary, StaticFinding } from '../../../types'

export type GraphNodeType = 'skill' | 'kind' | 'dir' | 'file' | 'finding'
export type EdgeRelation = 'contains' | 'references' | 'flags'
export type FileKind = 'reference' | 'script' | 'asset' | 'other'

export interface GraphNode {
  id: string
  type: GraphNodeType
  label: string
  /** Visual radius used for rendering and collision */
  radius: number
  kind?: FileKind
  file?: ResolvedFileReference
  finding?: StaticFinding
  tokens?: number
  parentId?: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  relation: EdgeRelation
  weight: number
}

export interface GraphLayers {
  dirs: boolean
  findings: boolean
  crossRefs: boolean
}

export const DEFAULT_LAYERS: GraphLayers = { dirs: true, findings: false, crossRefs: true }

export interface BuiltGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const KIND_ORDER: FileKind[] = ['reference', 'script', 'asset', 'other']
const KIND_LABEL: Record<FileKind, string> = {
  reference: 'References',
  script: 'Scripts',
  asset: 'Assets',
  other: 'Other',
}

export const SKILL_ID = 'skill'
export const kindId = (k: FileKind) => `kind:${k}`
export const dirId = (kind: FileKind, path: string) => `dir:${kind}:${path}`
export const fileId = (path: string) => `file:${path}`
export const findingId = (i: number) => `finding:${i}`

/** sqrt-scaled radius from a token count, clamped to [min, max]. */
export function radiusFromTokens(tokens: number, min = 14, max = 36): number {
  if (!tokens || tokens <= 0) return min
  const r = min + Math.sqrt(tokens) * 0.45
  return Math.max(min, Math.min(max, r))
}

export function normalizeKind(kind: string): FileKind {
  return (KIND_ORDER as string[]).includes(kind) ? (kind as FileKind) : 'other'
}

const normPath = (p: string) =>
  p
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\/+/, '')

/** Find the file a finding talks about by looking for its path in the message. */
export function findFindingTarget(
  finding: StaticFinding,
  files: ResolvedFileReference[],
): ResolvedFileReference | undefined {
  const text = `${finding.message} ${finding.suggestion ?? ''}`
  // Prefer the longest match so "refs/a/b.md" wins over "b.md"
  return [...files]
    .sort((a, b) => b.relative_path.length - a.relative_path.length)
    .find((f) => text.includes(f.relative_path))
}

export function buildGraph(
  pkg: SkillPackageSummary | null | undefined,
  findings: StaticFinding[] = [],
  layers: GraphLayers = DEFAULT_LAYERS,
  skillName = 'SKILL.md',
): BuiltGraph {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  if (!pkg) return { nodes, edges }

  const edgeIds = new Set<string>()
  const addEdge = (source: string, target: string, relation: EdgeRelation, weight = 1) => {
    const id = `${relation}:${source}->${target}`
    if (edgeIds.has(id)) return
    edgeIds.add(id)
    edges.push({ id, source, target, relation, weight })
  }

  const files = pkg.resolved_files ?? []
  nodes.push({
    id: SKILL_ID,
    type: 'skill',
    label: skillName,
    radius: radiusFromTokens(pkg.tokens?.activation_tokens ?? 0, 34, 52),
    tokens: pkg.tokens?.activation_tokens,
  })

  const presentKinds = KIND_ORDER.filter((k) => files.some((f) => normalizeKind(f.kind) === k))
  for (const k of presentKinds) {
    const total = files
      .filter((f) => normalizeKind(f.kind) === k)
      .reduce((s, f) => s + (f.token_count || 0), 0)
    nodes.push({ id: kindId(k), type: 'kind', label: KIND_LABEL[k], kind: k, radius: 22, tokens: total })
    addEdge(SKILL_ID, kindId(k), 'contains', 2)
  }

  const knownFileIds = new Map<string, string>() // normalized path -> node id
  for (const f of files) {
    const kind = normalizeKind(f.kind)
    const fid = fileId(f.relative_path)
    if (knownFileIds.has(normPath(f.relative_path))) continue
    knownFileIds.set(normPath(f.relative_path), fid)

    const segments = normPath(f.relative_path).split('/').filter(Boolean)
    const name = segments[segments.length - 1] ?? f.relative_path
    let parent = kindId(kind)

    if (layers.dirs) {
      let acc = ''
      for (const seg of segments.slice(0, -1)) {
        acc = acc ? `${acc}/${seg}` : seg
        const did = dirId(kind, acc)
        if (!nodes.some((n) => n.id === did)) {
          nodes.push({ id: did, type: 'dir', label: seg, kind, radius: 13, parentId: parent })
        }
        addEdge(parent, did, 'contains', 1.5)
        parent = did
      }
    }

    nodes.push({
      id: fid,
      type: 'file',
      label: name,
      kind,
      file: f,
      radius: radiusFromTokens(f.token_count),
      tokens: f.token_count,
      parentId: parent,
    })
    addEdge(parent, fid, 'contains', Math.max(1, Math.min(4, Math.sqrt(f.token_count || 0) / 8)))
  }

  if (layers.crossRefs) {
    for (const f of files) {
      for (const ref of f.references ?? []) {
        const target = knownFileIds.get(normPath(ref))
        const source = knownFileIds.get(normPath(f.relative_path))
        if (target && source && target !== source) addEdge(source, target, 'references', 1.5)
      }
    }
  }

  if (layers.findings) {
    findings.forEach((fd, i) => {
      if (fd.status === 'pass') return
      const id = findingId(i)
      nodes.push({
        id,
        type: 'finding',
        label: fd.rule,
        finding: fd,
        radius: 11,
      })
      const target = findFindingTarget(fd, files)
      addEdge(id, target ? fileId(target.relative_path) : SKILL_ID, 'flags', 1)
    })
  }

  return { nodes, edges }
}

/** Neighbour ids (1 hop) for hover highlighting. */
export function neighborIds(edges: GraphEdge[], id: string): Set<string> {
  const out = new Set<string>([id])
  for (const e of edges) {
    if (e.source === id) out.add(e.target)
    if (e.target === id) out.add(e.source)
  }
  return out
}
