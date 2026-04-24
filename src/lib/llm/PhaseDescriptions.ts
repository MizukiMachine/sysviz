import type { ViewConfig } from '@/types/visualization';

const PHASE_DESCRIPTIONS: Record<string, string> = {
  'mermaid-data-flow': `この可視化は、Mermaid flowchart（.mmdファイル）から自動生成されたデータフロー図です。`,
  'mermaid-fastapi-data-flow': `この可視化は、FastAPI の OpenAPI 生成とランタイム検証の流れを Mermaid flowchart から自動生成した図です。`,
  'mermaid-fastapi-sequence-request': `この可視化は、FastAPI のリクエスト処理ライフサイクルを Mermaid sequenceDiagram から自動生成した図です。`,
};

export function getPhaseDescriptions(viewName: string): string {
  return PHASE_DESCRIPTIONS[viewName] || 'この可視化の詳細な説明はまだ登録されていません。';
}

/**
 * ViewConfigのsubgraph・ノード情報からフェーズ説明を動的生成。
 * ViewConfigが渡されない場合はフォールバックとして固定文字列を返す。
 */
export function buildPhaseDescriptionFromConfig(
  viewName: string,
  viewConfig: ViewConfig | null,
): string {
  if (!viewConfig) return getPhaseDescriptions(viewName);

  const { subgraphs, nodeSubgraphs, nodes } = viewConfig;
  if (subgraphs.size === 0) return getPhaseDescriptions(viewName);

  // subgraph → ノード名リスト のマッピングを構築
  const phaseLines: string[] = [];

  for (const [subgraphId, sg] of subgraphs) {
    const memberNames = nodes
      .filter((n) => nodeSubgraphs.get(n.id) === subgraphId)
      .map((n) => n.name);

    if (memberNames.length > 0) {
      phaseLines.push(`- **${sg.title}**: ${memberNames.join(', ')}`);
    }
  }

  if (phaseLines.length === 0) return getPhaseDescriptions(viewName);

  return `この可視化は以下のフェーズで構成されています:\n${phaseLines.join('\n')}`;
}
