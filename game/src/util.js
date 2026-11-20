// Shared numeric and ground-plane helpers for Talvera Heat.
// Written fresh in this recorded session: same public API and same
// results as before, just organised and worded my way.

// ---- scalar helpers -------------------------------------------------------

export function clamp(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

export function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

// Shortest-path interpolation between two headings (radians).
export function lerpAngle(from, to, amount) {
  const twoPi = Math.PI * 2;
  let delta = (to - from) % twoPi;
  if (delta > Math.PI) delta -= twoPi;
  if (delta < -Math.PI) delta += twoPi;
  return from + delta * amount;
}

// Straight-line distance on the ground plane (x, z).
export function dist2d(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

// ---- deterministic randomness ---------------------------------------------

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function range(rng, low, high) {
  return low + rng() * (high - low);
}

// ---- ground-plane boxes ----------------------------------------------------

// A rectangle on the ground plane, stored as its four edges.
export function makeBox(centreX, centreZ, halfX, halfZ) {
  return {
    minX: centreX - halfX,
    maxX: centreX + halfX,
    minZ: centreZ - halfZ,
    maxZ: centreZ + halfZ,
  };
}

export function pointInBox(x, z, box) {
  return x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
}

// Move a ground circle (x, z, radius) out of every box it overlaps, so a
// walker or car cannot pass through a building. The circle is pushed to the
// nearest edge of each box it touches; returns the corrected position and
// whether any push happened.
export function resolveCircleBoxes(x, z, radius, boxes) {
  let moved = false;
  for (const box of boxes) {
    const nearestX = clamp(x, box.minX, box.maxX);
    const nearestZ = clamp(z, box.minZ, box.maxZ);
    const offX = x - nearestX;
    const offZ = z - nearestZ;
    const distSq = offX * offX + offZ * offZ;
    if (distSq >= radius * radius) continue;

    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      x = nearestX + (offX / dist) * radius;
      z = nearestZ + (offZ / dist) * radius;
    } else {
      // The centre sits inside the box: leave through whichever edge is
      // closest. Ties keep the order left, right, near, far.
      const toLeft = x - box.minX;
      const toRight = box.maxX - x;
      const toNear = z - box.minZ;
      const toFar = box.maxZ - z;
      const smallest = Math.min(toLeft, toRight, toNear, toFar);
      if (smallest === toLeft) x = box.minX - radius;
      else if (smallest === toRight) x = box.maxX + radius;
      else if (smallest === toNear) z = box.minZ - radius;
      else z = box.maxZ + radius;
    }
    moved = true;
  }
  return { x, z, pushed: moved };
}
