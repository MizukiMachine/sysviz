/**
 * Shared label utilities: text normalization, round rect, pill label texture.
 */
import * as THREE from 'three';
import { LABEL_FONT_FAMILY, DEFAULT_CANVAS_WIDTH } from './constants.js';
import { createCanvasTexture } from './threeUtils.js';

// ── Text normalization ───────────────────────────────────────────────────

/**
 * Normalize label text: strip HTML tags, handle <br> and &nbsp;, split into lines.
 */
export function normalizeLabelText(text: string): string[] {
  const normalized = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.length > 0 ? lines : [text.replace(/<[^>]+>/g, '').trim()];
}

// ── Canvas drawing helpers ───────────────────────────────────────────────

/**
 * Draw a rounded rectangle path on a Canvas 2D context.
 */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Pill label texture (connection/particle labels) ──────────────────────

export interface PillLabelOptions {
  canvasWidth?: number;
  canvasHeight?: number;
  fontWeight?: string;
  fontSize?: number;
  bgOpacity?: number;
  textColor?: string;
  borderColor?: string;
  borderOpacity?: number;
  borderWidth?: number;
  radius?: number;
  paddingX?: number;
  boxHeight?: number;
}

const DEFAULT_PILL_OPTIONS: Required<PillLabelOptions> = {
  canvasWidth: DEFAULT_CANVAS_WIDTH,
  canvasHeight: 160,
  fontWeight: '600',
  fontSize: 32,
  bgOpacity: 0.9,
  textColor: '#0f172a',
  borderColor: 'rgba(148, 163, 184, 0.3)',
  borderOpacity: 0.3,
  borderWidth: 2,
  radius: 16,
  paddingX: 44,
  boxHeight: 72,
};

/**
 * Create a pill-shaped label texture with text on a rounded-rect background.
 * Used by ConnectionLines and ParticleTraffic for connection labels.
 */
export function createPillLabelTexture(
  text: string,
  options?: PillLabelOptions,
): THREE.CanvasTexture {
  const opts = { ...DEFAULT_PILL_OPTIONS, ...options };

  const canvas = document.createElement('canvas');
  canvas.width = opts.canvasWidth;
  canvas.height = opts.canvasHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${opts.fontWeight} ${opts.fontSize}px ${LABEL_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textWidth = Math.min(ctx.measureText(text).width + opts.paddingX, canvas.width - 16);
  const boxX = (canvas.width - textWidth) / 2;
  const boxY = (canvas.height - opts.boxHeight) / 2;

  ctx.fillStyle = `rgba(255, 255, 255, ${opts.bgOpacity})`;
  roundRect(ctx, boxX, boxY, textWidth, opts.boxHeight, opts.radius);
  ctx.fill();

  ctx.strokeStyle = opts.borderColor;
  ctx.lineWidth = opts.borderWidth;
  ctx.stroke();

  ctx.fillStyle = opts.textColor;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 64);

  return createCanvasTexture(canvas);
}
