import axios from 'axios'
import type { StaticValidationResult, LLMValidationResult, ProviderConfig } from './types'

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 180_000, // 180s — local models are slow; a truncated JSON reply is retried once
})

export async function validateStatic(content: string): Promise<StaticValidationResult> {
  const { data } = await api.post<StaticValidationResult>('/validate/static', { content })
  return data
}

export async function validateLLM(
  content: string,
  config: ProviderConfig,
): Promise<LLMValidationResult> {
  const { data } = await api.post<LLMValidationResult>('/validate/llm', {
    content,
    provider: config.provider,
    model: config.model,
    api_key: config.api_key || null,
    base_url: config.base_url || null,
  })
  return data
}

import type {
  RepairPlanResult,
  LLMRefactorResult,
  ScenarioSuite,
  TrajectoryProfileReport,
  DiffReport,
} from './types'

export async function getRepairPlan(content: string): Promise<RepairPlanResult> {
  const { data } = await api.post<RepairPlanResult>('/repair/plan', { content })
  return data
}

export async function applyRepairs(
  content: string,
): Promise<{ repaired_content: string; repairs_count: number; diff: DiffReport }> {
  const { data } = await api.post<{ repaired_content: string; repairs_count: number; diff: DiffReport }>(
    '/repair/apply',
    { content },
  )
  return data
}

export async function refactorWithLLM(
  content: string,
  config: ProviderConfig,
  issues?: string[],
): Promise<LLMRefactorResult> {
  const { data } = await api.post<LLMRefactorResult>('/repair/refactor-llm', {
    content,
    provider: config.provider,
    model: config.model,
    api_key: config.api_key || null,
    base_url: config.base_url || null,
    issues: issues || null,
  })
  return data
}

export async function generateScenarios(
  content: string,
  count = 12,
  config?: ProviderConfig | null,
): Promise<ScenarioSuite> {
  const { data } = await api.post<ScenarioSuite>('/scenarios/generate', {
    content,
    count,
    provider: config?.provider || null,
    model: config?.model || null,
    api_key: config?.api_key || null,
    base_url: config?.base_url || null,
  })
  return data
}

export async function exportScenarios(
  suite: ScenarioSuite,
  format: 'json' | 'pytest' | 'markdown' = 'json',
): Promise<{ content: string; filename: string; format: string }> {
  const { data } = await api.post<{ content: string; filename: string; format: string }>(
    '/scenarios/export',
    { suite, format },
  )
  return data
}

export async function profileTrajectory(
  trace: any,
  skillContent?: string,
  baselineSteps?: number,
): Promise<TrajectoryProfileReport> {
  const { data } = await api.post<TrajectoryProfileReport>('/profiler/trajectory', {
    trace,
    skill_content: skillContent || null,
    baseline_steps: baselineSteps || null,
  })
  return data
}
