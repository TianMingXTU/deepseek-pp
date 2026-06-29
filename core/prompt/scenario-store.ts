import type { AgentScenario } from './types';

const STORAGE_KEY = 'deepseek_pp_agent_scenario';
const DEFAULT_SCENARIO: AgentScenario = 'chat';

/**
 * Get the currently selected agent scenario from storage.
 * Defaults to 'chat' when nothing is stored.
 */
export async function getAgentScenario(): Promise<AgentScenario> {
  const data = await chrome.storage.local.get(STORAGE_KEY) as Record<string, unknown>;
  return normalizeAgentScenario(data[STORAGE_KEY]);
}

/**
 * Save the agent scenario to storage and broadcast the change.
 */
export async function saveAgentScenario(scenario: AgentScenario): Promise<void> {
  const normalized = normalizeAgentScenario(scenario);
  await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
}

/**
 * Normalize an unknown value to a valid AgentScenario.
 */
export function normalizeAgentScenario(value: unknown): AgentScenario {
  if (value === 'chat' || value === 'coding' || value === 'browsing' || value === 'automation') {
    return value;
  }
  return DEFAULT_SCENARIO;
}
