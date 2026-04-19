import type { ViewConfig, VisualizationResourceTimelineKeyframe, VisualizationTimelineKeyframe } from '@/types/visualization';
import { generateChat, type LLMConfig, type LLMMessage } from './LLMService';

type ActiveResourceKeyframe = Omit<VisualizationResourceTimelineKeyframe, 'status'> & { status: 'active' };

interface StepInfo {
  index: number;
  nodeId: string;
  nodeName: string;
  subgraphTitle: string | null;
  outgoing: { targetId: string; targetName: string; label: string | null }[];
  incoming: { sourceId: string; sourceName: string; label: string | null }[];
}

function isActiveResourceKeyframe(frame: VisualizationTimelineKeyframe): frame is ActiveResourceKeyframe {
  return frame.type === 'resource' && frame.status === 'active';
}

function keyframeCaptionKey(frame: ActiveResourceKeyframe): string {
  return `${frame.time}:${frame.id}`;
}

function extractSteps(config: ViewConfig): StepInfo[] {
  const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));
  const activeFrames = config.timeline.keyframes
    .filter(isActiveResourceKeyframe)
    .sort((a, b) => a.time - b.time);

  return activeFrames.map((frame, index) => {
    const node = nodeMap.get(frame.id);
    const nodeName = node?.name ?? frame.id;
    const sgId = config.nodeSubgraphs.get(frame.id);
    const sg = sgId ? config.subgraphs.get(sgId) : null;

    const outgoing = config.connections
      .filter((c) => c.sourceId === frame.id)
      .map((c) => {
        const target = nodeMap.get(c.targetId);
        return { targetId: c.targetId, targetName: target?.name ?? c.targetId, label: c._label ?? null };
      });

    const incoming = config.connections
      .filter((c) => c.targetId === frame.id)
      .map((c) => {
        const source = nodeMap.get(c.sourceId);
        return { sourceId: c.sourceId, sourceName: source?.name ?? c.sourceId, label: c._label ?? null };
      });

    return { index, nodeId: frame.id, nodeName, subgraphTitle: sg?.title ?? null, outgoing, incoming };
  });
}

function buildPrompt(steps: StepInfo[], config: ViewConfig): { system: string; user: string } {
  const system = `You are a technical writer creating step-by-step captions for a system architecture visualization.
Each caption should be 1-2 concise sentences in Japanese, explaining WHAT is happening and WHY at each step.
Focus on data flow, the role of each component, and how it connects to the next step.
Do NOT use markdown formatting. Output ONLY a JSON array of strings. No other text.`;

  const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));
  const graphOverview = config.connections.map((c) => {
    const src = nodeMap.get(c.sourceId);
    const tgt = nodeMap.get(c.targetId);
    const label = c._label ? ` via ${c._label}` : '';
    return `${src?.name ?? c.sourceId} → ${tgt?.name ?? c.targetId}${label}`;
  }).join('\n');

  const stepsText = steps.map((s) => {
    const sg = s.subgraphTitle ? ` [${s.subgraphTitle}]` : '';
    const out = s.outgoing.map((o) => `→ ${o.targetName}${o.label ? `(${o.label})` : ''}`).join(', ') || 'none';
    const inc = s.incoming.map((i) => `← ${i.sourceName}${i.label ? `(${i.label})` : ''}`).join(', ') || 'none';
    return `${s.index + 1}. ${s.nodeName}${sg} | in: ${inc} | out: ${out}`;
  }).join('\n');

  const user = `## Graph connections:
${graphOverview}

## Steps to caption:
${stepsText}

Generate a JSON array of ${steps.length} Japanese caption strings, one per step.`;

  return { system, user };
}

export async function enrichCaptions(
  viewConfig: ViewConfig,
  llmConfig: LLMConfig,
  signal?: AbortSignal,
): Promise<ViewConfig> {
  const steps = extractSteps(viewConfig);
  if (steps.length === 0) return viewConfig;

  const { system, user } = buildPrompt(steps, viewConfig);
  const messages: LLMMessage[] = [{ role: 'user', content: user }];

  let raw: string;
  try {
    raw = await generateChat(llmConfig, messages, system, signal);
  } catch (e) {
    console.warn('Caption enrichment failed, using template captions:', e);
    return viewConfig;
  }

  let captions: string[];
  try {
    const jsonStr = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    captions = JSON.parse(jsonStr);
    if (!Array.isArray(captions)) throw new Error('Not an array');
  } catch (e) {
    console.warn('Failed to parse caption response, using template captions:', e, raw);
    return viewConfig;
  }

  // Build new keyframes with enriched captions
  const activeFrames = viewConfig.timeline.keyframes
    .filter(isActiveResourceKeyframe)
    .sort((a, b) => a.time - b.time);

  const captionMap = new Map(activeFrames.map((f, i) => [keyframeCaptionKey(f), captions[i]]));

  const newKeyframes = viewConfig.timeline.keyframes.map((f) => {
    const caption = isActiveResourceKeyframe(f) ? captionMap.get(keyframeCaptionKey(f)) : null;
    if (caption) return { ...f, caption };
    return f;
  });

  return {
    ...viewConfig,
    timeline: { ...viewConfig.timeline, keyframes: newKeyframes },
  };
}
