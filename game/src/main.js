// main.js — PROJECT VICE: HURRICANE CITY. Boot, game loop, input, camera, traffic,
// pedestrians, particles, weather cycle, garage, missions, wanted, save/load and
// screenshot staging. The game boots straight into the live 3D city with the player
// already in a sports car on the neon boulevard — no title screen, no blocking modal.
import * as THREE from 'three';
import { createCity, mulberry32 } from './city.js';
import { makeCar, makeTrafficCar } from './vehicles.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const rng = mulberry32(777);
const city = createCity(scene);
const audio = createAudio();
const hud = createHud();

// ---- player car (hero: hot pink sports car, cyan underglow) ----
const heroCar = makeCar({ color: 0xff2a55, neon: 0x37e6ff, beams: true });
heroCar.position.set(0, 0, 26);
scene.add(heroCar);
const player = createPlayer(scene);
player.enterCar(heroCar);
player.car = heroCar;
player.pos.set(0, 0, 26);
player.condition = 84;

const police = createPolice(scene, rng);
const missions = createMissions(scene);

// ---- traffic: living lanes of sports cars, sedans, muscle cars ----
const traffic = [];
const TRAFFIC_N = 16;
for (let i = 0; i < TRAFFIC_N; i++) {
  const kind = ['sport', 'sedan', 'muscle'][i % 3];
  const car = makeTrafficCar(kind, rng);
  const lane = (i % 4) < 2 ? -5.5 - (i % 2) * 4 : 5.5 + (i % 2) * 4;
  car.position.set(lane, 0, -400 + i * 52 + rng() * 20);
  car.rotation.y = lane < 0 ? 0 : Math.PI; // west lanes drive north, east lanes south
  scene.add(car);
  traffic.push({ mesh: car, lane, speed: 12 + rng() * 14, dir: lane < 0 ? -1 : 1, kind });
}

// ---- pedestrians on the sidewalks (flee during gunfights / storms) ----
const peds = [];
const pedColors = [0xffcf3d, 0x37e6ff, 0xff4fd8, 0x7dff6a, 0xffffff, 0xff7a2f];
for (let i = 0; i < 22; i++) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: pedColors[i % pedColors.length], roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.3), shirt);
  body.position.y = 1.0;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc98a5e }));
  head.position.y = 1.65;
  g.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.25), new THREE.MeshStandardMaterial({ color: 0x22304a }));
  legs.position.y = 0.3;
  g.add(legs);
  const side = i % 2 === 0 ? -1 : 1;
  g.position.set(side * (15.5 + rng() * 2), 0, -400 + i * 38 + rng() * 20);
  scene.add(g);
  peds.push({ mesh: g, speed: 1 + rng() * 1.4, dir: rng() < 0.5 ? 1 : -1, flee: 0, phase: rng() * 6 });
}

// ---- particles: nitro flames, drift smoke, crash sparks ----
const particles = [];
function spawnParticles(pos, color, n, spread, up, life) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.16 + Math.random() * 0.2, 6, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    m.position.copy(pos);
    scene.add(m);
    particles.push({
      mesh: m, life: life * (0.6 + Math.random() * 0.6), maxLife: life,
      vel: new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * up, (Math.random() - 0.5) * spread),
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.life -= dt;
    pt.mesh.position.addScaledVector(pt.vel, dt);
    pt.mesh.material.opacity = Math.max(0, pt.life / pt.maxLife);
    pt.mesh.scale.setScalar(1 + (1 - pt.life / pt.maxLife) * 2.2);
    if (pt.life <= 0) { scene.remove(pt.mesh); pt.mesh.material.dispose(); particles.splice(i, 1); }
  }
}

// nitro flame cones on the hero car
const flameMat = new THREE.MeshBasicMaterial({ color: 0x37a8ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
const flames = [];
for (const sx of [-0.5, 0.5]) {
  const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.4, 8), flameMat.clone());
  f.rotation.x = -Math.PI / 2 - 0.5;
  f.position.set(sx, 0.55, 2.6);
  f.visible = false;
  heroCar.add(f);
  flames.push(f);
}

