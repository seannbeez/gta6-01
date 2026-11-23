// Missions, the safehouse garage and progression save. Three repeatable jobs with
// glowing 3D beacons; the garage repairs, repaints and swaps collected cars.
import * as THREE from 'three';
import { clamp } from './rng.js';

const SAVE_KEY = 'project-vice-save-v3';

export const PAINTS = [
  { name: 'VICE PINK', color: 0xff2f7e }, { name: 'NEON CYAN', color: 0x00e5ff },
  { name: 'ACID LIME', color: 0x7dff5e }, { name: 'SUNSET GOLD', color: 0xffb347 },
  { name: 'MIDNIGHT', color: 0x1a1a2e }, { name: 'ARCTIC WHITE', color: 0xf2f2f2 },
];
export const NEONS = [0x00e5ff, 0xff2fb3, 0x7dff5e, 0xffb347, 0x9d4edd, 0xff2020];
export const GARAGE_CARS = [
  { name: 'VICE GT', kind: 'sports', color: 0xff2f7e },
  { name: 'PALM CRUISER', kind: 'sedan', color: 0x00e5ff },
  { name: 'HURRICANE MUSCLE', kind: 'muscle', color: 0xff6b35 },
];

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function storeSave(save) {
  try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode */ }
}

export function defaultSave() {
  return {
    cash: 2450, respect: 62, respectLevel: 4, paint: 0, neon: 0, carIndex: 0,
    owned: [0, 1], bestRace: 0, deliveries: 0, escapes: 0, missionsDone: 0,
  };
}

function makeBeacon(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 60, 16, 1, true), mat);
  pillar.position.y = 30;
  g.add(pillar);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.28, 10, 32),
    new THREE.MeshBasicMaterial({ color }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.3;
  g.add(ring);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  core.position.y = 2;
  g.add(core);
  g.userData.mat = mat; g.userData.ring = ring; g.userData.core = core;
  return g;
}

export const MISSIONS = [
  {
    id: 'race', title: 'STREET RACE', color: 0xffe14d,
    intro: 'MIRA: “Three checkpoints, Ocean Drive, no brakes. Beat my ghost and the purse is yours.”',
    checkpoints: [
      new THREE.Vector3(0, 0, -120), new THREE.Vector3(0, 0, 120), new THREE.Vector3(0, 0, -260),
    ],
    reward: 1200, timeLimit: 150,
  },
  {
    id: 'delivery', title: 'CONTRABAND DELIVERY', color: 0x00e5ff,
    intro: 'MIRA: “Cargo in the trunk, hurricane on the radar. Marina, before the storm hits. Don’t stop.”',
    checkpoints: [new THREE.Vector3(-30, 0, 250)],
    reward: 900, timeLimit: 120,
  },
  {
    id: 'escape', title: 'GETAWAY ESCAPE', color: 0xff2f7e,
    intro: 'MIRA: “They’ve got your plate. Lose the tail, cross the bridge, and vanish into the garage.”',
    checkpoints: [new THREE.Vector3(-10, 0, -292)],
    reward: 1500, timeLimit: 180,
  },
];

export function createMissions(scene) {
  const beacons = MISSIONS.map((m) => {
    const b = makeBeacon(m.color);
    b.visible = false;
    scene.add(b);
    return b;
  });
  return {
    list: MISSIONS,
    beacons,
    activeIndex: 0,
    active: null, // {mission, cp, timeLeft, startedAt}
    completedFlash: 0,
  };
}

export function startMission(missions, index, onStart) {
  const m = missions.list[index % missions.list.length];
  missions.activeIndex = index % missions.list.length;
  missions.active = { mission: m, cp: 0, timeLeft: m.timeLimit };
  const b = missions.beacons[missions.activeIndex];
  b.position.copy(m.checkpoints[0]);
  b.visible = true;
  if (onStart) onStart(m);
  return m;
}

export function missionObjective(missions) {
  if (!missions.active) {
    const next = missions.list[missions.activeIndex % missions.list.length];
    return { title: next.title, text: `Press N to start — ${next.title}. Reward $${next.reward}.` };
  }
  const a = missions.active;
  const left = Math.max(0, Math.ceil(a.timeLeft));
  return {
    title: a.mission.title,
    text: `Checkpoint ${a.cp + 1}/${a.mission.checkpoints.length} — ${left}s left — $${a.mission.reward}`,
  };
}

export function updateMissions(missions, dt, playerPos, game) {
  const a = missions.active;
  if (!a) return null;
  a.timeLeft -= dt;
  const b = missions.beacons[missions.activeIndex];
  b.userData.mat.opacity = 0.2 + Math.sin(game.time * 5) * 0.1;
  b.userData.ring.rotation.z += dt * 1.2;
  b.userData.core.position.y = 2 + Math.sin(game.time * 3) * 0.5;
  const target = a.mission.checkpoints[a.cp];
  const d = Math.hypot(playerPos.x - target.x, playerPos.z - target.z);
  if (d < 7) {
    a.cp += 1;
    game.onCheckpoint(a);
    if (a.cp >= a.mission.checkpoints.length) {
      const m = a.mission;
      missions.active = null;
      b.visible = false;
      missions.completedFlash = 1;
      game.onMissionComplete(m);
      return { done: m };
    }
    b.position.copy(a.mission.checkpoints[a.cp]);
    return { checkpoint: a.cp };
  }
  if (a.timeLeft <= 0) {
    missions.active = null;
    b.visible = false;
    game.onMissionFail(a.mission);
    return { failed: a.mission };
  }
  return null;
}

export function applyRepair(save) {
  if (save.cash < 250) return false;
  save.cash -= 250;
  return true;
}

export function addRespect(save, amount) {
  save.respect = clamp(save.respect + amount, 0, 100);
  save.respectLevel = 1 + Math.floor(save.respect / 20);
  if (save.respect >= 100) save.respect = 100;
}
