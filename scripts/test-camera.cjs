// Camera calculation verification test
// Tests that camera values are closer (smaller distance) than before the fix

const assert = require('assert');

// ===== Simulate _calculateCamera (old values) =====
function calculateCameraOld(nodes) {
  const FOV_DEG = 45;
  const halfFovRad = (FOV_DEG / 2) * (Math.PI / 180);
  const tanHalf = Math.tan(halfFovRad);

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
    minZ = Math.min(minZ, n.z); maxZ = Math.max(maxZ, n.z);
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const spreadX = maxX - minX, spreadZ = maxZ - minZ;

  const PADDED_X = Math.max(spreadX + 8, 12);
  const PADDED_Z = Math.max(spreadZ + 8, 12);
  const distForX = (PADDED_X / 1.5) / tanHalf;
  const distForZ = PADDED_Z / tanHalf;
  const dist = Math.max(distForX, distForZ, 15);

  const ELEVATION_ANGLE = 35 * (Math.PI / 180);
  const camY = dist * Math.sin(ELEVATION_ANGLE) + 2;
  const camOffsetZ = dist * Math.cos(ELEVATION_ANGLE);

  return { position: [cx, camY, cz + camOffsetZ], target: [cx, 0, cz], dist };
}

// ===== Simulate _calculateCamera (new values) =====
function calculateCameraNew(nodes) {
  const FOV_DEG = 45;
  const halfFovRad = (FOV_DEG / 2) * (Math.PI / 180);
  const tanHalf = Math.tan(halfFovRad);

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
    minZ = Math.min(minZ, n.z); maxZ = Math.max(maxZ, n.z);
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const spreadX = maxX - minX, spreadZ = maxZ - minZ;

  const PADDED_X = Math.max(spreadX + 3, 7);
  const PADDED_Z = Math.max(spreadZ + 3, 7);
  const distForX = (PADDED_X / 1.5) / tanHalf;
  const distForZ = PADDED_Z / tanHalf;
  const dist = Math.max(distForX, distForZ, 9);

  const ELEVATION_ANGLE = 35 * (Math.PI / 180);
  const camY = dist * Math.sin(ELEVATION_ANGLE) + 2;
  const camOffsetZ = dist * Math.cos(ELEVATION_ANGLE);

  return { position: [cx, camY, cz + camOffsetZ], target: [cx, 0, cz], dist };
}

// ===== Simulate _frameRegion (old values) =====
function frameRegionOld(minX, maxX, minZ, maxZ, aspect = 1.6) {
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const paddedWidth = Math.max(maxX - minX + 8, 12);
  const paddedDepth = Math.max(maxZ - minZ + 8, 12);
  const FOV_DEG = 45;
  const halfFovRad = (FOV_DEG / 2) * (Math.PI / 180);
  const tanHalfFov = Math.tan(halfFovRad);

  const distanceForWidth = (paddedWidth / 2) / Math.max(tanHalfFov * aspect, 0.001);
  const distanceForDepth = (paddedDepth / 2) / Math.max(tanHalfFov, 0.001);
  const distance = Math.max(distanceForWidth, distanceForDepth, 15) * 1.35;

  const elevation = 35 * (Math.PI / 180);
  const target = { x: cx, y: 0, z: cz };
  const position = {
    x: cx,
    y: distance * Math.sin(elevation) + 2,
    z: cz + distance * Math.cos(elevation),
  };
  return { distance, position, target };
}

// ===== Simulate _frameRegion (new values) =====
function frameRegionNew(minX, maxX, minZ, maxZ, aspect = 1.6) {
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const paddedWidth = Math.max(maxX - minX + 3, 9);
  const paddedDepth = Math.max(maxZ - minZ + 3, 9);
  const FOV_DEG = 45;
  const halfFovRad = (FOV_DEG / 2) * (Math.PI / 180);
  const tanHalfFov = Math.tan(halfFovRad);

  const distanceForWidth = (paddedWidth / 2) / Math.max(tanHalfFov * aspect, 0.001);
  const distanceForDepth = (paddedDepth / 2) / Math.max(tanHalfFov, 0.001);
  const distance = Math.max(distanceForWidth, distanceForDepth, 15) * 1.10;

  const elevation = 35 * (Math.PI / 180);
  const target = { x: cx, y: 0, z: cz };
  const position = {
    x: cx,
    y: distance * Math.sin(elevation) + 2,
    z: cz + distance * Math.cos(elevation),
  };
  return { distance, position, target };
}

