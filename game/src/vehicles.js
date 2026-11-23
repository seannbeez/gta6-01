// vehicles.js — PROJECT VICE. Procedural car factory: sports cars, sedans, muscle
// cars, police cruisers and the police helicopter with its searchlight cone.
// Every vehicle is built from boxes/cylinders with neon underglow, headlights and
// taillights — no external models.
import * as THREE from 'three';

const WHEEL_GEO = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 14);
const WHEEL_MAT = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 });
const RIM_GEO = new THREE.CylinderGeometry(0.24, 0.24, 0.34, 10);
const RIM_MAT = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 0.9, roughness: 0.25 });

function wheel(x, z) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
  tyre.rotation.z = Math.PI / 2;
  g.add(tyre);
  g.position.set(x, 0.42, z);
  return g;
}

function glowPlane(color, w, l, y = 0.06) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, l),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  return m;
}

function headlight(x) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.18, 0.12),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, toneMapped: false })
  );
  m.position.set(x, 0.72, -2.32);
  return m;
}

function taillight(x) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.16, 0.12),
    new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false })
  );
  m.position.set(x, 0.78, 2.32);
  return m;
}

// A sleek sports car. opts: { color, neon, police, taxi }
export function makeCar(opts = {}) {
  const color = opts.color ?? 0xff2a55;
  const neon = opts.neon ?? 0x37e6ff;
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.28 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a1420, metalness: 0.9, roughness: 0.12 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.55, 4.7), paint);
  body.position.y = 0.62;
  car.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.34, 0.7), paint);
  nose.position.set(0, 0.5, -2.35);
  car.add(nose);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.1), glass);
  cabin.position.set(0, 1.12, 0.25);
  car.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.4), paint);
  roof.position.set(0, 1.4, 0.3);
  car.add(roof);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.35), paint);
  spoiler.position.set(0, 1.05, 2.3);
  car.add(spoiler);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.14, 4.4), new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.6 }));
  skirt.position.y = 0.32;
  car.add(skirt);

  car.add(headlight(-0.62)); car.add(headlight(0.62));
  car.add(taillight(-0.62)); car.add(taillight(0.62));
  car.add(glowPlane(neon, 3.0, 5.6));

  const wheels = [wheel(-1.02, -1.55), wheel(1.02, -1.55), wheel(-1.02, 1.55), wheel(1.02, 1.55)];
  wheels.forEach((w) => car.add(w));
  car.userData.wheels = wheels;
  car.userData.paint = paint;
  car.userData.neonMat = car.children.find((c) => c.material && c.material.blending === THREE.AdditiveBlending)?.material;

  // headlight beams: only the hero car gets real SpotLights (each light costs
  // every fragment in the forward renderer; traffic keeps emissive lamps only)
  car.userData.beams = [];
  if (opts.beams) {
    const beamL = new THREE.SpotLight(0xfff2c0, 60, 34, 0.5, 0.55, 1.2);
    beamL.position.set(-0.6, 0.7, -2.3);
    const tgtL = new THREE.Object3D(); tgtL.position.set(-0.6, 0, -16);
    car.add(tgtL); beamL.target = tgtL; car.add(beamL);
    const beamR = new THREE.SpotLight(0xfff2c0, 60, 34, 0.5, 0.55, 1.2);
    beamR.position.set(0.6, 0.7, -2.3);
    const tgtR = new THREE.Object3D(); tgtR.position.set(0.6, 0, -16);
    car.add(tgtR); beamR.target = tgtR; car.add(beamR);
    car.userData.beams = [beamL, beamR];
  }

  if (opts.police) {
    const bar = new THREE.Group();
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }));
    r.position.x = -0.32;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: 0x2040ff, toneMapped: false }));
    b.position.x = 0.32;
    bar.add(r); bar.add(b);
    bar.position.set(0, 1.5, 0.2);
    car.add(bar);
    car.userData.lightbar = { r: r.material, b: b.material };
    // POLICE livery stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.2, 3.2), new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.5 }));
    stripe.position.set(0, 0.62, 0);
    car.add(stripe);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 1.6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    badge.position.set(-1.06, 0.7, 0);
    car.add(badge);
  }
  return car;
}

