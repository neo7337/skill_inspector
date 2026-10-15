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

export interface StaticValidationResult {
  findings: StaticFinding[]
  overall_status: RuleStatus
  score: number
  skill_tokens?: SkillTokenEstimate
  referenced_files?: ReferencedFile[]
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
}

export type LLMProvider = 'openai' | 'anthropic' | 'ollama'

export interface ProviderConfig {
  provider: LLMProvider
  model: string
  api_key: string
  base_url: string
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
