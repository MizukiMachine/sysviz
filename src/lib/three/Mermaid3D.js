import * as THREE from 'three';
import { ClusterRenderer } from './rendering/ClusterRenderer.js';
import { PlaybackEngine } from './engine/PlaybackEngine.js';
import { SubgraphRenderer } from './rendering/SubgraphRenderer.js';
import { MermaidParser } from './parser/MermaidParser.js';

export class Mermaid3D {
    /**
     * @param {HTMLElement} container - Canvas element or a container element
     */
    constructor(container) {
        this.canvas = container.tagName === 'CANVAS' ? container : this._createCanvas(container);
        this.renderer = new ClusterRenderer(this.canvas);
        this.parser = new MermaidParser();
        this.subgraphRenderer = new SubgraphRenderer(this.renderer.scene);
        this.playback = null;
        this._currentResourceIds = [];
        this._currentConnections = [];

        this.renderer.onAnimate = (delta) => {
            if (this.playback && this.playback.state === 'playing') {
                this.playback.update(delta);
            }
        };

        this.renderer.start();
    }

    _createCanvas(container) {
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.touchAction = 'none';
        container.appendChild(canvas);
        return canvas;
    }

    /**
     * Parse and render a Mermaid flowchart text.
     * @param {string} mmdText - Mermaid flowchart text
     */
    render(mmdText) {
        const data = this.parser.parseText(mmdText);

        this._clearScene();
        this._addNodes(data.nodes);
        this._addConnections(data.connections);
        this._addRoutes(data.buildRoutes);
        this._renderSubgraphs(data.subgraphs, data.nodeSubgraphs);
        this._setCamera(data.camera);
        this._initPlayback(data.timeline);

        this._currentConnections = data.connections;
    }

    _clearScene() {
        for (const id of [...this.renderer.resourceMeshes.keys()]) {
            this.renderer.removeResource(id);
        }
        for (const id of [...this.renderer.connectionLines.connections.keys()]) {
            this.renderer.connectionLines.removeConnection(id);
        }
        for (const id of [...this.renderer.particleTraffic.routes.keys()]) {
            this.renderer.particleTraffic.removeRoute(id);
        }
        this.subgraphRenderer.clear();
        this._currentResourceIds = [];
        this._currentConnections = [];
    }

    _resetScene() {
        for (const id of this._currentResourceIds) {
            this.renderer.setResourceStatus(id, 'idle');
        }
        for (const conn of this._currentConnections) {
            this._setRouteActive(`route-${conn.id}`, false);
        }
        this.renderer.clearTrafficParticles();
    }

    _addNodes(nodes) {
        this._currentResourceIds = nodes.map(n => n.id);
        for (const node of nodes) {
            this.renderer.addResource(node);
        }
    }

    _addConnections(connections) {
        for (const conn of connections) {
            this.renderer.addConnection(conn);
        }
    }

    _addRoutes(buildRoutes) {
        const routes = buildRoutes(this.renderer.resourceMeshes);
        for (const route of routes) {
            this.renderer.addTrafficRoute(route);
        }
    }

    _renderSubgraphs(subgraphs, nodeSubgraphs) {
        if (subgraphs && subgraphs.size > 0) {
            this.subgraphRenderer.render(subgraphs, nodeSubgraphs, this.renderer.resourceMeshes);
        }
    }

    _setCamera(camera) {
        if (camera) {
            this.renderer.camera.position.set(...camera.position);
            this.renderer.controls.target.set(...camera.target);
        } else {
            this.renderer.resetCamera();
        }
        this.renderer.controls.update();
    }

    _initPlayback(timeline) {
        this._resetScene();

        this.playback = new PlaybackEngine(timeline, {
            onResourceState: (id, status) => {
                this.renderer.setResourceStatus(id, status);
                if (status === 'active') {
                    const stepIdx = this.playback.steps.findIndex(s => s.nodeId === id);
                    const nextNodeId = stepIdx >= 0 && stepIdx < this.playback.steps.length - 1
                        ? this.playback.steps[stepIdx + 1].nodeId
                        : null;
                    this._focusOnNode(id, nextNodeId);
                }
            },
            onRouteState: (routeId, active) => {
                this._setRouteActive(routeId, active);
            },
            onCaption: (text) => {
                if (this.onCaption) this.onCaption(text);
            },
            onReset: () => {
                this._resetScene();
            },
            onStateChange: (state) => {
                this.renderer.lockDrag = (state === 'playing');
            },
            onStepChange: (nodeId, caption, stepIndex, totalSteps) => {
                this._focusOnNode(nodeId);
                if (this.onCaption) this.onCaption(caption || '');
            }
        });
    }

    _focusOnNode(nodeId, nextNodeId) {
        const mesh = this.renderer.resourceMeshes.get(nodeId);
        if (!mesh) return;

        let targetPos = mesh.position.clone();
        if (nextNodeId) {
            const nextMesh = this.renderer.resourceMeshes.get(nextNodeId);
            if (nextMesh) {
                targetPos = mesh.position.clone().add(nextMesh.position).multiplyScalar(0.5);
            }
        }

        const cameraOffset = new THREE.Vector3(0, 3, 14);
        const cameraPos = targetPos.clone().add(cameraOffset);

        this.renderer.flyTo(targetPos, cameraPos, 1000);
    }

    _setRouteActive(routeId, active) {
        this.renderer.setTrafficRouteActive(routeId, active);
        this.renderer.setConnectionActive(routeId.replace(/^route-/, ''), active);
    }

    play() {
        if (this.playback) this.playback.play();
    }

    pause() {
        if (this.playback) this.playback.pause();
    }

    stop() {
        if (this.playback) this.playback.stop();
    }

    next() {
        if (this.playback) this.playback.next();
    }

    prev() {
        if (this.playback) this.playback.prev();
    }

    dispose() {
        if (this.playback) {
            this.playback.stop();
            this.playback = null;
        }
        this.subgraphRenderer.dispose();
        this.renderer.dispose();
    }
}
