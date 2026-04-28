import type { GitLabManifestDiagram } from '@/lib/gitlab/GitLabService';

export interface ViewEntry {
  value: string;
  label: string;
  source: 'builtin' | 'gitlab';
  filePath?: string;
  diagramType?: 'flowchart' | 'sequence';
}

export const BUILTIN_VIEW_OPTIONS = [
  { value: 'mermaid-layered-architecture', label: 'Flask: Layered Architecture (.mmd)', source: 'builtin' },
  { value: 'mermaid-component', label: 'Flask: Component (.mmd)', source: 'builtin' },
  { value: 'mermaid-data-flow', label: 'Flask: Data Flow (.mmd)', source: 'builtin' },
  { value: 'mermaid-dependency', label: 'Flask: Dependency (.mmd)', source: 'builtin' },
  { value: 'mermaid-sequence-request', label: 'Flask: Request Lifecycle (sequenceDiagram)', source: 'builtin' },
  { value: 'mermaid-fastapi-layered-architecture', label: 'FastAPI: Layered Architecture (.mmd)', source: 'builtin' },
  { value: 'mermaid-fastapi-component', label: 'FastAPI: Component (.mmd)', source: 'builtin' },
  { value: 'mermaid-fastapi-sequence-request', label: 'FastAPI: Request Lifecycle (sequenceDiagram)', source: 'builtin' },
  { value: 'mermaid-fastapi-dependency', label: 'FastAPI: Dependency Injection (.mmd)', source: 'builtin' },
  { value: 'mermaid-fastapi-data-flow', label: 'FastAPI: Data Flow / OpenAPI (.mmd)', source: 'builtin' },
] as const satisfies readonly ViewEntry[];

export const VIEW_OPTIONS: ViewEntry[] = [...BUILTIN_VIEW_OPTIONS];

export type VisualizationKey = string;

export const DEFAULT_VIEW = 'mermaid-data-flow';

export const VIEW_LABELS: Record<string, string> = {
  'mermaid-layered-architecture': 'Flask Layered Architecture (from Mermaid)',
  'mermaid-component': 'Flask Component (from Mermaid)',
  'mermaid-data-flow': 'Flask Data Flow (from Mermaid)',
  'mermaid-dependency': 'Flask Dependency (from Mermaid)',
  'mermaid-sequence-request': 'Flask Request Lifecycle (from Mermaid sequenceDiagram)',
  'mermaid-fastapi-layered-architecture': 'FastAPI Layered Architecture (from Mermaid)',
  'mermaid-fastapi-component': 'FastAPI Component (from Mermaid)',
  'mermaid-fastapi-sequence-request': 'FastAPI Request Lifecycle (from Mermaid sequenceDiagram)',
  'mermaid-fastapi-dependency': 'FastAPI Dependency Injection (from Mermaid)',
  'mermaid-fastapi-data-flow': 'FastAPI Data Flow / OpenAPI (from Mermaid)',
};

export const MERMAID_PATHS: Record<string, string> = {
  'mermaid-layered-architecture': '/data/01_layered_architecture.mmd',
  'mermaid-component': '/data/02_component.mmd',
  'mermaid-data-flow': '/data/03_data_flow.mmd',
  'mermaid-dependency': '/data/04_dependency.mmd',
  'mermaid-sequence-request': '/data/05_sequence_request_lifecycle.mmd',
  'mermaid-fastapi-layered-architecture': '/data/11_fastapi_layered_architecture.mmd',
  'mermaid-fastapi-component': '/data/12_fastapi_component.mmd',
  'mermaid-fastapi-sequence-request': '/data/13_fastapi_sequence_request_lifecycle.mmd',
  'mermaid-fastapi-dependency': '/data/14_fastapi_dependency_injection.mmd',
  'mermaid-fastapi-data-flow': '/data/15_fastapi_data_flow_openapi.mmd',
};

const GITLAB_VIEW_PREFIX = 'gitlab:';

export function createGitLabViewEntry(diagram: GitLabManifestDiagram): ViewEntry {
  return {
    value: `${GITLAB_VIEW_PREFIX}${diagram.file}`,
    label: diagram.label,
    source: 'gitlab',
    filePath: diagram.file,
    diagramType: diagram.type,
  };
}

export function isGitLabView(viewKey: string): boolean {
  return viewKey.startsWith(GITLAB_VIEW_PREFIX);
}

export function resolveGitLabFilePath(viewKey: string): string {
  if (!isGitLabView(viewKey)) {
    throw new Error(`Not a GitLab view: ${viewKey}`);
  }
  return viewKey.slice(GITLAB_VIEW_PREFIX.length);
}
