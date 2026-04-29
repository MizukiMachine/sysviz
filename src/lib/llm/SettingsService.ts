const STORAGE_KEY = 'sysviz-llm-settings';

export type LLMProvider = 'gemini' | 'glm';

export interface LLMSettings {
  provider: LLMProvider;
  gemini: { apiKey: string; model: string };
  glm: { apiKey: string; model: string };
}

export const PROVIDER_BASE_URLS: Record<LLMProvider, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  glm: '/api/glm',
};

export const DEFAULT_SETTINGS: LLMSettings = {
  provider: 'gemini',
  gemini: { apiKey: '', model: 'gemini-2.0-flash' },
  glm: { apiKey: '', model: 'glm-5.1' },
};

export const loadSettings = (): LLMSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(stored);

    // Migrate old provider names
    let provider: LLMProvider = DEFAULT_SETTINGS.provider;
    if (parsed.provider === 'gemini' || parsed.provider === 'glm') {
      provider = parsed.provider;
    } else if (parsed.provider === 'openai' || parsed.provider === 'anthropic') {
      provider = 'glm';
    }

    return {
      provider,
      gemini: { ...DEFAULT_SETTINGS.gemini, ...(parsed.gemini || {}) },
      glm: { ...DEFAULT_SETTINGS.glm, ...(parsed.glm || {}) },
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
  return {
    provider: settings.provider,
    apiKey: cfg.apiKey,
    model: cfg.model,
    baseUrl: PROVIDER_BASE_URLS[settings.provider],
  };
};
