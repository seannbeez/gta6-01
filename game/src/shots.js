// Screenshot scenes: ?shot=cover|hurricane|garage|night stages a real, live
// frame of the game (same code paths as play, fixed seed) and sets
// window.__shotReady once it has settled, so the capture is deterministic.
import * as THREE from 'three';
import { setWeather } from './city.js';
import { addWanted, dispatchList } from './police.js';
import { startMission } from './missions.js';

function placeChase(game, wanted) {
  const p = game.player;
  p.inCar = true;
  p.body.visible = false;
  p.car.visible = true;
  p.pos.set(0, 0, 60);
  p.heading = Math.PI;
  p.speed = 34; // ~82 mph, mid-chase
  p.car.position.copy(p.pos);
  p.car.rotation.y = p.heading;
  p.condition = 84;
  game.camera.position.set(0, 5, 78);
  // police alongside the player (visible at the frame edges, never between
  // the chase camera and the player's car) and one ahead
  const spots = [[-5.4, 50], [5.4, 64], [-5, 38]];
  for (const c of game.police.cruisers) game.scene.remove(c.mesh);
  game.police.cruisers.length = 0;
  for (const [x, z] of spots) {
    const c = game.spawnPoliceCruiser(new THREE.Vector3(x, 0, z));
    c.mesh.rotation.y = Math.PI;
    c.speed = 30;
  }
  addWanted(game.police, wanted * 20, 'SHOT');
  game.police.stars = wanted;
  game.police.heat = wanted * 20;
  // traffic ahead for depth
  game.traffic.forEach((t, i) => {
    t.mesh.position.set(i % 2 === 0 ? -3.4 : 3.4, 0, 60 - 30 - i * 22);
    t.mesh.rotation.y = i % 2 === 0 ? Math.PI : 0;
  });
}

export function stageShot(name, game) {
  const g = game;
  g.hud.hideBadge();
  if (name === 'cover') {
    // Bright golden-sunset chase: dispatch, dialogue, weapon wheel, heli + cone.
    setWeather(g.city, 'sunset');
    g.city.blend = 0;
    placeChase(g, 4);
    startMission(g.missions, 0);
    g.missions.active.cp = 0;
    g.missions.active.timeLeft = 132;
    g.missions.beacons[0].position.set(0, 0, -120);
    g.missions.beacons[0].visible = true;
    g.hud.say('MIRA — FIXER', '“Lose them on the bridge and the cargo is yours.”', 'mira');
    g.hud.setWeapon(2);
    g.save.cash = 2450;
    return;
  }
  if (name === 'hurricane') {
    setWeather(g.city, 'storm');
    g.city.blend = 1;
    g.city.flash = 0.9;
    placeChase(g, 3);
    g.hud.say('MIRA — FIXER', '“Storm’s here. Flooded streets — the neon’s your only light now.”', 'mira');
    startMission(g.missions, 1);
    g.missions.beacons[1].position.set(-30, 0, 250);
    g.missions.beacons[1].visible = true;
    return;
  }
  if (name === 'garage') {
    setWeather(g.city, 'sunset');
    g.city.blend = 0;
    const p = g.player;
    p.inCar = true; p.body.visible = false; p.car.visible = true;
    p.pos.set(27, 0, 150); p.heading = Math.PI / 2; p.speed = 0;
    p.car.position.copy(p.pos); p.car.rotation.y = p.heading;
    p.condition = 100;
    g.camera.position.set(12, 4.2, 134);
    g.camera.lookAt(30, 1.5, 152);
    g.openGarage();
    g.hud.say('MIRA — FIXER', '“New paint, fresh neon. The cops will never spot this ride twice.”', 'mira');
    return;
  }
  // night: dark pursuit, heli cone sweeping the boulevard
  setWeather(g.city, 'storm');
  g.city.blend = 0.85;
  placeChase(g, 5);
  startMission(g.missions, 2);
  g.missions.beacons[2].position.set(-10, 0, -292);
  g.missions.beacons[2].visible = true;
  g.hud.say('DISPATCH — MARISOL PD', '“AIR ONE has eyes on the suspect. All units converge on Ocean Drive.”', 'dispatch');
  g.hud.setWeapon(4);
}

export function markShotReady(game) {
  // let the live loop render a few frames (rain, lightning, rotor, HUD) first;
  // wall-clock based so a slow software renderer still signals promptly
  const t0 = performance.now();
  const tick = () => {
    if (performance.now() - t0 > 2500) window.__shotReady = true;
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
