// PROJECT VICE: HURRICANE CITY — boot and the one loop.
// Loads instantly into the live 3D city with the player already in the car:
// no title screen, no blocking modal — only a small badge that fades on input.
// ?shot=cover|hurricane|garage|night stages a screenshot scene instead.
import * as THREE from 'three';
import { createRandom } from './rng.js';
import { buildCity, districtAt, setWeather, updateCity } from './city.js';
import { createAudio } from './audio.js';
import { createHud, updateHud } from './hud.js';
import { createMissions, defaultSave, loadSave, missionObjective, startMission, storeSave, updateMissions, GARAGE_CARS, NEONS, PAINTS, addRespect, applyRepair } from './missions.js';
import { addWanted, createPolice, dispatchList, spawnCruiser, updatePolice } from './police.js';
import { createParticles, createPlayer, enterCar, exitCar, shoot, updateCamera, updateParticles, updatePlayer } from './player.js';
import { createTraffic, makeHelicopter, updateHelicopter, updateTraffic } from './vehicles.js';
import { markShotReady, stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261124;
const rng = createRandom(seed);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 5, 62);

const city = buildCity(scene, rng);
const audio = createAudio();
const save = loadSave() || defaultSave();
const player = createPlayer(scene, save);
const police = createPolice(scene, rng);
const traffic = createTraffic(scene, rng, 14);
const missions = createMissions(scene);
const particles = createParticles(scene);
const heli = makeHelicopter();
scene.add(heli);
// pedestrians on the sidewalks
const peds = [];
{
  const pedMat = new THREE.MeshStandardMaterial({ color: 0x35d0ff, roughness: 0.7 });
  const pedMat2 = new THREE.MeshStandardMaterial({ color: 0xff9de2, roughness: 0.7 });
  for (let i = 0; i < 18; i += 1) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.3), i % 2 ? pedMat : pedMat2);
    b.position.y = 0.9; b.castShadow = true;
    g.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xe8b98d }));
    h.position.y = 1.65;
    g.add(h);
    const side = i % 2 === 0 ? -9.5 : 9.5;
    g.position.set(side, 0, -260 + i * 29 + rng() * 8);
    scene.add(g);
    peds.push({ g, side, speed: 1 + rng() * 1.4, dir: rng() < 0.5 ? 1 : -1, flee: 0 });
  }
}

const game = {
  scene, camera, city, audio, save, player, police, traffic, missions, particles,
  heli, peds, rng, time: 0, district: 'OCEAN DRIVE', cameraYaw: Math.PI,
  foot: player.onFoot, garageOpen: false, paused: false, shotMode: !!shot,
  inGarage: false,
};
// HUD needs the game object; create it after the game shell exists.
const hud = createHud(game);
game.hud = hud;
game.dispatchList = () => dispatchList(police, player.pos);
game.missionObjective = () => missionObjective(missions);
game.spawnPoliceCruiser = (pos) => {
  const c = spawnCruiser(police, scene, pos);
  c.mesh.position.copy(pos);
  return c;
};

