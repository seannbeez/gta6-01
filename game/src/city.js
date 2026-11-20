// Talvera city builder — procedural sun-baked river city, authored in this session.
// Grid roads every 60 units, terracotta + sandstone blocks, glass towers downtown,
// a teal river on the south edge with two bridges to the Old Mill Quarter.
import * as THREE from 'three';
import { CFG, PALETTE } from './config.js';
import { mulberry32, pick, range, makeBox, dist2d } from './util.js';
import { makeCarMesh } from './vehicles.js';

const ROAD_LINES = [-240, -180, -120, -60, 0, 60, 120, 180, 240];

export function buildCity(scene) {
  const rng = mulberry32(CFG.seed);
  const colliders = [];
  const buildings = []; // {x, z, w, d, h} for the minimap
  const roads = []; // {ax, az, bx, bz} centre-line segments for traffic
  const parks = new Set(['-2,-2', '2,1', '1,-3']); // block keys kept as green squares

  scene.background = new THREE.Color(CFG.sky);
  scene.fog = new THREE.Fog(CFG.fog, 120, 620);

  // Hurricane sky dome: a procedural gradient (bruised purple storm above,
  // burning orange at the horizon) with soft storm-cloud blobs, so the sky
  // reads as weather instead of a flat colour in every frame.
  const skyTex = makeSkyTexture();
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(850, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  scene.add(skyDome);

  const hemi = new THREE.HemisphereLight(0x9a6a9e, 0x8a5a3a, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(CFG.sunColor, 2.6);
  sun.position.set(220, 150, 140);
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
  // Building material: same colour cache, but with the procedural facade
  // texture so walls read as windows instead of flat colour.
  const facadeTex = makeFacadeTexture();
  const bMatCache = new Map();
  const bMat = (color) => {
    if (!bMatCache.has(color)) bMatCache.set(color, new THREE.MeshLambertMaterial({ color, map: facadeTex }));
    return bMatCache.get(color);
  };
  const addBuildingBox = (x, y, z, w, h, d, color) => {
    const m = new THREE.Mesh(boxGeo, bMat(color));
    m.position.set(x, y, z);
    m.scale.set(w, h, d);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    return m;
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

  // Roads: wet mirror asphalt — dark Phong strips with a glossy sheen so
  // the low sun and the neon streak along them, plus dashed centre lines
  // and zebra crossings drawn from procedural canvas textures (no images).
  const roadMat = new THREE.MeshPhongMaterial({ color: CFG.roadColor, shininess: 90, specular: 0x9999aa });
  const dashTex = makeStripeTexture([0, 0, 0, 0], [216, 177, 58, 255], 8, 64, false);
  const zebraTex = makeStripeTexture([255, 255, 255, 255], [0, 0, 0, 0], 64, 8, true);
  const walkMat = new THREE.MeshLambertMaterial({ color: CFG.sidewalkColor });
  for (const c of ROAD_LINES) {
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadWidth, CFG.cityHalf * 2 + 20), roadMat);
    vRoad.rotation.x = -Math.PI / 2; vRoad.position.set(c, 0.05, 0); vRoad.receiveShadow = true;
    scene.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(CFG.cityHalf * 2 + 20, CFG.roadWidth), roadMat);
    hRoad.rotation.x = -Math.PI / 2; hRoad.position.set(0, 0.05, c); hRoad.receiveShadow = true;
    scene.add(hRoad);
    // Dashed gold centre line down each road.
    const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.5, CFG.cityHalf * 2 + 20),
      new THREE.MeshBasicMaterial({ map: dashTex, transparent: true }));
    dashV.material.map = dashTex.clone();
    dashV.material.map.needsUpdate = true;
    dashV.material.map.repeat.set(1, 70);
    dashV.rotation.x = -Math.PI / 2; dashV.position.set(c, 0.07, 0);
    scene.add(dashV);
    const dashH = new THREE.Mesh(new THREE.PlaneGeometry(CFG.cityHalf * 2 + 20, 0.5),
      new THREE.MeshBasicMaterial({ map: dashTex, transparent: true }));
    dashH.material.map = dashTex.clone();
    dashH.material.map.needsUpdate = true;
    dashH.material.map.repeat.set(70, 1);
    dashH.rotation.x = -Math.PI / 2; dashH.position.set(0, 0.07, c);
    scene.add(dashH);
    // Solid white edge lines framing each road, so the asphalt reads as a
    // lane instead of a dark void.
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xd8d8cc, transparent: true, opacity: 0.8 });
    for (const s of [-1, 1]) {
      const ev = new THREE.Mesh(new THREE.PlaneGeometry(0.3, CFG.cityHalf * 2 + 20), edgeMat);
      ev.rotation.x = -Math.PI / 2; ev.position.set(c + s * (CFG.roadHalf - 0.5), 0.08, 0);
      scene.add(ev);
      const eh = new THREE.Mesh(new THREE.PlaneGeometry(CFG.cityHalf * 2 + 20, 0.3), edgeMat);
      eh.rotation.x = -Math.PI / 2; eh.position.set(0, 0.08, c + s * (CFG.roadHalf - 0.5));
      scene.add(eh);
    }
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
  // Zebra crossings at the four busiest intersections.
  for (const [zx, zz] of [[0, 0], [-60, -60], [120, 120], [0, 240]]) {
    const zb = new THREE.Mesh(new THREE.PlaneGeometry(13, 6),
      new THREE.MeshBasicMaterial({ map: zebraTex, transparent: true }));
    zb.material.map = zebraTex.clone();
    zb.material.map.needsUpdate = true;
    zb.material.map.repeat.set(6, 1);
    zb.rotation.x = -Math.PI / 2; zb.position.set(zx, 0.06, zz);
    scene.add(zb);
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
    const n = downtown && rng() < 0.4 ? 1 : 2 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const w = range(rng, 12, 20), d = range(rng, 12, 20);
      const ox = n === 1 ? 0 : (k % 2 === 0 ? -11 : 11);
      const oz = n === 1 ? 0 : (k < 2 ? -11 : 11);
      const x = b.x + ox, z = b.z + oz;
      const h = downtown ? range(rng, 18, 55) : range(rng, 6, 16);
      const color = downtown && h > 34 ? pick(rng, PALETTE.towers) : pick(rng, PALETTE.buildings);
      addBuildingBox(x, h / 2, z, w, h, d, color);
      addBox(x, h + 0.3, z, w * 0.9, 0.6, d * 0.9, 0x8a5f3a);
      // Rooftop clutter: AC box, water tank, aerial — roofs stop reading as flat slabs.
      if (rng() < 0.55) addBox(x + range(rng, -4, 4), h + 1.1, z + range(rng, -4, 4), 3, 1.1, 3, 0x6a6f75);
      if (rng() < 0.3) {
        const tank = new THREE.Mesh(
          new THREE.CylinderGeometry(1.4, 1.4, 2.6, 8),
          new THREE.MeshLambertMaterial({ color: 0x8a5f3a }),
        );
        tank.position.set(x + range(rng, -5, 5), h + 1.6, z + range(rng, -5, 5));
        tank.castShadow = true;
        scene.add(tank);
      }
      if (h > 30) {
        // Lit window strips on towers.
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.7, h * 0.55, 0.3),
          new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x664411 }),
        );
        win.position.set(x, h * 0.55, z - d / 2 - 0.1);
        scene.add(win);
        // Neon: a vertical sign strip and a glowing panel on the tower face.
        if (rng() < 0.6) {
          const neonColor = pick(rng, [0xff2e88, 0x2ee6ff, 0xffd23e, 0x7a4dff]);
          const strip = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, h * 0.45, 0.4),
            new THREE.MeshLambertMaterial({ color: neonColor, emissive: neonColor }),
          );
          strip.position.set(x + w / 2 + 0.4, h * 0.65, z - d / 2 - 0.2);
          scene.add(strip);
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.45, 3.2, 0.3),
            new THREE.MeshLambertMaterial({ color: neonColor, emissive: neonColor }),
          );
          panel.position.set(x - w * 0.1, h * 0.78, z - d / 2 - 0.15);
          scene.add(panel);
        }
      }
      // Street-level neon shop sign: a glowing fascia on the south face so
      // the ground floor reads as neon storefront, not blank wall.
      if (rng() < 0.65) {
        const signColor = pick(rng, [0xff2e88, 0x2ee6ff, 0xffd23e, 0x7a4dff, 0x2ec4b6]);
        const shop = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.7, 1.8, 0.3),
          new THREE.MeshLambertMaterial({ color: signColor, emissive: signColor }),
        );
        shop.position.set(x, 3.2, z - d / 2 - 0.15);
        scene.add(shop);
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
    addBuildingBox(x, h / 2, 410, 30, h, 24, millColors[k % 3]);
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
      if (rng() < 0.8) addPalm(scene, c + 11, s + range(rng, -8, 8), rng);
      if (rng() < 0.5) addLamp(scene, c - 11, s + 30);
    }
  }
  // Riverside promenade lamps and a double row of palms.
  for (let x = -260; x <= 260; x += 40) addLamp(scene, x, 284);
  for (let x = -250; x <= 250; x += 50) {
    if (rng() < 0.75) addPalm(scene, x + range(rng, -6, 6), 282, rng);
  }

  // Parked cars at the curbs: the streets read lived-in instead of empty.
  // Kept clear of the garage, the bank, the spawn and every mission marker.
  const keepOut = [[-90, -66], [-60, -60], [0, 400], [150, 120], [-180, 180], [30, 30], [60, 270], [-40, 390], [-120, -60]];
  let parked = 0, guard = 0;
  while (parked < 10 && guard++ < 80) {
    const c = pick(rng, ROAD_LINES);
    const along = range(rng, -250, 250);
    const side = rng() < 0.5 ? 1 : -1;
    const vertical = rng() < 0.5;
    const x = vertical ? c + side * 5.8 : along;
    const z = vertical ? along : c + side * 5.8;
    if (keepOut.some(([kx, kz]) => dist2d(x, z, kx, kz) < 26)) continue;
    const kind = pick(rng, ['sedan', 'sedan', 'sport', 'taxi', 'van']);
    const color = kind === 'taxi' ? 0xe0c34b : pick(rng, PALETTE.carPaints);
    const mesh = makeCarMesh(kind, color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = vertical ? 0 : -Math.PI / 2;
    scene.add(mesh);
    colliders.push(vertical ? makeBox(x, z, 1.4, 2.6) : makeBox(x, z, 2.6, 1.4));
    parked++;
  }

  return {
    colliders, buildings, roads, sun, water,
    garage: { x: -90, z: -66 },
    playerSpawn: { x: -60, z: -60, heading: 0 },
    bounds: { min: -CFG.cityHalf, max: CFG.cityHalf },
  };
}

