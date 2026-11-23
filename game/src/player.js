// The player: arcade driving (nitro, drift, damage), on-foot third-person
// (walk / sprint / jump / shoot), particles, screen shake and hit-stop.
import * as THREE from 'three';
import { clamp, lerp } from './rng.js';
import { makeCarMesh } from './vehicles.js';

const WALK_SPEED = 6, SPRINT_SPEED = 10;

export function createPlayer(scene, save) {
  const car = makeCarMesh('sports', 0xff2f7e, Math.random);
  car.position.set(0, 0, 46);
  car.rotation.y = Math.PI; // facing north (-Z) down Ocean Drive
  scene.add(car);
  // on-foot avatar: neon-jacketed runner with a glowing ring
  const body = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xff2f7e, roughness: 0.5 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), mat);
  torso.position.y = 1.15; torso.castShadow = true;
  body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xe8b98d, roughness: 0.7 }));
  head.position.y = 1.85; head.castShadow = true;
  body.add(head);
  const legs = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.8 });
  for (const x of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), legs);
    leg.position.set(x, 0.4, 0);
    body.add(leg);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
  body.add(ring);
  body.visible = false;
  body.position.set(3, 0, 46);
  scene.add(body);
  return {
    car, body, inCar: true, pos: new THREE.Vector3(0, 0, 46), heading: Math.PI,
    speed: 0, speedMph: 0, gear: 'N', nitro: 1, condition: 100,
    health: 100, armor: 60, onFoot: { vx: 0, vz: 0, vy: 0, grounded: true },
    shake: 0, hitStop: 0, muzzle: 0, walkPhase: 0, drift: false,
  };
}

function collideBuildings(player, colliders, radius) {
  for (const c of colliders) {
    const dx = player.pos.x - c.x, dz = player.pos.z - c.z;
    const ox = c.hw + radius - Math.abs(dx);
    const oz = c.hd + radius - Math.abs(dz);
    if (ox > 0 && oz > 0) {
      if (ox < oz) player.pos.x = c.x + Math.sign(dx || 1) * (c.hw + radius);
      else player.pos.z = c.z + Math.sign(dz || 1) * (c.hd + radius);
      return true;
    }
  }
  return false;
}

// --- Particles: one Points pool per effect, recycled ---
function makePool(scene, count, color, size) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const life = new Float32Array(count);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color, size, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  return { points, pos, vel, life, count, head: 0 };
}

export function createParticles(scene) {
  return {
    sparks: makePool(scene, 220, 0xffd23f, 0.5),
    smoke: makePool(scene, 160, 0x8a8a9a, 1.4),
    flames: makePool(scene, 120, 0x35a0ff, 0.8),
    muzzle: makePool(scene, 40, 0xfff2b0, 0.9),
  };
}

function burst(pool, x, y, z, n, spread, up) {
  for (let k = 0; k < n; k += 1) {
    const i = pool.head;
    pool.head = (pool.head + 1) % pool.count;
    pool.pos[i * 3] = x; pool.pos[i * 3 + 1] = y; pool.pos[i * 3 + 2] = z;
    pool.vel[i * 3] = (Math.random() - 0.5) * spread;
    pool.vel[i * 3 + 1] = Math.random() * up;
    pool.vel[i * 3 + 2] = (Math.random() - 0.5) * spread;
    pool.life[i] = 0.5 + Math.random() * 0.5;
  }
}

export function updateParticles(pools, dt) {
  for (const key of Object.keys(pools)) {
    const pool = pools[key];
    for (let i = 0; i < pool.count; i += 1) {
      if (pool.life[i] <= 0) { pool.pos[i * 3 + 1] = -50; continue; }
      pool.life[i] -= dt;
      pool.pos[i * 3] += pool.vel[i * 3] * dt;
      pool.pos[i * 3 + 1] += pool.vel[i * 3 + 1] * dt;
      pool.pos[i * 3 + 2] += pool.vel[i * 3 + 2] * dt;
      pool.vel[i * 3 + 1] -= dt * 3;
    }
    pool.points.geometry.attributes.position.needsUpdate = true;
  }
}

