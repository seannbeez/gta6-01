// Vehicles: car meshes, arcade driving, traffic AI — authored in this session.
import * as THREE from 'three';
import { CFG, PALETTE } from './config.js';
import { clamp, lerpAngle, dist2d, pick, range } from './util.js';

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const glassMat = new THREE.MeshLambertMaterial({ color: 0x223344 });

export function makeCarMesh(kind, color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const isPolice = kind === 'police';
  const isTruck = kind === 'truck';
  const len = isTruck ? 6.4 : 4.4;
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, 0.85, 2.0), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  if (isPolice) {
    // Black hood + trunk panels on a white body.
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 1.9), new THREE.MeshLambertMaterial({ color: PALETTE.policeBlack }));
    hood.position.set(len / 2 - 0.55, 1.06, 0);
    g.add(hood);
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 1.9), new THREE.MeshLambertMaterial({ color: PALETTE.policeBlack }));
    trunk.position.set(-len / 2 + 0.5, 1.06, 0);
    g.add(trunk);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 1.3), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    bar.position.set(0.1, 1.55, 0);
    g.add(bar);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.55), new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x880000 }));
    r.position.set(0.1, 1.7, -0.35); g.add(r);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.55), new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x000088 }));
    b.position.set(0.1, 1.7, 0.35); g.add(b);
    g.userData.lightBar = { r, b };
  }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(isTruck ? 1.6 : 2.1, 0.7, 1.8), isTruck ? bodyMat : glassMat);
  cabin.position.set(isTruck ? len / 2 - 1.1 : -0.25, 1.35, 0);
  cabin.castShadow = true;
  g.add(cabin);
  if (isTruck) {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 1.9), new THREE.MeshLambertMaterial({ color: 0x6a6f75 }));
    bed.position.set(-1.2, 1.2, 0);
    g.add(bed);
  }
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.5), new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0x777744 }));
  hl.position.set(len / 2 + 0.02, 0.7, 0.6); g.add(hl);
  const hl2 = hl.clone(); hl2.position.z = -0.6; g.add(hl2);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.5), new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x550000 }));
  tl.position.set(-len / 2 - 0.02, 0.7, 0.6); g.add(tl);
  const tl2 = tl.clone(); tl2.position.z = -0.6; g.add(tl2);
  const wheels = [];
  const wx = len / 2 - 0.8, wz = 1.0;
  for (const [x, z] of [[wx, wz], [wx, -wz], [-wx, wz], [-wx, -wz]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.42, z);
    g.add(w);
    wheels.push(w);
  }
  g.userData.wheels = wheels;
  g.userData.length = len;
  return g;
}

export class Car {
  constructor(scene, kind, color, x, z, heading) {
    this.kind = kind;
    this.color = color;
    this.mesh = makeCarMesh(kind, color);
    this.x = x; this.z = z; this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.stolen = false;
    scene.add(this.mesh);
    this.sync();
  }
  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = -this.heading;
  }
  // Arcade driving for the player car. Returns true if it hit something hard.
  drive(input, dt, colliders, others) {
    const fwd = input.any('KeyW', 'ArrowUp') ? 1 : 0;
    const back = input.any('KeyS', 'ArrowDown') ? 1 : 0;
    const left = input.any('KeyA', 'ArrowLeft') ? 1 : 0;
    const right = input.any('KeyD', 'ArrowRight') ? 1 : 0;
    const hand = input.down('Space');
    // Garage engine tuning: a tuned car pulls harder and runs faster.
    const eng = this.engineLevel || 0;
    const accel = CFG.carAccel * (1 + 0.1 * eng);
    const topSpeed = CFG.carMaxSpeed * (1 + 0.13 * eng);
    const topReverse = CFG.carMaxReverse * (1 + 0.1 * eng);
    if (fwd) this.speed += accel * dt * (this.speed < 0 ? 2.2 : 1);
    if (back) this.speed -= (this.speed > 0.5 ? CFG.carBrake : accel * 0.6) * dt;
    if (!fwd && !back) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
    if (hand) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 22 * dt);
    this.speed = clamp(this.speed, -topReverse, topSpeed);
    const targetSteer = (left ? 1 : 0) - (right ? 1 : 0);
    this.steer += (targetSteer - this.steer) * Math.min(1, dt * 8);
    const spd = this.speed;
    const turnRate = CFG.carTurn * clamp(Math.abs(spd) / 10, 0, 1) * (hand ? 1.35 : 1);
    this.heading += this.steer * turnRate * dt * Math.sign(spd || 1);
    const nx = this.x + Math.sin(this.heading) * spd * dt;
    const nz = this.z + Math.cos(this.heading) * spd * dt;
    // Building collision: slide along walls by trying each axis separately.
    let hit = false;
    const r = 1.9;
    if (!collides(nx, this.z, r, colliders)) this.x = nx;
    else { hit = true; this.speed *= 0.55; }
    if (!collides(this.x, nz, r, colliders)) this.z = nz;
    else { hit = true; this.speed *= 0.55; }
    // Car-to-car bumps.
    for (const o of others) {
      if (o === this) continue;
      const d = dist2d(this.x, this.z, o.x, o.z);
      if (d < 3.6 && d > 0.01) {
        const push = (3.6 - d) / 2;
        const ux = (this.x - o.x) / d, uz = (this.z - o.z) / d;
        this.x += ux * push; this.z += uz * push;
        if (Math.abs(this.speed) > 6) { hit = true; this.speed *= 0.7; }
      }
    }
    // Keep inside the playfield (river is a wall of water: stop at the promenade).
    this.x = clamp(this.x, -CFG.cityHalf - 6, CFG.cityHalf + 6);
    this.z = clamp(this.z, -CFG.cityHalf - 6, CFG.southBankFar + 6);
    this.sync();
    const wheels = this.mesh.userData.wheels;
    for (const w of wheels) w.rotation.y = this.steer * 0.4;
    return hit;
  }
}