// ---- input ----
const input = { forward: false, back: false, left: false, right: false, nitro: false, handbrake: false, sprint: false, jump: false };
const keys = {};
let paused = false;
let garageOpen = false;
let hintShown = true;
let weatherMode = 'sunset';
let weatherTimer = 42; // auto-cycle countdown
let mouseDown = false;

function hideHint() { if (hintShown) { hintShown = false; hud.setHint(false); } }

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  audio.ensure();
  hideHint();
  const k = e.code;
  if (k === 'KeyW' || k === 'ArrowUp') input.forward = true;
  if (k === 'KeyS' || k === 'ArrowDown') input.back = true;
  if (k === 'KeyA' || k === 'ArrowLeft') input.left = true;
  if (k === 'KeyD' || k === 'ArrowRight') input.right = true;
  if (k === 'ShiftLeft' || k === 'ShiftRight') { input.nitro = true; input.sprint = true; }
  if (k === 'Space') { input.handbrake = true; input.jump = true; e.preventDefault(); }
  if (k === 'KeyF' || k === 'KeyE') toggleEnterExit();
  if (k === 'KeyT') toggleWeather();
  if (k === 'KeyG') toggleGarage();
  if (k === 'KeyR') hud.setRadio(audio.toggleRadio());
  if (k === 'KeyM') hud.setRadio(!audio.toggleMute() && audio.radioOn);
  if (k === 'KeyH' || k === 'Escape') { paused = !paused; hud.setPause(paused); }
  if (k === 'KeyN') { missions.nextMission(); hud.setMission(missions.active.brief, missions.timeLeft); hud.flash('NEXT MISSION: ' + missions.active.name); }
  if (k >= 'Digit1' && k <= 'Digit7') {
    player.weaponIndex = Number(k.slice(5)) - 1;
    hud.setWeapon(player.weaponIndex);
    hud.setWeapon(player.weaponIndex);
  }
  if (k === 'Digit1' || k === 'Digit2') { /* fists/bat: melee, no ammo */ }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  const k = e.code;
  if (k === 'KeyW' || k === 'ArrowUp') input.forward = false;
  if (k === 'KeyS' || k === 'ArrowDown') input.back = false;
  if (k === 'KeyA' || k === 'ArrowLeft') input.left = false;
  if (k === 'KeyD' || k === 'ArrowRight') input.right = false;
  if (k === 'ShiftLeft' || k === 'ShiftRight') { input.nitro = false; input.sprint = false; }
  if (k === 'Space') { input.handbrake = false; input.jump = false; }
});
canvas.addEventListener('mousedown', (e) => {
  audio.ensure();
  hideHint();
  mouseDown = true;
  shootAt(e.clientX, e.clientY);
});
window.addEventListener('mouseup', () => { mouseDown = false; });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- shooting: raycast into the world, damage police / traffic ----
const raycaster = new THREE.Raycaster();
function shootAt(cx, cy) {
  const ndc = new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const far = raycaster.ray.at(60, new THREE.Vector3());
  if (player.shoot(far)) {
    audio.gunshot();
    police.commitCrime('shooting');
    for (const p of peds) p.flee = 3;
    // hit a cruiser?
    for (const c of police.cruisers) {
      if (c.mesh.position.distanceTo(far) < 6) {
        spawnParticles(c.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xffa020, 10, 6, 4, 0.5);
        player.cash += 25;
        break;
      }
    }
  }
}