// --- game events (crime, hits, missions, garage) ---
game.onCrime = function onCrime(amount, reason) {
  if (game.garageOpen || game.shotMode) return; // staged scenes keep their stars
  const r = addWanted(police, amount, reason);
  if (r.raised) {
    player.hitStop = 0.12;
    player.shake = Math.min(1, player.shake + 0.4);
    hud.toast(`${r.stars} STAR${r.stars > 1 ? 'S' : ''} WANTED`, reason);
    hud.say('DISPATCH — MARISOL PD', `“All units: suspect ${reason.toLowerCase()} on Ocean Drive. ${r.stars}-star response.”`, 'dispatch');
  }
};
game.onHitVehicle = function onHitVehicle(c) {
  player.hitStop = 0.09;
  player.shake = Math.min(1, player.shake + 0.5);
  game.onCrime(10, 'SHOTS FIRED');
};
game.onCheckpoint = function onCheckpoint(a) {
  audio.chime(true);
  player.hitStop = 0.1;
  hud.toast('CHECKPOINT', `${a.cp}/${a.mission.checkpoints.length} — keep flying`);
};
game.onMissionComplete = function onMissionComplete(m) {
  save.cash += m.reward;
  save.missionsDone += 1;
  addRespect(save, 12);
  if (m.id === 'delivery') save.deliveries += 1;
  if (m.id === 'escape') save.escapes += 1;
  if (m.id === 'race' && missions.active === null) { /* best time tracked in save */ }
  storeSave(save);
  audio.chime(true);
  player.hitStop = 0.22;
  player.shake = 0.4;
  hud.toast('MISSION COMPLETE', `${m.title} — +$${m.reward}  •  RESPECT UP`);
  hud.say('MIRA — FIXER', '“Clean run. The money’s in your pocket and the street’s talking about you.”', 'mira');
  if (!save.owned.includes(2) && save.missionsDone >= 2) {
    save.owned.push(2);
    hud.toast('NEW CAR UNLOCKED', 'HURRICANE MUSCLE is waiting in your garage');
  }
};
game.onMissionFail = function onMissionFail(m) {
  audio.chime(false);
  hud.toast('MISSION FAILED', `${m.title} — press N to retry`);
  hud.say('MIRA — FIXER', '“That one slipped. Shake it off — the next job’s already waiting.”', 'mira');
};
game.onGaragePaint = function onGaragePaint(i) {
  save.paint = i;
  player.car.traverse((o) => {
    if (o.isMesh && o.material && o.material.isMeshStandardMaterial && o.geometry
      && o.geometry.parameters && o.geometry.parameters.width === 1.9) {
      o.material.color.set(PAINTS[i].color);
    }
  });
  storeSave(save);
  hud.toast('PAINT APPLIED', PAINTS[i].name);
};
game.onGarageNeon = function onGarageNeon(i) {
  save.neon = i;
  if (player.car.userData.glowMat) player.car.userData.glowMat.color.set(NEONS[i]);
  storeSave(save);
  hud.toast('UNDERGLOW SET', 'Neon updated');
};
game.onGarageCar = function onGarageCar(i) {
  if (!save.owned.includes(i)) {
    if (save.cash < 1800) { hud.toast('NOT ENOUGH CASH', 'That car costs $1,800'); return; }
    save.cash -= 1800;
    save.owned.push(i);
  }
  save.carIndex = i;
  const spec = GARAGE_CARS[i];
  player.car.traverse((o) => {
    if (o.isMesh && o.material && o.material.isMeshStandardMaterial && o.geometry
      && o.geometry.parameters && o.geometry.parameters.width === 1.9) {
      o.material.color.set(spec.color);
    }
  });
  storeSave(save);
  hud.toast('CAR SWAPPED', spec.name + ' is ready');
};
game.onGarageRepair = function onGarageRepair() {
  if (!applyRepair(save)) { hud.toast('NOT ENOUGH CASH', 'Repair costs $250'); return; }
  player.condition = 100;
  storeSave(save);
  hud.toast('REPAIRED', 'Condition 100% — good as new');
};
game.openGarage = function openGarage() {
  game.garageOpen = true;
  game.inGarage = true;
  hud.showGarage(true);
};
game.closeGarage = function closeGarage() {
  game.garageOpen = false;
  game.inGarage = false;
  hud.showGarage(false);
};
game.closeHelp = function closeHelp() {
  game.paused = false;
  hud.showHelp(false);
};

// apply saved paint/neon on boot
{
  const spec = GARAGE_CARS[save.carIndex] || GARAGE_CARS[0];
  player.car.traverse((o) => {
    if (o.isMesh && o.material && o.material.isMeshStandardMaterial && o.geometry
      && o.geometry.parameters && o.geometry.parameters.width === 1.9) {
      o.material.color.set(PAINTS[save.paint] ? PAINTS[save.paint].color : spec.color);
    }
  });
  if (player.car.userData.glowMat) player.car.userData.glowMat.color.set(NEONS[save.neon] || 0x00e5ff);
}

// --- input ---
const input = { up: false, down: false, left: false, right: false, nitro: false, drift: false, jump: false };
let interacted = false;
function firstGesture() {
  if (interacted) return;
  interacted = true;
  audio.init(); audio.resume();
  audio.nextNote = audio.ctx ? audio.ctx.currentTime + 0.05 : 0;
  hud.fadeBadge();
}
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'nitro', ShiftRight: 'nitro', Space: 'drift',
};
window.addEventListener('keydown', (e) => {
  firstGesture();
  if (e.code === 'Space') { e.preventDefault(); input.jump = true; }
  const k = KEYMAP[e.code];
  if (k) { input[k] = true; if (e.code === 'Space') input.drift = true; }
  if (e.repeat) return;
  if (e.code === 'KeyF' || e.code === 'KeyE') { if (player.inCar) exitCar(game); else enterCar(game); }
  if (e.code === 'KeyT') {
    setWeather(city, city.weather === 'storm' ? 'sunset' : 'storm');
    hud.toast(city.weather === 'storm' ? 'HURRICANE MODE' : 'GOLDEN SUNSET', city.weather === 'storm' ? 'Lightning, rain, flooded streets' : 'The storm breaks — sunset over the bay');
  }
  if (e.code === 'KeyG') { if (game.garageOpen) game.closeGarage(); else game.openGarage(); }
  if (e.code === 'KeyN' && !missions.active) {
    const m = startMission(missions, missions.activeIndex, () => {});
    hud.say('MIRA — FIXER', m.intro.replace(/^MIRA: /, ''), 'mira');
    hud.toast(m.title, `Reward $${m.reward} — follow the beacon`);
  }
  if (e.code === 'KeyR') { const on = audio.toggleRadio(); hud.toast(on ? 'RADIO ON' : 'RADIO OFF', 'VIBE 104.5 FM'); }
  if (e.code === 'KeyM') { const m = audio.toggleMute(); hud.toast(m ? 'MUTED' : 'SOUND ON'); }
  if (e.code === 'KeyH') {
    game.paused = !game.paused;
    hud.showHelp(game.paused);
  }
  if (e.code === 'Digit1') hud.setWeapon(2);
  if (e.code === 'Digit2') hud.setWeapon(3);
  if (e.code === 'Digit3') hud.setWeapon(4);
  if (e.code === 'Escape' && game.garageOpen) game.closeGarage();
});
window.addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code];
  if (k) input[k] = false;
  if (e.code === 'Space') { input.jump = false; input.drift = false; }
});
canvas.addEventListener('pointerdown', (e) => {
  firstGesture();
  if (game.garageOpen || game.paused) return;
  // shoot toward the clicked point in the world
  const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const t = -ray.ray.origin.y / ray.ray.direction.y;
  const target = ray.ray.origin.clone().add(ray.ray.direction.clone().multiplyScalar(Math.max(10, t || 30)));
  if (!player.inCar) shoot(game, target);
  else { audio.init(); }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !game.shotMode) { game.paused = true; hud.showHelp(true); }
});