// Procedural sky texture: storm gradient + soft cloud blobs. The canvas is
// a small equirectangular map — u wraps the horizon, v runs zenith→nadir.
function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.00, '#1a0b33'); // deep storm purple, zenith
  grad.addColorStop(0.38, '#5b2a63'); // mauve
  grad.addColorStop(0.50, '#8a3d5c'); // horizon band
  grad.addColorStop(0.56, '#ff8a3d'); // low orange sunset glow
  grad.addColorStop(0.62, '#ffd23e'); // bright sunset line
  grad.addColorStop(1.00, '#3a1c2e'); // below horizon (hidden by ground)
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  // Storm clouds: dark purple blobs with a warm-lit underside, drawn as
  // soft radial gradients in the upper half.
  const cloud = (x, y, r, light) => {
    const cg = g.createRadialGradient(x, y, 0, x, y, r);
    cg.addColorStop(0, light ? 'rgba(255,150,80,0.55)' : 'rgba(24,10,48,0.85)');
    cg.addColorStop(0.55, light ? 'rgba(190,90,90,0.35)' : 'rgba(40,16,64,0.55)');
    cg.addColorStop(1, 'rgba(40,16,64,0)');
    g.fillStyle = cg;
    g.beginPath(); g.ellipse(x, y, r, r * 0.42, 0, 0, Math.PI * 2); g.fill();
  };
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * 512;
    const y = 8 + Math.random() * 96;
    const r = 26 + Math.random() * 70;
    cloud(x, y, r, y > 78 && Math.random() < 0.5);
  }
  // Low horizon clouds: soft dark banks sitting in the sunset glow, so the
  // sky reads as weather even from a low chase-camera angle.
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * 512;
    const y = 118 + Math.random() * 28;
    const r = 30 + Math.random() * 60;
    cloud(x, y, r, Math.random() < 0.6);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Procedural building facade: a dense window grid on white, so the material
// colour tints the wall while the windows stay dark (some warm-lit). The
// texture maps 0–1 across each box face, so every face reads textured.
function makeFacadeTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 160);
  const cols = 8, rows = 10;
  const cw = 128 / cols, ch = 160 / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const lit = Math.random() < 0.22;
      g.fillStyle = lit ? '#ffca6a' : '#1c2433';
      g.fillRect(col * cw + 3, r * ch + 4, cw - 6, ch - 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A tiny procedural stripe texture: colour `a` on one half of each tile,
// colour `b` on the other, so a repeating plane reads as dashes (split
// across the tile height) or zebra bars (split across the width).
// Colours are [r, g, b, alpha] arrays; `w`/`h` are the canvas pixels.
function makeStripeTexture(a, b, w, h, vertical) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  const rgba = (v) => `rgba(${v[0]},${v[1]},${v[2]},${v[3] / 255})`;
  c.fillStyle = rgba(a);
  if (vertical) c.fillRect(0, 0, w / 2, h);
  else c.fillRect(0, 0, w, h / 2);
  c.fillStyle = rgba(b);
  if (vertical) c.fillRect(w / 2, 0, w / 2, h);
  else c.fillRect(0, h / 2, w, h / 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
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
