import * as THREE from 'three';
import type {
  ClusterBounds,
  ViewConfig,
  VisualizationCamera,
  VisualizationConnection,
  VisualizationConnectionType,
  VisualizationNode,
  VisualizationRoute,
  VisualizationSubgraph,
  VisualizationTimeline,
  VisualizationTimelineKeyframe,
  VisualizationTrafficType,
} from '@/types/visualization';

// ---------------------------------------------------------------------------
// Shape / tag / label maps (unchanged)
// ---------------------------------------------------------------------------

const MERMAID_SHAPE_3D = {
  default: { shape: 'default', type: 'application' },
  rounded: { shape: 'default', type: 'application' },
  diamond: { shape: 'diamond', type: 'application' },
  circle: { shape: 'sphere', type: 'browser' },
  database: { shape: 'cylinder', type: 'datastore' },
  subroutine: { shape: 'cylinder', type: 'server' },
  hexagon: { shape: 'diamond', type: 'application' },
  parallelogram: { shape: 'default', type: 'application' },
  asymmetric: { shape: 'default', type: 'application' },
} as const;

const TAG_SHAPE_MAP = {
  User: { shape: 'sphere', type: 'browser' },
  CLI: { shape: 'sphere', type: 'browser' },
  Entry: { shape: 'cylinder', type: 'server' },
  Ctx: { shape: 'diamond', type: 'application' },
  Hook: { shape: 'default', type: 'application' },
  Router: { shape: 'diamond', type: 'application' },
  View: { shape: 'default', type: 'application' },
  Error: { shape: 'default', type: 'application' },
  Resp: { shape: 'default', type: 'application' },
  Session: { shape: 'cylinder', type: 'application' },
  Cleanup: { shape: 'default', type: 'application' },
  Output: { shape: 'torus', type: 'response' },
  DB: { shape: 'cylinder', type: 'datastore' },
  Store: { shape: 'cylinder', type: 'datastore' },
} as const;

const LABEL_TYPE_MAP = {
  error: { type: 'signal', trafficVolume: 1 },
  exception: { type: 'signal', trafficVolume: 1 },
  HTTP: { type: 'network', trafficVolume: 3 },
  async: { type: 'async', trafficVolume: 1 },
  config: { type: 'config', trafficVolume: 1 },
  store: { type: 'storage', trafficVolume: 1 },
} as const;

const LINE_STYLE_TYPE_MAP = {
  '-.->': { type: 'async', trafficVolume: 1 },
  '==>': { type: 'network', trafficVolume: 3 },
  '-->': { type: 'sync', trafficVolume: 2 },
  '---': { type: 'sync', trafficVolume: 2 },
} as const;

const FALLBACK_PALETTE = [
  0x6c9bd2, 0x7bc67e, 0x7bc7c4, 0xd4a76a,
  0xc77dba, 0x8bd49e, 0xd4826a, 0x9aabb8,
];

