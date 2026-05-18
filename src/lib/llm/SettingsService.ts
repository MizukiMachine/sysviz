const STORAGE_KEY = 'sysviz-llm-settings';

export interface LLMSettings {
  apiKey?: string;
  model: string;
}

export const DEFAULT_SETTINGS: LLMSettings = {
  model: 'glm-5.1',
};

export const GLM_BASE_URL = '/api/glm';

export const loadSettings = (): LLMSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(stored);

    // Migrate old multi-provider format
    if (parsed.glm) {
      return { model: parsed.glm.model || DEFAULT_SETTINGS.model };
    }

    return {
      model: parsed.model || DEFAULT_SETTINGS.model,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: LLMSettings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ model: settings.model }));
};

export const getActiveConfig = (settings: LLMSettings) => {
  return {
    apiKey: settings.apiKey || undefined,
    model: settings.model,
    baseUrl: GLM_BASE_URL,
  };
};
