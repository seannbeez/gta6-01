// Talvera city builder — procedural sun-baked river city, authored in this session.
// Grid roads every 60 units, terracotta + sandstone blocks, glass towers downtown,
// a teal river on the south edge with two bridges to the Old Mill Quarter.
import * as THREE from 'three';
import { CFG, PALETTE } from './config.js';
import { mulberry32, pick, range, makeBox } from './util.js';

const ROAD_LINES = [-240, -180, -120, -60, 0, 60, 120, 180, 240];

export function buildCity(scene) {
  const rng = mulberry32(CFG.seed);
  const colliders = [];
  const buildings = []; // {x, z, w, d, h} for the minimap
  const roads = []; // {ax, az, bx, bz} centre-line segments for traffic
  const parks = new Set(['-2,-2', '2,1', '1,-3']); // block keys kept as green squares

  scene.background = new THREE.Color(CFG.sky);
  scene.fog = new THREE.Fog(CFG.fog, 120, 620);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0xc9a06b, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(CFG.sunColor, 2.1);
  sun.position.set(180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const matCache = new Map();
  const mat = (color) => {
    if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
    return matCache.get(color);
  };
  const addBox = (x, y, z, w, h, d, color, shadow = true) => {
    const m = new THREE.Mesh(boxGeo, mat(color));
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    m.castShadow = shadow; m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  // Ground: sand base for the whole playfield, river water on top of it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 1100),
    new THREE.MeshLambertMaterial({ color: CFG.groundColor }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, CFG.riverFar - CFG.riverNear + 40),
    new THREE.MeshLambertMaterial({ color: CFG.riverColor }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.15, (CFG.riverNear + CFG.riverFar) / 2 + 10);
  scene.add(water);

  // Roads: dark strips along every grid line, plus sidewalk borders.
  const roadMat = new THREE.MeshLambertMaterial({ color: CFG.roadColor });
  const walkMat = new THREE.MeshLambertMaterial({ color: CFG.sidewalkColor });
  for (const c of ROAD_LINES) {
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadWidth, CFG.cityHalf * 2 + 20), roadMat);
    vRoad.rotation.x = -Math.PI / 2; vRoad.position.set(c, 0.05, 0); vRoad.receiveShadow = true;
    scene.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(CFG.cityHalf * 2 + 20, CFG.roadWidth), roadMat);
    hRoad.rotation.x = -Math.PI / 2; hRoad.position.set(0, 0.05, c); hRoad.receiveShadow = true;
    scene.add(hRoad);
    // Sidewalk strips flanking each road.
    for (const s of [-1, 1]) {
      const wv = new THREE.Mesh(new THREE.PlaneGeometry(3, CFG.cityHalf * 2 + 20), walkMat);
      wv.rotation.x = -Math.PI / 2; wv.position.set(c + s * (CFG.roadHalf + 1.5), 0.04, 0);
      scene.add(wv);
      const wh = new THREE.Mesh(new THREE.PlaneGeometry(CFG.cityHalf * 2 + 20, 3), walkMat);
      wh.rotation.x = -Math.PI / 2; wh.position.set(0, 0.04, c + s * (CFG.roadHalf + 1.5));
      scene.add(wh);
    }
    roads.push({ ax: c, az: -CFG.cityHalf, bx: c, bz: CFG.cityHalf, vertical: true });
    roads.push({ ax: -CFG.cityHalf, az: c, bx: CFG.cityHalf, bz: c, vertical: false });
  }
  // Bridge decks over the river at the two bridge roads, and the south-bank road.
  for (const bx of CFG.bridgeXs) {
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadWidth, CFG.riverFar - CFG.riverNear + 30), roadMat);
    deck.rotation.x = -Math.PI / 2;
    deck.position.set(bx, 0.3, (CFG.riverNear + CFG.riverFar) / 2);
    deck.receiveShadow = true;
    scene.add(deck);
    roads.push({ ax: bx, az: CFG.cityHalf, bx, bz: CFG.southBankFar, vertical: true });
  }
  const southRoad = new THREE.Mesh(new THREE.PlaneGeometry(560, CFG.roadWidth), roadMat);
  southRoad.rotation.x = -Math.PI / 2;
  southRoad.position.set(0, 0.05, 410);
  southRoad.receiveShadow = true;
  scene.add(southRoad);
  roads.push({ ax: -280, az: 410, bx: 280, bz: 410, vertical: false });

  // Buildings, block by block. Block centres sit halfway between road lines.
  const blockCentres = [];
  for (let i = 0; i < ROAD_LINES.length - 1; i++) {
    for (let j = 0; j < ROAD_LINES.length - 1; j++) {
      blockCentres.push({ x: (ROAD_LINES[i] + ROAD_LINES[i + 1]) / 2, z: (ROAD_LINES[j] + ROAD_LINES[j + 1]) / 2, i, j });
    }
  }
  const garageBlock = { x: -90, z: -90 };
  for (const b of blockCentres) {
    const key = `${b.i - 4},${b.j - 4}`;
    const downtown = Math.abs(b.x) < 130 && Math.abs(b.z) < 130;
    if (parks.has(key)) {
      // Green square: grass + palms.
      addBox(b.x, 0.2, b.z, 44, 0.4, 44, 0x7fae62, false);
      for (let k = 0; k < 5; k++) addPalm(scene, b.x + range(rng, -16, 16), b.z + range(rng, -16, 16), rng);
      continue;
    }
    if (b.x === garageBlock.x && b.z === garageBlock.z) {
      // Renner Garage (safehouse): low terracotta workshop with a teal roller door.
      addBox(b.x, 5, b.z, 34, 10, 22, 0xb98d5f);
      addBox(b.x, 10.4, b.z, 35, 0.8, 23, 0x8a5f3a);
      addBox(b.x, 2.6, b.z - 11.4, 16, 5, 0.6, 0x2e7f8f);
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(18, 2.2, 0.6),
        new THREE.MeshLambertMaterial({ color: 0x2ec4b6, emissive: 0x1a6a62 }),
      );
      sign.position.set(b.x, 8.2, b.z - 11.6);
      scene.add(sign);
      colliders.push(makeBox(b.x, b.z, 17, 11));
      buildings.push({ x: b.x, z: b.z, w: 34, d: 22, h: 10 });
      continue;
    }
    const n = downtown && rng() < 0.4 ? 1 : 2 + Math.floor(rng() * 2);
    for (let k = 0; k < n; k++) {
      const w = range(rng, 12, 20), d = range(rng, 12, 20);
      const ox = n === 1 ? 0 : (k % 2 === 0 ? -11 : 11);
      const oz = n === 1 ? 0 : (k < 2 ? -11 : 11);
      const x = b.x + ox, z = b.z + oz;
      const h = downtown ? range(rng, 18, 55) : range(rng, 6, 16);
      const color = downtown && h > 34 ? pick(rng, PALETTE.towers) : pick(rng, PALETTE.buildings);
      addBox(x, h / 2, z, w, h, d, color);
      addBox(x, h + 0.3, z, w * 0.9, 0.6, d * 0.9, 0x8a5f3a);
      if (h > 30) {
        // Lit window strips on towers.
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.7, h * 0.55, 0.3),
          new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x664411 }),
        );
        win.position.set(x, h * 0.55, z - d / 2 - 0.1);
        scene.add(win);
      }
      colliders.push(makeBox(x, z, w / 2 + 0.4, d / 2 + 0.4));
      buildings.push({ x, z, w, d, h });
    }
  }

  // South bank: Old Mill Quarter — six big mill buildings + the Grand Talvera Bank.
  const millColors = [0xa8b8a0, 0xc9a06b, 0x9fb4c0];
  for (let k = 0; k < 6; k++) {
    const x = -200 + k * 80;
    const h = range(rng, 10, 22);
    addBox(x, h / 2, 410, 30, h, 24, millColors[k % 3]);
    addBox(x, h + 0.3, 410, 31, 0.6, 25, 0x8a5f3a);
    colliders.push(makeBox(x, 410, 15.4, 12.4));
    buildings.push({ x, z: 410, w: 30, d: 24, h });
  }
  // Grand Talvera Bank: pale stone, columns, gold dome.
  addBox(0, 8, 400, 40, 16, 26, 0xe0d3b3);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(9, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xe0a92e, emissive: 0x332200 }),
  );
  dome.position.set(0, 16, 400);
  dome.castShadow = true;
  scene.add(dome);
  for (const s of [-14, -7, 0, 7, 14]) {
    addBox(s, 5, 386.5, 2, 10, 2, 0xf2ead8);
  }
  colliders.push(makeBox(0, 400, 20.4, 13.4));
  buildings.push({ x: 0, z: 400, w: 40, d: 26, h: 16 });

  // Palms and streetlights along the boulevards.
  for (const c of ROAD_LINES) {
    for (let s = -260; s <= 260; s += 60) {
      if (rng() < 0.6) addPalm(scene, c + 11, s + range(rng, -8, 8), rng);
      if (rng() < 0.5) addLamp(scene, c - 11, s + 30);
    }
  }
  // Riverside promenade lamps.
  for (let x = -260; x <= 260; x += 40) addLamp(scene, x, 284);

  return {
    colliders, buildings, roads, sun,
    garage: { x: -90, z: -66 },
    playerSpawn: { x: -60, z: -60, heading: 0 },
    bounds: { min: -CFG.cityHalf, max: CFG.cityHalf },
  };
}

function addPalm(scene, x, z, rng) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.55, 6, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6a42 }),
  );
  trunk.position.set(x, 3, z);
  trunk.castShadow = true;
  scene.add(trunk);
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0x4d8f4a }),
  );
  top.position.set(x, 6.6, z);
  top.scale.y = 0.55;
  top.castShadow = true;
  scene.add(top);
}

function addLamp(scene, x, z) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 7, 6),
    new THREE.MeshLambertMaterial({ color: 0x3a3f4a }),
  );
  pole.position.set(x, 3.5, z);
  scene.add(pole);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x997722 }),
  );
  head.position.set(x, 7.1, z);
  scene.add(head);
}
