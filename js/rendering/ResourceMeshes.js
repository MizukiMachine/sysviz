import * as THREE from 'three';

const STATUS_COLORS = {
    idle: 0x94a3b8,
    active: 0x22c55e,
    complete: 0x3b82f6,
    error: 0xef4444,
    default: 0x94a3b8
};

const BASE_COLOR = 0xe2e8f0;
const TEXT_COLOR = '#0f172a';
const LABEL_BG = 'rgba(255, 255, 255, 0.96)';
const LABEL_STROKE = 'rgba(15, 23, 42, 0.12)';
const _labelTextureCache = new Map();

function getStatusColor(status) {
    if (!status) return STATUS_COLORS.default;
    return STATUS_COLORS[String(status).toLowerCase()] || STATUS_COLORS.default;
}

function roundedBoxGeometry(width, height, depth, radius) {
    const shape = new THREE.Shape();
    const hw = width / 2 - radius;
    const hh = height / 2 - radius;

    shape.moveTo(-hw, height / 2);
    shape.lineTo(hw, height / 2);
    shape.quadraticCurveTo(width / 2, height / 2, width / 2, hh);
    shape.lineTo(width / 2, -hh);
    shape.quadraticCurveTo(width / 2, -height / 2, hw, -height / 2);
    shape.lineTo(-hw, -height / 2);
    shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2, -hh);
    shape.lineTo(-width / 2, hh);
    shape.quadraticCurveTo(-width / 2, height / 2, -hw, height / 2);

    return new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2
    });
}

function createLabelSprite(text, options = {}) {
    const {
        fontSize = 36,
        width = 768,
        height = 128,
        maxTextWidth = width - 32,
        scale = { x: 4.4, y: 0.78, z: 1 },
        fontFamily = '"Inter", sans-serif'
    } = options;
    const cacheKey = JSON.stringify({ text, fontSize, width, height, maxTextWidth, fontFamily });

    let texture = _labelTextureCache.get(cacheKey);
    if (!texture) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, width, height);
        ctx.font = `600 ${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const metrics = ctx.measureText(text);
        const textWidth = Math.min(metrics.width + 32, width - 12);
        const boxHeight = Math.min(height - 16, fontSize + 22);
        const boxX = (width - textWidth) / 2;
        const boxY = (height - boxHeight) / 2;
        const radius = 12;

        ctx.fillStyle = LABEL_BG;
        ctx.beginPath();
        ctx.moveTo(boxX + radius, boxY);
        ctx.lineTo(boxX + textWidth - radius, boxY);
        ctx.quadraticCurveTo(boxX + textWidth, boxY, boxX + textWidth, boxY + radius);
        ctx.lineTo(boxX + textWidth, boxY + boxHeight - radius);
        ctx.quadraticCurveTo(boxX + textWidth, boxY + boxHeight, boxX + textWidth - radius, boxY + boxHeight);
        ctx.lineTo(boxX + radius, boxY + boxHeight);
        ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - radius);
        ctx.lineTo(boxX, boxY + radius);
        ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = LABEL_STROKE;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = TEXT_COLOR;
        ctx.fillText(text, width / 2, height / 2, maxTextWidth);

        texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        _labelTextureCache.set(cacheKey, texture);
    }

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        sizeAttenuation: true
    }));
    sprite.scale.set(scale.x, scale.y, scale.z);
    sprite.userData.isLabel = true;
    return sprite;
}

function createGlowRing(color, radius = 1.05) {
    const geometry = new THREE.RingGeometry(radius * 0.82, radius, 48);
    const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.5;
    ring.userData.isGlow = true;
    return ring;
}

function createDefaultResource(resource) {
    const group = new THREE.Group();
    const statusColor = getStatusColor(resource.status);
    const nodeColor = resource.color || BASE_COLOR;

    const geometry = roundedBoxGeometry(2.8, 1.3, 0.6, 0.18);
    geometry.center();
    const material = new THREE.MeshStandardMaterial({
        color: nodeColor,
        metalness: 0.15,
        roughness: 0.42,
        emissive: new THREE.Color(statusColor),
        emissiveIntensity: 0.14
    });
    const body = new THREE.Mesh(geometry, material);
    group.add(body);

    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({
        color: 0xcbd5e1,
        transparent: true,
        opacity: 0.85
    });
    group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

    const glowRing = createGlowRing(statusColor);
    group.add(glowRing);

    const nameLabel = createLabelSprite(resource.name || resource.id || 'Node', {
        fontSize: 42,
        width: 768,
        height: 144,
        scale: { x: 4.2, y: 0.82, z: 1 }
    });
    nameLabel.position.set(0, 1.28, 0);
    group.add(nameLabel);

    const dataInText = resource.dataIn ? `IN: ${resource.dataIn}` : 'IN: -';
    const dataInLabel = createLabelSprite(dataInText, {
        fontSize: 24,
        width: 1024,
        height: 128,
        scale: { x: 4.2, y: 0.56, z: 1 }
    });
    dataInLabel.position.set(0, -0.02, 0.36);
    group.add(dataInLabel);

    const dataOutText = resource.dataOut ? `OUT: ${resource.dataOut}` : 'OUT: -';
    const dataOutLabel = createLabelSprite(dataOutText, {
        fontSize: 24,
        width: 1024,
        height: 128,
        scale: { x: 4.2, y: 0.56, z: 1 }
    });
    dataOutLabel.position.set(0, -0.68, 0.36);
    group.add(dataOutLabel);

    const idleY = resource.y || 0;
    group.userData.baseY = idleY;
    group.userData.animate = resource.animate || ((time) => {
        glowRing.material.opacity = 0.12 + (Math.sin(time * 2.4 + (resource.glowOffset || 0)) + 1) * 0.04;
    });

    return group;
}

const CREATORS = {
    default: createDefaultResource
};

export class ResourceMeshFactory {
    create(resource) {
        const shape = resource.shape || 'default';
        const creator = CREATORS[shape] || CREATORS.default;
        return creator(resource);
    }

    updateStatus(group, status) {
        const statusColor = getStatusColor(status);
        group.traverse((child) => {
            if (!child.material) return;
            if (child.userData.isGlow) {
                child.material.color.set(statusColor);
                return;
            }
            if (child.isMesh && !child.userData.isLabel && child.material.emissive) {
                child.material.emissive.set(statusColor);
            }
        });
    }

    dispose(group) {
        if (!group) return;
        group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (!child.material) return;
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            for (const material of materials) {
                if (material.map) material.map.dispose();
                material.dispose();
            }
        });
    }
}
