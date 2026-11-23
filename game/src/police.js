// Marisol PD: the 5-star wanted system, named dispatch units, cruiser chases and
// roadblocks. The HUD reads the dispatch list from here every frame.
import * as THREE from 'three';
import { clamp, pick, range } from './rng.js';
import { makeCarMesh } from './vehicles.js';

const UNIT_NAMES = ['UNIT 12', 'UNIT 07', 'UNIT 23', 'UNIT 31', 'UNIT 05', 'UNIT 19'];
const TACTICS = ['RAMMING', 'PIT MANEUVER', 'ROADBLOCK AHEAD', 'SPIKE STRIP', 'PURSUIT', 'CUTTING OFF'];
const CALLSIGNS = ['FALCON', 'VIPER', 'COBRA', 'HAWK', 'JAGUAR', 'PANTHER'];

export function createPolice(scene, rng) {
  return {
    stars: 0, heat: 0, heatDecay: 0, unitCounter: 0,
    cruisers: [], // {mesh, speed, state, unit}
    roadblocks: [],
    heliActive: false,
    lastCrime: 0,
    time: 0,
    rng,
  };
}

export function addWanted(police, amount, reason) {
  police.heat = clamp(police.heat + amount, 0, 100);
  const next = Math.min(5, Math.ceil(police.heat / 20));
  if (next > police.stars) {
    police.stars = next;
    police.lastCrime = police.time;
    return { raised: true, stars: next, reason };
  }
  police.stars = next;
  return { raised: false, stars: next, reason };
}

export function spawnCruiser(police, scene, nearPos) {
  const mesh = makeCarMesh('police', 0xf2f2f2, police.rng);
  const a = police.rng() * Math.PI * 2;
  mesh.position.set(
    clamp(nearPos.x + Math.cos(a) * range(police.rng, 26, 40), -12, 130),
    0,
    clamp(nearPos.z + Math.sin(a) * range(police.rng, 26, 40), -275, 275),
  );
  scene.add(mesh);
  const n = police.unitCounter;
  police.unitCounter += 1;
  const unit = {
    name: UNIT_NAMES[n % UNIT_NAMES.length],
    callsign: CALLSIGNS[n % CALLSIGNS.length],
    tactic: pick(police.rng, TACTICS),
  };
  const c = { mesh, speed: 0, state: 'chase', unit, ramCooldown: 0, side: police.cruisers.length % 2 === 0 ? -1 : 1 };
  police.cruisers.push(c);
  return c;
}

function removeCruiser(police, scene, c) {
  scene.remove(c.mesh);
  police.cruisers.splice(police.cruisers.indexOf(c), 1);
}

