// Types mirroring the FastAPI backend response models

export type RuleStatus = 'pass' | 'warn' | 'fail'

export type FixKind = 'frontmatter_field' | 'body_section' | 'text_replace'

export interface StaticFinding {
  dimension: string
  rule: string
  status: RuleStatus
  message: string
  suggestion: string
  // Structured fix fields (populated by backend for deterministic rules)
  fix_snippet?: string
  fix_kind?: FixKind
  fix_field?: string
  fix_replace_target?: string
}

export interface SkillTokenEstimate {
  catalog: number
  body: number
  total: number
}

export type ReferencedFileKind = 'reference' | 'script' | 'asset' | 'other'

export interface ReferencedFile {
  path: string
  kind: ReferencedFileKind
}

export type ReferenceFileStatus = 'found' | 'missing' | 'unreadable' | 'outside_root'

export interface ResolvedFileReference {
  relative_path: string
  kind: ReferencedFileKind | string
  status: ReferenceFileStatus
  absolute_path?: string | null
  size_bytes: number
  line_count: number
  token_count: number
  is_binary: boolean
  content_preview?: string | null
  error_message?: string | null
}

export type BudgetStatus = 'within_budget' | 'approaching_limit' | 'exceeds_budget'

export interface PackageTokenEconomy {
  catalog_tokens: number
  activation_tokens: number
  on_demand_tokens_by_file: Record<string, number>
  total_on_demand_tokens: number
  peak_context_footprint: number
  budget_status: BudgetStatus
}

export interface SkillPackageSummary {
  base_dir: string
  resolved_files: ResolvedFileReference[]
  tokens: PackageTokenEconomy
  missing_files_count: number
  found_files_count: number
  skill_content?: string
  skill_tokens?: SkillTokenEstimate
}

export type SkillPackageInspectionResult = SkillPackageSummary

export interface StaticValidationResult {
  findings: StaticFinding[]
  overall_status: RuleStatus
  score: number
  skill_tokens?: SkillTokenEstimate
  referenced_files?: ReferencedFile[]
  package?: SkillPackageSummary
  // Present when SKILL.md couldn't be parsed
  error?: string
  type?: 'parse_error'
}

// Structured LLM suggestion with optional example rewrite
export interface LLMSuggestion {
  text: string
  example?: string | null
}

export interface LLMDimensionResult {
  score: number
  status: RuleStatus
  findings: string[]
  suggestions: LLMSuggestion[]
}

export interface LLMValidationResult {
  description_quality: LLMDimensionResult
  instruction_clarity: LLMDimensionResult
  scope_and_boundaries: LLMDimensionResult
  token_efficiency: LLMDimensionResult
  overall_score: number
  overall_status: RuleStatus
  model_used: string
  provider_used: string
  skill_tokens?: SkillTokenEstimate
  referenced_files?: ReferencedFile[]
  package?: SkillPackageSummary
  package_tokens?: PackageTokenEconomy
  resolved_files?: ResolvedFileReference[]
}

export type LLMProvider = 'openai' | 'anthropic' | 'ollama'

export interface ProviderConfig {
  provider: LLMProvider
  model: string
  api_key: string
  base_url: string
  include_references?: boolean
}

export const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-haiku-20241022',
  ollama: 'llama3',
}

// Represents a fix that can be applied to the editor content
export interface ApplyableFix {
  kind: FixKind
  field?: string          // for frontmatter_field: the YAML key name
  snippet: string         // text to insert or replace with
  replaceTarget?: string  // for text_replace: the text to find
}

// ── Diff & Repair Types ──────────────────────────────────────────────────────

export interface DiffLine {
  type: 'add' | 'del' | 'context'
  line_number_old?: number | null
  line_number_new?: number | null
  content: string
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export interface DiffReport {
  unified_diff: string
  has_changes: boolean
  additions_count: number
  deletions_count: number
  hunks: DiffHunk[]
}

export interface RepairItem {
  id: string
  field_or_section: string
  title: string
  description: string
  is_safe: boolean
  original_value?: string | null
  repaired_value?: string | null
}

export interface RepairPlanResult {
  original_content: string
  repaired_content: string
  repairs_applied: RepairItem[]
  diff: DiffReport
}

export interface LLMRefactorResult {
  original_content: string
  refactored_content: string
  summary_of_changes: string[]
  diff: DiffReport
  provider_used: string
  model_used: string
}

// ── Synthetic Scenario Types ─────────────────────────────────────────────────

export type ScenarioCategory = 'happy_path' | 'adversarial' | 'tool_failure' | 'scope_boundary'

export interface MockToolCall {
  tool_name: string
  expected_args_pattern?: Record<string, any>
  mock_status: 'success' | 'error' | 'timeout' | 'rate_limit' | 'not_found'
  mock_output?: any
  simulated_error_message?: string
}

export interface TestScenario {
  id: string
  category: ScenarioCategory
  title: string
  description: string
  user_prompt: string
  mock_tools: MockToolCall[]
  expected_assertions: string[]
  max_step_budget: number
}

export interface ScenarioSuite {
  skill_name: string
  description: string
  total_scenarios: number
  categories_breakdown: Record<string, number>
  scenarios: TestScenario[]
  provider_used?: string | null
  model_used?: string | null
}

// ── Trajectory Profiler Types ────────────────────────────────────────────────

export type RedundancyKind =
  | 'repeated_search'
  | 'subsumed_file_read'
  | 'error_ping_pong'
  | 'no_op_mutation'
  | 'duplicate_tool_call'
  | 'undeclared_file_access'
  | 'redundant_reference_read'

export interface RedundantCallFinding {
  step_indices: number[]
  kind: RedundancyKind
  severity: 'warn' | 'fail'
  title: string
  detail: string
  suggested_skill_fix: string
}

export interface StepBudgetAnalysis {
  actual_steps: number
  baseline_steps: number
  variance_ratio: number
  status: 'pass' | 'warn' | 'fail'
  message: string
}

export interface TokenEfficiencyAnalysis {
  total_tokens: number
  redundant_tokens: number
  skill_context_tokens: number
  bloat_ratio: number
  score: number
  message: string
}

export interface TrajectoryTimelineStep {
  step_index: number
  tool_name: string
  is_error: boolean
  is_redundant: boolean
  duration_ms: number
  tokens: number
}

export interface ReferenceAccessAudit {
  declared_references: string[]
  accessed_files: string[]
  referenced_files_accessed: string[]
  unaccessed_references: string[]
  undeclared_accesses: string[]
  coverage_ratio: number
  coverage_pct: number
  redundant_reference_reads: string[]
  summary: string
}

export interface TrajectoryProfileReport {
  task_id: string
  skill_name: string
  overall_efficiency_score: number
  status: 'pass' | 'warn' | 'fail'
  step_budget: StepBudgetAnalysis
  token_efficiency: TokenEfficiencyAnalysis
  redundancies: RedundantCallFinding[]
  timeline_summary: TrajectoryTimelineStep[]
  reference_audit?: ReferenceAccessAudit | null
}
