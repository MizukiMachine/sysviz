import type { GitLabManifestDiagram } from '@/lib/gitlab/GitLabService';

// ---------------------------------------------------------------------------
// Diagram Entry
// ---------------------------------------------------------------------------

export interface DiagramEntry {
  id: string;
  label: string;
  filePath?: string;
  diagramType?: 'flowchart' | 'sequence';
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export interface Project {
  id: string;
  label: string;
  diagrams: readonly DiagramEntry[];
}

// ---------------------------------------------------------------------------
// Built-in projects & diagrams
// ---------------------------------------------------------------------------

export const BUILTIN_PROJECTS = [
  {
    id: 'flask',
    label: 'Flask',
    diagrams: [
      { id: 'flask-layered-architecture', label: 'Layered Architecture', filePath: '/data/01_layered_architecture.mmd', diagramType: 'flowchart' as const },
      { id: 'flask-component', label: 'Component', filePath: '/data/02_component.mmd', diagramType: 'flowchart' as const },
      { id: 'flask-data-flow', label: 'Data Flow', filePath: '/data/03_data_flow.mmd', diagramType: 'flowchart' as const },
      { id: 'flask-dependency', label: 'Dependency', filePath: '/data/04_dependency.mmd', diagramType: 'flowchart' as const },
      { id: 'flask-sequence-request', label: 'Request Lifecycle', filePath: '/data/05_sequence_request_lifecycle.mmd', diagramType: 'sequence' as const },
    ],
  },
  {
    id: 'fastapi',
    label: 'FastAPI',
    diagrams: [
      { id: 'fastapi-layered-architecture', label: 'Layered Architecture', filePath: '/data/11_fastapi_layered_architecture.mmd', diagramType: 'flowchart' as const },
      { id: 'fastapi-component', label: 'Component', filePath: '/data/12_fastapi_component.mmd', diagramType: 'flowchart' as const },
      { id: 'fastapi-sequence-request', label: 'Request Lifecycle', filePath: '/data/13_fastapi_sequence_request_lifecycle.mmd', diagramType: 'sequence' as const },
      { id: 'fastapi-dependency', label: 'Dependency Injection', filePath: '/data/14_fastapi_dependency_injection.mmd', diagramType: 'flowchart' as const },
      { id: 'fastapi-data-flow', label: 'Data Flow / OpenAPI', filePath: '/data/15_fastapi_data_flow_openapi.mmd', diagramType: 'flowchart' as const },
    ],
  },
] as const satisfies readonly Project[];

// ---------------------------------------------------------------------------
// Legacy view system (kept for backward compatibility with GitLab integration)
// ---------------------------------------------------------------------------

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

export const DEFAULT_VIEW = 'flask-data-flow';

export const VIEW_LABELS: Record<string, string> = {
  'flask-layered-architecture': 'Flask Layered Architecture',
  'flask-component': 'Flask Component',
  'flask-data-flow': 'Flask Data Flow',
  'flask-dependency': 'Flask Dependency',
  'flask-sequence-request': 'Flask Request Lifecycle',
  'fastapi-layered-architecture': 'FastAPI Layered Architecture',
  'fastapi-component': 'FastAPI Component',
  'fastapi-sequence-request': 'FastAPI Request Lifecycle',
  'fastapi-dependency': 'FastAPI Dependency Injection',
  'fastapi-data-flow': 'FastAPI Data Flow / OpenAPI',
};

// Legacy path mapping (kept for GitLab compatibility)
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

// ---------------------------------------------------------------------------
// GitLab helpers
// ---------------------------------------------------------------------------

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

export function createGitLabProject(diagram: GitLabManifestDiagram): Project {
  return {
    id: `gitlab:${diagram.file}`,
    label: diagram.label,
    diagrams: [
      {
        id: `${GITLAB_VIEW_PREFIX}${diagram.file}`,
        label: diagram.label,
        filePath: diagram.file,
        diagramType: diagram.type,
      },
    ],
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
