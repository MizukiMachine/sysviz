import * as THREE from 'three';
import dagre from 'dagre';
import type {
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

const SHAPE_DAGRE_SIZES = {
  default: { width: 3.0, height: 1.6 },
  sphere: { width: 2.2, height: 2.2 },
  cylinder: { width: 2.0, height: 1.6 },
  diamond: { width: 2.2, height: 2.2 },
  torus: { width: 1.6, height: 1.6 },
} as const;

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

type BuildRoutesFn = ViewConfig['buildRoutes'];

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

export class MermaidParser {
  async parse(url: string): Promise<ViewConfig> {
    const text = await this._fetch(url);
    return this.parseText(text);
  }

  parseText(mmdText: string): ViewConfig {
    const tokens = this._tokenize(mmdText);

    const nodes = this._buildNodes(tokens);
    const connections = this._buildConnections(tokens);
    this._layoutWithDagre(nodes, connections, tokens.direction, tokens.subgraphs, tokens.nodeSubgraphs);
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
    };
  }

  async _fetch(url: string): Promise<string> {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`MermaidParser: Failed to fetch ${url}: ${resp.status}`);
    return resp.text();
  }

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

    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('%%')) continue;

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

        this._registerInlineNode(rawNodes, sourceId, sourceLabel);
        this._registerInlineNode(rawNodes, targetId, targetLabel);

        rawConnections.push({
          source: sourceId,
          target: targetId,
          label: edgeLabel ? edgeLabel.trim() : null,
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

  _layoutWithDagre(
    nodes: MermaidNode[],
    connections: MermaidConnection[],
    direction: MermaidDirection,
    _subgraphs: Map<string, VisualizationSubgraph>,
    _nodeSubgraphs: Map<string, string>,
  ): void {
    if (nodes.length === 0) return;

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: direction, nodesep: 3, ranksep: 5, marginx: 1, marginy: 1 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const node of nodes) {
      const size = SHAPE_DAGRE_SIZES[node.shape] || SHAPE_DAGRE_SIZES.default;
      g.setNode(node.id, { width: size.width, height: size.height });
    }
    for (const conn of connections) {
      g.setEdge(conn.sourceId, conn.targetId);
    }
    dagre.layout(g);

    // Build adjacency maps
    const outMap = new Map<string, string[]>();
    const inMap = new Map<string, string[]>();
    for (const conn of connections) {
      if (!outMap.has(conn.sourceId)) outMap.set(conn.sourceId, []);
      outMap.get(conn.sourceId)!.push(conn.targetId);
      if (!inMap.has(conn.targetId)) inMap.set(conn.targetId, []);
      inMap.get(conn.targetId)!.push(conn.sourceId);
    }

    // Dagre positions
    type DagrePos = { x: number; y: number };
    const dagrePos = new Map<string, DagrePos>();
    for (const node of nodes) {
      const dn = g.node(node.id) as DagrePos | undefined;
      if (dn) dagrePos.set(node.id, dn);
    }

    // Find main path (longest source→sink)
    const sources = nodes
      .filter(n => !inMap.has(n.id) || inMap.get(n.id)!.length === 0)
      .map(n => n.id);
    const mainPath = this._findLongestPath(sources, outMap);
    const mainPathSet = new Set(mainPath);

    // Sort main path by dagre X
    const mainPathSorted = [...mainPath].sort(
      (a, b) => (dagrePos.get(a)?.x ?? 0) - (dagrePos.get(b)?.x ?? 0),
    );

    // Classify branch nodes (rejoin → behind z, dead-end → above y)
    const branchInfo = this._classifyBranches(nodes, mainPathSet, outMap);

    // Layout constants
    const X_STEP = 5;
    const BRANCH_Z = -6;
    const BRANCH_Y_UP = 4;
    const BASE_Y = 1.2;

    // Place main path nodes
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    for (let i = 0; i < mainPathSorted.length; i++) {
      const node = nodeMap.get(mainPathSorted[i])!;
      node.x = i * X_STEP;
      node.y = BASE_Y;
      node.z = 0;
    }

    // Place branch nodes — at their branch point's X position
    for (const node of nodes) {
      if (mainPathSet.has(node.id)) continue;

      // Find branch point (nearest main-path ancestor via BFS)
      const branchPoint = this._findBranchPoint(node.id, mainPathSet, inMap);
      const bpNode = branchPoint ? nodeMap.get(branchPoint) : null;
      node.x = bpNode ? bpNode.x : 0;

      const info = branchInfo.get(node.id);
      if (info?.type === 'dead-end') {
        node.y = BASE_Y + BRANCH_Y_UP * info.depth;
        node.z = 0;
      } else {
        node.y = BASE_Y;
        node.z = info ? BRANCH_Z * info.depth : 0;
      }
    }

    // Center on main path
    if (mainPathSorted.length > 0) {
      const cx = ((mainPathSorted.length - 1) * X_STEP) / 2;
      for (const node of nodes) node.x -= cx;
    }
  }

  _findLongestPath(
    sources: string[],
    outMap: Map<string, string[]>,
  ): string[] {
    const memo = new Map<string, { length: number; path: string[] }>();
    const computing = new Set<string>();

    const dfs = (nodeId: string): { length: number; path: string[] } => {
      if (memo.has(nodeId)) return memo.get(nodeId)!;
      if (computing.has(nodeId)) return { length: 0, path: [] };
      computing.add(nodeId);

      const targets = outMap.get(nodeId) || [];
      let best: { length: number; path: string[] } = { length: 0, path: [] };
      for (const target of targets) {
        const sub = dfs(target);
        if (sub.length > best.length) best = sub;
      }

      computing.delete(nodeId);
      const result = { length: best.length + 1, path: [nodeId, ...best.path] };
      memo.set(nodeId, result);
      return result;
    };

    let longestPath: string[] = [];
    for (const source of sources) {
      const result = dfs(source);
      if (result.path.length > longestPath.length) longestPath = result.path;
    }
    return longestPath;
  }

  _findBranchPoint(
    nodeId: string,
    mainPathSet: Set<string>,
    inMap: Map<string, string[]>,
  ): string | null {
    const visited = new Set<string>();
    const queue: string[] = [...(inMap.get(nodeId) || [])];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      if (mainPathSet.has(current)) return current;
      queue.push(...(inMap.get(current) || []));
    }
    return null;
  }

  _classifyBranches(
    nodes: MermaidNode[],
    mainPathSet: Set<string>,
    outMap: Map<string, string[]>,
  ): Map<string, { type: 'rejoin' | 'dead-end'; depth: number }> {
    const result = new Map<string, { type: 'rejoin' | 'dead-end'; depth: number }>();
    const cache = new Map<string, boolean>();

    const reachesMain = (nodeId: string, visited: Set<string>): boolean => {
      if (mainPathSet.has(nodeId)) return true;
      if (cache.has(nodeId)) return cache.get(nodeId)!;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);

      for (const target of (outMap.get(nodeId) || [])) {
        if (reachesMain(target, visited)) {
          cache.set(nodeId, true);
          return true;
        }
      }
      cache.set(nodeId, false);
      return false;
    };

    for (const node of nodes) {
      if (mainPathSet.has(node.id)) continue;
      const reaches = reachesMain(node.id, new Set());
      result.set(node.id, { type: reaches ? 'rejoin' : 'dead-end', depth: 1 });
    }
    return result;
  }

  _extractLayers(nodes: MermaidNode[], direction: MermaidDirection): string[][] {
    const isLR = direction === 'LR' || direction === 'RL';
    const sorted = [...nodes].sort((a, b) => {
      const aFlow = isLR ? a.x : a.z;
      const bFlow = isLR ? b.x : b.z;
      return aFlow - bFlow;
    });

    const layers: string[][] = [];
    let currentLayer: string[] = [];
    let currentFlowPos: number | null = null;
    const TOLERANCE = 1.0;

    for (const node of sorted) {
      const flowPos = isLR ? node.x : node.z;
      if (currentFlowPos === null || Math.abs(flowPos - currentFlowPos) > TOLERANCE) {
        if (currentLayer.length > 0) layers.push(currentLayer);
        currentLayer = [node.id];
        currentFlowPos = flowPos;
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

  _calculateCamera(nodes: MermaidNode[]): VisualizationCamera {
    if (nodes.length === 0) {
      return { position: [18, 3, 14], target: [0, 0, 0] };
    }
    let minX = Infinity;
    let maxX = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
    }
    const cx = (minX + maxX) / 2;
    const spread = Math.max(maxX - minX, 10);
    return {
      position: [cx, spread * 0.5 + 1.5, spread * 0.55],
      target: [cx, 0, 0],
    };
  }

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