function collides(x, z, r, colliders) {
  for (const b of colliders) {
    const cx = clamp(x, b.minX, b.maxX);
    const cz = clamp(z, b.minZ, b.maxZ);
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

// Traffic: cars that follow the road network, turn at intersections, and queue.
export class Traffic {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.maxCars = 24;
    // Adjacency: endpoint key -> segments touching it.
    this.adj = new Map();
    for (const s of city.roads) {
      for (const k of [key(s.ax, s.az), key(s.bx, s.bz)]) {
        if (!this.adj.has(k)) this.adj.set(k, []);
        this.adj.get(k).push(s);
      }
    }
  }
  spawn(n, nearX, nearZ) {
    for (let i = 0; i < n; i++) {
      const seg = pick(this.rng, this.city.roads);
      const t = this.rng();
      const x = seg.ax + (seg.bx - seg.ax) * t;
      const z = seg.az + (seg.bz - seg.az) * t;
      if (nearX !== undefined && dist2d(x, z, nearX, nearZ) > 240) continue;
      const kind = pick(this.rng, ['sedan', 'sedan', 'sedan', 'sport', 'taxi', 'van', 'truck']);
      const color = kind === 'taxi' ? 0xe0c34b : pick(this.rng, PALETTE.carPaints);
      const car = new Car(this.scene, kind, color, x, z, 0);
      car.seg = seg;
      car.segT = t;
      car.dir = this.rng() < 0.5 ? 1 : -1;
      car.cruise = range(this.rng, 8, 13);
      car.speed = car.cruise;
      this.cars.push(car);
    }
  }
  update(dt, playerX, playerZ) {
    // Top up traffic near the player.
    if (this.cars.length < this.maxCars && this.rng() < dt * 2) this.spawn(1, playerX, playerZ);
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (dist2d(c.x, c.z, playerX, playerZ) > 300) {
        this.scene.remove(c.mesh);
        this.cars.splice(i, 1);
        continue;
      }
      const seg = c.seg;
      const len = Math.hypot(seg.bx - seg.ax, seg.bz - seg.az);
      const ux = (seg.bx - seg.ax) / len, uz = (seg.bz - seg.az) / len;
      // Right-hand lane offset.
      const lane = 3.4 * c.dir;
      const px = -uz * lane, pz = ux * lane;
      // Slow down for a car ahead in the same lane.
      let target = c.cruise;
      for (const o of this.cars) {
        if (o === c) continue;
        const along = (o.x - c.x) * ux * c.dir + (o.z - c.z) * uz * c.dir;
        const side = Math.abs((o.x - c.x) * px + (o.z - c.z) * pz) / 3.4;
        if (along > 0 && along < 12 && side < 1.6) { target = 0; break; }
      }
      c.speed += (target - c.speed) * Math.min(1, dt * 1.5);
      c.segT += (c.speed * c.dir * dt) / len;
      let endKey = null;
      if (c.segT >= 1) { c.segT = 1; endKey = key(seg.bx, seg.bz); }
      if (c.segT <= 0) { c.segT = 0; endKey = key(seg.ax, seg.az); }
      if (endKey) {
        const options = (this.adj.get(endKey) || []).filter((s) => s !== seg);
        if (options.length) {
          c.seg = pick(this.rng, options);
          const atB = Math.abs(c.seg.bx - (endKey.split(',')[0] | 0)) < 1 && Math.abs(c.seg.bz - (endKey.split(',')[1] | 0)) < 1;
          // Recompute from the endpoint we arrived at.
          const ex = Number(endKey.split(',')[0]), ez = Number(endKey.split(',')[1]);
          const nearA = dist2d(c.seg.ax, c.seg.az, ex, ez) < 1;
          c.dir = nearA ? 1 : -1;
          c.segT = nearA ? 0 : 1;
        } else {
          c.dir *= -1;
          c.segT = clamp(c.segT, 0.02, 0.98);
        }
      }
      c.x = c.seg.ax + (c.seg.bx - c.seg.ax) * c.segT + px;
      c.z = c.seg.az + (c.seg.bz - c.seg.az) * c.segT + pz;
      const targetHeading = Math.atan2(ux * c.dir, uz * c.dir);
      c.heading = lerpAngle(c.heading, targetHeading, Math.min(1, dt * 6));
      c.sync();
    }
  }
  nearestCar(x, z, maxD) {
    let best = null, bestD = maxD;
    for (const c of this.cars) {
      const d = dist2d(x, z, c.x, c.z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }
  remove(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    this.scene.remove(car.mesh);
  }
}

function key(x, z) { return `${x},${z}`; }
