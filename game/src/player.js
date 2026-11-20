// Dax Renner on foot: third-person walker, punch + pistol combat — authored in this session.
import * as THREE from 'three';
import { CFG, PALETTE } from './config.js';
import { clamp, lerpAngle, dist2d, resolveCircleBoxes, pick } from './util.js';

export function makePersonMesh(shirt, pants, skin = 0xd9a077) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.85, 0.4), shirtMat);
  torso.position.y = 1.15; torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
  head.position.y = 1.82; head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.16, 0.44), new THREE.MeshLambertMaterial({ color: 0x2a2018 }));
  hair.position.y = 2.05;
  g.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.8, 0.32), pantsMat);
  legL.position.set(-0.19, 0.4, 0); legL.castShadow = true;
  g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.19;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.26), shirtMat);
  armL.position.set(-0.48, 1.15, 0);
  g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.48;
  g.add(armR);
  g.userData = { legL, legR, armL, armR, torso, head };
  return g;
}

export class Player {
  constructor(scene, x, z) {
    this.scene = scene;
    this.mesh = makePersonMesh(0x2e6fc2, 0x2a2f38);
    // Dax wears a red jacket over the blue shirt: a slightly bigger torso shell.
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.9, 0.46), new THREE.MeshLambertMaterial({ color: 0xc23b2e }));
    jacket.position.y = 1.15;
    this.mesh.add(jacket);
    this.x = x; this.z = z;
    this.heading = 0;
    this.camYaw = 0;
    this.health = CFG.playerHealth;
    this.inCar = null;
    this.walkPhase = 0;
    this.punchTimer = 0;
    this.shootCooldown = 0;
    this.fireInterval = 0.32;
    this.muzzle = null;
    scene.add(this.mesh);
    this.sync();
  }
  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = -this.heading;
  }
  // Returns 'punch' | 'shoot' when an attack was triggered this frame, else null.
  update(input, dt, colliders) {
    if (this.inCar) return null;
    const fwd = (input.any('KeyW', 'ArrowUp') ? 1 : 0) - (input.any('KeyS', 'ArrowDown') ? 1 : 0);
    const strafe = (input.any('KeyD', 'ArrowRight') ? 1 : 0) - (input.any('KeyA', 'ArrowLeft') ? 1 : 0);
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? CFG.sprintSpeed : CFG.walkSpeed;
    this.camYaw -= input.mouseDX * 0.004;
    // Walk relative to the camera yaw: W walks away from the camera.
    const yaw = this.camYaw;
    let mx = 0, mz = 0;
    if (fwd !== 0 || strafe !== 0) {
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      mx = fx * fwd + rx * strafe;
      mz = fz * fwd + rz * strafe;
      const len = Math.hypot(mx, mz);
      mx /= len; mz /= len;
      this.heading = lerpAngle(this.heading, Math.atan2(mx, mz), Math.min(1, dt * 12));
      this.walkPhase += dt * speed * 1.6;
    }
    const nx = this.x + mx * speed * dt;
    const nz = this.z + mz * speed * dt;
    const res = resolveCircleBoxes(nx, nz, 0.6, colliders);
    this.x = clamp(res.x, -CFG.cityHalf - 6, CFG.cityHalf + 6);
    this.z = clamp(res.z, -CFG.cityHalf - 6, CFG.southBankFar + 6);
    // Walk-cycle limb swing.
    const swing = (fwd !== 0 || strafe !== 0) ? Math.sin(this.walkPhase) * 0.55 : 0;
    const u = this.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.7;
    u.armR.rotation.x = swing * 0.7;
    if (this.punchTimer > 0) {
      this.punchTimer -= dt;
      u.armR.rotation.x = -1.6 * Math.max(0, this.punchTimer / 0.25);
    }
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    this.sync();
    if (input.pressed('KeyF')) { this.punchTimer = 0.25; return 'punch'; }
    if ((input.mouseClicked || input.pressed('KeyG')) && this.shootCooldown <= 0) {
      this.shootCooldown = this.fireInterval;
      return 'shoot';
    }
    return null;
  }
  damage(n) {
    this.health = Math.max(0, this.health - n);
  }
  heal(n) {
    this.health = Math.min(CFG.playerHealth, this.health + n);
  }
}

// Pedestrians: sidewalk walkers who stroll, cross at corners, and flee from gunfire.
export class Pedestrians {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.list = [];
    this.maxPeds = 34;
  }
  spawn(n, nearX, nearZ) {
    for (let i = 0; i < n; i++) {
      const x = nearX + (this.rng() * 2 - 1) * 120;
      const z = nearZ + (this.rng() * 2 - 1) * 120;
      const shirt = pick(this.rng, PALETTE.pedShirts);
      const mesh = makePersonMesh(shirt, pick(this.rng, [0x2a2f38, 0x4a3a2a, 0x3a4a3a]));
      const p = {
        mesh, x, z,
        heading: this.rng() * Math.PI * 2,
        speed: 1.2 + this.rng() * 1.3,
        phase: this.rng() * 6,
        flee: 0,
        alive: true,
        health: 50,
      };
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.list.push(p);
    }
  }
  update(dt, playerX, playerZ, dangerX, dangerZ, dangerR) {
    if (this.list.length < this.maxPeds && this.rng() < dt * 1.5) this.spawn(1, playerX, playerZ);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (!p.alive) continue;
      if (dist2d(p.x, p.z, playerX, playerZ) > 320) {
        this.scene.remove(p.mesh);
        this.list.splice(i, 1);
        continue;
      }
      if (dangerX !== null && dist2d(p.x, p.z, dangerX, dangerZ) < dangerR) p.flee = 2.5;
      if (p.flee > 0) {
        p.flee -= dt;
        const away = Math.atan2(p.x - playerX, p.z - playerZ);
        p.heading = lerpAngle(p.heading, away, Math.min(1, dt * 8));
        p.speed = 5;
      } else {
        p.speed = 1.2 + Math.sin(p.phase * 0.3) * 0.3;
        if (this.rng() < dt * 0.1) p.heading += (this.rng() - 0.5) * 1.6;
      }
      p.phase += dt * 6;
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      p.x = clamp(p.x, -CFG.cityHalf - 6, CFG.cityHalf + 6);
      p.z = clamp(p.z, -CFG.cityHalf - 6, CFG.southBankFar + 6);
      const u = p.mesh.userData;
      const swing = Math.sin(p.phase) * 0.5;
      u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.6; u.armR.rotation.x = swing * 0.6;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = -p.heading;
    }
  }
  nearest(x, z, maxD) {
    let best = null, bestD = maxD;
    for (const p of this.list) {
      if (!p.alive) continue;
      const d = dist2d(x, z, p.x, p.z);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  }
}
