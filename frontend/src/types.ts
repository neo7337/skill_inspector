// Types mirroring the FastAPI backend response models

export type RuleStatus = 'pass' | 'warn' | 'fail'

export interface StaticFinding {
  dimension: string
  rule: string
  status: RuleStatus
  message: string
  suggestion: string
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

export interface LLMDimensionResult {
  score: number
  status: RuleStatus
  findings: string[]
  suggestions: string[]
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
