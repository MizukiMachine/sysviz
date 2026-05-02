/**
 * Shared constants for the SysViz 3D rendering pipeline.
 * Single Source of Truth for all magic numbers previously duplicated across files.
 */

// ── Camera ────────────────────────────────────────────────────────────────
export const CAMERA_FOV = 45;
export const CAMERA_ELEVATION_DEG = 35;
export const CAMERA_Y_OFFSET = 2;
export const CAMERA_FRAME_PADDING = 1.10;
export const CAMERA_BOUNDS_PADDING = 3;
export const CAMERA_MIN_SPAN = 9;
export const CAMERA_NEAR = 0.1;
export const CAMERA_FAR = 500;
export const CONTROLS_MIN_DISTANCE = 5;
export const CONTROLS_MAX_DISTANCE = 80;

// ── Default node dimensions ──────────────────────────────────────────────
export const DEFAULT_NODE_WIDTH = 2.8;
export const DEFAULT_NODE_HEIGHT = 1.3;
export const DEFAULT_NODE_DEPTH = 0.85;
export const DEFAULT_HALF_HEIGHT = DEFAULT_NODE_HEIGHT / 2; // 0.65
export const DEFAULT_NODE_COLOR = 0xe2e8f0;
export const DEFAULT_EMISSIVE_INTENSITY = 0.08;

// ── Curve / connection ───────────────────────────────────────────────────
export const CURVE_ARCH_FACTOR = 0.3;
export const CURVE_MAX_HEIGHT = 3;
export const MAX_CURVE_SEGMENTS = 48;

// ── Flowchart floating edge ──────────────────────────────────────────────
export const FLOWCHART_EDGE_Y = 0.16;

// ── Cluster bounds ───────────────────────────────────────────────────────
export const CLUSTER_NODE_MARGIN_X = 2.0;
export const CLUSTER_NODE_MARGIN_Z = 1.2;

// ── Scene ────────────────────────────────────────────────────────────────
export const BACKGROUND_COLOR = 0xfafafa;
export const FOG_COLOR = 0xffffff;
export const FOG_DENSITY = 0.005;

// ── Render order layers ──────────────────────────────────────────────────
export const RENDER_ORDER = {
  FLOOR: 1,
  UNDERLAY: 3,
  CONNECTION: 4,
  NODE_BODY: 5,
  NODE_LABEL: 6,
  CONNECTION_LABEL: 8,
  PARTICLE_LABEL: 12,
} as const;

// ── Label / font ─────────────────────────────────────────────────────────
export const LABEL_FONT_FAMILY = '"Inter", sans-serif';

// ── Edge colors ──────────────────────────────────────────────────────────
export const EDGE_LINE_COLOR = 0x64748b;
export const BORDER_COLOR = 0x94a3b8;
