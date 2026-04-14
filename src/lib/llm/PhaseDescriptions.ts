const PHASE_DESCRIPTIONS: Record<string, string> = {
  'mermaid-data-flow': `この可視化は、Mermaid flowchart（.mmdファイル）から自動生成されたFlaskデータフロー図です。`,
};

export function getPhaseDescriptions(viewName: string): string {
  return PHASE_DESCRIPTIONS[viewName] || 'この可視化の詳細な説明はまだ登録されていません。';
}
