export const VIEW_OPTIONS = [
  { value: 'mermaid-data-flow', label: 'Flask: Data Flow (.mmd)' },
] as const;

export type VisualizationKey = (typeof VIEW_OPTIONS)[number]['value'];

export const DEFAULT_VIEW: VisualizationKey = VIEW_OPTIONS[0].value;

export const VIEW_LABELS: Record<VisualizationKey, string> = {
  'mermaid-data-flow': 'Flask Data Flow (from Mermaid)',
};

export const MERMAID_DATA_FLOW_PATH = '/data/03_data_flow.mmd';
