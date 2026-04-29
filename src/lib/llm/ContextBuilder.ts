import type { ViewConfig } from '@/types/visualization';
import { VIEW_LABELS } from '@/lib/views/viewRegistry';
import { buildPhaseDescriptionFromConfig } from './PhaseDescriptions';

export function buildSystemPrompt(
  viewName: string,
  viewConfig: ViewConfig | null = null,
  rawMmdText: string = '',
): string {
  const viewLabel = VIEW_LABELS[viewName as keyof typeof VIEW_LABELS] || viewName;
  const phaseDescs = buildPhaseDescriptionFromConfig(viewName, viewConfig);

  return `You are SysViz AI, an assistant embedded in a 3D system visualization viewer.
Currently showing: "${viewLabel}"

## Visualization Context
${phaseDescs}

${viewConfig ? buildGraphStructureSection(viewConfig) : ''}

${rawMmdText ? buildDiagramSourceSection(rawMmdText) : ''}

## Response Guidelines
- ALWAYS respond in the SAME LANGUAGE as the user's question.
- Keep responses SHORT. Aim for 3-8 sentences for general questions. Never exceed 200 words unless the user explicitly asks for detail.
- For "explain the overall flow" type questions: give a high-level summary in 5-10 bullet points, not a step-by-step walkthrough.
- For questions about a specific node: explain its role in 2-4 sentences.
- Use markdown: **bold** for key terms, bullet lists for multiple items, \`code\` for technical terms.
- Never start with "Sure!" or "Here's". Get straight to the answer.
- If the question is vague, answer briefly and ask a focused follow-up.`;
}

function buildGraphStructureSection(viewConfig: ViewConfig): string {
  const { nodes, connections, subgraphs, nodeSubgraphs } = viewConfig;
  const sections: string[] = ['## Graph Structure'];

  // Nodes
  const nodeLines = nodes.map((n) => `- ${n.id}: ${n.name}`);
  sections.push('### Nodes');
  sections.push(nodeLines.join('\n'));

  // Subgraphs (phases)
  if (subgraphs.size > 0) {
    const sgLines: string[] = [];
    for (const [sgId, sg] of subgraphs) {
      const members = nodes
        .filter((n) => nodeSubgraphs.get(n.id) === sgId)
        .map((n) => n.id);
      sgLines.push(`- ${sg.title}: ${members.join(', ')}`);
    }
    sections.push('### Phases (Subgraphs)');
    sections.push(sgLines.join('\n'));
  }

  // Connections
  const connLines = connections.map((c) => {
    const label = c._label ? ` (${c._label})` : '';
    return `- ${c.sourceId} → ${c.targetId}${label}`;
  });
  sections.push('### Connections');
  sections.push(connLines.join('\n'));

  return sections.join('\n');
}

function buildDiagramSourceSection(rawMmdText: string): string {
  return `## Diagram Source (Mermaid)
\`\`\`mermaid
${rawMmdText}
\`\`\``;
}
