const STORAGE_KEY = 'sysviz-gitlab-settings';

export interface GitLabSettings {
  enabled: boolean;
  baseUrl: string;
  token: string;
  sysvizProjectPath: string;
  targetProjectPath: string;
  targetRef: string;
}

export const DEFAULT_GITLAB_SETTINGS: GitLabSettings = {
  enabled: false,
  baseUrl: '',
  token: '',
  sysvizProjectPath: '',
  targetProjectPath: '',
  targetRef: 'main',
};

export function loadGitLabSettings(): GitLabSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GITLAB_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed.enabled ?? DEFAULT_GITLAB_SETTINGS.enabled,
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : DEFAULT_GITLAB_SETTINGS.baseUrl,
      token: typeof parsed.token === 'string' ? parsed.token : DEFAULT_GITLAB_SETTINGS.token,
      sysvizProjectPath: typeof parsed.sysvizProjectPath === 'string'
        ? parsed.sysvizProjectPath
        : typeof parsed.projectPath === 'string'
          ? parsed.projectPath
          : DEFAULT_GITLAB_SETTINGS.sysvizProjectPath,
      targetProjectPath: typeof parsed.targetProjectPath === 'string'
        ? parsed.targetProjectPath
        : DEFAULT_GITLAB_SETTINGS.targetProjectPath,
      targetRef: typeof parsed.targetRef === 'string' && parsed.targetRef.trim()
        ? parsed.targetRef
        : typeof parsed.branch === 'string' && parsed.branch.trim()
          ? parsed.branch
          : DEFAULT_GITLAB_SETTINGS.targetRef,
    };
  } catch {
    return DEFAULT_GITLAB_SETTINGS;
  }
}

export function saveGitLabSettings(settings: GitLabSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function isGitLabConfigured(settings: GitLabSettings): boolean {
  return Boolean(
    settings.enabled &&
    settings.baseUrl.trim() &&
    settings.token.trim() &&
    settings.sysvizProjectPath.trim() &&
    settings.targetProjectPath.trim() &&
    settings.targetRef.trim()
  );
}
