import * as THREE from 'three';
import { createLabelSprite } from './ResourceMeshes.js';

// Design colors from sysviz-design.md
const BOX_COLOR = 0xfafafa;        // off-white
const BOX_OPACITY = 0.12;
const EDGE_COLOR = 0xd1d5db;       // slate gray
const EDGE_OPACITY = 0.45;
const PADDING = 2.0;

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
            const height = 1.2;

            const sgGroup = new THREE.Group();

            // Semi-transparent box
            const boxGeo = new THREE.BoxGeometry(width, height, depth);
            const boxMat = new THREE.MeshStandardMaterial({
                color: BOX_COLOR,
                transparent: true,
                opacity: BOX_OPACITY,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.set(cx, -0.1, cz);
            sgGroup.add(box);

            // Edge wireframe
            const edgesGeo = new THREE.EdgesGeometry(boxGeo);
            const edgesMat = new THREE.LineBasicMaterial({
                color: EDGE_COLOR,
                transparent: true,
                opacity: EDGE_OPACITY
            });
            const edges = new THREE.LineSegments(edgesGeo, edgesMat);
            edges.position.set(cx, -0.1, cz);
            sgGroup.add(edges);

            // Group name label at top
            const title = sg.title || sg.id;
            const label = createLabelSprite(title, {
                fontSize: 20,
                width: 512,
                height: 48,
                scale: { x: 3.0, y: 0.32, z: 1 }
            });
            label.position.set(cx, height / 2 + 0.3, cz);
            label.renderOrder = 5;
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