// ---- enter / exit / hijack ----
function nearestCar(maxD) {
  let best = null, bd = maxD;
  // your own car counts too — you can always climb back in
  if (player.car) {
    const d = player.car.position.distanceTo(player.pos);
    if (d < bd) { bd = d; best = { mesh: player.car, own: true }; }
  }
  for (const t of traffic) {
    const d = t.mesh.position.distanceTo(player.pos);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}
function toggleEnterExit() {
  if (player.mode === 'car') {
    player.exitCar();
    hud.flash('ON FOOT — find a car, press F to hijack');
  } else {
    const t = nearestCar(6);
    if (t) {
      if (t.own) {
        player.enterCar(t.mesh);
        player.car = t.mesh;
        hud.flash('BACK IN THE DRIVER SEAT');
        return;
      }
      traffic.splice(traffic.indexOf(t), 1);
      scene.remove(t.mesh);
      const stolen = makeCar({ color: 0x37e6ff, neon: 0xff4fd8 });
      stolen.position.copy(t.mesh.position);
      stolen.rotation.y = t.mesh.rotation.y;
      scene.add(stolen);
      player.enterCar(stolen);
      player.car = stolen;
      player.condition = 92;
      police.commitCrime('steal');
      hud.flash('CAR JACKED — nice ride');
      audio.sting('wanted');
    } else {
      hud.flash('NO CAR NEARBY');
    }
  }
}

// ---- weather ----
function setWeatherMode(mode) {
  weatherMode = mode;
  city.setWeather(mode);
  weatherTimer = mode === 'sunset' ? 42 : mode === 'hurricane' ? 30 : 999;
  audio.setRain(mode === 'hurricane');
  const labels = { sunset: '☀ GOLDEN SUNSET', hurricane: '⛈ NEON HURRICANE', night: '🌙 PALM CITY NIGHT' };
  hud.setWeather(labels[mode], mode === 'sunset' ? 'storm in ' + weatherTimer + 's' : mode === 'hurricane' ? 'clearing in ' + weatherTimer + 's' : '');
  hud.setDistrict(mode === 'hurricane' ? 'OCEAN DRIVE' : 'OCEAN DRIVE', mode === 'hurricane' ? '⚠ HURRICANE WARNING' : mode === 'night' ? 'NIGHT PURSUIT' : 'GOLDEN HOUR');
}
function toggleWeather() {
  setWeatherMode(weatherMode === 'sunset' ? 'hurricane' : weatherMode === 'hurricane' ? 'night' : 'sunset');
  hud.flash(weatherMode === 'hurricane' ? '⛈ HURRICANE MODE' : weatherMode === 'night' ? '🌙 NIGHT MODE' : '☀ GOLDEN SUNSET');
  if (weatherMode === 'hurricane') audio.thunder();
}

// ---- garage ----
function openGarage(force) {
  garageOpen = true;
  hud.setGarage(true);
  if (player.mode === 'car') player.condition = Math.min(100, player.condition + 0);
}
function closeGarage() {
  garageOpen = false;
  hud.setGarage(false);
}
function toggleGarage() {
  if (garageOpen) closeGarage();
  else {
    openGarage();
    hud.flash('SAFEHOUSE GARAGE — repair & customize');
  }
}
document.getElementById('btn-close-garage').addEventListener('click', closeGarage);
document.getElementById('btn-resume').addEventListener('click', () => { paused = false; hud.setPause(false); });
document.getElementById('btn-repair').addEventListener('click', () => {
  if (player.cash >= 150) { player.cash -= 150; player.condition = 100; hud.flash('REPAIRED — CONDITION 100%'); audio.sting('complete'); }
  else hud.flash('NOT ENOUGH CASH');
});
const neonCycle = [0x37e6ff, 0xff4fd8, 0x7dff6a, 0xffcf3d];
let neonIdx = 0;
document.getElementById('btn-neon').addEventListener('click', () => {
  neonIdx = (neonIdx + 1) % neonCycle.length;
  const c = neonCycle[neonIdx];
  if (player.car && player.car.userData.neonMat) player.car.userData.neonMat.color.setHex(c);
  document.getElementById('btn-neon').textContent = '💡 NEON: #' + c.toString(16).toUpperCase();
});
document.getElementById('btn-swap').addEventListener('click', () => {
  hud.flash('GARAGE: 1 / 3 SPORTS CARS — steal more on the street!');
});
document.querySelectorAll('#paint-row .swatch').forEach((s) => {
  s.addEventListener('click', () => {
    if (player.car) player.car.userData.paint.color.setHex(parseInt(s.dataset.color.slice(1), 16));
    hud.flash('PAINT APPLIED');
  });
});

// ---- save / load (localStorage) ----
function saveGame() {
  try {
    localStorage.setItem('project-vice-save', JSON.stringify({
      cash: player.cash, respect: player.respect, respectLevel: player.respectLevel,
      condition: player.condition, weaponIndex: player.weaponIndex,
      paint: player.car ? '#' + player.car.userData.paint.color.getHexString() : '#ff2a55',
    }));
  } catch (e) {}
}
function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem('project-vice-save') || 'null');
    if (!s) return;
    player.cash = s.cash ?? player.cash;
    player.respect = s.respect ?? player.respect;
    player.respectLevel = s.respectLevel ?? player.respectLevel;
    player.condition = s.condition ?? player.condition;
    player.weaponIndex = s.weaponIndex ?? player.weaponIndex;
    if (s.paint && player.car) player.car.userData.paint.color.set(s.paint);
  } catch (e) {}
}
loadGame();
setInterval(saveGame, 8000);

