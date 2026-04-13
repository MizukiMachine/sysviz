import * as THREE from 'three';
import dagre from 'dagre';

// --- Mermaid standard shape → 3D mapping (generic engine) ---

const MERMAID_SHAPE_3D = {
    default:       { shape: 'default',  type: 'application' },
    rounded:       { shape: 'default',  type: 'application' },
    diamond:       { shape: 'diamond',  type: 'application' },
    circle:        { shape: 'sphere',   type: 'browser' },
    database:      { shape: 'cylinder', type: 'datastore' },
    subroutine:    { shape: 'cylinder', type: 'server' },
    hexagon:       { shape: 'diamond',  type: 'application' },
    parallelogram: { shape: 'default',  type: 'application' },
    asymmetric:    { shape: 'default',  type: 'application' },
};

// --- Enriched [Tag] → Shape mapping (backward compatible with .mmd files using tags) ---

const TAG_SHAPE_MAP = {
    'User':    { shape: 'sphere',   type: 'browser' },
    'CLI':     { shape: 'sphere',   type: 'browser' },
    'Entry':   { shape: 'cylinder', type: 'server' },
    'Ctx':     { shape: 'diamond',  type: 'application' },
    'Hook':    { shape: 'default',  type: 'application' },
    'Router':  { shape: 'diamond',  type: 'application' },
    'View':    { shape: 'default',  type: 'application' },
    'Error':   { shape: 'default',  type: 'application' },
    'Resp':    { shape: 'default',  type: 'application' },
    'Session': { shape: 'cylinder', type: 'application' },
    'Cleanup': { shape: 'default',  type: 'application' },
    'Output':  { shape: 'torus',    type: 'response' },
    'DB':      { shape: 'cylinder', type: 'datastore' },
    'Store':   { shape: 'cylinder', type: 'datastore' },
};

// --- Label → Connection type mapping (Section 5) ---

const LABEL_TYPE_MAP = {
    'error':     { type: 'signal',  trafficVolume: 1 },
    'exception': { type: 'signal',  trafficVolume: 1 },
    'HTTP':      { type: 'network', trafficVolume: 3 },
    'async':     { type: 'async',   trafficVolume: 1 },
    'config':    { type: 'config',  trafficVolume: 1 },
    'store':     { type: 'storage', trafficVolume: 1 },
};

// --- Line style → Connection type mapping (Mermaid standard) ---

const LINE_STYLE_TYPE_MAP = {
    '-.->': { type: 'async',   trafficVolume: 1 },
    '==>':  { type: 'network', trafficVolume: 3 },
    '-->':  { type: 'sync',    trafficVolume: 2 },
    '---':  { type: 'sync',    trafficVolume: 2 },
};

// --- Fallback palette (Section 4) ---

const FALLBACK_PALETTE = [
    0x6C9BD2, 0x7BC67E, 0x7BC7C4, 0xD4A76A,
    0xC77DBA, 0x8BD49E, 0xD4826A, 0x9AABB8
];

// --- Node sizes for dagre layout ---

const SHAPE_DAGRE_SIZES = {
    default:  { width: 3.0, height: 1.6 },
    sphere:   { width: 2.2, height: 2.2 },
    cylinder: { width: 2.0, height: 1.6 },
    diamond:  { width: 2.2, height: 2.2 },
    torus:    { width: 1.6, height: 1.6 }
};

// --- Color utilities ---

function hexToHSL(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
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

function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * Math.max(0, Math.min(1, color)))
            .toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function pastelize(hexColor) {
    const hsl = hexToHSL(hexColor);
    hsl.s = Math.max(35, Math.min(55, hsl.s));
    hsl.l = Math.max(55, Math.min(75, hsl.l));
    return parseInt(hslToHex(hsl.h, hsl.s, hsl.l).slice(1), 16);
}

// --- Main Parser ---

export class MermaidParser {