export function makeTrafficCar(kind, rng) {
  const palette = {
    sport: [0xff2a55, 0xffcf3d, 0x37e6ff, 0x7dff6a, 0xff7a2f],
    sedan: [0x9aa4b0, 0x3a4a5a, 0x6a5a4a, 0x2a2a33, 0x8a2a3a],
    muscle: [0xc22a1a, 0x1a5a2a, 0x2a3a8a, 0xd8a020],
  };
  const colors = palette[kind] || palette.sedan;
  const color = colors[Math.floor(rng() * colors.length)];
  const neon = [0x37e6ff, 0xff4fd8, 0x7dff6a][Math.floor(rng() * 3)];
  const car = makeCar({ color, neon });
  if (kind === 'sedan') car.scale.set(1.02, 0.94, 1.06);
  if (kind === 'muscle') car.scale.set(1.08, 0.98, 1.02);
  return car;
}

export function makePoliceCruiser(rng) {
  return makeCar({ color: 0xe8e8ec, neon: 0x2040ff, police: true });
}

// ---- Police helicopter: BIG, well-lit, unmistakable aircraft with searchlight cone ----
export function makeHelicopter() {
  const heli = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a3a4a, metalness: 0.7, roughness: 0.35, emissive: 0x2a3a4a, emissiveIntensity: 0.55 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.9, 4.6), bodyMat);
  body.position.y = 0;
  heli.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 10), new THREE.MeshStandardMaterial({ color: 0x0a1420, metalness: 0.9, roughness: 0.15 }));
  nose.scale.set(1, 0.85, 1.1);
  nose.position.set(0, -0.15, -2.6);
  heli.add(nose);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 5.4, 8), bodyMat);
  tail.rotation.x = Math.PI / 2;
  tail.position.set(0, 0.35, 4.6);
  heli.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.8, 1.2), bodyMat);
  fin.position.set(0, 1.1, 7.0);
  heli.add(fin);
  // skids
  for (const sx of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 4.4, 6), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    skid.rotation.x = Math.PI / 2;
    skid.position.set(sx * 1.1, -1.35, 0);
    heli.add(skid);
  }
  // main rotor (spins)
  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.09, 0.55), bladeMat);
    blade.rotation.y = (i * Math.PI) / 2;
    rotor.add(blade);
  }
  rotor.position.y = 1.35;
  heli.add(rotor);
  // tail rotor
  const tailRotor = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.3), bladeMat);
    blade.rotation.z = (i * Math.PI) / 2;
    tailRotor.add(blade);
  }
  tailRotor.position.set(0.5, 1.1, 7.0);
  heli.add(tailRotor);
  // bright POLICE markings + nav lights (lit, not a black silhouette)
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.5, 4.62), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }));
  stripe.position.y = 0.1;
  heli.add(stripe);
  const bellyLight = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  bellyLight.position.set(0, -1.05, -1.2);
  heli.add(bellyLight);
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4040, toneMapped: false }));
  strobe.position.set(0, 1.1, 0);
  heli.add(strobe);
  heli.userData.strobe = strobe.material;
  // searchlight: clean translucent cone + bright pool on the ground.
  // Sized to the heli's altitude (25m) so the tip lands on the road, dim
  // enough to read as light, not a solid white pillar.
  const coneLen = 26;
  const coneGeo = new THREE.ConeGeometry(3.4, coneLen, 24, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.y = -coneLen / 2 - 1;
  cone.rotation.x = Math.PI; // apex up at the heli
  heli.add(cone);
  const coneInner = new THREE.Mesh(
    new THREE.ConeGeometry(1.7, coneLen, 18, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  coneInner.position.y = -coneLen / 2 - 1;
  coneInner.rotation.x = Math.PI;
  heli.add(coneInner);
  const spot = new THREE.SpotLight(0xfff2c0, 900, 60, 0.32, 0.5, 0.8);
  spot.position.set(0, -1, -1);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, -40, 0);
  heli.add(spotTarget);
  spot.target = spotTarget;
  heli.add(spot);
  heli.userData.rotor = rotor;
  heli.userData.tailRotor = tailRotor;
  heli.userData.cone = cone;
  heli.userData.coneInner = coneInner;
  heli.userData.spot = spot;
  heli.userData.spotTarget = spotTarget;
  heli.scale.setScalar(1.9); // large + close: readable in the cover frame
  return heli;
}

// ground pool where the searchlight lands
export function makeLightPool() {
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 28),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.14;
  return pool;
}