// ---- mission events ----
function onMissionEvent(kind, mission) {
  if (kind === 'complete') {
    player.cash += mission.reward;
    player.respect = Math.min(100, player.respect + 14);
    if (player.respect >= 100) { player.respect = 12; player.respectLevel += 1; }
    player.hitStop = 0.18;
    player.shake = 0.5;
    hud.flash('MISSION COMPLETE — +$' + mission.reward, '');
    audio.sting('complete');
    spawnParticles(player.pos.clone().add(new THREE.Vector3(0, 2, 0)), 0xffcf3d, 26, 8, 8, 1.1);
    setTimeout(() => missions.nextMission(), 2500);
  } else if (kind === 'checkpoint') {
    hud.flash('CHECKPOINT ✓', '');
    audio.sting('checkpoint');
  } else if (kind === 'failed') {
    hud.flash('MISSION FAILED — RETRY (N)', 'warn');
    audio.sting('wanted');
    setTimeout(() => missions.start(mission), 2500);
  }
}

// ---- camera ----
const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();
function snapCamera() {
  const fwd = new THREE.Vector3(-Math.sin(player.heading), 0, -Math.cos(player.heading));
  camPos.copy(player.pos).add(fwd.clone().multiplyScalar(-11)).add(new THREE.Vector3(0, 4.6, 0));
  camPos.x = THREE.MathUtils.clamp(camPos.x, -60, 90);
  camTarget.copy(player.pos).add(new THREE.Vector3(0, 2.6, 0)).add(fwd.clone().multiplyScalar(8));
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
}
function updateCamera(dt) {
  const fwd = new THREE.Vector3(-Math.sin(player.heading), 0, -Math.cos(player.heading));
  const back = fwd.clone().multiplyScalar(-11);
  const desired = player.pos.clone().add(back).add(new THREE.Vector3(0, 4.6, 0));
  // keep the camera out of buildings: clamp x
  desired.x = THREE.MathUtils.clamp(desired.x, -60, 90);
  camPos.lerp(desired, Math.min(1, dt * 5));
  camTarget.lerp(player.pos.clone().add(new THREE.Vector3(0, 2.6, 0)).add(fwd.clone().multiplyScalar(8)), Math.min(1, dt * 7));
  camera.position.copy(camPos);
  if (player.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * player.shake;
    camera.position.y += (Math.random() - 0.5) * player.shake;
    player.shake = Math.max(0, player.shake - dt * 1.4);
  }
  camera.lookAt(camTarget);
}