    /**
     * Parse a .mmd file and return view data compatible with loadView().
     * @param {string} url - Path to the .mmd file
     * @returns {{ nodes, connections, timeline, camera, buildRoutes, subgraphs, nodeSubgraphs }}
     */
    async parse(url) {
        const text = await this._fetch(url);
        return this.parseText(text);
    }

    /**
     * Parse a Mermaid text string directly (no fetch).
     * @param {string} mmdText - Mermaid flowchart text
     * @returns {{ nodes, connections, timeline, camera, buildRoutes, subgraphs, nodeSubgraphs }}
     */
    parseText(mmdText) {
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
            nodeSubgraphs: tokens.nodeSubgraphs
        };
    }

    // --- Fetch ---

    async _fetch(url) {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`MermaidParser: Failed to fetch ${url}: ${resp.status}`);
        return resp.text();
    }

    // --- Tokenizer (Section 1) ---

    _tokenize(text) {
        const lines = text.split('\n');
        let direction = 'LR';
        const rawNodes = new Map();
        const rawConnections = [];
        const subgraphs = new Map();
        const styles = new Map();
        const nodeSubgraphs = new Map();
        let currentSubgraph = null;
        let sgOrder = 0;

        for (const line of lines) {
            const t = line.trim();
            if (!t || t.startsWith('%%')) continue;

            // Direction
            const dirM = t.match(/^flowchart\s+(LR|TB|BT|RL)$/);
            if (dirM) { direction = dirM[1]; continue; }

            // Subgraph end
            if (t === 'end') { currentSubgraph = null; continue; }

            // Subgraph start
            const sgM = t.match(/^subgraph\s+(\w+)(?:\["(.+?)"\])?/);
            if (sgM) {
                subgraphs.set(sgM[1], { id: sgM[1], title: sgM[2] || sgM[1], order: sgOrder++ });
                currentSubgraph = sgM[1];
                continue;
            }

            // Style definition
            const stM = t.match(/^style\s+(\w+)\s+fill:(#[0-9A-Fa-f]{6})/);
            if (stM) { styles.set(stM[1], stM[2]); continue; }

            // Connection — supports Mermaid line styles: -->, -.->, ==>, ---
            // Handles bare IDs, inline [text] definitions, and edge labels
            const edgeM = t.match(/^(\w+)(?:\["([^"]*)"|\[([^\]]*)\])?\s*(-\.->|==>|-->|---)\s*(?:\|([^|]+)\|\s*)?(\w+)(?:\["([^"]*)"|\[([^\]]*)\])?$/);
            if (edgeM) {
                const sourceId = edgeM[1];
                const sourceLabel = edgeM[2] !== undefined ? edgeM[2] : edgeM[3];
                const lineStyle = edgeM[4];
                const edgeLabel = edgeM[5];
                const targetId = edgeM[6];
                const targetLabel = edgeM[7] !== undefined ? edgeM[7] : edgeM[8];

                // Register inline node definitions if node not already defined
                this._registerInlineNode(rawNodes, sourceId, sourceLabel);
                this._registerInlineNode(rawNodes, targetId, targetLabel);

                rawConnections.push({ source: sourceId, target: targetId, label: edgeLabel ? edgeLabel.trim() : null, lineStyle: lineStyle || '-->' });

                // P2 fix: record subgraph membership for edge-discovered nodes
                if (currentSubgraph) {
                    if (!nodeSubgraphs.has(sourceId)) nodeSubgraphs.set(sourceId, currentSubgraph);
                    if (!nodeSubgraphs.has(targetId)) nodeSubgraphs.set(targetId, currentSubgraph);
                }

                continue;
            }

            // Node with [Tag] (must be checked before no-tag)
            const ntM = t.match(/^(\w+)\["\[(\w+)\]\s*(.*)"\]$/);
            if (ntM) {
                const namePart = ntM[3].split('<br/>')[0].trim();
                rawNodes.set(ntM[1], {
                    id: ntM[1],
                    tag: ntM[2],
                    text: ntM[3],
                    name: namePart || ntM[1],
                    mermaidShape: null
                });
                if (currentSubgraph) nodeSubgraphs.set(ntM[1], currentSubgraph);
                continue;
            }

            // Node without tag
            const nM = t.match(/^(\w+)\["(.*)"\]$/);
            if (nM) {
                const namePart = nM[2].split('<br/>')[0].trim();
                rawNodes.set(nM[1], {
                    id: nM[1],
                    tag: null,
                    text: nM[2],
                    name: namePart || nM[1],
                    mermaidShape: null
                });
                if (currentSubgraph) nodeSubgraphs.set(nM[1], currentSubgraph);
                continue;
            }

            // Circle: ID((text))
            const cirM = t.match(/^(\w+)\(\(\s*(.+)\s*\)\)$/);
            if (cirM) {
                const text = cirM[2].trim().replace(/^"|"$/g, '');
                const namePart = text.split('<br/>')[0].trim();
                rawNodes.set(cirM[1], {
                    id: cirM[1], tag: null, text, name: namePart || cirM[1], mermaidShape: 'circle'
                });
                if (currentSubgraph) nodeSubgraphs.set(cirM[1], currentSubgraph);
                continue;
            }

            // Database: ID[(text)]
            const dbM = t.match(/^(\w+)\[\(\s*(.+)\s*\)\]$/);
            if (dbM) {
                const text = dbM[2].trim().replace(/^"|"$/g, '');
                const namePart = text.split('<br/>')[0].trim();
                rawNodes.set(dbM[1], {
                    id: dbM[1], tag: null, text, name: namePart || dbM[1], mermaidShape: 'database'
                });
                if (currentSubgraph) nodeSubgraphs.set(dbM[1], currentSubgraph);
                continue;
            }

            // Diamond: ID{text}
            const diaM = t.match(/^(\w+)\{(?:"(.+)"|(.+))\}$/);
            if (diaM) {
                const text = (diaM[2] !== undefined ? diaM[2] : diaM[3]).trim();
                const namePart = text.split('<br/>')[0].trim();
                rawNodes.set(diaM[1], {
                    id: diaM[1], tag: null, text, name: namePart || diaM[1], mermaidShape: 'diamond'
                });
                if (currentSubgraph) nodeSubgraphs.set(diaM[1], currentSubgraph);
                continue;
            }

            // Rounded: ID(text) — must be checked after circle ((...))
            const rndM = t.match(/^(\w+)\((?!\()(?:"(.+)"|(.+))\)$/);
            if (rndM) {
                const text = (rndM[2] !== undefined ? rndM[2] : rndM[3]).trim();
                const namePart = text.split('<br/>')[0].trim();
                rawNodes.set(rndM[1], {
                    id: rndM[1], tag: null, text, name: namePart || rndM[1], mermaidShape: 'rounded'
                });
                if (currentSubgraph) nodeSubgraphs.set(rndM[1], currentSubgraph);
                continue;
            }

            // Rectangle (unquoted): ID[text] — must be checked after database [(...)]
            const rectM = t.match(/^(\w+)\[(?!\[)([^\]]*)\]$/);
            if (rectM) {
                const text = rectM[2].trim();
                const namePart = text.split('<br/>')[0].trim();
                rawNodes.set(rectM[1], {
                    id: rectM[1], tag: null, text, name: namePart || rectM[1], mermaidShape: 'default'
                });
                if (currentSubgraph) nodeSubgraphs.set(rectM[1], currentSubgraph);
                continue;
            }
        }

        return { direction, rawNodes, rawConnections, subgraphs, styles, nodeSubgraphs };
    }

    _ensureNode(rawNodes, id) {
        if (!rawNodes.has(id)) {
            rawNodes.set(id, { id, tag: null, text: id, name: id, mermaidShape: null });
        }
    }

    _registerInlineNode(rawNodes, id, label) {
        if (label === undefined) {
            // Bare ID — ensure minimal node entry
            this._ensureNode(rawNodes, id);
            return;
        }
        if (rawNodes.has(id)) return; // Don't overwrite explicit definitions

        const tagMatch = label.match(/^\[(\w+)\]\s*(.*)$/);
        if (tagMatch) {
            const namePart = tagMatch[2].split('<br/>')[0].trim();
            rawNodes.set(id, { id, tag: tagMatch[1], text: label, name: namePart || id, mermaidShape: null });
        } else {
            const namePart = label.split('<br/>')[0].trim();
            rawNodes.set(id, { id, tag: null, text: label, name: namePart || id, mermaidShape: null });
        }
    }

    // --- Build Nodes (Section 3: shape mapping) ---

    _buildNodes(tokens) {
        const nodes = [];
        let i = 0;
        for (const raw of tokens.rawNodes.values()) {
            // Priority: mermaidShape (syntax) > tag (enriched) > default
            let shape = 'default';
            let type = 'application';

            if (raw.mermaidShape) {
                const info = MERMAID_SHAPE_3D[raw.mermaidShape];
                if (info) { shape = info.shape; type = info.type; }
            } else if (raw.tag) {
                const info = TAG_SHAPE_MAP[raw.tag];
                if (info) { shape = info.shape; type = info.type; }
            }

            nodes.push({
                id: raw.id,
                name: raw.name,
                type,
                shape,
                status: 'idle',
                color: 0xe2e8f0,
                x: 0, y: 0, z: 0,
                dataIn: '-',
                dataOut: '-',
                floatOffset: i * 0.5,
                glowOffset: i * 0.3 + 0.3
            });
            i++;
        }
        return nodes;
    }

    // --- Build Connections (Section 5: type mapping) ---

    _buildConnections(tokens) {
        return tokens.rawConnections.map(rc => {
            // Base type from line style
            const ls = LINE_STYLE_TYPE_MAP[rc.lineStyle] || LINE_STYLE_TYPE_MAP['-->'];
            let type = ls.type;
            let trafficVolume = ls.trafficVolume;

            // Override with label-based mapping if available
            if (rc.label) {
                const mapped = LABEL_TYPE_MAP[rc.label] || LABEL_TYPE_MAP[rc.label.toLowerCase()];
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
                _label: rc.label
            };
        });
    }

    // --- Layout with dagre ---

    _layoutWithDagre(nodes, connections, direction, subgraphs, nodeSubgraphs) {
        // Run dagre for topological ordering
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

        // Sort nodes by dagre X position (topological order) → single line along X
        const sorted = nodes.filter(n => g.node(n.id))
            .sort((a, b) => g.node(a.id).x - g.node(b.id).x);

        const X_STEP = 5;
        for (let i = 0; i < sorted.length; i++) {
            sorted[i].x = i * X_STEP;
            sorted[i].y = 1.2;
            sorted[i].z = 0;
        }

        // Center on X
        if (sorted.length > 0) {
            const cx = (sorted.length - 1) * X_STEP / 2;
            for (const n of nodes) { n.x -= cx; }
        }
    }

    // --- Extract pseudo-layers from dagre positions for timeline ---

    _extractLayers(nodes, direction) {
        const isLR = (direction === 'LR' || direction === 'RL');

        const sorted = [...nodes].sort((a, b) => {
            const aFlow = isLR ? a.x : a.z;
            const bFlow = isLR ? b.x : b.z;
            return aFlow - bFlow;
        });

        const layers = [];
        let currentLayer = [];
        let currentFlowPos = null;
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

    // --- Colors (Section 4) ---

    _applyColors(nodes, styles) {
        for (const node of nodes) {
            const hexColor = styles.get(node.id);
            if (hexColor) {
                node.color = pastelize(hexColor);
            }
        }

        // Fallback palette rotation for unstyled nodes
        let pi = 0;
        for (const node of nodes) {
            if (!styles.has(node.id)) {
                node.color = FALLBACK_PALETTE[pi % FALLBACK_PALETTE.length];
                pi++;
            }
        }
    }

    // --- Data labels from connection labels ---

    _applyDataLabels(nodes, connections) {
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        // dataOut: prefer non-error outgoing connection label
        for (const node of nodes) {
            const outConns = connections.filter(c => c.sourceId === node.id);
            const normal = outConns.find(c => c.type !== 'signal');
            const any = outConns[0];
            const label = (normal || any)?._label;
            if (label) node.dataOut = label;
        }

        // dataIn: first incoming connection label
        for (const node of nodes) {
            const inConn = connections.find(c => c.targetId === node.id);
            if (inConn?._label) node.dataIn = inConn._label;
        }
    }

    // --- Camera (Section 7) ---

    _calculateCamera(nodes) {
        if (nodes.length === 0) {
            return { position: [18, 3, 14], target: [0, 0, 0] };
        }
        let minX = Infinity, maxX = -Infinity;
        for (const n of nodes) {
            minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
        }
        const cx = (minX + maxX) / 2;
        const spread = Math.max(maxX - minX, 10);
        return {
            position: [cx, 4, cx + spread * 0.8],
            target: [cx, 1.2, 0]
        };
    }

    // --- Timeline (Section 6) ---

    _generateTimeline(nodes, connections, layers, subgraphs, nodeSubgraphs) {
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const NODE_DURATION = 3.5;
        const ROUTE_ON = 0.5;
        const ROUTE_OFF = 3.3;

        // Build outgoing connection map per node
        const outMap = new Map();
        for (const c of connections) {
            if (!outMap.has(c.sourceId)) outMap.set(c.sourceId, []);
            outMap.get(c.sourceId).push(c);
        }

        const keyframes = [];
        const activeOrder = [];
        let time = 0;

        for (const layer of layers) {
            for (const nodeId of layer) {
                const node = nodeMap.get(nodeId);
                if (!node) continue;

                // Generate caption from subgraph phase + node name
                const sgId = nodeSubgraphs.get(nodeId);
                const sg = sgId ? subgraphs.get(sgId) : null;
                const phase = sg ? sg.title.split('/')[0].trim() : '';
                const caption = phase
                    ? `${phase}: ${node.name} を実行します`
                    : `${node.name} を処理中`;

                keyframes.push({
                    time,
                    type: 'resource',
                    id: nodeId,
                    status: 'active',
                    caption
                });
                activeOrder.push({ time, id: nodeId });

                // Activate outgoing routes
                for (const c of (outMap.get(nodeId) || [])) {
                    keyframes.push({ time: time + ROUTE_ON, type: 'route', id: `route-${c.id}`, active: true });
                    keyframes.push({ time: time + ROUTE_OFF, type: 'route', id: `route-${c.id}`, active: false });
                }

                time += NODE_DURATION;
            }
        }

        // Mark previous node as complete when next node activates
        for (let i = 1; i < activeOrder.length; i++) {
            keyframes.push({
                time: activeOrder[i].time,
                type: 'resource',
                id: activeOrder[i - 1].id,
                status: 'complete'
            });
        }

        keyframes.sort((a, b) => a.time - b.time);
        return { duration: time + 2, keyframes };
    }

    // --- buildTrafficRoutes (Section 8) ---

    _createBuildRoutes(nodes, connections) {
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const lastConnId = connections.length > 0 ? connections[connections.length - 1].id : null;

        return function buildRoutes(resourceMeshes) {
            return connections.flatMap(conn => {
                const srcMesh = resourceMeshes.get(conn.sourceId);
                const tgtMesh = resourceMeshes.get(conn.targetId);
                if (!srcMesh || !tgtMesh) return [];

                let trafficType = 'default';
                if (conn.type === 'signal') trafficType = 'error';
                else if (conn.id === lastConnId) trafficType = 'healthy';

                return [{
                    id: `route-${conn.id}`,
                    sourceId: conn.sourceId,
                    targetId: conn.targetId,
                    sourcePos: srcMesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)),
                    targetPos: tgtMesh.position.clone().add(new THREE.Vector3(0, 0.6, 0)),
                    payload: nodeMap.get(conn.sourceId)?.dataOut || '',
                    trafficType,
                    requestRate: 1.25
                }];
            });
        };
    }
}
