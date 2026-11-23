// police.js — PROJECT VICE. 5-star wanted system: crimes raise stars, cruisers spawn
// with flashing red/blue lightbars, chase and ram, roadblocks at 3+, and a big
// well-lit helicopter with a searchlight cone at 4+. Dispatch list data included.
import * as THREE from 'three';
import { makePoliceCruiser, makeHelicopter, makeLightPool } from './vehicles.js';

export const DISPATCH_UNITS = [
  { call: 'UNIT 12', role: 'RAMMING', tactic: 'PIT on the bridge' },
  { call: 'UNIT 07', role: 'ROADBLOCK', tactic: 'Roadblock — Ocean Dr' },
  { call: 'UNIT 23', role: 'PURSUIT', tactic: 'Closing from rear' },
  { call: 'UNIT 31', role: 'PURSUIT', tactic: 'Flanking 5th Ave' },
  { call: 'AIR ONE', role: 'SPOTLIGHT', tactic: 'In sight — tracking' },
  { call: 'UNIT 05', role: 'STANDBY', tactic: 'Staging at marina' },
];

export function createPolice(scene, rng) {
  const pol = {
    stars: 4, // the cover frame opens mid-chase at 4 stars
    heat: 75, // 75 heat = 4 stars (ceil(75/20)); kept in sync by setStars
    cruisers: [],
    heli: null,
    lightPool: null,
    roadblock: null,
    sirenPhase: 0,
    lastCrime: 0,
  };

  pol.heli = makeHelicopter();
  pol.heli.visible = false;
  scene.add(pol.heli);
  pol.lightPool = makeLightPool();
  pol.lightPool.visible = false;
  scene.add(pol.lightPool);

  pol.spawnCruiser = function (pos) {
    const car = makePoliceCruiser(rng);
    car.position.copy(pos || new THREE.Vector3((rng() - 0.5) * 20, 0, 60 + rng() * 40));
    scene.add(car);
    const c = { mesh: car, speed: 0, heading: Math.PI, stuck: 0 };
    pol.cruisers.push(c);
    return c;
  };

  pol.setStars = function (n) {
    n = THREE.MathUtils.clamp(Math.round(n), 0, 5);
    // keep heat in the band that produces these stars, so the wanted level
    // does not instantly decay the moment it is set (cover frame stays 4★)
    if (n > pol.stars) pol.heat = Math.max(pol.heat, (n - 1) * 20 + 1);
    else if (n < pol.stars) pol.heat = Math.min(pol.heat, n * 20);
    pol.stars = n;
    // cruiser count follows stars
    const want = pol.stars === 0 ? 0 : Math.min(2 + pol.stars, 7);
    while (pol.cruisers.length < want) pol.spawnCruiser();
    while (pol.cruisers.length > want) {
      const c = pol.cruisers.pop();
      scene.remove(c.mesh);
    }
    pol.heli.visible = pol.stars >= 4;
    pol.lightPool.visible = pol.stars >= 4;
  };

  pol.commitCrime = function (kind) {
    const now = performance.now() / 1000;
    if (now - pol.lastCrime < 1.2) return;
    pol.lastCrime = now;
    const gains = { speeding: 4, crash: 8, steal: 14, shooting: 18, ram: 10 };
    pol.heat = Math.min(100, pol.heat + (gains[kind] || 6));
    pol.setStars(Math.ceil(pol.heat / 20));
  };

  pol.coolDown = function (dt) {
    pol.heat = Math.max(0, pol.heat - dt * 1.1);
    const s = Math.ceil(pol.heat / 20);
    if (s < pol.stars) pol.setStars(s);
  };

  // roadblock: two cruisers + striped barrier across the road ahead
  pol.buildRoadblock = function (z) {
    if (pol.roadblock) { scene.remove(pol.roadblock); pol.roadblock = null; }
    const g = new THREE.Group();
    for (const x of [-6, 6]) {
      const c = makePoliceCruiser(rng);
      c.position.set(x, 0, 0);
      c.rotation.y = 0;
      g.add(c);
    }
    const barrier = new THREE.Mesh(
      new THREE.BoxGeometry(16, 1.1, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xffcf3d, emissive: 0x554400, emissiveIntensity: 0.4 })
    );
    barrier.position.set(0, 0.8, 2);
    g.add(barrier);
    g.position.set(0, 0, z);
    scene.add(g);
    pol.roadblock = g;
  };

  pol.update = function (dt, t, playerPos, playerSpeed) {
    pol.sirenPhase += dt * 6;
    const flash = Math.sin(pol.sirenPhase) > 0;
    // chase AI: cruisers steer toward the player, ram when close
    for (const c of pol.cruisers) {
      const toPlayer = new THREE.Vector3().subVectors(playerPos, c.mesh.position);
      const dist = toPlayer.length();
      const wantHeading = Math.atan2(-toPlayer.x, -toPlayer.z);
      let dh = wantHeading - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += THREE.MathUtils.clamp(dh, -1.6 * dt, 1.6 * dt);
      const targetSpeed = dist > 90 ? 40 : dist > 25 ? 34 : 26;
      c.speed += (targetSpeed - c.speed) * Math.min(1, dt * 1.5);
      // keep on the road lanes
      const nx = THREE.MathUtils.clamp(c.mesh.position.x + -Math.sin(c.heading) * c.speed * dt, -11, 11);
      const nz = c.mesh.position.z + -Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.x = nx;
      c.mesh.position.z = THREE.MathUtils.clamp(nz, -430, 430);
      c.mesh.rotation.y = c.heading;
      c.mesh.rotation.z = -THREE.MathUtils.clamp(dh, -0.2, 0.2);
      // lightbar strobe
      if (c.mesh.userData.lightbar) {
        c.mesh.userData.lightbar.r.color.setHex(flash ? 0xff2020 : 0x330000);
        c.mesh.userData.lightbar.b.color.setHex(flash ? 0x000033 : 0x2040ff);
      }
      // ram: bump the player when touching
      if (dist < 4.2 && Math.abs(playerSpeed) > 1) {
        c.speed *= 0.6;
      }
    }
    // helicopter: big, close, well-lit, kept AHEAD of the player so it is in
    // the chase-camera frame with the cone locked on the car
    if (pol.heli.visible) {
      const h = pol.heli;
      const orbit = t * 0.12;
      const hx = playerPos.x - 8 + Math.sin(orbit) * 8;
      const hz = playerPos.z - 26 - Math.cos(orbit) * 5;
      h.position.set(hx, 23, hz);
      h.rotation.y = Math.atan2(playerPos.x - hx, playerPos.z - hz) + Math.PI;
      h.userData.rotor.rotation.y += dt * 22;
      h.userData.tailRotor.rotation.z += dt * 30;
      h.userData.strobe.color.setHex(Math.sin(t * 9) > 0 ? 0xff4040 : 0x550000);
      // cone tracks the player
      const dx = playerPos.x - hx, dz = playerPos.z - hz;
      const tilt = Math.atan2(Math.hypot(dx, dz), 26);
      h.userData.cone.rotation.x = Math.PI;
      h.rotation.x = THREE.MathUtils.clamp(tilt * 0.5, 0, 0.45);
      h.rotation.z = THREE.MathUtils.clamp(-dx * 0.01, -0.3, 0.3);
      pol.lightPool.position.set(playerPos.x, 0.14, playerPos.z);
      pol.lightPool.material.opacity = 0.3 + Math.sin(t * 3) * 0.08;
      // heli spotlight aims at the player
      h.userData.spotTarget.position.set(dx, -26, dz);
    }
    // roadblock appears at 3+ stars, ahead of the player
    if (pol.stars >= 3 && !pol.roadblock) pol.buildRoadblock(playerPos.z - 120);
    if (pol.stars < 3 && pol.roadblock) { scene.remove(pol.roadblock); pol.roadblock = null; }
    if (pol.roadblock) {
      const rb = pol.roadblock;
      if (rb.position.z > playerPos.z + 40) rb.position.z = playerPos.z - 140;
    }
  };

  pol.dispatchList = function (playerPos) {
    // distances live from cruiser positions
    return DISPATCH_UNITS.slice(0, pol.stars >= 4 ? 6 : 4).map((u, i) => {
      let d = 30 + i * 17 + Math.floor(Math.random() * 12);
      if (u.call === 'AIR ONE') d = 18;
      if (pol.cruisers[i]) d = Math.round(pol.cruisers[i].mesh.position.distanceTo(playerPos));
      return { ...u, dist: d };
    });
  };

  pol.setStars(4);
  return pol;
}
