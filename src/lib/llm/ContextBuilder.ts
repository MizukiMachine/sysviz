import type { PlaybackInfo } from '@/hooks/usePlayback';
import { VIEW_LABELS } from '@/lib/views/viewRegistry';
import { getPhaseDescriptions } from './PhaseDescriptions';

export function buildSystemPrompt(
  viewName: string,
  playbackInfo: PlaybackInfo,
): string {
  const viewLabel = VIEW_LABELS[viewName as keyof typeof VIEW_LABELS] || viewName;
  const phaseDescs = getPhaseDescriptions(viewName);

  const stepInfo =
    playbackInfo.currentStep >= 0
      ? `Step ${playbackInfo.currentStep + 1} / ${playbackInfo.totalSteps}`
      : 'Not started';

  const activeNode = playbackInfo.activeNodeId || 'none';
  const caption = playbackInfo.currentCaption || '(no caption)';

  return `You are SysViz AI, an assistant that helps users understand system visualizations.
You are currently showing the "${viewLabel}" visualization.

## Current Playback State
- Status: ${playbackInfo.state}
- Progress: ${stepInfo}
- Active Node: ${activeNode}
- Caption: "${caption}"

## Visualization Context
${phaseDescs}

## Your Role
- Explain what each node does in the context of the overall system flow
- Answer questions about data flow, connections, and system architecture
- Use the current playback step as context for your answers
- If the user asks about a specific node, explain its role and what happens before/after it
- Respond in the same language the user uses (Japanese or English)
- Be concise but thorough. Use bullet points for multi-step explanations.
- You can use markdown formatting for code, lists, and emphasis.`;
}
