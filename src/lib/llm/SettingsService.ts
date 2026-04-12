const STORAGE_KEY = 'sysviz-llm-settings';

export interface LLMSettings {
  provider: 'anthropic' | 'openai';
  anthropic: { apiKey: string; model: string };
  openai: { apiKey: string; model: string };
}

export const DEFAULT_SETTINGS: LLMSettings = {
  provider: 'anthropic',
  anthropic: { apiKey: '', model: 'claude-sonnet-4-20250514' },
  openai: { apiKey: '', model: 'gpt-4o' },
};

export const loadSettings = (): LLMSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(stored);
    // Deep merge to prevent missing nested keys
    return {
      provider: parsed.provider === 'anthropic' || parsed.provider === 'openai' ? parsed.provider : DEFAULT_SETTINGS.provider,
      anthropic: { ...DEFAULT_SETTINGS.anthropic, ...(parsed.anthropic || {}) },
      openai: { ...DEFAULT_SETTINGS.openai, ...(parsed.openai || {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: LLMSettings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const getActiveConfig = (settings: LLMSettings) => {
  const cfg = settings[settings.provider];
  if (!cfg?.apiKey) return null;
  return { provider: settings.provider, apiKey: cfg.apiKey, model: cfg.model };
};
