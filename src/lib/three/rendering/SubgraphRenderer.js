import * as THREE from 'three';

// Design colors from sysviz-design.md
const BOX_COLOR = 0xf0f4f8;        // soft blue-tinted white
const BOX_OPACITY = 0.35;
const EDGE_COLOR = 0x94a3b8;       // slate-400
const EDGE_OPACITY = 0.7;
const PADDING = 2.0;
const BOX_HEIGHT = 2.4;
const BANNER_BG = '#e2e8f0';       // slate-200 — visible but muted
const BANNER_EDGE = '#94a3b8';     // slate-400 — matches box edges

function createBannerLabel(text) {
    const canvas = document.createElement('canvas');
    const cW = 768;
    const cH = 80;
    canvas.width = cW;
    canvas.height = cH;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, cW, cH);
    ctx.font = '600 28px "Inter", sans-serif';
    const metrics = ctx.measureText(text);
    const textW = Math.min(metrics.width + 40, cW - 20);
    const boxH = 44;
    const boxX = (cW - textW) / 2;
    const boxY = (cH - boxH) / 2;
    const r = 10;

    // Banner background
    ctx.fillStyle = BANNER_BG;
    ctx.beginPath();
    ctx.moveTo(boxX + r, boxY);
    ctx.lineTo(boxX + textW - r, boxY);
    ctx.quadraticCurveTo(boxX + textW, boxY, boxX + textW, boxY + r);
    ctx.lineTo(boxX + textW, boxY + boxH - r);
    ctx.quadraticCurveTo(boxX + textW, boxY + boxH, boxX + textW - r, boxY + boxH);
    ctx.lineTo(boxX + r, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - r);
    ctx.lineTo(boxX, boxY + r);
    ctx.quadraticCurveTo(boxX, boxY, boxX + r, boxY);
    ctx.closePath();
    ctx.fill();

    // Banner border
    ctx.strokeStyle = BANNER_EDGE;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cW / 2, cH / 2, cW - 40);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        sizeAttenuation: true
    }));
    sprite.scale.set(3.6, 0.38, 1);
    sprite.userData.isLabel = true;
    sprite.renderOrder = 5;
    return sprite;
}

export class SubgraphRenderer {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.group.userData.isSubgraphGroup = true;
        this.scene.add(this.group);
        this.subgraphs = new Map();
    }

    /**
     * Render subgraph boxes around their member nodes.
     * @param {Map<string, {id, title}>} subgraphs - subgraphId → {id, title}
     * @param {Map<string, string>} nodeSubgraphs - nodeId → subgraphId
     * @param {Map<string, THREE.Group>} resourceMeshes - nodeId → mesh group
     */
    render(subgraphs, nodeSubgraphs, resourceMeshes) {
        this.clear();

        if (!subgraphs || subgraphs.size === 0) return;

        // Group nodes by subgraph
        const membersBySg = new Map();
        for (const sg of subgraphs.values()) {
            membersBySg.set(sg.id, []);
        }
        for (const [nodeId, sgId] of nodeSubgraphs) {
            if (membersBySg.has(sgId) && resourceMeshes.has(nodeId)) {
                membersBySg.get(sgId).push(nodeId);
            }
        }

        for (const sg of subgraphs.values()) {
            const members = membersBySg.get(sg.id);
            if (!members || members.length === 0) continue;

            // Calculate AABB from member positions
            let minX = Infinity, maxX = -Infinity;
            let minZ = Infinity, maxZ = -Infinity;
            for (const nodeId of members) {
                const mesh = resourceMeshes.get(nodeId);
                if (!mesh) continue;
                const p = mesh.position;
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minZ = Math.min(minZ, p.z);
                maxZ = Math.max(maxZ, p.z);
            }

            const width = maxX - minX + PADDING * 2;
            const depth = maxZ - minZ + PADDING * 2;
            const cx = (minX + maxX) / 2;
            const cz = (minZ + maxZ) / 2;

            const sgGroup = new THREE.Group();

            // Semi-transparent box
            const boxGeo = new THREE.BoxGeometry(width, BOX_HEIGHT, depth);
            const boxMat = new THREE.MeshStandardMaterial({
                color: BOX_COLOR,
                transparent: true,
                opacity: BOX_OPACITY,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.set(cx, BOX_HEIGHT / 2, cz);
            sgGroup.add(box);

            // Edge wireframe
            const edgesGeo = new THREE.EdgesGeometry(boxGeo);
            const edgesMat = new THREE.LineBasicMaterial({
                color: EDGE_COLOR,
                transparent: true,
                opacity: EDGE_OPACITY
            });
            const edges = new THREE.LineSegments(edgesGeo, edgesMat);
            edges.position.set(cx, BOX_HEIGHT / 2, cz);
            sgGroup.add(edges);

            // Banner label — sits at the top edge, half overlapping the box
            const title = sg.title || sg.id;
            const label = createBannerLabel(title);
            label.position.set(cx, BOX_HEIGHT - 0.05, cz);
            sgGroup.add(label);

            this.group.add(sgGroup);
            this.subgraphs.set(sg.id, { group: sgGroup, box, edges, label });
        }
    }

    clear() {
        for (const [id, entry] of this.subgraphs) {
            this.group.remove(entry.group);
            entry.group.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            });
        }
        this.subgraphs.clear();
    }

    dispose() {
        this.clear();
        this.scene.remove(this.group);
    }
}
