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

const CLUSTER_NODE_MARGIN_X = 2.0;
const CLUSTER_NODE_MARGIN_Z = 1.2;

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
  /** Rendered SVG node width, when Mermaid exposes a shape size */
  width: number | null;
  /** Rendered SVG node height, when Mermaid exposes a shape size */
  height: number | null;
  className: string;
  dataId: string | null;
}

interface SvgLayoutPositions {
  nodePositions: Map<string, SvgNodePosition>;
  clusterBounds: Map<string, SvgRectBounds>;
  clusterLabelBounds: Map<string, SvgRectBounds>;
}

interface FlowPosition {
  x: number;
  z: number;
}

interface SvgRectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
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
      clusterBounds = await this._layoutFromMermaid(mmdText, nodes, tokens.subgraphs, tokens.nodeSubgraphs, tokens.direction);
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
   * Render mermaid diagram to SVG and extract node positions.
   * Throws if Mermaid cannot render or the SVG does not contain usable node
   * positions. The caller applies a deterministic non-dagre fallback.
   */
  private async _layoutFromMermaid(
    mmdText: string,
    nodes: MermaidNode[],
    subgraphs: Map<string, VisualizationSubgraph>,
    nodeSubgraphs: Map<string, string>,
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
    return this._mapSvgTo3D(nodes, svgPos, idMap, direction, nodeSubgraphs);
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
   * Parse node positions from SVG elements.
   * Mermaid nodes usually use transform="translate(x, y)".
   */
  private _parseSvgPositions(svgDoc: Document): SvgLayoutPositions {
    const nodePositions = new Map<string, SvgNodePosition>();
    const clusterBounds = new Map<string, SvgRectBounds>();
    const clusterLabelBounds = new Map<string, SvgRectBounds>();
    const allGroups = svgDoc.querySelectorAll<SVGGElement>('g.node[id]');

    for (const g of allGroups) {
      const svgElId = g.getAttribute('id');
      if (!svgElId) continue;
      const translate = this._parseCumulativeTranslate(g);
      if (translate) {
        translate.className = g.getAttribute('class') || '';
        translate.dataId = g.getAttribute('data-id');
        const size = this._parseSvgNodeSize(g);
        if (size) {
          translate.width = size.width;
          translate.height = size.height;
        }
        nodePositions.set(svgElId, translate);
      }
    }

    const clusterGroups = svgDoc.querySelectorAll<SVGGElement>('g.cluster[id]');
    for (const g of clusterGroups) {
      const svgElId = g.getAttribute('id');
      if (!svgElId) continue;

      const rect = g.querySelector<SVGRectElement>('rect');
      const rectBounds = rect ? this._parseSvgRectBounds(rect) : null;
      if (rectBounds) {
        clusterBounds.set(svgElId, rectBounds);
      }

      const labelBounds = this._parseSvgClusterLabelBounds(g);
      if (labelBounds) {
        clusterLabelBounds.set(svgElId, labelBounds);
      }
    }

    return { nodePositions, clusterBounds, clusterLabelBounds };
  }

  private _parseTranslate(transform: string | null): SvgNodePosition | null {
    if (!transform) return null;
    const translateMatch = transform.match(SVG_TRANSLATE_RE);
    if (!translateMatch) return null;
    const x = Number(translateMatch[1]);
    const y = Number(translateMatch[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y, width: null, height: null, className: '', dataId: null };
  }

  private _parseCumulativeTranslate(g: SVGGElement): SvgNodePosition | null {
    let x = 0;
    let y = 0;
    let found = false;
    let current: Element | null = g;

    while (current && current.tagName.toLowerCase() !== 'svg') {
      const local = this._parseTranslate(current.getAttribute('transform'));
      if (local) {
        x += local.x;
        y += local.y;
        found = true;
      }
      current = current.parentElement;
    }

    if (!found) return null;
    return { x, y, width: null, height: null, className: '', dataId: null };
  }

  private _parseSvgNodeSize(g: SVGGElement): { width: number; height: number } | null {
    const rect = g.querySelector<SVGRectElement>('rect');
    if (rect) {
      const width = Number(rect.getAttribute('width'));
      const height = Number(rect.getAttribute('height'));
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        return { width, height };
      }
    }

    const circle = g.querySelector<SVGCircleElement>('circle');
    if (circle) {
      const r = Number(circle.getAttribute('r'));
      if (Number.isFinite(r) && r > 0) return { width: r * 2, height: r * 2 };
    }

    const ellipse = g.querySelector<SVGEllipseElement>('ellipse');
    if (ellipse) {
      const rx = Number(ellipse.getAttribute('rx'));
      const ry = Number(ellipse.getAttribute('ry'));
      if (Number.isFinite(rx) && Number.isFinite(ry) && rx > 0 && ry > 0) {
        return { width: rx * 2, height: ry * 2 };
      }
    }

    const polygon = g.querySelector<SVGPolygonElement>('polygon');
    const pointsAttr = polygon?.getAttribute('points');
    if (pointsAttr) {
      const points = pointsAttr
        .trim()
        .split(/\s+/)
        .map((point) => point.split(',').map(Number))
        .filter(([px, py]) => Number.isFinite(px) && Number.isFinite(py));
      if (points.length > 0) {
        const xs = points.map(([px]) => px);
        const ys = points.map(([, py]) => py);
        return {
          width: Math.max(...xs) - Math.min(...xs),
          height: Math.max(...ys) - Math.min(...ys),
        };
      }
    }

    return null;
  }

  private _parseSvgRectBounds(rect: SVGRectElement): SvgRectBounds | null {
    const x = Number(rect.getAttribute('x') ?? 0);
    const y = Number(rect.getAttribute('y') ?? 0);
    const width = Number(rect.getAttribute('width'));
    const height = Number(rect.getAttribute('height'));
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
      return null;
    }

    const translate = this._parseCumulativeTranslate(rect);
    const tx = translate?.x ?? 0;
    const ty = translate?.y ?? 0;

    return { x: x + tx, y: y + ty, width, height };
  }

  private _parseSvgClusterLabelBounds(clusterGroup: SVGGElement): SvgRectBounds | null {
    const labelGroup = clusterGroup.querySelector<SVGGElement>('g.cluster-label');
    if (!labelGroup) return null;

    const translate = this._parseCumulativeTranslate(labelGroup);
    if (!translate) return null;

    const foreignObject = labelGroup.querySelector<SVGForeignObjectElement>('foreignObject');
    if (foreignObject) {
      const width = Number(foreignObject.getAttribute('width'));
      const height = Number(foreignObject.getAttribute('height'));
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        return { x: translate.x, y: translate.y, width, height };
      }
    }

    const text = labelGroup.querySelector<SVGTextElement>('text');
    if (text) {
      const x = Number(text.getAttribute('x') ?? 0);
      const y = Number(text.getAttribute('y') ?? 0);
      const width = Number(text.getAttribute('data-width'));
      const height = Number(text.getAttribute('data-height'));
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        return {
          x: translate.x + x,
          y: translate.y + y - height,
          width,
          height,
        };
      }
    }

    return null;
  }

  /**
   * Map SVG coordinates to 3D world coordinates using non-uniform scaling.
   * Scaling runs before 3D subgraph gap insertion, and cluster bounds are then
   * derived from the adjusted node positions.
   */
  private _mapSvgTo3D(
    nodes: MermaidNode[],
    svgPositions: SvgLayoutPositions,
    idMap: Map<string, string>,
    direction: MermaidDirection,
    nodeSubgraphs: Map<string, string>,
  ): Map<string, ClusterBounds> {
    const clusterBounds = new Map<string, ClusterBounds>();

    const nodeLookup = new Map<string, SvgNodePosition>();
    const rawClusterBounds = new Map<string, SvgRectBounds>();
    const rawClusterLabelBounds = new Map<string, SvgRectBounds>();
    const resolvedRows: Array<{
      id: string;
      svgElId: string;
      dataId: string | null;
      className: string;
      svgX: number;
      svgY: number;
      width: number | null;
      height: number | null;
    }> = [];
    for (const [originalId, svgElId] of idMap.entries()) {
      const pos = svgPositions.nodePositions.get(svgElId);
      if (pos) {
        nodeLookup.set(originalId, pos);
        if (nodes.some((node) => node.id === originalId)) {
          resolvedRows.push({
            id: originalId,
            svgElId,
            dataId: pos.dataId,
            className: pos.className,
            svgX: Number(pos.x.toFixed(2)),
            svgY: Number(pos.y.toFixed(2)),
            width: pos.width ? Number(pos.width.toFixed(2)) : null,
            height: pos.height ? Number(pos.height.toFixed(2)) : null,
          });
        }
      }

      const clusterRect = svgPositions.clusterBounds.get(svgElId);
      if (clusterRect) {
        rawClusterBounds.set(originalId, clusterRect);
      }

      const clusterLabel = svgPositions.clusterLabelBounds.get(svgElId);
      if (clusterLabel) {
        rawClusterLabelBounds.set(originalId, clusterLabel);
      }
    }

    const missingNodeIds = nodes.filter((node) => !nodeLookup.has(node.id)).map((node) => node.id);
    if (missingNodeIds.length > 0) {
      throw new Error(`MermaidParser: rendered SVG did not contain positions for nodes: ${missingNodeIds.join(', ')}`);
    }

    const rawPositions = new Map<string, FlowPosition>();
    const rawNodeWidths: number[] = [];
    const rawNodeHeights: number[] = [];

    let rawMinX = Infinity;
    let rawMaxX = -Infinity;
    let rawMinZ = Infinity;
    let rawMaxZ = -Infinity;

    for (const node of nodes) {
      const svgPos = nodeLookup.get(node.id);
      if (svgPos) {
        const { x: r3x, z: r3z } = this._svgPointToFlowPosition(svgPos);
        rawPositions.set(node.id, { x: r3x, z: r3z });
        rawMinX = Math.min(rawMinX, r3x);
        rawMaxX = Math.max(rawMaxX, r3x);
        rawMinZ = Math.min(rawMinZ, r3z);
        rawMaxZ = Math.max(rawMaxZ, r3z);
        if (svgPos.width && svgPos.width > 0) rawNodeWidths.push(svgPos.width);
        if (svgPos.height && svgPos.height > 0) rawNodeHeights.push(svgPos.height);
      }
    }

    if (!Number.isFinite(rawMinX)) return clusterBounds;

    const rawExtentX = rawMaxX - rawMinX;
    const rawExtentZ = rawMaxZ - rawMinZ;
    const aspect = rawExtentX / Math.max(rawExtentZ, 1);
    const medianRawWidth = this._median(rawNodeWidths);
    const medianRawHeight = this._median(rawNodeHeights);

    // Mermaid's rendered SVG is the source of truth. Use one uniform scale so
    // the 3D ground-plane projection preserves the 2D diagram's aspect ratio.
    // Size the SVG-to-world conversion from rendered Mermaid node dimensions,
    // not from total diagram extent. Otherwise large diagrams collapse center
    // spacing while fixed-size 3D node meshes stay large and overlap.
    const TARGET_NODE_WORLD_WIDTH = 4.4;
    const TARGET_NODE_WORLD_HEIGHT = 1.6;
    const scaleCandidates = [
      medianRawWidth ? TARGET_NODE_WORLD_WIDTH / medianRawWidth : null,
      medianRawHeight ? TARGET_NODE_WORLD_HEIGHT / medianRawHeight : null,
    ].filter((value): value is number => value !== null && Number.isFinite(value) && value > 0);
    const scale = this._median(scaleCandidates) ?? 0.03;

    const rawCX = (rawMinX + rawMaxX) / 2;
    const rawCZ = (rawMinZ + rawMaxZ) / 2;

    for (const node of nodes) {
      const raw = rawPositions.get(node.id);
      if (raw) {
        node.x = (raw.x - rawCX) * scale;
        node.z = (raw.z - rawCZ) * scale;
        node.y = 0;
      }
    }

    if (this._shouldLogLayoutDiagnostics()) {
      this._logLayoutDiagnostics({
        direction,
        rawExtentX,
        rawExtentZ,
        aspect,
        scale,
        medianRawWidth,
        medianRawHeight,
        nodes,
        resolvedRows,
      });
    }

    // Keep Mermaid's SVG layout intact. Extra 3D-only subgraph separation would
    // change the spatial relationships users see in the original 2D diagram.
    // this._separateSubgraphGroups3D(nodes, nodeSubgraphs);

    for (const [clusterId, rawRect] of rawClusterBounds.entries()) {
      const min = this._svgPointToFlowPosition({ x: rawRect.x, y: rawRect.y, width: null, height: null, className: '', dataId: null });
      const max = this._svgPointToFlowPosition({
        x: rawRect.x + rawRect.width,
        y: rawRect.y + rawRect.height,
        width: null,
        height: null,
        className: '',
        dataId: null,
      });

      const bounds: ClusterBounds = {
        minX: (Math.min(min.x, max.x) - rawCX) * scale,
        maxX: (Math.max(min.x, max.x) - rawCX) * scale,
        minZ: (Math.min(min.z, max.z) - rawCZ) * scale,
        maxZ: (Math.max(min.z, max.z) - rawCZ) * scale,
      };

      const rawLabel = rawClusterLabelBounds.get(clusterId);
      if (rawLabel) {
        const labelCenter = this._svgPointToFlowPosition({
          x: rawLabel.x + rawLabel.width / 2,
          y: rawLabel.y + rawLabel.height / 2,
          width: null,
          height: null,
          className: '',
          dataId: null,
        });
        bounds.labelCenterX = (labelCenter.x - rawCX) * scale;
        bounds.labelCenterZ = (labelCenter.z - rawCZ) * scale;
        bounds.labelWidth = rawLabel.width * scale;
        bounds.labelHeight = rawLabel.height * scale;
      }

      clusterBounds.set(clusterId, bounds);
    }

    if (clusterBounds.size === 0) {
      return this._computeClusterBoundsFromNodes(nodes, nodeSubgraphs);
    }

    for (const [clusterId, fallback] of this._computeClusterBoundsFromNodes(nodes, nodeSubgraphs)) {
      if (!clusterBounds.has(clusterId)) {
        clusterBounds.set(clusterId, fallback);
      }
    }

    return clusterBounds;
  }

  /**
   * Add extra spacing between different subgraph groups in the flow direction (X),
   * operating on already-scaled 3D node positions. This avoids the problem of
   * SVG-space gaps being crushed by flowScale.
   */
  private _separateSubgraphGroups3D(
    nodes: MermaidNode[],
    nodeSubgraphs: Map<string, string>,
  ): void {
    interface GroupRange { id: string; minX: number; maxX: number; nodeIndices: number[] }
    const grouped = new Map<string, GroupRange>();
    const ungrouped: GroupRange = { id: '__ungrouped__', minX: Infinity, maxX: -Infinity, nodeIndices: [] };

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!Number.isFinite(node.x)) continue;
      const sgId = nodeSubgraphs.get(node.id);
      if (sgId) {
        let group = grouped.get(sgId);
        if (!group) {
          group = { id: sgId, minX: Infinity, maxX: -Infinity, nodeIndices: [] };
          grouped.set(sgId, group);
        }
        group.minX = Math.min(group.minX, node.x);
        group.maxX = Math.max(group.maxX, node.x);
        group.nodeIndices.push(i);
      } else {
        ungrouped.minX = Math.min(ungrouped.minX, node.x);
        ungrouped.maxX = Math.max(ungrouped.maxX, node.x);
        ungrouped.nodeIndices.push(i);
      }
    }

    const groups = [...grouped.values()];
    if (ungrouped.nodeIndices.length > 0) groups.push(ungrouped);
    groups.sort((a, b) => a.minX - b.minX);
    if (groups.length < 2) return;

    // Compute minimum gap: 40% of average group width, clamped to MIN_3D_GAP
    const MIN_3D_GAP = 6.0;
    let totalWidth = 0;
    for (const g of groups) totalWidth += g.maxX - g.minX;
    const minGap = Math.max((totalWidth / groups.length) * 0.6, MIN_3D_GAP);

    // Track cumulative shift per group
    const shifts = new Map<string, number>();
    let shift = 0;
    shifts.set(groups[0].id, 0);
    for (let i = 1; i < groups.length; i++) {
      const gap = groups[i].minX - groups[i - 1].maxX;
      if (gap < minGap) shift += (minGap - gap);
      shifts.set(groups[i].id, shift);
    }

    // Apply shifts directly to node.x positions
    for (const g of groups) {
      const s = shifts.get(g.id)!;
      if (s === 0) continue;
      for (const idx of g.nodeIndices) {
        nodes[idx].x += s;
      }
    }
  }

  private _median(values: number[]): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private _logLayoutDiagnostics(args: {
    direction: MermaidDirection;
    rawExtentX: number;
    rawExtentZ: number;
    aspect: number;
    scale: number;
    medianRawWidth: number | null;
    medianRawHeight: number | null;
    nodes: MermaidNode[];
    resolvedRows: Array<{
      id: string;
      svgElId: string;
      dataId: string | null;
      className: string;
      svgX: number;
      svgY: number;
      width: number | null;
      height: number | null;
    }>;
  }): void {
    const { direction, rawExtentX, rawExtentZ, aspect, scale, medianRawWidth, medianRawHeight, nodes, resolvedRows } = args;
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

    let nearest: { a: string; b: string; dist: number; dx: number; dz: number } | null = null;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = Math.abs(a.x - b.x);
        const dz = Math.abs(a.z - b.z);
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (!nearest || dist < nearest.dist) {
          nearest = { a: a.id, b: b.id, dist, dx, dz };
        }
      }
    }

    console.groupCollapsed(`[MermaidParser] layout direction=${direction} nodes=${nodes.length}`);
    console.debug({
      rawExtentX: Number(rawExtentX.toFixed(2)),
      rawExtentZ: Number(rawExtentZ.toFixed(2)),
      aspect: Number(aspect.toFixed(2)),
      medianRawWidth: medianRawWidth ? Number(medianRawWidth.toFixed(2)) : null,
      medianRawHeight: medianRawHeight ? Number(medianRawHeight.toFixed(2)) : null,
      scale: Number(scale.toFixed(5)),
      worldExtentX: Number((maxX - minX).toFixed(2)),
      worldExtentZ: Number((maxZ - minZ).toFixed(2)),
      nearestPair: nearest
        ? {
            ...nearest,
            dist: Number(nearest.dist.toFixed(2)),
            dx: Number(nearest.dx.toFixed(2)),
            dz: Number(nearest.dz.toFixed(2)),
          }
        : null,
      fixedMeshReference: {
        defaultBodyWidth: 2.8,
        labelWidth: 4.2,
        sphereDiameter: 2.0,
      },
    });
    console.table(nodes.map((node) => ({
      id: node.id,
      x: Number(node.x.toFixed(2)),
      z: Number(node.z.toFixed(2)),
    })));
    console.table(resolvedRows);
    console.groupEnd();
  }

  private _shouldLogLayoutDiagnostics(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('sysviz.debug.mermaidLayout') === '1';
    } catch {
      return false;
    }
  }

  private _svgPointToFlowPosition(svgPos: SvgNodePosition): FlowPosition {
    return { x: svgPos.x, z: svgPos.y };
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
        if (!Number.isFinite(node.x) || !Number.isFinite(node.z)) continue;
        minX = Math.min(minX, node.x - CLUSTER_NODE_MARGIN_X);
        maxX = Math.max(maxX, node.x + CLUSTER_NODE_MARGIN_X);
        minZ = Math.min(minZ, node.z - CLUSTER_NODE_MARGIN_Z);
        maxZ = Math.max(maxZ, node.z + CLUSTER_NODE_MARGIN_Z);
      }
      if (Number.isFinite(minX)) {
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
    const TOLERANCE = Number.isFinite(minGap) ? minGap * 0.4 : 1.8;

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
