// Tiny math toolbox for Talvera Heat: number clamping, blending, angles,
// seeded dice and flat-ground rectangle collision. Nothing here knows about
// the game itself — every helper is pure input in, value out — so the rest
// of the code can lean on it without worrying about hidden state.

const TAU = Math.PI * 2;

// Keep a number inside [low, high]. Values already in range pass through.
export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

// Slide from `from` to `to`; amount 0 gives `from`, 1 gives `to`.
export function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

// Blend between two headings, always taking the short way round the circle,
// so a turn from 170 degrees to -170 degrees swings 20 degrees, not 340.
export function lerpAngle(from, to, amount) {
  let gap = (to - from) % TAU;
  if (gap > Math.PI) gap -= TAU;
  if (gap < -Math.PI) gap += TAU;
  return from + gap * amount;
}

// Flat distance between two spots on the ground, ignoring height.
export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// A small seeded generator (mulberry32): same seed, same stream of numbers
// in [0, 1), every run, on every machine. The game seeds it once per world
// so a city layout is stable while still looking hand-scattered.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Draw one entry out of a list, using the next roll from `rng`.
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// One roll stretched onto [low, high).
export function range(rng, low, high) {
  return low + rng() * (high - low);
}

// A flat rectangle on the ground, held as its four edges so tests against it
// are cheap comparisons. `halfX` / `halfZ` are half the width and depth.
export function makeBox(centreX, centreZ, halfX, halfZ) {
  return {
    minX: centreX - halfX,
    maxX: centreX + halfX,
    minZ: centreZ - halfZ,
    maxZ: centreZ + halfZ,
  };
}

// True when the spot (x, z) lies on or inside the rectangle, edges included.
export function pointInBox(x, z, box) {
  return x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
}

// Shove a ground circle (centre x, z and a radius) out of any rectangle it
// overlaps, so walkers and cars slide along walls instead of passing through
// them. Each box is handled in turn with the circle's updated spot, and the
// result reports the fixed spot plus whether anything had to move at all.
//
// Outside a box the circle is pushed straight away from the closest point
// on the box. Dead centre inside a box it escapes through the nearest wall;
// a tie between walls favours left, then right, then near, then far.
export function resolveCircleBoxes(x, z, radius, boxes) {
  let pushed = false;
  for (let i = 0; i < boxes.length; i += 1) {
    const box = boxes[i];
    const nearX = clamp(x, box.minX, box.maxX);
    const nearZ = clamp(z, box.minZ, box.maxZ);
    const dx = x - nearX;
    const dz = z - nearZ;
    const gapSq = dx * dx + dz * dz;
    if (gapSq >= radius * radius) continue;

    if (gapSq > 0.0001) {
      const gap = Math.sqrt(gapSq);
      x = nearX + (dx / gap) * radius;
      z = nearZ + (dz / gap) * radius;
    } else {
      const outLeft = x - box.minX;
      const outRight = box.maxX - x;
      const outNear = z - box.minZ;
      const outFar = box.maxZ - z;
      const least = Math.min(outLeft, outRight, outNear, outFar);
      if (least === outLeft) x = box.minX - radius;
      else if (least === outRight) x = box.maxX + radius;
      else if (least === outNear) z = box.minZ - radius;
      else z = box.maxZ + radius;
    }
    pushed = true;
  }
  return { x, z, pushed };
}
