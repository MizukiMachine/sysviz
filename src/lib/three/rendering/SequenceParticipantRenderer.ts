import * as THREE from 'three';
import type { VisualizationSequenceParticipant } from '@/types/visualization';

const BODY_COLOR = 0xb8daf3;
const EDGE_COLOR = 0x7fb4da;
const LABEL_COLOR = '#36506b';
const TOP_LABEL_BG = 'rgba(255,255,255,0.76)';
const FRONT_LABEL_BG = 'rgba(255,255,255,0.8)';

interface Entry {
  group: THREE.Group;
  textures: THREE.Texture[];
}

function normalizeLines(text: string): string[] {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function createLabelTexture(
  text: string,
  width: number,
  height: number,
  background: string,
  fontSize: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('SequenceParticipantRenderer: failed to create canvas context');
  }

  const lines = normalizeLines(text);
  const safeLines = lines.length > 0 ? lines : [''];
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = LABEL_COLOR;
  ctx.font = `600 ${fontSize}px "Inter", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineHeight = Math.round(fontSize * 1.18);
  const startY = height / 2 - ((safeLines.length - 1) * lineHeight) / 2;
  for (const [index, line] of safeLines.entries()) {
    ctx.fillText(line, width / 2, startY + index * lineHeight, width - 18);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

export class SequenceParticipantRenderer {
  scene: THREE.Scene;
  group: THREE.Group;
  entries: Entry[];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.userData.isSequenceParticipantGroup = true;
    this.scene.add(this.group);
    this.entries = [];
  }

  render(participants: VisualizationSequenceParticipant[] | undefined): void {
    this.clear();
    if (!participants || participants.length === 0) return;

    for (const participant of participants) {
      const group = new THREE.Group();

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(participant.width, participant.height, participant.depth),
        new THREE.MeshPhysicalMaterial({
          color: BODY_COLOR,
          roughness: 0.34,
          metalness: 0.08,
          clearcoat: 0.22,
          clearcoatRoughness: 0.4,
          transparent: true,
          opacity: 0.94,
        }),
      );
      body.position.set(participant.x, participant.height / 2, participant.z);
      group.add(body);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(body.geometry),
        new THREE.LineBasicMaterial({ color: EDGE_COLOR, transparent: true, opacity: 0.75 }),
      );
      edges.position.copy(body.position);
      group.add(edges);

      const topTexture = createLabelTexture(participant.label, 1024, 256, TOP_LABEL_BG, 56);
      const topLabel = new THREE.Mesh(
        new THREE.PlaneGeometry(participant.width * 0.92, participant.depth * 0.72),
        new THREE.MeshBasicMaterial({
          map: topTexture,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      topLabel.rotation.x = -Math.PI / 2;
      topLabel.position.set(participant.x, participant.height + 0.03, participant.z);
      topLabel.renderOrder = 6;
      group.add(topLabel);

      const frontTexture = createLabelTexture(participant.label, 1024, 320, FRONT_LABEL_BG, 54);
      const frontLabel = new THREE.Mesh(
        new THREE.PlaneGeometry(participant.width * 0.92, participant.height * 0.82),
        new THREE.MeshBasicMaterial({
          map: frontTexture,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      frontLabel.position.set(
        participant.x,
        participant.height * 0.52,
        participant.z + participant.depth / 2 + 0.03,
      );
      frontLabel.renderOrder = 6;
      group.add(frontLabel);

      this.group.add(group);
      this.entries.push({ group, textures: [topTexture, frontTexture] });
    }
  }

  clear(): void {
    for (const entry of this.entries) {
      this.group.remove(entry.group);
      entry.group.traverse((child) => {
        const obj = child as THREE.Mesh;
        obj.geometry?.dispose();
        if (!obj.material) return;
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) material.dispose();
      });
      for (const texture of entry.textures) texture.dispose();
    }
    this.entries = [];
  }

  dispose(): void {
    this.clear();
    this.scene.remove(this.group);
  }
}