export function updatePlayer(game, dt, input) {
  const p = game.player;
  const car = p.car;
  if (p.hitStop > 0) { p.hitStop -= dt; return; }

  if (p.inCar) {
    // --- arcade driving ---
    const fwd = input.up ? 1 : input.down ? -0.55 : 0;
    const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    const maxSpeed = 42;
    const nitro = input.nitro && p.nitro > 0.05 && fwd > 0;
    if (nitro) p.nitro = Math.max(0, p.nitro - dt * 0.45);
    else p.nitro = Math.min(1, p.nitro + dt * 0.08);
    const accel = (nitro ? 26 : 15) * fwd;
    p.speed += accel * dt;
    p.speed -= p.speed * (input.down ? 2.2 : 0.55) * dt; // drag / brake
    p.speed = clamp(p.speed, -12, nitro ? maxSpeed * 1.35 : maxSpeed);
    const spd = Math.abs(p.speed);
    const steerAmt = steer * (0.9 + spd * 0.02) * (p.speed < 0 ? -1 : 1);
    p.heading += steerAmt * dt * clamp(spd / 8, 0.25, 1.6);
    p.drift = input.drift && spd > 12;
    if (p.drift) {
      p.heading += steer * dt * 1.1;
      p.speed *= (1 - dt * 0.25);
      game.particles && burst(game.particles.smoke, p.pos.x, 0.3, p.pos.z, 2, 3, 2);
    }
    p.pos.x += Math.sin(p.heading) * p.speed * dt;
    p.pos.z += Math.cos(p.heading) * p.speed * dt;
    // keep inside the playable map
    p.pos.x = clamp(p.pos.x, -13.5, 134);
    p.pos.z = clamp(p.pos.z, -278, 278);
    const hit = collideBuildings(p, game.city.colliders, 1.6);
    if (hit && spd > 8 && !game.shotMode) {
      p.speed *= 0.45;
      p.condition = Math.max(20, p.condition - 4);
      p.shake = Math.min(1, p.shake + 0.5);
      game.audio.crash();
      game.onCrime(8, 'CRASH');
      burst(game.particles.sparks, p.pos.x, 0.8, p.pos.z, 14, 8, 5);
    }
    car.position.copy(p.pos);
    car.position.y = 0;
    car.rotation.y = p.heading;
    car.rotation.z = -steer * clamp(spd / 40, 0, 1) * (p.drift ? 0.22 : 0.07);
    for (const w of car.userData.wheels) w.rotation.x += p.speed * dt * 2.4;
    car.userData.beamMat.opacity = game.city.blend > 0.4 ? 0.22 : 0.10;
    car.userData.glowMat.opacity = nitro ? 0.95 : 0.55;
    if (nitro) {
      const bx = p.pos.x - Math.sin(p.heading) * 2.4;
      const bz = p.pos.z - Math.cos(p.heading) * 2.4;
      burst(game.particles.flames, bx, 0.5, bz, 3, 1.5, 1);
    }
    p.speedMph = p.speed * 2.4;
    p.gear = p.speedMph > 95 ? '5' : p.speedMph > 65 ? '4' : p.speedMph > 38 ? '3' : p.speedMph > 15 ? '2' : p.speedMph > 2 ? '1' : 'N';
    // speeding past a cruiser is a crime
    if (spd > 26 && game.police.cruisers.length > 0) game.onCrime(dt * 3, 'SPEEDING');
  } else {
    // --- on foot ---
    const f = game.foot;
    const run = input.nitro;
    const sp = run ? SPRINT_SPEED : WALK_SPEED;
    const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const mz = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, mz) || 1;
    const camYaw = game.cameraYaw;
    const wx = (Math.sin(camYaw) * mz + Math.cos(camYaw) * mx) / len * sp;
    const wz = (Math.cos(camYaw) * mz - Math.sin(camYaw) * mx) / len * sp;
    const moving = mx !== 0 || mz !== 0;
    f.vx = lerp(f.vx, moving ? wx : 0, Math.min(1, dt * 10));
    f.vz = lerp(f.vz, moving ? wz : 0, Math.min(1, dt * 10));
    p.pos.x = clamp(p.pos.x + f.vx * dt, -13.5, 134);
    p.pos.z = clamp(p.pos.z + f.vz * dt, -278, 278);
    collideBuildings(p, game.city.colliders, 0.5);
    if (input.jump && f.grounded) { f.vy = 7.5; f.grounded = false; }
    f.vy -= 22 * dt;
    p.pos.y = (p.pos.y || 0) + f.vy * dt;
    if (p.pos.y <= 0) { p.pos.y = 0; f.vy = 0; f.grounded = true; }
    if (moving) {
      p.walkPhase += dt * (run ? 13 : 9);
      p.heading = Math.atan2(f.vx, f.vz);
    }
    p.body.position.set(p.pos.x, p.pos.y, p.pos.z);
    p.body.rotation.y = p.heading;
    p.body.rotation.z = Math.sin(p.walkPhase) * (moving ? 0.08 : 0);
    p.speedMph = Math.hypot(f.vx, f.vz) * 2.4;
    p.gear = run ? 'RUN' : 'WALK';
  }
  p.shake = Math.max(0, p.shake - dt * 2.2);
  p.muzzle = Math.max(0, p.muzzle - dt * 8);
}

