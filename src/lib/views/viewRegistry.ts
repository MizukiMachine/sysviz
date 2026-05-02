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

export function deriveLabel(entry: DiagramEntry): string {
  if (entry.label) return entry.label;
  if (entry.filePath) {
    const name = entry.filePath.split('/').pop()?.replace(/\.mmd$/i, '') ?? entry.id;
    return name
      .replace(/^\d+[_\-]/, '')
      .replace(/[_\-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return entry.id;
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

// Flask was the original project; its legacy mermaid keys omit the "flask-" prefix
// (e.g. "flask-component" → "mermaid-component", not "mermaid-flask-component").
function toMermaidKey(projectId: string, diagramId: string): string {
  if (projectId === 'flask') {
    return `mermaid-${diagramId.slice(projectId.length + 1)}`;
  }
  return `mermaid-${diagramId}`;
}

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

export const BUILTIN_VIEW_OPTIONS = BUILTIN_PROJECTS.flatMap((project) =>
  project.diagrams.map((diagram) => ({
    value: toMermaidKey(project.id, diagram.id),
    label: `${project.label}: ${diagram.label} (${diagram.diagramType === 'sequence' ? 'sequenceDiagram' : '.mmd'})`,
    source: 'builtin' as const,
  })),
) satisfies readonly ViewEntry[];

export const VIEW_OPTIONS: ViewEntry[] = [...BUILTIN_VIEW_OPTIONS];

export type VisualizationKey = string;

export const DEFAULT_VIEW = 'flask-data-flow';

export const VIEW_LABELS: Record<string, string> = Object.fromEntries(
  BUILTIN_PROJECTS.flatMap((project) =>
    project.diagrams.map((d) => [d.id, `${project.label} ${d.label}`]),
  ),
);

// Legacy path mapping (kept for GitLab compatibility)
export const MERMAID_PATHS: Record<string, string> = Object.fromEntries(
  BUILTIN_PROJECTS.flatMap((project) =>
    project.diagrams
      .filter((d) => d.filePath != null)
      .map((d) => [toMermaidKey(project.id, d.id), d.filePath as string]),
  ),
);

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
