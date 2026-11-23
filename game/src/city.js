// city.js — PROJECT VICE: HURRICANE CITY. Builds the whole procedural city:
// Ocean Drive boulevard, art-deco strip with glowing neon signs, downtown towers,
// suspension bridge, marina, palms, ocean, sky, dynamic sunset/hurricane/night weather,
// lightning, slanted rain and wet neon reflections. No external assets: every texture
// is drawn on a canvas here.
import * as THREE from 'three';

// ---------- seeded random ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- procedural canvas textures ----------
function canvasTex(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

export function buildingTexture(rng, base, litRatio) {
  return canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    // subtle vertical gradient + grime
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,255,255,0.10)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const cols = 8, rows = 18, ww = 18, hh = 14;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lit = rng() < litRatio;
        const warm = rng() < 0.7;
        g.fillStyle = lit
          ? (warm ? `rgba(255,${190 + Math.floor(rng() * 50)},110,0.95)` : `rgba(140,230,255,0.95)`)
          : 'rgba(8,12,22,0.9)';
        g.fillRect(14 + x * 28, 16 + y * 27, ww, hh);
        if (lit) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(14 + x * 28, 16 + y * 27, ww, 3); }
      }
    }
    // deco trim lines
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
  });
}

export function neonSignTexture(text, color, sub = '') {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#05060a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = color; g.lineWidth = 6;
    g.shadowColor = color; g.shadowBlur = 26;
    g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = color;
    g.font = 'bold 64px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = text.split('\n');
    const lh = sub ? 62 : 76;
    const y0 = h / 2 - ((lines.length - 1) * lh) / 2 - (sub ? 18 : 0);
    lines.forEach((ln, i) => g.fillText(ln, w / 2, y0 + i * lh));
    if (sub) {
      g.font = 'bold 34px Arial, sans-serif';
      g.fillText(sub, w / 2, h - 46);
    }
    // glow dots
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(34 + i * 8, 34, 3, 0, 7); g.fill(); }
  });
}

export function roadTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#14161d'; g.fillRect(0, 0, w, h);
    // asphalt speckle
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${120 + Math.random() * 60},${120 + Math.random() * 60},${140 + Math.random() * 60},${Math.random() * 0.12})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // centre double yellow
    g.fillStyle = '#e8b820'; g.fillRect(w / 2 - 8, 0, 5, h); g.fillRect(w / 2 + 3, 0, 5, h);
    // lane dashes
    g.fillStyle = '#dfe6ee';
    g.fillRect(w / 4 - 2, 20, 4, 70); g.fillRect((3 * w) / 4 - 2, 20, 4, 70);
    g.fillRect(w / 4 - 2, 160, 4, 70); g.fillRect((3 * w) / 4 - 2, 160, 4, 70);
  }, 1, 24);
}

function streakTexture(color) {
  return canvasTex(64, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
}

function skyTextureSunset() {
  return canvasTex(1024, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#5a2f8a');
    grad.addColorStop(0.35, '#a04a9a');
    grad.addColorStop(0.55, '#e86a8a');
    grad.addColorStop(0.72, '#ff9a4d');
    grad.addColorStop(0.85, '#ffc46b');
    grad.addColorStop(1, '#ff8a3d');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // sun glow
    const rg = g.createRadialGradient(w * 0.22, h * 0.78, 4, w * 0.22, h * 0.78, 150);
    rg.addColorStop(0, 'rgba(255,240,190,1)');
    rg.addColorStop(0.25, 'rgba(255,180,80,0.85)');
    rg.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
    // storm clouds top
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(40,16,64,${0.25 + Math.random() * 0.35})`;
      const cx = Math.random() * w, cy = Math.random() * h * 0.42, r = 40 + Math.random() * 110;
      g.beginPath(); g.ellipse(cx, cy, r, r * 0.32, 0, 0, 7); g.fill();
    }
  });
}

function skyTextureStorm() {
  return canvasTex(1024, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1c1038');
    grad.addColorStop(0.45, '#3a2060');
    grad.addColorStop(0.7, '#6a3480');
    grad.addColorStop(0.85, '#a04a6e');
    grad.addColorStop(1, '#d86a55');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(12,6,26,${0.35 + Math.random() * 0.45})`;
      const cx = Math.random() * w, cy = Math.random() * h * 0.6, r = 50 + Math.random() * 130;
      g.beginPath(); g.ellipse(cx, cy, r, r * 0.34, 0, 0, 7); g.fill();
    }
    // faint horizon glow
    const rg = g.createRadialGradient(w * 0.2, h * 0.95, 4, w * 0.2, h * 0.95, 260);
    rg.addColorStop(0, 'rgba(255,140,70,0.55)');
    rg.addColorStop(1, 'rgba(255,140,70,0)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
  });
}

