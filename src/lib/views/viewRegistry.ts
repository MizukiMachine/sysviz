export const VIEW_OPTIONS = [
  { value: 'mermaid-layered-architecture', label: 'Flask: Layered Architecture (.mmd)' },
  { value: 'mermaid-component', label: 'Flask: Component (.mmd)' },
  { value: 'mermaid-data-flow', label: 'Flask: Data Flow (.mmd)' },
  { value: 'mermaid-dependency', label: 'Flask: Dependency (.mmd)' },
  { value: 'mermaid-sequence-request', label: 'Flask: Request Lifecycle (sequenceDiagram)' },
  { value: 'mermaid-fastapi-layered-architecture', label: 'FastAPI: Layered Architecture (.mmd)' },
  { value: 'mermaid-fastapi-component', label: 'FastAPI: Component (.mmd)' },
  { value: 'mermaid-fastapi-sequence-request', label: 'FastAPI: Request Lifecycle (sequenceDiagram)' },
  { value: 'mermaid-fastapi-dependency', label: 'FastAPI: Dependency Injection (.mmd)' },
  { value: 'mermaid-fastapi-data-flow', label: 'FastAPI: Data Flow / OpenAPI (.mmd)' },
] as const;

export type VisualizationKey = (typeof VIEW_OPTIONS)[number]['value'];

export const DEFAULT_VIEW: VisualizationKey = 'mermaid-data-flow';

export const VIEW_LABELS: Record<VisualizationKey, string> = {
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

export const MERMAID_PATHS: Record<VisualizationKey, string> = {
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