export function updatePolice(police, scene, dt, playerPos, playerSpeed, inGarage) {
  police.time += dt;
  const wanted = police.stars;
  // wanted decays when hidden (garage) or long out of sight at low stars
  if (inGarage) police.heat = Math.max(0, police.heat - dt * 6);
  else if (police.time - police.lastCrime > 25 && wanted <= 2) police.heat = Math.max(0, police.heat - dt * 2);
  police.stars = Math.min(5, Math.ceil(police.heat / 20));
  if (police.stars === 0) police.heat = 0;

  const wantCruisers = police.stars === 0 ? 0 : Math.min(2 + police.stars, 7);
  while (police.cruisers.length < wantCruisers) spawnCruiser(police, scene, playerPos);
  while (police.cruisers.length > wantCruisers) removeCruiser(police, scene, police.cruisers[police.cruisers.length - 1]);

  // roadblocks at 3+ stars: a line of cruisers ahead on the boulevard
  if (police.stars >= 3 && police.roadblocks.length === 0) {
    const bz = clamp(playerPos.z - 90, -260, 260);
    for (const bx of [-5, 0, 5]) {
      const mesh = makeCarMesh('police', 0xf2f2f2, police.rng);
      mesh.position.set(bx, 0, bz);
      mesh.rotation.y = Math.PI / 2;
      scene.add(mesh);
      police.roadblocks.push(mesh);
    }
  }
  if (police.stars < 3) {
    for (const m of police.roadblocks) scene.remove(m);
    police.roadblocks.length = 0;
  }

  police.heliActive = police.stars >= 4;

  // chase: steer toward the player, ram on contact, flash the lightbar
  const flash = Math.sin(police.time * 14) > 0;
  for (const c of police.cruisers) {
    // flank the player (classic pursuit alongside) instead of sitting on the
    // chase camera's line of sight: aim 6.5 m to the cruiser's side, 3 m back
    const tx = playerPos.x + c.side * 6.5;
    const tz = playerPos.z - 3;
    const dx = tx - c.mesh.position.x;
    const dz = tz - c.mesh.position.z;
    const dist = Math.hypot(playerPos.x - c.mesh.position.x, playerPos.z - c.mesh.position.z) || 1;
    // trail the player at a readable distance instead of ramming the camera
    const targetSpeed = dist < 10
      ? playerSpeed * 0.95
      : clamp(11 + police.stars * 1.6, 11, 21);
    c.speed = THREE.MathUtils.lerp(c.speed, targetSpeed, Math.min(1, dt * 0.8));
    const targetYaw = Math.atan2(dx, dz);
    let dy = targetYaw - c.mesh.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    c.mesh.rotation.y += clamp(dy, -2.2 * dt, 2.2 * dt);
    c.mesh.position.x += Math.sin(c.mesh.rotation.y) * c.speed * dt;
    c.mesh.position.z += Math.cos(c.mesh.rotation.y) * c.speed * dt;
    c.mesh.position.x = clamp(c.mesh.position.x, -13, 135);
    c.mesh.position.z = clamp(c.mesh.position.z, -278, 278);
    for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt * 2.4;
    if (c.mesh.userData.lightRed) {
      c.mesh.userData.lightRed.material.color.setHex(flash ? 0xff2020 : 0x550000);
      c.mesh.userData.lightBlue.material.color.setHex(flash ? 0x101040 : 0x2040ff);
    }
    c.ramCooldown -= dt;
    if (dist < 3.4 && c.ramCooldown <= 0) {
      c.ramCooldown = 1.2;
      c.speed *= 0.4;
    }
  }
  return { rammed: police.cruisers.some((c) => {
    const d = Math.hypot(playerPos.x - c.mesh.position.x, playerPos.z - c.mesh.position.z);
    return d < 3.2 && c.ramCooldown > 0.9;
  }) };
}

// Named dispatch list for the HUD: every active unit with role, distance, tactic.
export function dispatchList(police, playerPos) {
  const list = [];
  for (const c of police.cruisers) {
    const d = Math.round(Math.hypot(playerPos.x - c.mesh.position.x, playerPos.z - c.mesh.position.z));
    list.push({ name: c.unit.name, callsign: c.unit.callsign, role: 'PURSUIT', dist: d, tactic: c.unit.tactic });
  }
  if (police.heliActive) {
    list.push({ name: 'AIR ONE', callsign: 'HELICOPTER', role: 'SPOTLIGHT', dist: 0, tactic: 'IN SIGHT' });
  }
  if (police.roadblocks.length > 0) {
    list.push({ name: 'UNIT 31', callsign: 'BLOCKADE', role: 'ROADBLOCK', dist: 90, tactic: 'ROADBLOCK AHEAD' });
  }
  if (list.length === 0) {
    return [
      { name: 'DISPATCH', callsign: 'MARISOL PD', role: 'STANDBY', dist: 0, tactic: 'ALL UNITS CLEAR' },
      { name: 'UNIT 12', callsign: 'FALCON', role: 'PATROL', dist: 210, tactic: 'OCEAN DRIVE BEAT' },
    ];
  }
  return list.slice(0, 6);
}
