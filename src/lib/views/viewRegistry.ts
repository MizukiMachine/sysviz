export const VIEW_OPTIONS = [
  { value: 'mermaid-layered-architecture', label: 'Flask: Layered Architecture (.mmd)' },
  { value: 'mermaid-component', label: 'Flask: Component (.mmd)' },
  { value: 'mermaid-data-flow', label: 'Flask: Data Flow (.mmd)' },
  { value: 'mermaid-dependency', label: 'Flask: Dependency (.mmd)' },
] as const;

export type VisualizationKey = (typeof VIEW_OPTIONS)[number]['value'];

export const DEFAULT_VIEW: VisualizationKey = 'mermaid-data-flow';

export const VIEW_LABELS: Record<VisualizationKey, string> = {
  'mermaid-layered-architecture': 'Flask Layered Architecture (from Mermaid)',
  'mermaid-component': 'Flask Component (from Mermaid)',
  'mermaid-data-flow': 'Flask Data Flow (from Mermaid)',
  'mermaid-dependency': 'Flask Dependency (from Mermaid)',
};

export const MERMAID_PATHS: Record<VisualizationKey, string> = {
  'mermaid-layered-architecture': '/data/01_layered_architecture.mmd',
  'mermaid-component': '/data/02_component.mmd',
  'mermaid-data-flow': '/data/03_data_flow.mmd',
  'mermaid-dependency': '/data/04_dependency.mmd',
};
