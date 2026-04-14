import * as THREE from 'three';

const RELATIONSHIP_COLORS = {
    ownership: 0xc9d1d9,
    network:   0x93c5fd,
    storage:   0x8b949e,
    config:    0xd29922,
    sync:      0xa5b4fc,
    async:     0x67e8f9,
    signal:    0xfcd34d,
    default:   0xd1d5db
};

const DASH_CONFIG = {
    network:   { dashSize: 0.3, gapSize: 0.15 },
    sync:      null,
    async:     { dashSize: 0.3, gapSize: 0.2 },
    signal:    { dashSize: 0.08, gapSize: 0.08 },
    default:   { dashSize: 0.3, gapSize: 0.15 }
};

const FLOW_SPEEDS = {
    network: 2.0,
    sync:    2.5,
    async:   1.0,
    signal:  3.5,
    default: 2.0
};

const CURVE_SEGMENTS = 32;
const BASE_LINE_WIDTH = 1.5;
const MIN_OPACITY = 0.25;
const MAX_OPACITY = 0.7;

export class ConnectionLineManager {
    constructor(scene) {
        this.scene = scene;
        this.connections = new Map();
        this.lineGroup = new THREE.Group();
        this.scene.add(this.lineGroup);
    }

    _getBaseOpacity(connection) {
        const trafficVolume = connection.trafficVolume || 1;
        return Math.min(MIN_OPACITY + trafficVolume * 0.05, MAX_OPACITY);
    }

    addConnection(connection, resourceMeshes) {
        if (this.connections.has(connection.id)) return;

        const sourceGroup = resourceMeshes.get(connection.sourceId);
        const targetGroup = resourceMeshes.get(connection.targetId);
        if (!sourceGroup || !targetGroup) return;

        const sourcePos = sourceGroup.position.clone();
        const targetPos = targetGroup.position.clone();

        const midpoint = new THREE.Vector3().lerpVectors(sourcePos, targetPos, 0.5);
        const distance = sourcePos.distanceTo(targetPos);
        midpoint.y += Math.min(distance * 0.3, 3);

        const curve = new THREE.QuadraticBezierCurve3(sourcePos, midpoint, targetPos);
        const points = curve.getPoints(CURVE_SEGMENTS);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        const relationColor = RELATIONSHIP_COLORS[connection.type] || RELATIONSHIP_COLORS.default;
        const opacity = this._getBaseOpacity(connection);
        const dashConfig = DASH_CONFIG[connection.type] ?? DASH_CONFIG.default;

        let material;
        if (dashConfig === null) {
            material = new THREE.LineBasicMaterial({
                color: relationColor,
                transparent: true,
                opacity,
                linewidth: BASE_LINE_WIDTH
            });
        } else {
            material = new THREE.LineDashedMaterial({
                color: relationColor,
                dashSize: dashConfig.dashSize,
                gapSize: dashConfig.gapSize,
                transparent: true,
                opacity,
                linewidth: BASE_LINE_WIDTH
            });
        }

        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        line.userData.connectionId = connection.id;
        line.userData.sourceId = connection.sourceId;
        line.userData.targetId = connection.targetId;
        line.userData.type = connection.type;
        line.userData.flowOffset = 0;
        line.userData.flowSpeed = (FLOW_SPEEDS[connection.type] || FLOW_SPEEDS.default) * (0.5 + Math.random() * 0.5);
        line.userData.curve = curve;

        this.lineGroup.add(line);

        this.connections.set(connection.id, {
            line,
            connection,
            curve,
            labelSprite: null,
            sourcePos: sourcePos.clone(),
            targetPos: targetPos.clone(),
            midpoint: midpoint.clone()
        });
    }

    removeConnection(connectionId) {
        const entry = this.connections.get(connectionId);
        if (!entry) return;

        this.lineGroup.remove(entry.line);
        entry.line.geometry.dispose();
        entry.line.material.dispose();

        if (entry.labelSprite) {
            this.lineGroup.remove(entry.labelSprite);
            if (entry.labelSprite.material.map) entry.labelSprite.material.map.dispose();
            entry.labelSprite.material.dispose();
        }

        this.connections.delete(connectionId);
    }

    updatePositions(resourceMeshes) {
        for (const [id, entry] of this.connections) {
            const sourceGroup = resourceMeshes.get(entry.connection.sourceId);
            const targetGroup = resourceMeshes.get(entry.connection.targetId);

            if (!sourceGroup || !targetGroup) {
                this.removeConnection(id);
                continue;
            }

            const sourcePos = sourceGroup.position;
            const targetPos = targetGroup.position;

            if (sourcePos.distanceToSquared(entry.sourcePos) < 0.001 &&
                targetPos.distanceToSquared(entry.targetPos) < 0.001) {
                continue;
            }

            entry.sourcePos.copy(sourcePos);
            entry.targetPos.copy(targetPos);

            const midpoint = new THREE.Vector3().lerpVectors(sourcePos, targetPos, 0.5);
            const distance = sourcePos.distanceTo(targetPos);
            midpoint.y += Math.min(distance * 0.3, 3);
            entry.midpoint.copy(midpoint);

            // Update label sprite position
            if (entry.labelSprite) {
                entry.labelSprite.position.copy(midpoint);
                entry.labelSprite.position.y += 0.4;
            }

            const curve = new THREE.QuadraticBezierCurve3(
                sourcePos.clone(), midpoint, targetPos.clone()
            );
            entry.curve = curve;
            entry.line.userData.curve = curve;

            const points = curve.getPoints(CURVE_SEGMENTS);
            entry.line.geometry.dispose();
            entry.line.geometry = new THREE.BufferGeometry().setFromPoints(points);
            entry.line.computeLineDistances();
        }
    }

    update(delta) {
        for (const entry of this.connections.values()) {
            const line = entry.line;
            line.userData.flowOffset += line.userData.flowSpeed * delta;
            if (line.material.isLineDashedMaterial) {
                line.material.dashOffset = -line.userData.flowOffset;
            }
        }
    }

    setConnectionActive(connectionId, active) {
        const entry = this.connections.get(connectionId);
        if (!entry) return;

        const baseSpeed = FLOW_SPEEDS[entry.connection.type] || FLOW_SPEEDS.default;
        entry.line.material.opacity = active ? MAX_OPACITY : this._getBaseOpacity(entry.connection) * 0.35;
        entry.line.userData.flowSpeed = baseSpeed * (active ? 2.4 : 0.45);
    }

    dispose() {
        for (const id of [...this.connections.keys()]) {
            this.removeConnection(id);
        }
        this.scene.remove(this.lineGroup);
    }
}
