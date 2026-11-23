// player.js — PROJECT VICE. The player: seamless on-foot third-person walker and
// arcade-sim driver. On foot: walk, sprint, jump, shoot with tracers + muzzle flash,
// weapons 1-3 (Pistol / SMG / Shotgun). In car: steering, accel, handbrake drift,
// nitro with blue flames, damage sparks. Enter/exit any car with F or E.
import * as THREE from 'three';

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', ammo: Infinity, damage: 12, rate: 0.35 },
  { id: 'bat', name: 'BAT', ammo: Infinity, damage: 22, rate: 0.5 },
  { id: 'pistol', name: 'PISTOL', ammo: 48, damage: 26, rate: 0.28 },
  { id: 'smg', name: 'SMG', ammo: 120, damage: 14, rate: 0.09 },
  { id: 'shotgun', name: 'SHOTGUN', ammo: 24, damage: 70, rate: 0.8 },
  { id: 'rifle', name: 'RIFLE', ammo: 60, damage: 42, rate: 0.14 },
  { id: 'rpg', name: 'RPG', ammo: 4, damage: 140, rate: 1.2 },
];

export function createPlayer(scene) {
  const p = {
    mode: 'car', // 'car' | 'foot'
    pos: new THREE.Vector3(0, 0, 26),
    heading: 0, // facing -Z: north up the boulevard toward the bridge
    speed: 0,
    steer: 0,
    nitro: 100,
    nitroActive: false,
    drifting: false,
    health: 100,
    armor: 60,
    cash: 1250,
    respect: 62, // 0-100 progress to next rank
    respectLevel: 4,
    respectTitle: 'FIXER',
    condition: 84, // car condition %
    weaponIndex: 2, // pistol
    lastShot: 0,
    onGround: true,
    vy: 0,
    walkHeading: 0,
    car: null,
    mesh: null,
    footMesh: null,
    muzzle: null,
    tracers: [],
    shake: 0,
    hitStop: 0,
  };

  // --- on-foot character: stylised driver in a neon jacket ---
  const foot = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0xff2a55, roughness: 0.6 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x22304a, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.7 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.32), jeans);
  legs.position.y = 0.45;
  foot.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.75, 0.4), jacket);
  torso.position.y = 1.2;
  foot.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.78;
  foot.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0x111111 }));
  cap.position.y = 1.98;
  foot.add(cap);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), jacket);
  armL.position.set(-0.46, 1.2, 0);
  foot.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.46;
  foot.add(armR);
  foot.visible = false;
  scene.add(foot);
  p.footMesh = foot;

  // muzzle flash light + sprite
  const muzzle = new THREE.PointLight(0xffc860, 0, 14, 1.5);
  scene.add(muzzle);
  p.muzzle = muzzle;

  p.currentWeapon = () => WEAPONS[p.weaponIndex];

  p.shoot = function (targetPoint) {
    const now = performance.now() / 1000;
    const w = p.currentWeapon();
    if (now - p.lastShot < w.rate) return false;
    if (w.ammo !== Infinity && w.ammo <= 0) return false;
    if (w.ammo !== Infinity) w.ammo -= 1;
    p.lastShot = now;
    const origin = p.mode === 'car' && p.car
      ? p.car.position.clone().add(new THREE.Vector3(0, 1.1, 0))
      : p.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
    const dir = targetPoint ? targetPoint.clone().sub(origin).normalize() : new THREE.Vector3(-Math.sin(p.heading), 0, -Math.cos(p.heading));
    // tracer: bright line that fades
    const geo = new THREE.BufferGeometry().setFromPoints([origin, origin.clone().add(dir.clone().multiplyScalar(42))]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 }));
    scene.add(line);
    p.tracers.push({ line, life: 0.09 });
    p.muzzle.position.copy(origin);
    p.muzzle.intensity = 90;
    p.shake = Math.min(p.shake + 0.12, 0.4);
    return true;
  };

  p.updateTracers = function (dt) {
    for (let i = p.tracers.length - 1; i >= 0; i--) {
      const t = p.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09);
      if (t.life <= 0) { scene.remove(t.line); t.line.geometry.dispose(); p.tracers.splice(i, 1); }
    }
    p.muzzle.intensity = Math.max(0, p.muzzle.intensity - dt * 900);
  };

  // --- driving physics (arcade-sim) ---
  p.drive = function (dt, input, onCrime) {
    if (!p.car) return;
    const accel = input.forward ? 26 : input.back ? -16 : 0;
    const maxSpeed = p.nitroActive && p.nitro > 0 ? 62 : 46;
    p.speed += accel * dt;
    if (!input.forward && !input.back) p.speed -= Math.sign(p.speed) * 14 * dt;
    if (Math.abs(p.speed) < 0.4 && !input.forward && !input.back) p.speed = 0;
    p.speed = THREE.MathUtils.clamp(p.speed, -14, maxSpeed);
    // steering: sharper at low speed, drift widens it
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    p.steer += (steerTarget - p.steer) * Math.min(1, dt * 10);
    const steerAngle = p.steer * (p.drifting ? 0.85 : 0.55) * Math.min(1, Math.abs(p.speed) / 12);
    p.heading += steerAngle * (p.speed / 46) * dt * 2.4 * (p.speed < 0 ? -1 : 1);
    const fwd = new THREE.Vector3(-Math.sin(p.heading), 0, -Math.cos(p.heading));
    const lateral = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const driftSlide = p.drifting ? p.steer * 0.35 : 0;
    p.pos.addScaledVector(fwd, p.speed * dt);
    p.pos.addScaledVector(lateral, driftSlide * Math.abs(p.speed) * dt);
    // stay on the island: soft bounds
    p.pos.x = THREE.MathUtils.clamp(p.pos.x, -120, 150);
    p.pos.z = THREE.MathUtils.clamp(p.pos.z, -430, 430);
    // nitro
    p.nitroActive = input.nitro && p.nitro > 0 && p.speed > 8;
    if (p.nitroActive) p.nitro = Math.max(0, p.nitro - 26 * dt);
    else p.nitro = Math.min(100, p.nitro + 5 * dt);
    p.drifting = input.handbrake && Math.abs(p.speed) > 10;
    if (p.drifting) p.speed *= (1 - 0.25 * dt);
    // speeding past cops is a crime
    if (Math.abs(p.speed) > 40 && onCrime) onCrime('speeding');
    // apply to mesh
    p.car.position.copy(p.pos);
    p.car.position.y = 0;
    p.car.rotation.y = p.heading;
    p.car.rotation.z = -p.steer * 0.06 * Math.min(1, Math.abs(p.speed) / 20) - (p.drifting ? p.steer * 0.08 : 0);
    p.car.rotation.x = -accel * 0.0012;
    // wheel spin
    const wheels = p.car.userData.wheels || [];
    for (const w of wheels) w.rotation.x += p.speed * dt * 1.6;
  };

  // --- on-foot movement ---
  p.walk = function (dt, input) {
    const sprint = input.sprint ? 9.5 : 5.2;
    const move = new THREE.Vector3();
    if (input.forward) move.z -= 1;
    if (input.back) move.z += 1;
    if (input.left) move.x -= 1;
    if (input.right) move.x += 1;
    if (move.lengthSq() > 0) {
      move.normalize();
      // camera-relative: forward is -Z of heading
      const fwd = new THREE.Vector3(-Math.sin(p.walkHeading), 0, -Math.cos(p.walkHeading));
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const dir = fwd.clone().multiplyScalar(-move.z).add(right.clone().multiplyScalar(move.x)).normalize();
      p.pos.addScaledVector(dir, sprint * dt);
      p.walkHeading = Math.atan2(-dir.x, -dir.z);
      p.footMesh.position.copy(p.pos);
      p.footMesh.rotation.y = p.walkHeading;
      // walk bob
      p.footMesh.position.y = Math.abs(Math.sin(performance.now() / 90)) * 0.06;
    }
    // jump
    if (input.jump && p.onGround) { p.vy = 7.5; p.onGround = false; }
    if (!p.onGround) {
      p.vy -= 22 * dt;
      p.pos.y += p.vy * dt;
      if (p.pos.y <= 0) { p.pos.y = 0; p.vy = 0; p.onGround = true; }
      p.footMesh.position.y = p.pos.y;
    }
    p.pos.x = THREE.MathUtils.clamp(p.pos.x, -120, 150);
    p.pos.z = THREE.MathUtils.clamp(p.pos.z, -430, 430);
  };

  p.enterCar = function (car) {
    p.car = car;
    p.mode = 'car';
    p.pos.copy(car.position);
    p.heading = car.rotation.y;
    p.speed = 0;
    p.footMesh.visible = false;
  };

  p.exitCar = function () {
    if (!p.car) return;
    p.mode = 'foot';
    const side = new THREE.Vector3(Math.cos(p.heading), 0, -Math.sin(p.heading));
    p.pos.copy(p.car.position).addScaledVector(side, 2.6);
    p.pos.y = 0;
    p.walkHeading = p.heading;
    p.footMesh.visible = true;
    p.footMesh.position.copy(p.pos);
    p.speed = 0;
  };

  return p;
}