export function shoot(game, targetPoint) {
  const p = game.player;
  if (p.inCar) return false; // shooting happens on foot (click = horn in car)
  p.muzzle = 1;
  const w = game.hud.weaponIndex;
  const kind = ['fists', 'bat', 'pistol', 'smg', 'shotgun'][Math.min(w, 4)];
  game.audio.shot(kind === 'fists' || kind === 'bat' ? 'pistol' : kind);
  const from = new THREE.Vector3(p.pos.x, (p.pos.y || 0) + 1.5, p.pos.z);
  const dir = new THREE.Vector3().subVectors(targetPoint, from).normalize();
  const end = from.clone().add(dir.clone().multiplyScalar(60));
  burst(game.particles.muzzle, from.x + dir.x * 1.2, from.y, from.z + dir.z * 1.2, 6, 2, 2);
  burst(game.particles.sparks, end.x, Math.max(0.5, end.y), end.z, 8, 6, 4);
  p.shake = Math.min(1, p.shake + 0.25);
  game.onCrime(6, 'SHOTS FIRED');
  // hit a cruiser or traffic car near the shot line?
  for (const c of [...game.police.cruisers, ...game.traffic]) {
    const toCar = new THREE.Vector3().subVectors(c.mesh.position, from);
    const along = toCar.dot(dir);
    if (along > 0 && along < 60) {
      const perp = toCar.clone().addScaledVector(dir, -along).length();
      if (perp < 3) {
        burst(game.particles.sparks, c.mesh.position.x, 1, c.mesh.position.z, 18, 9, 6);
        game.onHitVehicle(c);
        return true;
      }
    }
  }
  return true;
}

export function enterCar(game) {
  const p = game.player;
  if (p.inCar) return;
  // nearest traffic car within 4 m becomes the ride (hijack); otherwise step
  // back into the player's own parked car if it is close
  let best = null, bestD = 4.5;
  for (const t of game.traffic) {
    const d = Math.hypot(t.mesh.position.x - p.pos.x, t.mesh.position.z - p.pos.z);
    if (d < bestD) { best = t; bestD = d; }
  }
  const ownD = Math.hypot(p.car.position.x - p.pos.x, p.car.position.z - p.pos.z);
  if (!best && ownD > 4.5) return; // too far from any car: stay on foot
  p.inCar = true;
  p.body.visible = false;
  p.car.visible = true;
  if (best) {
    // hijack: swap the player's car mesh for the stolen one
    p.car.position.copy(best.mesh.position);
    p.pos.copy(best.mesh.position);
    p.heading = best.mesh.rotation.y;
    game.traffic.splice(game.traffic.indexOf(best), 1);
    game.scene.remove(best.mesh);
    game.onCrime(14, 'CARJACKING');
    game.hud.toast('CARJACKED', 'That one is yours now — the owner disagrees.');
  } else {
    p.pos.copy(p.car.position);
    p.heading = p.car.rotation.y;
  }
  p.speed = 0;
}

export function exitCar(game) {
  const p = game.player;
  if (!p.inCar) return;
  p.inCar = false;
  p.car.visible = true; // car stays parked where it is
  p.body.visible = true;
  p.body.position.set(p.pos.x + 2.5, 0, p.pos.z);
  p.pos.set(p.body.position.x, 0, p.body.position.z);
  p.speed = 0; p.speedMph = 0;
}

export function updateCamera(game, dt) {
  const p = game.player;
  const cam = game.camera;
  const shake = p.shake * 0.5;
  const sx = (Math.random() - 0.5) * shake;
  const sy = (Math.random() - 0.5) * shake;
  if (p.inCar) {
    const back = 12 + Math.abs(p.speed) * 0.12;
    const up = 4.8 + Math.abs(p.speed) * 0.02;
    const tx = p.pos.x - Math.sin(p.heading) * back + sx;
    const tz = p.pos.z - Math.cos(p.heading) * back + sy;
    cam.position.x = lerp(cam.position.x, tx, Math.min(1, dt * 6));
    cam.position.y = lerp(cam.position.y, up, Math.min(1, dt * 6));
    cam.position.z = lerp(cam.position.z, tz, Math.min(1, dt * 6));
    cam.lookAt(p.pos.x + Math.sin(p.heading) * 12, 1.6 + sy, p.pos.z + Math.cos(p.heading) * 12);
  } else {
    const back = 7.5, up = 3.6;
    const tx = p.pos.x - Math.sin(game.cameraYaw) * back + sx;
    const tz = p.pos.z - Math.cos(game.cameraYaw) * back + sy;
    cam.position.x = lerp(cam.position.x, tx, Math.min(1, dt * 8));
    cam.position.y = lerp(cam.position.y, up, Math.min(1, dt * 8));
    cam.position.z = lerp(cam.position.z, tz, Math.min(1, dt * 8));
    cam.lookAt(p.pos.x, 1.5 + sy, p.pos.z);
  }
}