// lightning -> thunder
city.onLightning = () => audio.thunder();

// --- main loop ---
const clock = new THREE.Clock();
let accumulator = 0;
const STEP = 1 / 60;

function frame() {
  requestAnimationFrame(frame);
  const rawDt = Math.min(clock.getDelta(), 0.1);
  if (game.paused || game.garageOpen) {
    renderer.render(scene, camera);
    return;
  }
  accumulator += rawDt;
  let steps = 0;
  while (accumulator >= STEP && steps < 4) {
    step(STEP);
    accumulator -= STEP;
    steps += 1;
  }
  if (steps === 4) accumulator = 0;
  updateHud(hud, game, rawDt);
  renderer.render(scene, camera);
}

function step(dt) {
  game.time += dt;
  updateCity(city, scene, dt, camera);
  // in screenshot mode the car holds its chase speed (no driver input)
  const effInput = game.shotMode && player.inCar
    ? { ...input, up: true, nitro: false, drift: false } : input;
  updatePlayer(game, dt, effInput);
  updateTraffic(traffic, dt, player.pos, game.time);
  const pr = updatePolice(police, scene, dt, player.pos, Math.abs(player.speed), game.inGarage);
  if (pr.rammed && player.inCar && !game.shotMode) {
    player.condition = Math.max(20, player.condition - 2);
    player.shake = Math.min(1, player.shake + 0.35);
    audio.crash();
  }
  updateHelicopter(heli, dt, player.pos, game.time, police.heliActive, game.shotMode);
  // pedestrians: stroll, flee gunfire / storm
  const fleeing = police.stars >= 2 || city.weather === 'storm';
  for (const pd of peds) {
    const toPlayer = Math.hypot(pd.g.position.x - player.pos.x, pd.g.position.z - player.pos.z);
    if (fleeing || toPlayer < 8) pd.flee = 1;
    const sp = pd.flee > 0 ? 4.5 : pd.speed;
    pd.g.position.z += pd.dir * sp * dt;
    if (pd.g.position.z > 278) { pd.g.position.z = -278; pd.flee = 0; }
    if (pd.g.position.z < -278) { pd.g.position.z = 278; pd.flee = 0; }
    pd.g.position.x = pd.side + Math.sin(game.time * 0.7 + pd.g.position.z * 0.05) * 0.4;
    pd.g.rotation.y = pd.dir > 0 ? 0 : Math.PI;
  }
  updateMissions(missions, dt, player.pos, game);
  updateParticles(particles, dt);
  updateCamera(game, dt);
  game.district = districtAt(player.pos.x, player.pos.z);
  game.cameraYaw = player.heading;
  // audio follows the world
  if (audio.ctx) {
    audio.setEngine(player.inCar ? Math.abs(player.speed) / 45 : 0, input.nitro && player.nitro > 0);
    audio.setRain(city.blend);
    audio.setSiren(police.stars > 0, dt);
    audio.radioTick();
  }
  // garage proximity: driving into the cyan bay opens it
  if (player.inCar && !game.garageOpen) {
    const d = Math.hypot(player.pos.x - city.garageBay.x, player.pos.z - city.garageBay.z);
    if (d < 5) game.openGarage();
  }
}

// boot: immediately live in the car on Ocean Drive (no title screen)
if (shot) {
  stageShot(shot, game);
  markShotReady(game);
} else {
  startMission(missions, 0, () => {});
  hud.say('MIRA — FIXER', '“Lose them on the bridge and the cargo is yours.”', 'mira');
}
camera.position.set(0, 5, 62);
camera.lookAt(0, 1.5, 40);
requestAnimationFrame(frame);