const SVG_NUMBER_PATTERN = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?`;
const SVG_TRANSLATE_RE = new RegExp(
  String.raw`translate\(\s*(${SVG_NUMBER_PATTERN})(?:\s*,\s*|\s+)(${SVG_NUMBER_PATTERN})\s*\)`,
  'i',
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MermaidDirection = 'LR' | 'TB' | 'BT' | 'RL';
type MermaidShapeKey = keyof typeof MERMAID_SHAPE_3D;
type Node3DShape = 'default' | 'sphere' | 'cylinder' | 'diamond' | 'torus';
type ConnectionLineStyle = keyof typeof LINE_STYLE_TYPE_MAP;

interface MermaidNode extends VisualizationNode {
  id: string;
  name: string;
  type: string;
  shape: Node3DShape;
  status: 'idle';
  color: number;
  x: number;
  y: number;
  z: number;
  dataIn: string | undefined;
  dataOut: string | undefined;
  floatOffset: number;
  glowOffset: number;
}

interface MermaidConnection extends VisualizationConnection {
  id: string;
  sourceId: string;
  targetId: string;
  type: VisualizationConnectionType;
  trafficVolume: number;
  _label: string | null;
}

interface MermaidRoute extends VisualizationRoute {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePos: THREE.Vector3;
  targetPos: THREE.Vector3;
  payload: string;
  trafficType: VisualizationTrafficType;
  requestRate: number;
}

interface RawNode {
  id: string;
  tag: string | null;
  text: string;
  name: string;
  mermaidShape: MermaidShapeKey | null;
}

interface RawConnection {
  source: string;
  target: string;
  label: string | null;
  lineStyle: ConnectionLineStyle;
}

interface TokenizedMermaid {
  direction: MermaidDirection;
  rawNodes: Map<string, RawNode>;
  rawConnections: RawConnection[];
  subgraphs: Map<string, VisualizationSubgraph>;
  styles: Map<string, string>;
  nodeSubgraphs: Map<string, string>;
}

interface SvgNodePosition {
  /** Mermaid SVG x coordinate (horizontal in SVG) */
  x: number;
  /** Mermaid SVG y coordinate (vertical in SVG) */
  y: number;
}

interface SvgClusterPosition {
  /** Center x in SVG coordinates. */
  x: number;
  /** Center y in SVG coordinates. */
  y: number;
  width: number;
  height: number;
}

interface SvgLayoutPositions {
  nodePositions: Map<string, SvgNodePosition>;
  clusterPositions: Map<string, SvgClusterPosition>;
}

interface FlowPosition {
  x: number;
  z: number;
}

type BuildRoutesFn = ViewConfig['buildRoutes'];

// ---------------------------------------------------------------------------
// Color utilities (unchanged)
// ---------------------------------------------------------------------------

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): string => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, color))).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function pastelize(hexColor: string): number {
  const hsl = hexToHSL(hexColor);
  hsl.s = Math.max(35, Math.min(55, hsl.s));
  hsl.l = Math.max(55, Math.min(75, hsl.l));
  return parseInt(hslToHex(hsl.h, hsl.s, hsl.l).slice(1), 16);
}

// ---------------------------------------------------------------------------
// MermaidParser
// ---------------------------------------------------------------------------

/** Unique ID prefix used for mermaid.render() calls to avoid SVG ID collisions. */
let _renderCounter = 0;

export class MermaidParser {
  // =========================================================================
  // Public API
  // =========================================================================

  async parse(url: string): Promise<ViewConfig> {
    const text = await this._fetch(url);
    return this.parseText(text);
  }

  async parseText(mmdText: string): Promise<ViewConfig> {
    const tokens = this._tokenize(mmdText);

    const nodes = this._buildNodes(tokens);
    const connections = this._buildConnections(tokens);

    let clusterBounds: Map<string, ClusterBounds> | undefined;

    try {
      clusterBounds = await this._layoutFromMermaid(mmdText, nodes, tokens.subgraphs, tokens.direction);
    } catch (e) {
      console.warn('MermaidParser: mermaid.render() layout failed; using deterministic fallback layout:', e);
      this._layoutDeterministicFallback(nodes, connections, tokens.direction);
      clusterBounds = this._computeClusterBoundsFromNodes(nodes, tokens.nodeSubgraphs);
    }

    const layers = this._extractLayers(nodes, tokens.direction);
    this._applyColors(nodes, tokens.styles);
    this._applyDataLabels(nodes, connections);
    const camera = this._calculateCamera(nodes);
    const timeline = this._generateTimeline(nodes, connections, layers, tokens.subgraphs, tokens.nodeSubgraphs);
    const buildRoutes = this._createBuildRoutes(nodes, connections);

    return {
      nodes,
      connections,
      timeline,
      camera,
      buildRoutes,
      subgraphs: tokens.subgraphs,
      nodeSubgraphs: tokens.nodeSubgraphs,
      rawMmdText: mmdText,
      clusterBounds,
    };
  }

  // =========================================================================
  // Fetch
  // =========================================================================

  async _fetch(url: string): Promise<string> {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`MermaidParser: Failed to fetch ${url}: ${resp.status}`);
    return resp.text();
  }

  // =========================================================================
  // Tokenizer (unchanged)
  // =========================================================================

  _tokenize(text: string): TokenizedMermaid {
    const lines = text.split('\n');
    let direction: MermaidDirection = 'LR';
    const rawNodes = new Map<string, RawNode>();
    const rawConnections: RawConnection[] = [];
    const subgraphs = new Map<string, VisualizationSubgraph>();
    const styles = new Map<string, string>();
    const nodeSubgraphs = new Map<string, string>();
    let currentSubgraph: string | null = null;
    let sgOrder = 0;

    // Track init directive block: %%{init...}%% spans multiple lines.
    // Any line inside such a block should be skipped.
    let inInitBlock = false;
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;

      // Handle %%{init...}%% multi-line directive block
      if (t.startsWith('%%{') && t.endsWith('}%%')) {
        // Single-line init directive
        continue;
      }
      if (t.startsWith('%%{')) {
        inInitBlock = true;
        continue;
      }
      if (inInitBlock) {
        if (t.endsWith('}%%')) inInitBlock = false;
        continue;
      }
      if (t.startsWith('%%')) continue;

      const dirM = t.match(/^flowchart\s+(LR|TB|BT|RL)$/);
      if (dirM) {
        direction = dirM[1] as MermaidDirection;
        continue;
      }

      if (t === 'end') {
        currentSubgraph = null;
        continue;
      }

      const sgM = t.match(/^subgraph\s+(\w+)(?:\["(.+?)"\])?/);
      if (sgM) {
        subgraphs.set(sgM[1], { id: sgM[1], title: sgM[2] || sgM[1], order: sgOrder++ });
        currentSubgraph = sgM[1];
        continue;
      }

      // subgraph-local direction directive: "direction LR|TB|BT|RL"
      const sgDirM = t.match(/^direction\s+(LR|TB|BT|RL)$/);
      if (sgDirM) {
        continue;
      }

      const stM = t.match(/^style\s+(\w+)\s+fill:(#[0-9A-Fa-f]{6})/);
      if (stM) {
        styles.set(stM[1], stM[2]);
        continue;
      }

      const edgeM = t.match(/^(\w+)(?:\["([^"]*)"|\[([^\]]*)\])?\s*(-\.->|==>|-->|---)\s*(?:\|([^|]+)\|\s*)?(\w+)(?:\["([^"]*)"|\[([^\]]*)\])?$/);
      if (edgeM) {
        const sourceId = edgeM[1];
        const sourceLabel = edgeM[2] !== undefined ? edgeM[2] : edgeM[3];
        const lineStyle = edgeM[4] as ConnectionLineStyle;
        const edgeLabel = edgeM[5];
        const targetId = edgeM[6];
        const targetLabel = edgeM[7] !== undefined ? edgeM[7] : edgeM[8];

        // Skip edges that use a subgraph as an endpoint. Those edges are valid
        // Mermaid syntax, but SysViz routes need concrete node meshes.
        const isSourceCluster = subgraphs.has(sourceId) && sourceLabel === undefined;
        const isTargetCluster = subgraphs.has(targetId) && targetLabel === undefined;
        if (isSourceCluster || isTargetCluster) continue;

        if (!isSourceCluster) this._registerInlineNode(rawNodes, sourceId, sourceLabel);
        if (!isTargetCluster) this._registerInlineNode(rawNodes, targetId, targetLabel);

        // Strip surrounding double quotes from pipe-style labels (e.g. |"extends"|)
        let cleanLabel: string | null = edgeLabel ? edgeLabel.trim() : null;
        if (cleanLabel && cleanLabel.startsWith('"') && cleanLabel.endsWith('"')) {
          cleanLabel = cleanLabel.slice(1, -1);
        }

        rawConnections.push({
          source: sourceId,
          target: targetId,
          label: cleanLabel,
          lineStyle: lineStyle || '-->',
        });

        if (currentSubgraph) {
          if (!nodeSubgraphs.has(sourceId)) nodeSubgraphs.set(sourceId, currentSubgraph);
          if (!nodeSubgraphs.has(targetId)) nodeSubgraphs.set(targetId, currentSubgraph);
        }

        continue;
      }

      const ntM = t.match(/^(\w+)\["\[(\w+)\]\s*(.*)"\]$/);
      if (ntM) {
        const namePart = ntM[3].split('<br/>')[0].trim();
        rawNodes.set(ntM[1], {
          id: ntM[1],
          tag: ntM[2],
          text: ntM[3],
          name: namePart || ntM[1],
          mermaidShape: null,
        });
        if (currentSubgraph) nodeSubgraphs.set(ntM[1], currentSubgraph);
        continue;
      }

      const nM = t.match(/^(\w+)\["(.*)"\]$/);
      if (nM) {
        const namePart = nM[2].split('<br/>')[0].trim();
        rawNodes.set(nM[1], {
          id: nM[1],
          tag: null,
          text: nM[2],
          name: namePart || nM[1],
          mermaidShape: null,
        });
        if (currentSubgraph) nodeSubgraphs.set(nM[1], currentSubgraph);
        continue;
      }

      const cirM = t.match(/^(\w+)\(\(\s*(.+)\s*\)\)$/);
      if (cirM) {
        const circleText = cirM[2].trim().replace(/^"|"$/g, '');
        const namePart = circleText.split('<br/>')[0].trim();
        rawNodes.set(cirM[1], {
          id: cirM[1],
          tag: null,
          text: circleText,
          name: namePart || cirM[1],
          mermaidShape: 'circle',
        });
        if (currentSubgraph) nodeSubgraphs.set(cirM[1], currentSubgraph);
        continue;
      }

      const dbM = t.match(/^(\w+)\[\(\s*(.+)\s*\)\]$/);
      if (dbM) {
        const databaseText = dbM[2].trim().replace(/^"|"$/g, '');
        const namePart = databaseText.split('<br/>')[0].trim();
        rawNodes.set(dbM[1], {
          id: dbM[1],
          tag: null,
          text: databaseText,
          name: namePart || dbM[1],
          mermaidShape: 'database',
        });
        if (currentSubgraph) nodeSubgraphs.set(dbM[1], currentSubgraph);
        continue;
      }

      const diaM = t.match(/^(\w+)\{(?:"(.+)"|(.+))\}$/);
      if (diaM) {
        const diamondText = (diaM[2] !== undefined ? diaM[2] : diaM[3]).trim();
        const namePart = diamondText.split('<br/>')[0].trim();
        rawNodes.set(diaM[1], {
          id: diaM[1],
          tag: null,
          text: diamondText,
          name: namePart || diaM[1],
          mermaidShape: 'diamond',
        });
        if (currentSubgraph) nodeSubgraphs.set(diaM[1], currentSubgraph);
        continue;
      }

      const rndM = t.match(/^(\w+)\((?!\()(?:"(.+)"|(.+))\)$/);
      if (rndM) {
        const roundedText = (rndM[2] !== undefined ? rndM[2] : rndM[3]).trim();
        const namePart = roundedText.split('<br/>')[0].trim();
        rawNodes.set(rndM[1], {
          id: rndM[1],
          tag: null,
          text: roundedText,
          name: namePart || rndM[1],
          mermaidShape: 'rounded',
        });
        if (currentSubgraph) nodeSubgraphs.set(rndM[1], currentSubgraph);
        continue;
      }

      const rectM = t.match(/^(\w+)\[(?!\[)([^\]]*)\]$/);
      if (rectM) {
        const rectText = rectM[2].trim();
        const namePart = rectText.split('<br/>')[0].trim();
        rawNodes.set(rectM[1], {
          id: rectM[1],
          tag: null,
          text: rectText,
          name: namePart || rectM[1],
          mermaidShape: 'default',
        });
        if (currentSubgraph) nodeSubgraphs.set(rectM[1], currentSubgraph);
      }
    }

    return { direction, rawNodes, rawConnections, subgraphs, styles, nodeSubgraphs };
  }

  // =========================================================================
  // Node registration (unchanged)
  // =========================================================================

  _ensureNode(rawNodes: Map<string, RawNode>, id: string): void {
    if (!rawNodes.has(id)) {
      rawNodes.set(id, { id, tag: null, text: id, name: id, mermaidShape: null });
    }
  }

  _registerInlineNode(rawNodes: Map<string, RawNode>, id: string, label?: string): void {
    if (label === undefined) {
      this._ensureNode(rawNodes, id);
      return;
    }
    if (rawNodes.has(id)) return;

    const tagMatch = label.match(/^\[(\w+)\]\s*(.*)$/);
    if (tagMatch) {
      const namePart = tagMatch[2].split('<br/>')[0].trim();
      rawNodes.set(id, { id, tag: tagMatch[1], text: label, name: namePart || id, mermaidShape: null });
    } else {
      const namePart = label.split('<br/>')[0].trim();
      rawNodes.set(id, { id, tag: null, text: label, name: namePart || id, mermaidShape: null });
    }
  }

  // =========================================================================
  // Build nodes / connections (unchanged)
  // =========================================================================

  _buildNodes(tokens: TokenizedMermaid): MermaidNode[] {
    const nodes: MermaidNode[] = [];
    let i = 0;
    for (const raw of tokens.rawNodes.values()) {
      let shape: Node3DShape = 'default';
      let type = 'application';

      if (raw.mermaidShape) {
        const info = MERMAID_SHAPE_3D[raw.mermaidShape];
        if (info) {
          shape = info.shape;
          type = info.type;
        }
      } else if (raw.tag) {
        const info = TAG_SHAPE_MAP[raw.tag as keyof typeof TAG_SHAPE_MAP];
        if (info) {
          shape = info.shape;
          type = info.type;
        }
      }

      nodes.push({
        id: raw.id,
        name: raw.name,
        type,
        shape,
        status: 'idle',
        color: 0xe2e8f0,
        x: 0,
        y: 0,
        z: 0,
        dataIn: undefined,
        dataOut: undefined,
        floatOffset: i * 0.5,
        glowOffset: i * 0.3 + 0.3,
      });
      i++;
    }
    return nodes;
  }

  _buildConnections(tokens: TokenizedMermaid): MermaidConnection[] {
    return tokens.rawConnections.map((rc) => {
      const ls = LINE_STYLE_TYPE_MAP[rc.lineStyle] || LINE_STYLE_TYPE_MAP['-->'];
      let type: VisualizationConnectionType = ls.type;
      let trafficVolume = ls.trafficVolume;

      if (rc.label) {
        const mapped = LABEL_TYPE_MAP[rc.label as keyof typeof LABEL_TYPE_MAP]
          || LABEL_TYPE_MAP[rc.label.toLowerCase() as keyof typeof LABEL_TYPE_MAP];
        if (mapped) {
          type = mapped.type;
          trafficVolume = mapped.trafficVolume;
        }
      }
      return {
        id: `conn-${rc.source}-${rc.target}`,
        sourceId: rc.source,
        targetId: rc.target,
        type,
        trafficVolume,
        _label: rc.label,
      };
    });
  }

  // =========================================================================
  // Layout: mermaid.render() based (new)
  // =========================================================================

  /**
   * Render mermaid diagram to SVG and extract node/cluster positions.
   * Throws if Mermaid cannot render or the SVG does not contain usable node
   * positions. The caller applies a deterministic non-dagre fallback.
   */
  private async _layoutFromMermaid(
    mmdText: string,
    nodes: MermaidNode[],
    subgraphs: Map<string, VisualizationSubgraph>,
    direction: MermaidDirection,
  ): Promise<Map<string, ClusterBounds>> {
    const diagramId = `sysviz-${++_renderCounter}`;

    const mermaid = await import('mermaid');
    mermaid.default.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      flowchart: { nodeSpacing: 50, rankSpacing: 50 },
    });

    const { svg } = await mermaid.default.render(diagramId, mmdText);

    const svgDoc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const parseError = svgDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`MermaidParser: failed to parse rendered SVG: ${parseError.textContent || 'unknown parser error'}`);
    }

    const idMap = this._resolveSvgElementIds(
      svgDoc,
      diagramId,
      new Set(nodes.map((node) => node.id)),
      new Set(subgraphs.keys()),
    );

    const svgPos = this._parseSvgPositions(svgDoc);
    return this._mapSvgTo3D(nodes, svgPos, idMap, direction);
  }

  /**
   * Build a mapping from original Mermaid IDs to rendered SVG element IDs.
   * Mermaid v11 normally emits data-id, but the prefixed id fallback keeps this
   * robust across renderer variants.
   */
  private _resolveSvgElementIds(
    svgDoc: Document,
    diagramId: string,
    nodeIds: Set<string>,
    clusterIds: Set<string>,
  ): Map<string, string> {
    const idMap = new Map<string, string>();
    const expectedIds = new Set([...nodeIds, ...clusterIds]);

    // Stage 1: data-id attribute
    const dataIdEls = svgDoc.querySelectorAll<SVGGElement>('g.node[data-id], g.cluster[data-id]');
    for (const el of dataIdEls) {
      const originalId = el.getAttribute('data-id');
      const svgElId = el.getAttribute('id');
      if (originalId && expectedIds.has(originalId) && svgElId && !idMap.has(originalId)) {
        idMap.set(originalId, svgElId);
      }
    }

    // Stage 2: ID pattern matching {diagramId}-{originalId}
    // mermaid prefixes all node/cluster IDs with the diagramId
    const prefix = `${diagramId}-`;
    const allGroups = svgDoc.querySelectorAll<SVGGElement>('g.node[id], g.cluster[id]');
    for (const g of allGroups) {
      const svgElId = g.getAttribute('id');
      if (!svgElId) continue;
      if (!svgElId.startsWith(prefix)) continue;

      const stripped = svgElId.slice(prefix.length);
      const resolvedId = this._resolveExpectedIdFromSvgSuffix(stripped, expectedIds);

      if (resolvedId && !idMap.has(resolvedId)) {
        idMap.set(resolvedId, svgElId);
      }
    }

    return idMap;
  }

  private _resolveExpectedIdFromSvgSuffix(suffix: string, expectedIds: Set<string>): string | null {
    if (expectedIds.has(suffix)) return suffix;

    // Mermaid v11 prefixes node (but not cluster) IDs with "flowchart-":
    //   node:   {diagramId}-flowchart-{nodeId}-{index}
    //   cluster: {diagramId}-{clusterId}
    const stripped = suffix.startsWith('flowchart-') ? suffix.slice('flowchart-'.length) : suffix;
    if (expectedIds.has(stripped)) return stripped;

    // Mermaid may append a numeric suffix to avoid SVG ID collisions. Prefer
    // the longest expected ID so original IDs such as "api-1" are not truncated
    // to "api" accidentally.
    const matches = [...expectedIds]
      .filter((id) => stripped.startsWith(`${id}-`) && /^\d+$/.test(stripped.slice(id.length + 1)))
      .sort((a, b) => b.length - a.length);

    return matches[0] ?? null;
  }

  /**
   * Parse node and cluster positions from SVG elements.
   * Nodes usually use transform="translate(x, y)". Clusters may use either a
   * translated group or absolute rect x/y coordinates depending on Mermaid's
   * renderer version.
   */
  private _parseSvgPositions(svgDoc: Document): SvgLayoutPositions {
    const nodePositions = new Map<string, SvgNodePosition>();
    const clusterPositions = new Map<string, SvgClusterPosition>();

    const allGroups = svgDoc.querySelectorAll<SVGGElement>('g[id]');

    for (const g of allGroups) {
      const svgElId = g.getAttribute('id');
      if (!svgElId) continue;
      const classList = g.getAttribute('class') || '';

      const isCluster = classList.includes('cluster');

      if (isCluster) {
        const groupTranslate = this._parseTranslate(g.getAttribute('transform'));
        let x = groupTranslate?.x ?? 0;
        let y = groupTranslate?.y ?? 0;
        let width: number | null = null;
        let height: number | null = null;
        const rect = g.querySelector('rect');
        if (rect) {
          const rectX = this._parseSvgNumber(rect.getAttribute('x'));
          const rectY = this._parseSvgNumber(rect.getAttribute('y'));
          width = this._parseSvgNumber(rect.getAttribute('width'));
          height = this._parseSvgNumber(rect.getAttribute('height'));

          if (width !== null && height !== null) {
            x += (rectX ?? 0) + width / 2;
            y += (rectY ?? 0) + height / 2;
          }
        }

        // If no rect dimensions are available, approximate from child node centers.
        if (width === null || height === null) {
          const childNodes = g.querySelectorAll('.node');
          if (childNodes.length > 0) {
            let minX = Infinity;
            let maxX = -Infinity;
            let minY = Infinity;
            let maxY = -Infinity;
            for (const cn of childNodes) {
              const childTranslate = this._parseTranslate(cn.getAttribute('transform'));
              if (childTranslate) {
                minX = Math.min(minX, childTranslate.x);
                maxX = Math.max(maxX, childTranslate.x);
                minY = Math.min(minY, childTranslate.y);
                maxY = Math.max(maxY, childTranslate.y);
              }
            }
            if (isFinite(minX)) {
              width = maxX - minX;
              height = maxY - minY;
              x = (minX + maxX) / 2;
              y = (minY + maxY) / 2;
            }
          }
        }

        if (width !== null && height !== null && width > 0 && height > 0) {
          clusterPositions.set(svgElId, { x, y, width, height });
        }
      } else if (classList.includes('node') || classList.includes('default')) {
        const translate = this._parseTranslate(g.getAttribute('transform'));
        if (translate) {
          nodePositions.set(svgElId, translate);
        }
      }
    }

    return { nodePositions, clusterPositions };
  }

  private _parseTranslate(transform: string | null): SvgNodePosition | null {
    if (!transform) return null;
    const translateMatch = transform.match(SVG_TRANSLATE_RE);
    if (!translateMatch) return null;
    const x = Number(translateMatch[1]);
    const y = Number(translateMatch[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
  }

  private _parseSvgNumber(value: string | null): number | null {
    if (!value) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  /**
   * Map SVG coordinates to 3D world coordinates using non-uniform scaling.
   * Returns cluster bounds derived from SVG cluster rects with the same scaling,
   * so the 3D subgraph areas match the 2D mermaid diagram proportions.
   */
  private _mapSvgTo3D(
    nodes: MermaidNode[],
    svgPositions: SvgLayoutPositions,
    idMap: Map<string, string>,
    direction: MermaidDirection,
  ): Map<string, ClusterBounds> {
    const clusterBounds = new Map<string, ClusterBounds>();

    const nodeLookup = new Map<string, { x: number; y: number }>();
    for (const [originalId, svgElId] of idMap.entries()) {
      const pos = svgPositions.nodePositions.get(svgElId);
      if (pos) {
        nodeLookup.set(originalId, pos);
      }
    }

    const missingNodeIds = nodes.filter((node) => !nodeLookup.has(node.id)).map((node) => node.id);
    if (missingNodeIds.length > 0) {
      throw new Error(`MermaidParser: rendered SVG did not contain positions for nodes: ${missingNodeIds.join(', ')}`);
    }

    const rawPositions = new Map<string, FlowPosition>();

    let rawMinX = Infinity;
    let rawMaxX = -Infinity;
    let rawMinZ = Infinity;
    let rawMaxZ = -Infinity;

    for (const node of nodes) {
      const svgPos = nodeLookup.get(node.id);
      if (svgPos) {
        const { x: r3x, z: r3z } = this._svgPointToFlowPosition(svgPos, direction);
        rawPositions.set(node.id, { x: r3x, z: r3z });
        rawMinX = Math.min(rawMinX, r3x);
        rawMaxX = Math.max(rawMaxX, r3x);
        rawMinZ = Math.min(rawMinZ, r3z);
        rawMaxZ = Math.max(rawMaxZ, r3z);
      }
    }

    if (!isFinite(rawMinX)) return clusterBounds;

    // Non-uniform scaling: flow direction fits TARGET_MAX_EXTENT, cross direction
    // gets a minimum extent to prevent excessive compression of narrow layouts.
    const TARGET_MAX_EXTENT = 50;
    const MIN_CROSS_EXTENT = 25;
    const rawExtentX = rawMaxX - rawMinX;
    const rawExtentZ = rawMaxZ - rawMinZ;
    const flowScale = Math.min(0.8, TARGET_MAX_EXTENT / Math.max(rawExtentX, 1));
    const crossScale = Math.min(0.8, Math.max(MIN_CROSS_EXTENT, TARGET_MAX_EXTENT * 0.5) / Math.max(rawExtentZ, 1));

    const rawCX = (rawMinX + rawMaxX) / 2;
    const rawCZ = (rawMinZ + rawMaxZ) / 2;

    for (const node of nodes) {
      const raw = rawPositions.get(node.id);
      if (raw) {
        node.x = (raw.x - rawCX) * flowScale;
        node.z = (raw.z - rawCZ) * crossScale;
        node.y = 0;
      }
    }

    // Compute cluster bounds from SVG cluster rects with the same scaling.
    // This preserves the 2D diagram's cluster proportions in 3D.
    for (const [originalId, svgElId] of idMap.entries()) {
      const clusterPos = svgPositions.clusterPositions.get(svgElId);
      if (!clusterPos) continue;

      const { x: cCX, z: cCZ } = this._svgPointToFlowPosition(clusterPos, direction);
      const halfW = (direction === 'LR' || direction === 'RL' ? clusterPos.width : clusterPos.height) / 2;
      const halfH = (direction === 'LR' || direction === 'RL' ? clusterPos.height : clusterPos.width) / 2;

      clusterBounds.set(originalId, {
        minX: (cCX - halfW - rawCX) * flowScale,
        maxX: (cCX + halfW - rawCX) * flowScale,
        minZ: (cCZ - halfH - rawCZ) * crossScale,
        maxZ: (cCZ + halfH - rawCZ) * crossScale,
      });
    }

    return clusterBounds;
  }

  private _svgPointToFlowPosition(svgPos: SvgNodePosition, direction: MermaidDirection): FlowPosition {
    if (direction === 'LR' || direction === 'RL') {
      return { x: svgPos.x, z: svgPos.y };
    }
    return { x: svgPos.y, z: svgPos.x };
  }

  private _computeClusterBoundsFromNodes(
    nodes: MermaidNode[],
    nodeSubgraphs: Map<string, string>,
  ): Map<string, ClusterBounds> {
    const bounds = new Map<string, ClusterBounds>();
    const membersByCluster = new Map<string, MermaidNode[]>();

    for (const node of nodes) {
      const clusterId = nodeSubgraphs.get(node.id);
      if (!clusterId) continue;
      if (!membersByCluster.has(clusterId)) membersByCluster.set(clusterId, []);
      membersByCluster.get(clusterId)!.push(node);
    }

    for (const [clusterId, members] of membersByCluster) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const node of members) {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minZ = Math.min(minZ, node.z);
        maxZ = Math.max(maxZ, node.z);
      }
      if (isFinite(minX)) {
        bounds.set(clusterId, { minX, maxX, minZ, maxZ });
      }
    }

    return bounds;
  }

  // =========================================================================
  // Layout: deterministic fallback (no dagre)
  // =========================================================================

  private _layoutDeterministicFallback(
    nodes: MermaidNode[],
    connections: MermaidConnection[],
    direction: MermaidDirection,
  ): void {
    if (nodes.length === 0) return;

    const nodeIds = new Set(nodes.map((node) => node.id));
    const indegree = new Map<string, number>();
    const outgoing = new Map<string, string[]>();
    const layerById = new Map<string, number>();
    for (const node of nodes) {
      indegree.set(node.id, 0);
      outgoing.set(node.id, []);
    }

    for (const connection of connections) {
      if (!nodeIds.has(connection.sourceId) || !nodeIds.has(connection.targetId)) continue;
      outgoing.get(connection.sourceId)?.push(connection.targetId);
      indegree.set(connection.targetId, (indegree.get(connection.targetId) ?? 0) + 1);
    }

    const queue = nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id);
    for (const id of queue) layerById.set(id, 0);

    while (queue.length > 0) {
      const id = queue.shift();
      if (id === undefined) continue;
      const sourceLayer = layerById.get(id) ?? 0;
      for (const targetId of outgoing.get(id) ?? []) {
        layerById.set(targetId, Math.max(layerById.get(targetId) ?? 0, sourceLayer + 1));
        const nextIndegree = (indegree.get(targetId) ?? 0) - 1;
        indegree.set(targetId, nextIndegree);
        if (nextIndegree === 0) queue.push(targetId);
      }
    }

    // Cyclic or disconnected nodes that were not reached keep their declaration
    // order, grouped after the acyclic layers.
    const maxLayer = Math.max(0, ...layerById.values());
    let overflow = 0;
    for (const node of nodes) {
      if (!layerById.has(node.id)) {
        layerById.set(node.id, maxLayer + Math.floor(overflow / 4) + 1);
        overflow++;
      }
    }

    const byLayer = new Map<number, MermaidNode[]>();
    for (const node of nodes) {
      const layer = layerById.get(node.id) ?? 0;
      if (!byLayer.has(layer)) byLayer.set(layer, []);
      byLayer.get(layer)?.push(node);
    }

    const layerStep = 6;
    const crossStep = 4;
    const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);
    const reverseFlow = direction === 'RL' || direction === 'BT';

    for (const [layerIndex, layer] of sortedLayers.entries()) {
      const members = byLayer.get(layer) ?? [];
      const flow = (reverseFlow ? sortedLayers.length - layerIndex - 1 : layerIndex) * layerStep;
      for (let index = 0; index < members.length; index++) {
        const cross = (index - (members.length - 1) / 2) * crossStep;
        const node = members[index];
        node.x = flow - ((sortedLayers.length - 1) * layerStep) / 2;
        node.z = cross;
        node.y = 0;
      }
    }
  }

  // =========================================================================
  // Layers, colors, data labels (unchanged)
  // =========================================================================

  _extractLayers(nodes: MermaidNode[], direction: MermaidDirection): string[][] {
    const order = direction === 'RL' || direction === 'BT' ? -1 : 1;
    const sorted = [...nodes].sort((a, b) => (a.x - b.x) * order);

    if (sorted.length === 0) return [];

    const flowPositions = sorted.map((n) => n.x);
    let minGap = Infinity;
    for (let i = 1; i < flowPositions.length; i++) {
      const gap = Math.abs(flowPositions[i] - flowPositions[i - 1]);
      if (gap > 0 && gap < minGap) minGap = gap;
    }
    const TOLERANCE = isFinite(minGap) ? minGap * 0.4 : 1.8;

    const layers: string[][] = [];
    let currentLayer: string[] = [];
    let currentFlowPos: number | null = null;

    for (const node of sorted) {
      if (currentFlowPos === null || Math.abs(node.x - currentFlowPos) > TOLERANCE) {
        if (currentLayer.length > 0) layers.push(currentLayer);
        currentLayer = [node.id];
        currentFlowPos = node.x;
      } else {
        currentLayer.push(node.id);
      }
    }
    if (currentLayer.length > 0) layers.push(currentLayer);

    return layers;
  }

  _applyColors(nodes: MermaidNode[], styles: Map<string, string>): void {
    for (const node of nodes) {
      const hexColor = styles.get(node.id);
      if (hexColor) {
        node.color = pastelize(hexColor);
      }
    }

    let pi = 0;
    for (const node of nodes) {
      if (!styles.has(node.id)) {
        node.color = FALLBACK_PALETTE[pi % FALLBACK_PALETTE.length];
        pi++;
      }
    }
  }

  _applyDataLabels(nodes: MermaidNode[], connections: MermaidConnection[]): void {
    for (const node of nodes) {
      const outConns = connections.filter((connection) => connection.sourceId === node.id);
      const normal = outConns.find((connection) => connection.type !== 'signal');
      const anyConnection = outConns[0];
      const label = (normal || anyConnection)?._label;
      if (label) node.dataOut = label;
    }

    for (const node of nodes) {
      const inConn = connections.find((connection) => connection.targetId === node.id);
      if (inConn?._label) node.dataIn = inConn._label;
    }
  }

  // =========================================================================
  // Camera (unchanged)
  // =========================================================================

  _calculateCamera(nodes: MermaidNode[]): VisualizationCamera {
    if (nodes.length === 0) {
      return { position: [18, 3, 14], target: [0, 0, 0] };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minZ = Math.min(minZ, node.z);
      maxZ = Math.max(maxZ, node.z);
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const spreadX = maxX - minX;
    const spreadZ = maxZ - minZ;

    const FOV_DEG = 45;
    const halfFovRad = (FOV_DEG / 2) * (Math.PI / 180);
    const tanHalf = Math.tan(halfFovRad);
    const PADDED_X = Math.max(spreadX + 8, 12);
    const PADDED_Z = Math.max(spreadZ + 8, 12);
    const distForX = (PADDED_X / 1.5) / tanHalf;
    const distForZ = PADDED_Z / tanHalf;
    const dist = Math.max(distForX, distForZ, 15);

    const ELEVATION_ANGLE = 35 * (Math.PI / 180);
    const camY = dist * Math.sin(ELEVATION_ANGLE) + 2;
    const camOffsetZ = dist * Math.cos(ELEVATION_ANGLE);

    return {
      position: [cx, camY, cz + camOffsetZ],
      target: [cx, 0, cz],
    };
  }

  // =========================================================================
  // Timeline (unchanged)
  // =========================================================================

  _generateTimeline(
    nodes: MermaidNode[],
    connections: MermaidConnection[],
    layers: string[][],
    subgraphs: Map<string, VisualizationSubgraph>,
    nodeSubgraphs: Map<string, string>,
  ): VisualizationTimeline {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const NODE_DURATION = 3.5;
    const ROUTE_ON = 0.5;
    const ROUTE_OFF = 3.3;

    const outMap = new Map<string, MermaidConnection[]>();
    for (const connection of connections) {
      if (!outMap.has(connection.sourceId)) outMap.set(connection.sourceId, []);
      outMap.get(connection.sourceId)?.push(connection);
    }

    const keyframes: VisualizationTimelineKeyframe[] = [];
    const activeOrder: Array<{ time: number; id: string }> = [];
    let time = 0;

    for (const layer of layers) {
      for (const nodeId of layer) {
        const node = nodeMap.get(nodeId);
        if (!node) continue;

        const sgId = nodeSubgraphs.get(nodeId);
        const sg = sgId ? subgraphs.get(sgId) : null;
        const phase = sg ? sg.title.split('/')[0].trim() : '';
        const caption = phase ? `${phase}: ${node.name} を実行します` : `${node.name} を処理中`;

        keyframes.push({
          time,
          type: 'resource',
          id: nodeId,
          status: 'active',
          caption,
        });
        activeOrder.push({ time, id: nodeId });

        for (const connection of outMap.get(nodeId) || []) {
          keyframes.push({ time: time + ROUTE_ON, type: 'route', id: `route-${connection.id}`, active: true });
          keyframes.push({ time: time + ROUTE_OFF, type: 'route', id: `route-${connection.id}`, active: false });
        }

        time += NODE_DURATION;
      }
    }

    for (let i = 1; i < activeOrder.length; i++) {
      keyframes.push({
        time: activeOrder[i].time,
        type: 'resource',
        id: activeOrder[i - 1].id,
        status: 'complete',
      });
    }

    keyframes.sort((a, b) => a.time - b.time);
    return { duration: time + 2, keyframes };
  }

  // =========================================================================
  // Build routes (unchanged)
  // =========================================================================

  _createBuildRoutes(nodes: MermaidNode[], connections: MermaidConnection[]): BuildRoutesFn {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const lastConnId = connections.length > 0 ? connections[connections.length - 1].id : null;

    return function buildRoutes(resourceMeshes: Map<string, THREE.Group>): MermaidRoute[] {
      return connections.flatMap((conn) => {
        const srcMesh = resourceMeshes.get(conn.sourceId);
        const tgtMesh = resourceMeshes.get(conn.targetId);
        if (!srcMesh || !tgtMesh) return [];

        let trafficType: VisualizationTrafficType = 'default';
        if (conn.type === 'signal') trafficType = 'error';
        else if (conn.id === lastConnId) trafficType = 'healthy';

        return [{
          id: `route-${conn.id}`,
          sourceId: conn.sourceId,
          targetId: conn.targetId,
          sourcePos: srcMesh.position.clone(),
          targetPos: tgtMesh.position.clone(),
          payload: nodeMap.get(conn.sourceId)?.dataOut || '',
          trafficType,
          requestRate: 1.25,
        }];
      });
    };
  }
}
