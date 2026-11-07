import { describe, expect, it } from 'vitest'
import type { ResolvedFileReference, SkillPackageSummary, StaticFinding } from '../../../types'
import { buildGraph, DEFAULT_LAYERS, neighborIds, radiusFromTokens } from './buildGraph'

const file = (p: Partial<ResolvedFileReference> & { relative_path: string }): ResolvedFileReference => ({
  kind: 'reference',
  status: 'found',
  size_bytes: 10,
  line_count: 1,
  token_count: 100,
  is_binary: false,
  ...p,
})

const pkg = (files: ResolvedFileReference[]): SkillPackageSummary => ({
  base_dir: '/x',
  resolved_files: files,
  tokens: {
    catalog_tokens: 1,
    activation_tokens: 200,
    on_demand_tokens_by_file: {},
    total_on_demand_tokens: 0,
    peak_context_footprint: 0,
    budget_status: 'within_budget',
  },
  missing_files_count: 0,
  found_files_count: files.length,
})

describe('buildGraph', () => {
  it('returns empty graph without a package', () => {
    expect(buildGraph(null)).toEqual({ nodes: [], edges: [] })
  })

  it('builds skill -> kind -> dir -> file chains', () => {
    const g = buildGraph(pkg([file({ relative_path: 'references/deep/a.md' })]))
    const ids = g.nodes.map((n) => n.id)
    expect(ids).toContain('skill')
    expect(ids).toContain('kind:reference')
    expect(ids).toContain('dir:reference:references')
    expect(ids).toContain('dir:reference:references/deep')
    expect(ids).toContain('file:references/deep/a.md')
    expect(g.edges.filter((e) => e.relation === 'contains')).toHaveLength(4)
  })

  it('skips directory nodes when the dirs layer is off', () => {
    const g = buildGraph(pkg([file({ relative_path: 'references/a.md' })]), [], {
      ...DEFAULT_LAYERS,
      dirs: false,
    })
    expect(g.nodes.some((n) => n.type === 'dir')).toBe(false)
    expect(g.edges.some((e) => e.source === 'kind:reference' && e.target === 'file:references/a.md')).toBe(true)
  })

  it('adds cross-reference edges only between known files', () => {
    const g = buildGraph(
      pkg([
        file({ relative_path: 'a.md', references: ['b.md', 'ghost.md'] }),
        file({ relative_path: 'b.md' }),
      ]),
    )
    const refs = g.edges.filter((e) => e.relation === 'references')
    expect(refs).toHaveLength(1)
    expect(refs[0]).toMatchObject({ source: 'file:a.md', target: 'file:b.md' })
  })

  it('links findings to the file named in the message, else the skill', () => {
    const findings: StaticFinding[] = [
      { dimension: 'd', rule: 'r1', status: 'warn', message: 'Problem in scripts/run.py', suggestion: '' },
      { dimension: 'd', rule: 'r2', status: 'fail', message: 'General issue', suggestion: '' },
      { dimension: 'd', rule: 'r3', status: 'pass', message: 'ok', suggestion: '' },
    ]
    const g = buildGraph(
      pkg([file({ relative_path: 'scripts/run.py', kind: 'script' })]),
      findings,
      { ...DEFAULT_LAYERS, findings: true },
    )
    const flags = g.edges.filter((e) => e.relation === 'flags')
    expect(flags).toHaveLength(2)
    expect(flags.find((e) => e.source === 'finding:0')?.target).toBe('file:scripts/run.py')
    expect(flags.find((e) => e.source === 'finding:1')?.target).toBe('skill')
  })

  it('clamps token-based radius', () => {
    expect(radiusFromTokens(0)).toBe(14)
    expect(radiusFromTokens(1e9)).toBe(36)
    expect(radiusFromTokens(2000)).toBeGreaterThan(radiusFromTokens(100))
  })

  it('computes 1-hop neighbours', () => {
    const g = buildGraph(pkg([file({ relative_path: 'a.md' })]), [], { ...DEFAULT_LAYERS, dirs: false })
    expect([...neighborIds(g.edges, 'kind:reference')].sort()).toEqual(['file:a.md', 'kind:reference', 'skill'])
  })
})