// ===== Test cases =====
const testCases = [
  // Compact diagram (few nodes close together)
  { name: 'compact (4 nodes)', nodes: [
    { x: 0, z: 0 }, { x: 5, z: 0 }, { x: 0, z: 5 }, { x: 5, z: 5 }
  ]},
  // Wide diagram
  { name: 'wide (6 nodes)', nodes: [
    { x: -10, z: 0 }, { x: -5, z: 0 }, { x: 0, z: 0 }, { x: 5, z: 0 }, { x: 10, z: 0 }, { x: 15, z: 0 }
  ]},
  // Large spread
  { name: 'large (9 nodes)', nodes: [
    { x: -15, z: -15 }, { x: 0, z: -15 }, { x: 15, z: -15 },
    { x: -15, z: 0 }, { x: 0, z: 0 }, { x: 15, z: 0 },
    { x: -15, z: 15 }, { x: 0, z: 15 }, { x: 15, z: 15 }
  ]},
];

console.log('=== Camera Calculation Verification ===\n');
let passed = 0, failed = 0;

for (const tc of testCases) {
  const old = calculateCameraOld(tc.nodes);
  const nw = calculateCameraNew(tc.nodes);
  const closer = nw.dist < old.dist;
  const ratio = ((nw.dist / old.dist) * 100).toFixed(1);

  console.log(`[${tc.name}]`);
  console.log(`  OLD: dist=${old.dist.toFixed(2)}  pos=[${old.position.map(v=>v.toFixed(1)).join(', ')}]`);
  console.log(`  NEW: dist=${nw.dist.toFixed(2)}  pos=[${nw.position.map(v=>v.toFixed(1)).join(', ')}]`);
  console.log(`  Distance ratio: ${ratio}% (${closer ? 'CLOSER ✓' : 'FARTHER ✗'})`);

  if (closer) { passed++; } else { failed++; }
}

// FrameRegion tests
console.log('\n=== FrameRegion Verification ===\n');
const frameTests = [
  { name: 'compact bounds', minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
  { name: 'wide bounds', minX: -20, maxX: 20, minZ: -5, maxZ: 5 },
  { name: 'large bounds', minX: -30, maxX: 30, minZ: -20, maxZ: 20 },
];

for (const ft of frameTests) {
  const old = frameRegionOld(ft.minX, ft.maxX, ft.minZ, ft.maxZ);
  const nw = frameRegionNew(ft.minX, ft.maxX, ft.minZ, ft.maxZ);
  const closer = nw.distance < old.distance;
  const ratio = ((nw.distance / old.distance) * 100).toFixed(1);

  console.log(`[${ft.name}]`);
  console.log(`  OLD: dist=${old.distance.toFixed(2)}`);
  console.log(`  NEW: dist=${nw.distance.toFixed(2)}`);
  console.log(`  Distance ratio: ${ratio}% (${closer ? 'CLOSER ✓' : 'FARTHER ✗'})`);

  if (closer) { passed++; } else { failed++; }
}

// Flat diagram camera test
console.log('\n=== Flat Diagram Camera Verification ===\n');
function flatCameraOld(maxSpan, type) {
  if (type === 'flowchart') return [0, Math.max(18, maxSpan * 0.82), Math.max(10, maxSpan * 0.42)];
  return [0, Math.max(26, maxSpan * 1.18), 0.01];
}
function flatCameraNew(maxSpan, type) {
  if (type === 'flowchart') return [0, Math.max(13, maxSpan * 0.60), Math.max(6, maxSpan * 0.30)];
  return [0, Math.max(18, maxSpan * 0.82), 0.01];
}

for (const [type, spans] of [['flowchart', [24, 40, 60]], ['sequence', [24, 40, 60]]]) {
  for (const span of spans) {
    const old = flatCameraOld(span, type);
    const nw = flatCameraNew(span, type);
    const oldDist = Math.sqrt(old[1]*old[1] + old[2]*old[2]);
    const nwDist = Math.sqrt(nw[1]*nw[1] + nw[2]*nw[2]);
    const closer = nwDist < oldDist;
    const ratio = ((nwDist / oldDist) * 100).toFixed(1);
    console.log(`[${type} span=${span}] OLD dist=${oldDist.toFixed(2)} NEW dist=${nwDist.toFixed(2)} ratio=${ratio}% (${closer ? 'CLOSER ✓' : 'FARTHER ✗'})`);
    if (closer) { passed++; } else { failed++; }
  }
}

console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