// ---- traffic + pedestrian update ----
function updateTraffic(dt) {
  for (const t of traffic) {
    t.mesh.position.z += t.dir * t.speed * dt;
    if (t.mesh.position.z > 430) t.mesh.position.z = -430;
    if (t.mesh.position.z < -430) t.mesh.position.z = 430;
    // avoid the player: swerve
    const dz = t.mesh.position.z - player.pos.z;
    if (Math.abs(dz) < 14 && Math.abs(t.mesh.position.x - player.pos.x) < 3.5) {
      t.mesh.position.x += (t.mesh.position.x > player.pos.x ? 1 : -1) * dt * 6;
    }
    t.mesh.position.x = THREE.MathUtils.clamp(t.mesh.position.x, -11, 11);
    const wheels = t.mesh.userData.wheels || [];
    for (const w of wheels) w.rotation.x += t.speed * dt * 1.6;
    // collision with the player car
    if (player.mode === 'car' && t.mesh.position.distanceTo(player.pos) < 3.4) {
      player.speed *= 0.55;
      player.condition = Math.max(20, player.condition - 3);
      player.shake = 0.35;
      spawnParticles(player.pos.clone().add(new THREE.Vector3(0, 1, 0)), 0xffa020, 12, 7, 5, 0.6);
      police.commitCrime('crash');
      t.mesh.position.x += (t.mesh.position.x > player.pos.x ? 4 : -4);
      t.speed *= 0.5;
    }
  }
}
function updatePeds(dt, t) {
  const fleeing = police.stars >= 3 || player.lastShot > performance.now() / 1000 - 1;
  for (const p of peds) {
    const run = fleeing || p.flee > 0;
    if (p.flee > 0) p.flee -= dt;
    const sp = run ? p.speed * 3.2 : p.speed;
    p.mesh.position.z += p.dir * sp * dt;
    if (p.mesh.position.z > 420) p.dir = -1;
    if (p.mesh.position.z < -420) p.dir = 1;
    // run away from the road when fleeing
    if (run) {
      const side = p.mesh.position.x > 0 ? 1 : -1;
      p.mesh.position.x += side * dt * 2.2;
      p.mesh.position.x = THREE.MathUtils.clamp(p.mesh.position.x, 14, 30) * (side > 0 ? 1 : -1) * Math.sign(p.mesh.position.x || side);
    }
    p.mesh.position.y = Math.abs(Math.sin(t * 6 + p.phase)) * (run ? 0.14 : 0.05);
    p.mesh.rotation.y = p.dir > 0 ? 0 : Math.PI;
  }
}

// ---- HUD refresh ----
let hudTimer = 0;
function refreshHud(dt) {
  hudTimer -= dt;
  if (hudTimer > 0) return;
  hudTimer = 0.12;
  hud.setStars(police.stars);
  hud.setHealth(player.health, player.armor);
  hud.setCash(player.cash);
  hud.setWeapon(player.weaponIndex);
  const mph = Math.abs(player.speed) * 2.2;
  const gear = player.mode === 'car' ? Math.min(6, 1 + Math.floor(Math.abs(player.speed) / 9)) : 0;
  hud.setSpeed(mph, gear, player.nitro);
  hud.setCondition(player.condition);
  hud.setRespect(player.respectLevel, player.respectTitle, player.respect);
  hud.setMission(missions.active ? missions.active.brief : '—', missions.active ? missions.timeLeft : null);
  const mn = document.getElementById('mission-name');
  if (missions.active) mn.textContent = missions.active.name;
  hud.setDispatch(police.dispatchList(player.pos));
  const missionCp = missions.active && missions.state === 'active' ? missions.active.checkpoints[missions.index] : null;
  hud.drawMinimap(
    player.pos, player.heading,
    police.cruisers.map((c) => c.mesh.position),
    missionCp, city.garagePos,
    police.heli.visible ? police.heli.position : null
  );
  const district = player.pos.z < -200 ? 'BRIDGE — NORTH ISLE' : player.pos.x < -14 ? 'BEACHFRONT' : player.pos.z > 120 ? 'MARINA DISTRICT' : 'OCEAN DRIVE';
  hud.setDistrict(district, weatherMode === 'hurricane' ? '⚠ HURRICANE WARNING' : weatherMode === 'night' ? 'NIGHT PURSUIT' : '');
  if (weatherMode === 'sunset') hud.setWeather('☀ GOLDEN SUNSET', 'storm in ' + Math.max(0, Math.ceil(weatherTimer)) + 's');
  else if (weatherMode === 'hurricane') hud.setWeather('⛈ NEON HURRICANE', 'clearing in ' + Math.max(0, Math.ceil(weatherTimer)) + 's');
  audio.siren(police.stars >= 1);
}

