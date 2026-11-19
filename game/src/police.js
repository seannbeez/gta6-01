// Wanted system + Talvera PD: pursuit cars, roadblocks, helicopter — authored in this session.
import * as THREE from 'three';
import { CFG, PALETTE } from './config.js';
import { clamp, lerpAngle, dist2d } from './util.js';
import { Car } from './vehicles.js';

function collides(x, z, r, colliders) {
  for (const b of colliders) {
    const cx = clamp(x, b.minX, b.maxX);
    const cz = clamp(z, b.minZ, b.maxZ);
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

export class Police {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.heat = 0; // 0..100; wanted stars derive from it
    this.lastCrimeAt = -999;
    this.cars = [];
    this.roadblock = null;
    this.roadblockTimer = 0;
    this.heli = null;
    this.heliAngle = 0;
    this.heliHeight = 42;
    this.heliRadius = 26;
    this.bustedTimer = 0;
    this.time = 0;
  }
  get wanted() {
    if (this.heat <= 0) return 0;
    return Math.min(5, Math.ceil(this.heat / 20));
  }
  addHeat(stars, now) {
    this.heat = clamp(this.heat + stars * 20, 0, 100);
    this.lastCrimeAt = now;
  }
  clearHeat() { this.heat = 0; this.lastCrimeAt = -999; }
  spawnCar(x, z) {
    const car = new Car(this.scene, 'police', PALETTE.policeWhite, x, z, 0);
    car.chaseSpeed = 30 + this.wanted * 1.5;
    car.stuck = 0;
    car.reverseT = 0;
    this.cars.push(car);
    return car;
  }
  removeCar(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    this.scene.remove(car.mesh);
  }
  makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.4, 1.8), new THREE.MeshLambertMaterial({ color: 0x1c1e26 }));
    body.castShadow = true;
    g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.5), new THREE.MeshLambertMaterial({ color: 0x1c1e26 }));
    tail.position.set(-3, 0.2, 0);
    g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 0.95;
    g.add(rotor);
    const lamp = new THREE.Mesh(
      new THREE.ConeGeometry(6, 22, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false }),
    );
    lamp.position.y = -11;
    lamp.rotation.x = Math.PI;
    g.add(lamp);
    g.userData.rotor = rotor;
    this.scene.add(g);
    return g;
  }
  spawnRoadblock(px, pz, heading) {
    // Two parked cruisers across the road ahead of the player.
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const rx = Math.cos(heading), rz = -Math.sin(heading);
    const bx = px + fx * 55, bz = pz + fz * 55;
    const cars = [];
    for (const s of [-3.2, 3.2]) {
      const car = new Car(this.scene, 'police', PALETTE.policeWhite, bx + rx * s, bz + rz * s, heading + Math.PI / 2);
      car.speed = 0;
      cars.push(car);
    }
    this.roadblock = { x: bx, z: bz, cars, life: 25 };
  }
  clearRoadblock() {
    if (!this.roadblock) return;
    for (const c of this.roadblock.cars) this.scene.remove(c.mesh);
    this.roadblock = null;
  }
  update(dt, ctx) {
    this.time += dt;
    const { player, audio } = ctx;
    const px = player.inCar ? player.inCar.x : player.x;
    const pz = player.inCar ? player.inCar.z : player.z;
    const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : 0;
    // Decay: no crime for a while and no cruiser close by.
    const nearestCop = this.cars.reduce((m, c) => Math.min(m, dist2d(c.x, c.z, px, pz)), 999);
    if (this.heat > 0 && this.time - this.lastCrimeAt > CFG.wantedDecaySeconds && nearestCop > 45 && !this.heli) {
      this.heat = Math.max(0, this.heat - dt * 4);
    }
    // Cruisers: one per star, plus one extra from 3 stars.
    const want = this.wanted === 0 ? 0 : this.wanted + (this.wanted >= 3 ? 1 : 0);
    while (this.cars.length < want) {
      const a = this.rng() * Math.PI * 2;
      const x = clamp(px + Math.sin(a) * 90, -290, 290);
      const z = clamp(pz + Math.cos(a) * 90, -290, 450);
      this.spawnCar(x, z);
    }
    while (this.cars.length > want) this.removeCar(this.cars[this.cars.length - 1]);
    // Pursuit.
    for (const c of this.cars) {
      const d = dist2d(c.x, c.z, px, pz);
      const desired = Math.atan2(px - c.x, pz - c.z);
      if (c.reverseT > 0) {
        c.reverseT -= dt;
        c.speed = -8;
      } else {
        c.speed += ((d > 60 ? c.chaseSpeed : c.chaseSpeed * 0.85) - c.speed) * Math.min(1, dt * 1.2);
      }
      c.heading = lerpAngle(c.heading, desired, Math.min(1, dt * (c.reverseT > 0 ? 6 : 2.2)));
      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z + Math.cos(c.heading) * c.speed * dt;
      const prevX = c.x, prevZ = c.z;
      if (!collides(nx, c.z, 1.9, this.city.colliders)) c.x = nx;
      if (!collides(c.x, nz, 1.9, this.city.colliders)) c.z = nz;
      if (dist2d(c.x, c.z, prevX, prevZ) < 0.2 && Math.abs(c.speed) > 4) {
        c.stuck += dt;
        if (c.stuck > 1.2) { c.reverseT = 0.9; c.stuck = 0; }
      } else c.stuck = 0;
      // Ram the player's car: shove it and slow it.
      if (player.inCar && d < 4.2) {
        const ux = (player.inCar.x - c.x) / (d || 1), uz = (player.inCar.z - c.z) / (d || 1);
        player.inCar.x += ux * 2.4 * dt * 10;
        player.inCar.z += uz * 2.4 * dt * 10;
        player.inCar.speed *= 1 - Math.min(0.5, dt * 1.5);
      }
      c.sync();
      // Flash the light bar.
      const bar = c.mesh.userData.lightBar;
      if (bar) {
        const on = Math.floor(this.time * 4) % 2 === 0;
        bar.r.material.emissive.setHex(on ? 0xaa0000 : 0x220000);
        bar.b.material.emissive.setHex(on ? 0x000022 : 0x0000aa);
      }
    }
    // Roadblock at 3+ stars, refreshed every 25 s.
    this.roadblockTimer -= dt;
    if (this.wanted >= 3 && this.roadblockTimer <= 0) {
      this.clearRoadblock();
      const heading = player.inCar ? player.inCar.heading : player.heading;
      this.spawnRoadblock(px, pz, heading);
      this.roadblockTimer = 25;
    }
    if (this.roadblock) {
      this.roadblock.life -= dt;
      if (this.roadblock.life <= 0) { this.clearRoadblock(); this.roadblockTimer = 8; }
    }
    if (this.wanted < 3) { this.clearRoadblock(); this.roadblockTimer = 0; }
    // Helicopter at 4+ stars.
    if (this.wanted >= 4 && !this.heli) this.heli = this.makeHeli();
    if (this.wanted < 4 && this.heli) { this.scene.remove(this.heli); this.heli = null; }
    if (this.heli) {
      this.heliAngle += dt * 0.35;
      this.heli.position.set(px + Math.sin(this.heliAngle) * this.heliRadius, this.heliHeight, pz + Math.cos(this.heliAngle) * this.heliRadius);
      this.heli.rotation.y = -Math.atan2(px - this.heli.position.x, pz - this.heli.position.z);
      this.heli.userData.rotor.rotation.y += dt * 22;
      this.heli.lookAt(px, 0, pz);
    }
    // Siren while any cruiser is out.
    audio.siren(this.cars.length > 0);
    // Busted: a cruiser sits on top of a slow player.
    const slow = player.inCar ? Math.abs(player.inCar.speed) < 2 : true;
    if (this.wanted > 0 && nearestCop < 4 && slow) this.bustedTimer += dt;
    else this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    return this.bustedTimer > 3;
  }
}
