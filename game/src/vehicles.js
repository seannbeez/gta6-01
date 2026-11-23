// Vehicles: procedural car meshes (sports / sedan / muscle / police), the traffic
// that drives the boulevard lanes, and the AIR ONE police helicopter with its
// volumetric-style searchlight cone.
import * as THREE from 'three';
import { clamp, lerp, pick, range } from './rng.js';

const CAR_COLORS = [0xff2f5e, 0x00e5ff, 0xffe14d, 0x7dff5e, 0xff6b35, 0xb388ff, 0xf2f2f2, 0x1a1a22];

export function makeCarMesh(kind, color, random) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color, roughness: 0.25, metalness: 0.75,
  });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a1420, roughness: 0.1, metalness: 0.9 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.8 });
  const bodyLen = kind === 'muscle' ? 4.6 : 4.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, bodyLen), bodyMat);
  body.position.y = 0.55; body.castShadow = true;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.42, 0.9), bodyMat);
  nose.position.set(0, 0.48, -bodyLen / 2 - 0.15); nose.castShadow = true;
  g.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, kind === 'sports' ? 1.9 : 2.3), glassMat);
  cabin.position.set(0, 1.08, kind === 'sports' ? 0.35 : 0.1);
  cabin.castShadow = true;
  g.add(cabin);
  if (kind === 'sports') {
    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), darkMat);
    spoiler.position.set(0, 1.05, bodyLen / 2 + 0.1);
    g.add(spoiler);
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.3), darkMat);
    wingL.position.set(-0.8, 0.88, bodyLen / 2 + 0.1); g.add(wingL);
    const wingR = wingL.clone(); wingR.position.x = 0.8; g.add(wingR);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[-0.85, -1.45], [0.85, -1.45], [-0.85, 1.45], [0.85, 1.45]]) {
    const w = new THREE.Mesh(wheelGeo, darkMat);
    w.position.set(x, 0.36, z); w.castShadow = true;
    g.add(w); wheels.push(w);
  }
  // headlights + taillights (emissive, always on at night / in storm)
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), headMat);
    h.position.set(x, 0.55, -bodyLen / 2 - 0.62);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1a1a });
  for (const x of [-0.62, 0.62]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.06), tailMat);
    t.position.set(x, 0.6, bodyLen / 2 + 0.04);
    g.add(t);
  }
  // headlight beams (additive translucent cones, visible at night/storm)
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.10,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beamGeo = new THREE.ConeGeometry(1.1, 9, 12, 1, true);
  beamGeo.rotateX(-Math.PI / 2); beamGeo.translate(0, 0.25, -6.4);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  g.add(beam);
  g.userData.beamMat = beamMat;
  // underbody neon glow
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, bodyLen + 0.6), glowMat);
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06;
  g.add(glow);
  g.userData.glowMat = glowMat;
  g.userData.wheels = wheels;
  if (kind === 'police') {
    // black-and-white cruiser + lightbar
    bodyMat.color.set(0xf2f2f2);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.4, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.4, metalness: 0.5 }));
    door.position.set(0, 0.55, 0.2);
    g.add(door);
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.4), darkMat);
    barBase.position.set(0, 1.42, 0.1);
    g.add(barBase);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.38),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.28, 1.52, 0.1);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.38),
      new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.28, 1.52, 0.1);
    g.add(blue);
    g.userData.lightRed = red; g.userData.lightBlue = blue;
    glowMat.color.set(0xff2020);
  }
  g.userData.kind = kind;
  return g;
}

export function setCarPaint(car, color, neon) {
  car.traverse((o) => {
    if (o.isMesh && o.material && o.material.isMeshStandardMaterial && o.userData.kind === undefined) {
      // only the body meshes carry the paint: they are the two big boxes
      if (o.geometry && o.geometry.parameters && o.geometry.parameters.width === 1.9) {
        o.material.color.set(color);
      }
    }
  });
  if (car.userData.glowMat) car.userData.glowMat.color.set(neon);
}

// --- Traffic: cars looping the boulevard + cross streets, stopping at junctions ---
const LANES = [
  { x: -3.4, dir: -1, z0: -275, z1: 275 }, // northbound
  { x: 3.4, dir: 1, z0: -275, z1: 275 }, // southbound
];

export function createTraffic(scene, rng, count = 14) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const kind = pick(rng, ['sports', 'sedan', 'muscle', 'sedan', 'sports']);
    const mesh = makeCarMesh(kind, pick(rng, CAR_COLORS), rng);
    const lane = LANES[i % 2];
    const z = range(rng, lane.z0, lane.z1);
    mesh.position.set(lane.x + range(rng, -0.4, 0.4), 0, z);
    mesh.rotation.y = lane.dir === -1 ? Math.PI : 0;
    scene.add(mesh);
    cars.push({
      mesh, lane, speed: range(rng, 7, 13), baseSpeed: 0, kind,
      state: 'drive', wait: 0, targetSpeed: range(rng, 7, 13),
    });
    cars[i].baseSpeed = cars[i].targetSpeed;
  }
  return cars;
}