// Force a full synchronous HUD refresh (screenshot staging needs the HUD to
// match the staged state at once, not after a few rendered frames).
function forceHud() { hudTimer = 0; refreshHud(1); }

// ---- main loop ----
const clock = new THREE.Clock();
let elapsed = 0;
let lastBolt = 0;
setWeatherMode('sunset');
hud.setDialogue('MIRA — fixer', 'Lose them on the bridge and the cargo is yours.');
hud.setRadio(true);

function animate() {
  // frozen (screenshot harness): keep the rAF chain alive but skip work, so
  // unfreezing resumes the loop on the settled frame
  if (window.__VICE_FROZEN__) { requestAnimationFrame(animate); return; }
  requestAnimationFrame(animate);
  const rawDt = Math.min(clock.getDelta(), 0.05);
  const dt = player.hitStop > 0 ? rawDt * 0.12 : rawDt;
  if (player.hitStop > 0) player.hitStop -= rawDt;
  elapsed += dt;
  if (paused || garageOpen) {
    renderer.render(scene, camera);
    return;
  }
  // weather auto-cycle
  weatherTimer -= dt;
  if (weatherTimer <= 0) {
    if (weatherMode === 'sunset') { setWeatherMode('hurricane'); hud.flash('⛈ HURRICANE INCOMING', 'warn'); audio.thunder(); }
    else if (weatherMode === 'hurricane') { setWeatherMode('night'); }
    else setWeatherMode('sunset');
  }
  if (weatherMode === 'hurricane' && city.flashTimer > 0 && lastBolt !== city.nextBolt) { lastBolt = city.nextBolt; }

  // player
  if (player.mode === 'car') {
    player.drive(dt, input, (kind) => police.commitCrime(kind));
    if (player.nitroActive) {
      const rear = player.pos.clone().add(new THREE.Vector3(Math.sin(player.heading) * 2.4, 0.6, Math.cos(player.heading) * 2.4));
      spawnParticles(rear, 0x37a8ff, 2, 1.5, 1, 0.35);
      flames.forEach((f) => { f.visible = true; f.scale.set(1 + Math.random() * 0.5, 1 + Math.random() * 0.8, 1); });
    } else flames.forEach((f) => { f.visible = false; });
    if (player.drifting) {
      spawnParticles(player.pos.clone(), 0xbbbbbb, 2, 3, 2, 0.7);
      if (Math.random() < dt * 4) audio.screech();
    }
  } else {
    player.walk(dt, input);
  }
  player.updateTracers(dt);
  if (mouseDown && player.mode === 'foot') shootAt(window.innerWidth / 2, window.innerHeight / 2);

  // world systems
  updateTraffic(dt);
  updatePeds(dt, elapsed);
  police.update(dt, elapsed, player.pos, player.speed);
  police.coolDown(dt * 0.4);
  missions.update(dt, player.pos, onMissionEvent);
  city.update(dt, elapsed, camera.position);
  updateParticles(dt);
  audio.setEngine(player.mode === 'car' ? Math.abs(player.speed) / 62 : 0, player.nitroActive);

  updateCamera(rawDt);
  refreshHud(dt);
  renderer.render(scene, camera);
}
animate();

// ---- screenshot staging (?shot=cover|hurricane|garage|night) ----
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  const game = { setWeatherMode, police, player, hud, openGarage, missions, forceHud, snapCamera };
  stageShot(shot, game);
} else {
  setTimeout(() => { window.__VICE_READY__ = true; }, 1500);
}
window.__VICE__ = { player, police, missions, city, setWeatherMode, forceHud, snapCamera };
