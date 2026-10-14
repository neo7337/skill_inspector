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