export function updateTraffic(cars, dt, playerPos, time) {
  for (const c of cars) {
    // slow near intersections, and yield when the player is right ahead
    let target = c.baseSpeed;
    const z = c.mesh.position.z;
    for (const jz of [-180, -90, 0, 90, 180]) {
      if (Math.abs(z - jz) < 14) { target = c.baseSpeed * 0.45; break; }
    }
    const dx = c.mesh.position.x - playerPos.x;
    const dz = c.mesh.position.z - playerPos.z;
    if (Math.abs(dx) < 3 && dz * c.lane.dir > 0 && dz * c.lane.dir < 12) target = 0;
    c.speed = lerp(c.speed, target, Math.min(1, dt * 1.5));
    c.mesh.position.z += c.lane.dir * c.speed * dt;
    if (c.mesh.position.z > 278) c.mesh.position.z = -278;
    if (c.mesh.position.z < -278) c.mesh.position.z = 278;
    // gentle lane wobble + wheel spin
    c.mesh.position.x = c.lane.x + Math.sin(time * 0.5 + c.mesh.position.z * 0.02) * 0.25;
    for (const w of c.mesh.userData.wheels) w.rotation.x += c.speed * dt * 2.4;
    c.mesh.userData.beamMat.opacity = 0.10;
  }
}

// --- Police helicopter: visible aircraft + translucent searchlight cone ---
export function makeHelicopter() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.4, metalness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 4.6), bodyMat);
  body.castShadow = true;
  g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x0a2a4a, roughness: 0.1, metalness: 0.9 }));
  glass.position.set(0, 0.2, -2.0);
  g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.4), bodyMat);
  tail.position.set(0, 0.3, 4.2);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1.0), bodyMat);
  fin.position.set(0, 0.9, 6.2);
  g.add(fin);
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.7 });
  for (const x of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.6), skidMat);
    skid.position.set(x, -1.0, 0);
    g.add(skid);
  }
  // main rotor (spins)
  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x30303a, roughness: 0.5 });
  for (let i = 0; i < 4; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 5.4), bladeMat);
    blade.position.z = i % 2 === 0 ? 2.7 : -2.7;
    if (i >= 2) blade.rotation.y = Math.PI / 2;
    rotor.add(blade);
  }
  rotor.position.y = 1.15;
  g.add(rotor);
  g.userData.rotor = rotor;
  // belly spotlight + cone
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff6c8, transparent: true, opacity: 0.16,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const coneGeo = new THREE.ConeGeometry(7, 34, 20, 1, true);
  coneGeo.rotateX(Math.PI); // apex up at the heli
  coneGeo.translate(0, -17, 0);
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.y = -0.8;
  g.add(cone);
  const spot = new THREE.SpotLight(0xfff2b0, 900, 90, 0.32, 0.5, 1.2);
  spot.position.set(0, -0.8, 0);
  g.add(spot);
  g.userData.spot = spot;
  // pool of light where the cone lands
  const poolMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pool = new THREE.Mesh(new THREE.CircleGeometry(6.5, 24), poolMat);
  pool.rotation.x = -Math.PI / 2;
  g.add(pool);
  g.userData.pool = pool; g.userData.poolMat = poolMat; g.userData.coneMat = coneMat;
  g.visible = false;
  return g;
}

export function updateHelicopter(heli, dt, targetPos, time, active, framed = false) {
  heli.visible = active;
  if (!active) return;
  heli.userData.rotor.rotation.y += dt * 22;
  // hover above and slightly behind the player, circling slowly; when framed
  // (screenshot mode) hold it ahead-right, in the camera's view, cone on target
  const a = time * 0.25;
  if (framed) {
    heli.position.set(targetPos.x + 14, 15 + Math.sin(time * 0.6) * 1.2, targetPos.z - 12);
  } else {
    heli.position.set(
      targetPos.x + Math.cos(a) * 16,
      34 + Math.sin(time * 0.6) * 1.5,
      targetPos.z + Math.sin(a) * 16 - 8,
    );
  }
  heli.lookAt(targetPos.x, 0, targetPos.z);
  heli.rotation.z = Math.sin(time * 0.9) * 0.06;
  // aim the cone + pool at the player: rotate the cone's down axis onto the
  // heli->player direction, stretch it to reach the ground
  const dx = targetPos.x - heli.position.x;
  const dz = targetPos.z - heli.position.z;
  const h = heli.position.y;
  const dist = Math.hypot(dx, h, dz);
  const dir = new THREE.Vector3(dx, -h, dz).normalize();
  const cone = heli.children.find((c) => c.geometry && c.geometry.type === 'ConeGeometry');
  if (cone) {
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    cone.scale.set(1, dist / 34, 1);
  }
  heli.userData.pool.position.set(dx, -(h - 0.8), dz);
  heli.userData.spot.target.position.set(dx, -h, dz);
  heli.userData.spot.target.updateMatrixWorld();
}
