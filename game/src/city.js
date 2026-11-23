// The city of Marisol: Ocean Drive boulevard, downtown towers, suspension bridge,
// marina, palms and the living sky. Everything procedural; the weather system
// (golden sunset <-> neon hurricane) lives here too.
import * as THREE from 'three';
import { clamp, lerp, pick, range } from './rng.js';
import { billboardTexture, neonSignTexture, roadTexture, sidewalkTexture, windowsTexture } from './textures.js';

const SUNSET = {
  skyTop: new THREE.Color(0x2a1650), skyMid: new THREE.Color(0xff7e3d), skyBot: new THREE.Color(0xffc46b),
  fog: new THREE.Color(0x8a4a6e), sun: new THREE.Color(0xffb347), hemi: 1.0, sunI: 3.0, amb: 0.55,
};
const STORM = {
  skyTop: new THREE.Color(0x0a0618), skyMid: new THREE.Color(0x3a1d5e), skyBot: new THREE.Color(0x6b2a6e),
  fog: new THREE.Color(0x1a0f2e), sun: new THREE.Color(0x8f7bff), hemi: 0.35, sunI: 0.5, amb: 0.25,
};

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x2a1650) },
      mid: { value: new THREE.Color(0xff7e3d) },
      bot: { value: new THREE.Color(0xffc46b) },
      flash: { value: 0 },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; uniform vec3 top, mid, bot; uniform float flash;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(bot, mid, smoothstep(-0.08, 0.12, h));
      c += vec3(0.75, 0.8, 1.0) * flash; gl_FragColor = vec4(c, 1.0); }`,
  });
}

function neonSignMesh(text, color, w, h, sub = '') {
  const tex = neonSignTexture(text, color, sub);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
  );
  return m;
}

function makePalm(random, height = 9) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, height, 6), trunkMat);
  trunk.position.y = height / 2; trunk.castShadow = true;
  g.add(trunk);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x1e8a44, roughness: 0.85, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i += 1) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 4), frondMat);
    const a = (i / 7) * Math.PI * 2 + random() * 0.4;
    frond.position.set(Math.cos(a) * 1.2, height + 0.5, Math.sin(a) * 1.2);
    frond.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
    frond.scale.set(1, 1, 0.18);
    g.add(frond);
  }
  g.userData.height = height;
  return g;
}

function makeBuilding(random, w, h, d, winTex, tint, face = -1) {
  const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.85, metalness: 0.05 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  body.castShadow = true; body.receiveShadow = true;
  const winMat = new THREE.MeshStandardMaterial({
    map: winTex, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.9, roughness: 0.4,
  });
  // windows face the street (face=+1 looks toward +x, face=-1 toward -x)
  const win = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.92, h * 0.94), winMat);
  win.position.x = face * (w / 2 + 0.06);
  win.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2;
  const g = new THREE.Group();
  g.add(body); g.add(win);
  // neon roof edge
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.2, 0.22, d + 0.2),
    new THREE.MeshBasicMaterial({ color: pick(random, [0xff2fb3, 0x00e5ff, 0xff6b35, 0x9d4edd]) }),
  );
  edge.position.y = h / 2 + 0.1;
  g.add(edge);
  return g;
}

export function buildCity(scene, rng) {
  const colliders = []; // {x, z, hw, hd}
  const palms = [];
  const city = {
    colliders, palms, weather: 'sunset', blend: 0, stormTime: 0,
    garagePos: new THREE.Vector3(30, 0, 150),
    bridgePos: new THREE.Vector3(-10, 0, -292),
    marinaPos: new THREE.Vector3(-30, 0, 250),
    raceBeacons: [], onLightning: null,
  };

  scene.fog = new THREE.Fog(0x8a4a6e, 60, 420);
  const hemi = new THREE.HemisphereLight(0xffc4a3, 0x1a1030, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb347, 2.4);
  sun.position.set(-120, 90, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -90; sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90; sun.shadow.camera.bottom = -90;
  sun.shadow.camera.far = 400;
  scene.add(sun); scene.add(sun.target);
  const amb = new THREE.AmbientLight(0x604080, 0.5);
  scene.add(amb);

  const skyMat = skyMaterial();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 16), skyMat);
  scene.add(sky);

  // Sun disc low over the ocean (west).
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd27d, fog: false, transparent: true, opacity: 0.95 }),
  );
  sunDisc.position.set(-420, 42, -40);
  sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);
  city.sunDisc = sunDisc;

  // --- Ground: ocean west, beach, roads, sidewalks ---
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 640),
    new THREE.MeshStandardMaterial({ color: 0x0e3a5e, roughness: 0.15, metalness: 0.55 }),
  );
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(-170, -0.5, 0);
  ocean.receiveShadow = true;
  scene.add(ocean);
  city.ocean = ocean;

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 600),
    new THREE.MeshStandardMaterial({ color: 0xc9a06a, roughness: 1 }),
  );
  beach.rotation.x = -Math.PI / 2; beach.position.set(-12.5, 0.02, 0);
  scene.add(beach);

  const groundMat = new THREE.MeshStandardMaterial({ color: 0x23202e, roughness: 0.95 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 640), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(60, -0.05, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ map: roadTexture(rng), roughness: 0.55, metalness: 0.25 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 580), roadMat);
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.05, 0);
  road.receiveShadow = true;
  scene.add(road);
  city.roadMat = roadMat;

  const walkMat = new THREE.MeshStandardMaterial({ map: sidewalkTexture(rng), roughness: 0.9 });
  for (const sx of [-9.5, 9.5]) {
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(5, 580), walkMat);
    walk.rotation.x = -Math.PI / 2; walk.position.set(sx, 0.06, 0);
    walk.receiveShadow = true;
    scene.add(walk);
  }
  // cross streets
  for (const z of [-180, -90, 0, 90, 180]) {
    const cross = new THREE.Mesh(new THREE.PlaneGeometry(150, 10), roadMat);
    cross.rotation.x = -Math.PI / 2; cross.position.set(62, 0.05, z);
    cross.receiveShadow = true;
    scene.add(cross);
  }

  // Wet neon reflection streaks on the boulevard (additive, brighter in the storm).
  const streakMat = new THREE.MeshBasicMaterial({
    color: 0xff2fb3, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const streakMat2 = streakMat.clone(); streakMat2.color.set(0x00e5ff);
  for (const [x, mat, w] of [[-4.5, streakMat, 1.6], [4.5, streakMat2, 1.6], [0, streakMat, 0.9]]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w, 560), mat);
    s.rotation.x = -Math.PI / 2; s.position.set(x, 0.09, 0);
    scene.add(s);
  }
  city.streakMats = [streakMat, streakMat2];

  // --- Art Deco strip along Ocean Drive ---
  const signs = [
    ['PALM BREEZE', 'HOTEL', '#ff2fb3'], ['OCEAN DRIVE', '', '#00e5ff'],
    ['LOUNGE', 'COCKTAILS', '#9d4edd'], ['VILLAGE CAFE', '', '#ff6b35'],
    ['MARISOL', 'BEACH CLUB', '#00ff9d'], ['NEON PALMS', 'MOTEL', '#ff2fb3'],
  ];
  const winTexA = windowsTexture(rng, '#232c4d');
  const winTexB = windowsTexture(rng, '#3d1f3a');
  let signIdx = 0;
  for (const side of [-1, 1]) {
    for (let z = -250; z <= 250; z += 42) {
      if (Math.abs(z - 150) < 24 && side === 1) continue; // garage plot
      const w = range(rng, 16, 24), h = range(rng, 14, 34), d = range(rng, 12, 18);
      const x = side * (13 + d / 2 + range(rng, 0, 4));
      const b = makeBuilding(rng, w, h, d, rng() < 0.5 ? winTexA : winTexB, pick(rng, [0xe8dcc8, 0xf2e6d0, 0xd8c8e8, 0xbfe8e8, 0xffd9c0]), side < 0 ? 1 : -1);
      b.position.set(x, h / 2, z + range(rng, -4, 4));
      scene.add(b);
      colliders.push({ x, z: b.position.z, hw: w / 2 + 1, hd: d / 2 + 1 });
      // neon sign facing the boulevard
      const [txt, sub, col] = signs[signIdx % signs.length]; signIdx += 1;
      const sign = neonSignMesh(txt, col, Math.min(w * 0.95, 15), 3.4, sub);
      sign.position.set(x - side * (d / 2 + 0.25), h * 0.72, b.position.z);
      sign.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(sign);
    }
  }

  // --- Downtown towers (east) ---
  for (let i = 0; i < 16; i += 1) {
    const w = range(rng, 18, 30), h = range(rng, 45, 110), d = range(rng, 18, 30);
    const x = range(rng, 52, 120), z = range(rng, -210, 210);
    const t = makeBuilding(rng, w, h, d, rng() < 0.5 ? winTexA : winTexB, pick(rng, [0x2a3550, 0x3a2a4a, 0x22303e]));
    t.position.set(x, h / 2, z);
    scene.add(t);
    colliders.push({ x, z, hw: w / 2 + 1, hd: d / 2 + 1 });
  }

  // --- Billboards ---
  const bbData = [
    { pos: [14, 16, -120], lines: ['VICE NIGHTS', 'LIVE AT THE PALMS'], hue: 300 },
    { pos: [-14, 15, 40], lines: ['HURRICANE', 'SEASON IS HERE'], hue: 200 },
    { pos: [14, 18, 210], lines: ['MARISOL GP', 'STREET RACE'], hue: 40 },
  ];
  for (const bb of bbData) {
    const tex = billboardTexture(rng, bb.lines, bb.hue);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 10),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.85 }),
    );
    board.position.set(bb.pos[0], bb.pos[1], bb.pos[2]);
    board.rotation.y = bb.pos[0] > 0 ? -Math.PI / 2 : Math.PI / 2;
    scene.add(board);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, bb.pos[1] - 5, 8),
      new THREE.MeshStandardMaterial({ color: 0x222222 }));
    pole.position.set(bb.pos[0] + (bb.pos[0] > 0 ? 2 : -2), (bb.pos[1] - 5) / 2, bb.pos[2]);
    scene.add(pole);
  }

  // --- Suspension bridge (north, over the bay) ---
  const bridge = new THREE.Group();
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x2c2f3a, roughness: 0.6 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(110, 1.2, 12), deckMat);
  deck.position.set(-10, 7, -292);
  deck.castShadow = true;
  bridge.add(deck);
  for (const tx of [-38, 18]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(3, 26, 3),
      new THREE.MeshStandardMaterial({ color: 0xd8d0e8, roughness: 0.5 }));
    tower.position.set(tx, 20, -292);
    bridge.add(tower);
    const cableMat = new THREE.LineBasicMaterial({ color: 0x9df2ff });
    const pts = [];
    for (let i = 0; i <= 20; i += 1) {
      const x = -66 + i * 5.6;
      const y = 33 - Math.abs(x - tx) * 0.32;
      pts.push(new THREE.Vector3(x, Math.max(y, 8), -292));
    }
    bridge.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableMat));
  }
  for (let x = -60; x <= 40; x += 10) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff9de2 }));
    lamp.position.set(x, 8.6, -287);
    bridge.add(lamp);
  }
  scene.add(bridge);

  // --- Elevated coastal highway (east viaduct) ---
  const viaMat = new THREE.MeshStandardMaterial({ color: 0x33364a, roughness: 0.7 });
  const via = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 380), viaMat);
  via.position.set(42, 8, 0);
  scene.add(via);
  for (let z = -180; z <= 180; z += 30) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 2), viaMat);
    pillar.position.set(42, 4, z);
    scene.add(pillar);
  }

  // --- Marina (south-west): docks + yachts ---
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
  for (let i = 0; i < 3; i += 1) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 26), dockMat);
    dock.position.set(-26 - i * 12, 0.2, 250);
    scene.add(dock);
    const yacht = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 11),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.25, metalness: 0.4 }));
    hull.position.y = 0.7; yacht.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 5),
      new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.3, metalness: 0.5 }));
    cab.position.set(0, 2.1, -0.5); yacht.add(cab);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 6),
      new THREE.MeshStandardMaterial({ color: 0xdddddd }));
    mast.position.set(0, 5, 1); yacht.add(mast);
    yacht.position.set(-26 - i * 12 + 4, -0.2, 246 + i * 6);
    yacht.rotation.y = range(rng, -0.15, 0.15);
    scene.add(yacht);
  }

  // --- Safehouse garage (cyan bay, east side at z=150) ---
  const garage = new THREE.Group();
  const gBody = new THREE.Mesh(new THREE.BoxGeometry(22, 9, 18),
    new THREE.MeshStandardMaterial({ color: 0x1c2438, roughness: 0.8 }));
  gBody.position.set(34, 4.5, 150); gBody.castShadow = true;
  garage.add(gBody);
  const bay = new THREE.Mesh(new THREE.PlaneGeometry(10, 6.5),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.85 }));
  bay.position.set(22.9, 3.4, 150); bay.rotation.y = -Math.PI / 2;
  garage.add(bay);
  const gSign = neonSignMesh('SAFEHOUSE', '#00e5ff', 12, 2.6, 'GARAGE');
  gSign.position.set(22.8, 8.2, 150); gSign.rotation.y = -Math.PI / 2;
  garage.add(gSign);
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(14, 12),
    new THREE.MeshStandardMaterial({ color: 0x2a2f45, roughness: 0.4, metalness: 0.4 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(28, 0.08, 150);
  garage.add(pad);
  scene.add(garage);
  colliders.push({ x: 34, z: 150, hw: 11, hd: 9 });
  city.garageBay = new THREE.Vector3(27, 0, 150);

  // --- Palms along the boulevard + beach ---
  for (let z = -270; z <= 270; z += 18) {
    for (const sx of [-11.5, 11.5]) {
      if (rng() < 0.85) {
        const p = makePalm(rng, range(rng, 7, 11));
        p.position.set(sx + range(rng, -0.6, 0.6), 0, z + range(rng, -3, 3));
        p.rotation.z = range(rng, -0.06, 0.06);
        scene.add(p); palms.push(p);
      }
    }
  }

  // --- Streetlights ---
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.6 });
  for (let z = -260; z <= 260; z += 40) {
    for (const sx of [-8.5, 8.5]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), lampMat);
      pole.position.set(sx, 3.5, z);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      bulb.position.set(sx, 7.1, z);
      scene.add(bulb);
    }
  }

  // --- Storm clouds (dark billboards high up, only visible in storm) ---
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0x120a24, transparent: true, opacity: 0.0, depthWrite: false });
  const clouds = new THREE.Group();
  for (let i = 0; i < 14; i += 1) {
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(range(rng, 90, 190), range(rng, 26, 48)), cloudMat);
    cl.position.set(range(rng, -220, 180), range(rng, 90, 150), range(rng, -280, 280));
    cl.rotation.x = -0.25;
    clouds.add(cl);
  }
  scene.add(clouds);
  city.cloudMat = cloudMat;

  // --- Rain (points around the camera, slanted) ---
  const rainCount = 1600;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i += 1) {
    rainPos[i * 3] = range(rng, -60, 60);
    rainPos[i * 3 + 1] = range(rng, 0, 45);
    rainPos[i * 3 + 2] = range(rng, -60, 60);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({
    color: 0x9db8ff, size: 0.35, transparent: true, opacity: 0,
  }));
  rain.frustumCulled = false;
  scene.add(rain);
  city.rain = rain;

  city.hemi = hemi; city.sun = sun; city.amb = amb; city.skyMat = skyMat;
  city.flash = 0; city.lightningTimer = 6; city.time = 0;
  return city;
}

function mixWeather(city, t) {
  const a = SUNSET, b = STORM;
  city.skyMat.uniforms.top.value.lerpColors(a.skyTop, b.skyTop, t);
  city.skyMat.uniforms.mid.value.lerpColors(a.skyMid, b.skyMid, t);
  city.skyMat.uniforms.bot.value.lerpColors(a.skyBot, b.skyBot, t);
  sceneFog(city, t);
  city.hemi.intensity = lerp(a.hemi, b.hemi, t);
  city.sun.intensity = lerp(a.sunI, b.sunI, t) + city.flash * 6;
  city.sun.color.lerpColors(a.sun, b.sun, t);
  city.amb.intensity = lerp(a.amb, b.amb, t);
  city.cloudMat.opacity = t * 0.92;
  city.rain.material.opacity = t * 0.75;
  city.roadMat.roughness = lerp(0.55, 0.22, t);
  city.ocean.material.color.setHex(0x0e3a5e).lerp(new THREE.Color(0x0a1a30), t);
  for (const m of city.streakMats) m.opacity = lerp(0.06, 0.3, t);
  city.sunDisc.material.opacity = lerp(0.95, 0.12, t);
}

function sceneFog(city, t) {
  // Fog object lives on the scene; colours are mixed here each frame.
  const c = new THREE.Color().lerpColors(SUNSET.fog, STORM.fog, t);
  if (city._scene) city._scene.fog.color.copy(c);
}

export function updateCity(city, scene, dt, camera) {
  city._scene = scene;
  city.time += dt;
  // auto-cycle: 75 s sunset, 75 s storm (manual T toggle jumps the phase)
  city.stormTime += dt;
  if (city.stormTime > 75) {
    city.stormTime = 0;
    city.weather = city.weather === 'sunset' ? 'storm' : 'sunset';
  }
  const target = city.weather === 'storm' ? 1 : 0;
  city.blend = clamp(city.blend + (target - city.blend) * Math.min(1, dt * 0.55), 0, 1);
  // lightning
  city.flash = Math.max(0, city.flash - dt * 3.2);
  city.lightningTimer -= dt;
  if (city.weather === 'storm' && city.lightningTimer <= 0) {
    city.lightningTimer = range(Math.random, 4, 9);
    city.flash = 1;
    if (city.onLightning) city.onLightning();
  }
  city.skyMat.uniforms.flash.value = city.flash * 0.55;
  mixWeather(city, city.blend);
  // palms sway / bend in the wind
  const wind = city.blend * 0.55;
  for (let i = 0; i < city.palms.length; i += 1) {
    const p = city.palms[i];
    p.rotation.z = Math.sin(city.time * 1.4 + i * 0.7) * (0.03 + wind * 0.12) + wind * 0.22;
    p.rotation.x = Math.cos(city.time * 1.1 + i) * (0.02 + wind * 0.08);
  }
  // rain falls slanted, centred on the camera
  if (city.blend > 0.02) {
    const pos = city.rain.geometry.attributes.position;
    const cx = camera.position.x, cz = camera.position.z;
    for (let i = 0; i < pos.count; i += 1) {
      let y = pos.getY(i) - dt * 42;
      let x = pos.getX(i) - dt * 9;
      if (y < 0) { y = 42; x = cx + (Math.random() - 0.5) * 120; pos.setZ(i, cz + (Math.random() - 0.5) * 120); }
      if (x < cx - 60) x = cx + 60;
      pos.setY(i, y); pos.setX(i, x);
    }
    pos.needsUpdate = true;
    city.rain.position.set(0, 0, 0);
  }
  // ocean shimmer
  city.ocean.position.y = -0.5 + Math.sin(city.time * 0.8) * 0.12;
}

export function setWeather(city, name) {
  city.weather = name;
  city.stormTime = 0;
}

export function districtAt(x, z) {
  if (x < -11) return 'MARISOL BAY';
  if (z < -200) return 'NORTH BRIDGE';
  if (z > 220) return 'MARINA';
  if (x > 42) return 'DOWNTOWN';
  if (Math.abs(z) < 12) return 'OCEAN DRIVE';
  return 'OCEAN DRIVE';
}
