import * as THREE from 'three';

// Design colors from sysviz-design.md
const BOX_COLOR = 0xf0f4f8;        // soft blue-tinted white
const BOX_OPACITY = 0.35;
const EDGE_COLOR = 0x94a3b8;       // slate-400
const EDGE_OPACITY = 0.7;
const PADDING = 2.0;
const BOX_HEIGHT = 2.4;

function createFloorLabelTexture(text) {
    const canvas = document.createElement('canvas');
    const cW = 1024;
    const cH = 512;
    canvas.width = cW;
    canvas.height = cH;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, cW, cH);

    // Label text
    ctx.fillStyle = 'rgba(51, 65, 85, 0.85)'; // slate-700
    ctx.font = '700 48px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cW / 2, cH / 2, cW - 60);

    // Subtle underline
    const metrics = ctx.measureText(text);
    const lineW = Math.min(metrics.width, cW - 60);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo((cW - lineW) / 2, cH / 2 + 32);
    ctx.lineTo((cW + lineW) / 2, cH / 2 + 32);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    return texture;
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

            // Semi-transparent box (single material)
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

            // Floor label — plane on the bottom of the box, facing up (+Y)
            const title = sg.title || sg.id;
            const floorTex = createFloorLabelTexture(title);

            // Use full box floor, maintain 2:1 aspect to prevent text stretch
            // For single-node subgraphs, scale up for readability
            const scaleFactor = members.length === 1 ? 1.8 : 1;
            const texAspect = 2;
            let planeW, planeD;
            if ((width * scaleFactor) / (depth * scaleFactor) > texAspect) {
                planeD = depth * scaleFactor;
                planeW = planeD * texAspect;
            } else {
                planeW = width * scaleFactor;
                planeD = planeW / texAspect;
            }

            const floorGeo = new THREE.PlaneGeometry(planeW, planeD);
            const floorMat = new THREE.MeshBasicMaterial({
                map: floorTex,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide,
            });
            const floorPlane = new THREE.Mesh(floorGeo, floorMat);
            floorPlane.rotation.x = -Math.PI / 2;
            floorPlane.position.set(cx, 0.02, cz + depth * 0.25);
            floorPlane.userData.isLabel = true;
            floorPlane.renderOrder = 1;
            sgGroup.add(floorPlane);

            this.group.add(sgGroup);
            this.subgraphs.set(sg.id, { group: sgGroup, box, edges, floorPlane });
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