function skyTextureNight() {
  return canvasTex(1024, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#04060f');
    grad.addColorStop(0.6, '#0d1530');
    grad.addColorStop(0.85, '#27355e');
    grad.addColorStop(1, '#4a3a6e');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
      g.fillRect(Math.random() * w, Math.random() * h * 0.5, 1.6, 1.6);
    }
  });
}

// ---------- city builder ----------
export function createCity(scene) {
  const rng = mulberry32(20261124);
  const city = { palms: [], neonStreaks: [], rain: null, rainVel: null, lightningLight: null, flashTimer: 0, nextBolt: 4, weather: 'sunset' };

  // renderer-facing lights
  const hemi = new THREE.HemisphereLight(0xffc9a0, 0x1a1430, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb066, 2.4);
  sun.position.set(-60, 55, 40);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x7a86ff, 0.5);
  fill.position.set(40, 30, -60);
  scene.add(fill);
  city.sunLight = sun; city.hemi = hemi; city.fill = fill;

  // sky dome (bright sunset by default — the cover key light)
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTextureSunset(), side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  city.skyMat = skyMat;
  city.skyTexSunset = skyMat.map;
  city.skyTexStorm = skyTextureStorm();
  city.skyTexNight = skyTextureNight();

  scene.fog = new THREE.Fog(0x3a1e4a, 120, 620);

  // ---- ocean (west, x < -34) with warm sun glitter ----
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 900),
    new THREE.MeshStandardMaterial({ color: 0x1a3a5e, metalness: 0.85, roughness: 0.25, emissive: 0x30180a, emissiveIntensity: 0.35 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-180, -0.4, 0);
  scene.add(ocean);
  city.ocean = ocean;
  // sun glitter strip on the water
  const glitter = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 500),
    new THREE.MeshBasicMaterial({ map: streakTexture('rgba(255,170,80,0.55)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  glitter.rotation.x = -Math.PI / 2;
  glitter.position.set(-60, -0.2, 0);
  scene.add(glitter);
  city.glitter = glitter;

  // ---- beach sand strip ----
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 900),
    new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 1 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-26, -0.15, 0);
  scene.add(sand);

  // ---- boulevard road (z axis): wet asphalt, bright enough to read at night ----
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 900),
    new THREE.MeshStandardMaterial({ map: roadTexture(), color: 0x9aa0b0, metalness: 0.55, roughness: 0.28, emissive: 0x20242e, emissiveIntensity: 0.7 })
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, 0);
  scene.add(road);
  city.road = road;

  // sidewalks
  for (const sx of [-1, 1]) {
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 900),
      new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 0.9 })
    );
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(sx * 16.5, 0.05, 0);
    scene.add(walk);
  }

  // ---- wet neon reflection streaks on the road (bright, visible in storm too) ----
  const streakCols = ['rgba(255,60,160,0.85)', 'rgba(60,220,255,0.85)', 'rgba(255,120,60,0.7)', 'rgba(180,80,255,0.8)'];
  for (let i = 0; i < 34; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6 + rng() * 2.2, 26 + rng() * 40),
      new THREE.MeshBasicMaterial({ map: streakTexture(streakCols[i % streakCols.length]), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 })
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = (rng() - 0.5) * 0.12;
    // keep several streaks near the road centre so the middle never reads black
    const cx = i % 3 === 0 ? (rng() - 0.5) * 6 : -11 + rng() * 22;
    m.position.set(cx, 0.12, -420 + i * 26 + rng() * 12);
    scene.add(m);
    city.neonStreaks.push(m);
  }

  // ---- buildings: art-deco strip both sides + downtown towers east ----
  const palette = ['#3a2b4d', '#4d2f45', '#2f3a55', '#54423a', '#33304a', '#4a3a2e'];
  const signDefs = [
    { text: 'PALM BREEZE\nHOTEL', color: '#ff4fd8', sub: 'OCEAN DRIVE' },
    { text: 'OCEAN DRIVE', color: '#37e6ff', sub: '' },
    { text: 'LOUNGE', color: '#37e6ff', sub: 'VIBE 104.5' },
    { text: 'VILLAGE CAFE', color: '#ff5a3c', sub: '' },
    { text: 'MARISOL', color: '#ffcf3d', sub: 'HURRICANE CITY' },
    { text: 'NEON PALMS', color: '#7dff6a', sub: 'CASINO' },
    { text: 'TALVERA', color: '#ff4fd8', sub: 'HEAT' },
    { text: 'SUNSET\nMOTEL', color: '#37e6ff', sub: '' },
  ];
  let signIdx = 0;
  function addBuilding(x, z, w, h, d, base) {
    const tex = buildingTexture(rng, base, 0.55);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.25, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, h / 2, z);
    scene.add(b);
    // roof neon edge
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3),
      new THREE.MeshBasicMaterial({ color: [0xff4fd8, 0x37e6ff, 0xffcf3d, 0x7dff6a][Math.floor(rng() * 4)] })
    );
    edge.position.set(x, h + 0.2, z);
    scene.add(edge);
    // neon sign on the street face
    if (Math.abs(x) < 60 && rng() < 0.85) {
      const def = signDefs[signIdx++ % signDefs.length];
      const st = neonSignTexture(def.text, def.color, def.sub);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 5),
        new THREE.MeshBasicMaterial({ map: st, transparent: false, toneMapped: false })
      );
      const faceX = x > 0 ? x - w / 2 - 0.15 : x + w / 2 + 0.15;
      sign.position.set(faceX, Math.min(h * 0.62, 16), z);
      sign.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(sign);
      // vertical neon strip beside the sign
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, h * 0.7, 0.3),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color), toneMapped: false })
      );
      strip.position.set(faceX, h * 0.35, z + 6);
      scene.add(strip);
    }
    return b;
  }
  for (let z = -420; z <= 420; z += 26) {
    const hL = 14 + rng() * 26, hR = 14 + rng() * 26;
    addBuilding(-(24 + rng() * 8), z + rng() * 6, 12 + rng() * 8, hL, 16 + rng() * 8, palette[Math.floor(rng() * palette.length)]);
    addBuilding(24 + rng() * 8, z + rng() * 6, 12 + rng() * 8, hR, 16 + rng() * 8, palette[Math.floor(rng() * palette.length)]);
  }
  // downtown towers (east, taller, lit windows)
  for (let i = 0; i < 14; i++) {
    const h = 60 + rng() * 90;
    addBuilding(70 + rng() * 70, -300 + i * 46 + rng() * 20, 20 + rng() * 14, h, 20 + rng() * 14, palette[Math.floor(rng() * palette.length)]);
  }
  // far skyline silhouettes north
  for (let i = 0; i < 10; i++) {
    const h = 40 + rng() * 70;
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(18, h, 18),
      new THREE.MeshStandardMaterial({ color: 0x241a33, roughness: 1, emissive: 0x33204a, emissiveIntensity: 0.4 })
    );
    b.position.set(-120 + i * 30 + rng() * 10, h / 2, -470);
    scene.add(b);
  }

  // ---- suspension bridge (north, z = -380) ----
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x2c3242, metalness: 0.6, roughness: 0.5 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(180, 2, 14), bridgeMat);
  deck.position.set(0, 14, -380);
  scene.add(deck);
  for (const tx of [-70, 70]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(4, 55, 4), new THREE.MeshStandardMaterial({ color: 0xff5a3c, emissive: 0x881100, emissiveIntensity: 0.5 }));
    tower.position.set(tx, 40, -380);
    scene.add(tower);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 150, 6), new THREE.MeshBasicMaterial({ color: 0xcccccc }));
    cable.rotation.z = Math.PI / 2.4;
    cable.position.set(tx > 0 ? 35 : -35, 48, -380);
    scene.add(cable);
  }
  // bridge lights
  for (let i = -8; i <= 8; i++) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffcf3d, toneMapped: false }));
    lamp.position.set(i * 11, 16.5, -380);
    scene.add(lamp);
  }

  // ---- marina yachts (west, on the ocean) ----
  for (let i = 0; i < 5; i++) {
    const yacht = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 12), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.4, roughness: 0.3 }));
    hull.position.y = 0.4;
    yacht.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 5), new THREE.MeshStandardMaterial({ color: 0xdfe9f2, metalness: 0.3, roughness: 0.4 }));
    cab.position.set(0, 2, -1);
    yacht.add(cab);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    mast.position.set(0, 5, 1);
    yacht.add(mast);
    yacht.position.set(-70 - rng() * 40, 0, -200 + i * 90);
    yacht.rotation.y = rng() * 0.6;
    scene.add(yacht);
  }

  // ---- palms along both sidewalks ----
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 1 });
  const frondTex = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#2fae5f'; g.lineWidth = 7; g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      g.beginPath(); g.moveTo(w / 2, h / 2);
      g.quadraticCurveTo(w / 2 + Math.cos(a) * 34, h / 2 + Math.sin(a) * 34, w / 2 + Math.cos(a) * 58, h / 2 + Math.sin(a) * 58 + 14);
      g.stroke();
    }
  });
  for (let z = -400; z <= 400; z += 34) {
    for (const sx of [-1, 1]) {
      if (rng() < 0.18) continue;
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 11, 7), trunkMat);
      trunk.position.y = 5.5;
      trunk.rotation.z = (rng() - 0.5) * 0.22;
      palm.add(trunk);
      const crown = new THREE.Group();
      crown.position.y = 11;
      const frondMat = new THREE.MeshBasicMaterial({ map: frondTex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
      for (let i = 0; i < 3; i++) {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), frondMat);
        f.rotation.x = -Math.PI / 2 + (rng() - 0.5) * 0.4;
        f.rotation.z = (i * Math.PI) / 3;
        f.position.y = i * 0.25;
        crown.add(f);
      }
      palm.add(crown);
      palm.position.set(sx * (19.5 + rng() * 1.5), 0, z + rng() * 8);
      scene.add(palm);
      city.palms.push({ group: palm, crown, phase: rng() * 6.28, sway: 0.05 + rng() * 0.06 });
    }
  }

  // ---- street lamps with warm glow ----
  for (let z = -400; z <= 400; z += 52) {
    for (const sx of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), new THREE.MeshStandardMaterial({ color: 0x222831 }));
      pole.position.set(sx * 13.5, 3.5, z);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }));
      bulb.position.set(sx * 13.5, 7.1, z);
      scene.add(bulb);
    }
  }

  // ---- garage / safehouse bay (east side, z = 60) ----
  const garage = new THREE.Group();
  const bay = new THREE.Mesh(
    new THREE.BoxGeometry(16, 9, 12),
    new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.6, metalness: 0.4, emissive: 0x0a2a33, emissiveIntensity: 0.6 })
  );
  bay.position.y = 4.5;
  garage.add(bay);
  const bayGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 7),
    new THREE.MeshBasicMaterial({ map: neonSignTexture('SAFEHOUSE\nGARAGE', '#37e6ff', 'REPAIR · PAINT · NEON'), toneMapped: false })
  );
  bayGlow.position.set(0, 5, 6.1);
  garage.add(bayGlow);
  const bayLight = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 0.8),
    new THREE.MeshBasicMaterial({ color: 0x37e6ff, toneMapped: false })
  );
  bayLight.rotation.x = -Math.PI / 2;
  bayLight.position.set(0, 0.15, 8);
  garage.add(bayLight);
  garage.position.set(-30, 0, 60);
  garage.rotation.y = Math.PI / 2; // sign + bay light face east, toward the road
  scene.add(garage);
  city.garagePos = new THREE.Vector3(-30, 0, 60);

  // ---- rain (hidden until hurricane) ----
  const rainCount = 1200;
  const pos = new Float32Array(rainCount * 3);
  const vel = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    pos[i * 3] = (rng() - 0.5) * 160;
    pos[i * 3 + 1] = rng() * 60;
    pos[i * 3 + 2] = (rng() - 0.5) * 160;
    vel[i] = 55 + rng() * 30;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaac8ff, size: 0.55, transparent: true, opacity: 0.75 }));
  rain.visible = false;
  rain.frustumCulled = false;
  scene.add(rain);
  city.rain = rain; city.rainVel = vel;

  // lightning light
  const bolt = new THREE.DirectionalLight(0xd8c8ff, 0);
  bolt.position.set(30, 120, -40);
  scene.add(bolt);
  city.lightningLight = bolt;

  // ---- weather application ----
  city.setWeather = function (mode) {
    city.weather = mode;
    if (mode === 'sunset') {
      city.skyMat.map = city.skyTexSunset; city.skyMat.needsUpdate = true;
      sun.intensity = 2.8; sun.color.set(0xffb066); hemi.intensity = 1.15; hemi.color.set(0xffc9a0);
      fill.intensity = 0.5;
      scene.fog.color.set(0x3a1e4a); scene.fog.near = 120; scene.fog.far = 620;
      rain.visible = false; city.glitter.visible = true;
      city.neonStreaks.forEach((s) => { s.material.opacity = 0.85; });
      ocean.material.emissive.set(0x30180a); ocean.material.emissiveIntensity = 0.35;
    } else if (mode === 'hurricane') {
      city.skyMat.map = city.skyTexStorm; city.skyMat.needsUpdate = true;
      sun.intensity = 0.9; sun.color.set(0xff8a5a); hemi.intensity = 0.75; hemi.color.set(0x8a6ab0);
      fill.intensity = 0.9; fill.color.set(0x9a7aff);
      scene.fog.color.set(0x1c1030); scene.fog.near = 60; scene.fog.far = 420;
      rain.visible = true; city.glitter.visible = false;
      // brighter wet road: streaks punch through the dark
      city.neonStreaks.forEach((s) => { s.material.opacity = 1.0; s.scale.set(1.4, 1.4, 1); });
      ocean.material.emissive.set(0x1a1030); ocean.material.emissiveIntensity = 0.5;
    } else { // night
      city.skyMat.map = city.skyTexNight; city.skyMat.needsUpdate = true;
      sun.intensity = 0.35; sun.color.set(0x8fa8ff); hemi.intensity = 0.55; hemi.color.set(0x5a6ab0);
      fill.intensity = 0.7; fill.color.set(0x6a7aff);
      scene.fog.color.set(0x0a0e24); scene.fog.near = 90; scene.fog.far = 520;
      rain.visible = false; city.glitter.visible = false;
      city.neonStreaks.forEach((s) => { s.material.opacity = 0.95; s.scale.set(1.15, 1.15, 1); });
      ocean.material.emissive.set(0x050a18); ocean.material.emissiveIntensity = 0.3;
    }
  };

  city.update = function (dt, t, camPos) {
    const wind = city.weather === 'hurricane' ? 1.8 : 1;
    for (const p of city.palms) {
      p.crown.rotation.z = Math.sin(t * 1.4 * wind + p.phase) * p.sway * wind;
      p.crown.rotation.x = Math.cos(t * 1.1 * wind + p.phase) * p.sway * 0.7 * wind;
      p.group.rotation.z = Math.sin(t * 0.9 + p.phase) * 0.02 * wind;
    }
    // rain falls slanted, centred on camera
    if (city.rain.visible && camPos) {
      const arr = city.rain.geometry.attributes.position.array;
      for (let i = 0; i < city.rainVel.length; i++) {
        arr[i * 3 + 1] -= city.rainVel[i] * dt;
        arr[i * 3] -= 14 * dt; // slant
        if (arr[i * 3 + 1] < 0) {
          arr[i * 3 + 1] = 55 + Math.random() * 5;
          arr[i * 3] = camPos.x + (Math.random() - 0.5) * 160;
          arr[i * 3 + 2] = camPos.z + (Math.random() - 0.5) * 160;
        }
      }
      city.rain.geometry.attributes.position.needsUpdate = true;
    }
    // lightning
    city.flashTimer -= dt;
    if (city.weather === 'hurricane') {
      city.nextBolt -= dt;
      if (city.nextBolt <= 0) {
        city.nextBolt = 3 + Math.random() * 6;
        city.flashTimer = 0.28;
      }
      if (city.flashTimer > 0) {
        city.lightningLight.intensity = 5.5 * (city.flashTimer / 0.28);
        city.skyMat.color.setScalar(1.6);
      } else {
        city.lightningLight.intensity = 0;
        city.skyMat.color.setScalar(1);
      }
    } else {
      city.lightningLight.intensity = 0;
      city.skyMat.color.setScalar(1);
    }
    // neon streak shimmer
    for (let i = 0; i < city.neonStreaks.length; i++) {
      const s = city.neonStreaks[i];
      s.material.opacity = (city.weather === 'hurricane' ? 0.9 : 0.7) + Math.sin(t * 2 + i * 1.7) * 0.15;
    }
    // ocean swell shimmer
    ocean.position.y = -0.4 + Math.sin(t * 0.8) * 0.12;
  };

  return city;
}
