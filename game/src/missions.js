// missions.js — PROJECT VICE. Three repeatable missions with glowing 3D waypoint
// beacons, checkpoint rings, timers and cash rewards. Story: MIRA the fixer sends
// you across Hurricane City while Marisol PD closes in.
import * as THREE from 'three';

export const MISSIONS = [
  {
    id: 'race',
    name: 'STREET RACE',
    giver: 'MIRA',
    brief: 'Beat the neon circuit — 4 checkpoints, no cops, no mercy.',
    checkpoints: [
      new THREE.Vector3(0, 0, -120),
      new THREE.Vector3(0, 0, -260),
      new THREE.Vector3(0, 0, -80),
      new THREE.Vector3(0, 0, 40),
    ],
    timeLimit: 75,
    reward: 900,
  },
  {
    id: 'delivery',
    name: 'CONTRABAND DELIVERY',
    giver: 'MIRA',
    brief: 'Cargo for the marina before the hurricane hits. Do not stop.',
    checkpoints: [
      new THREE.Vector3(0, 0, -200),
      new THREE.Vector3(0, 0, -340),
      new THREE.Vector3(-30, 0, -180),
    ],
    timeLimit: 60,
    reward: 1400,
  },
  {
    id: 'getaway',
    name: 'GETAWAY ESCAPE',
    giver: 'DANTE',
    brief: 'Lose them on the bridge and the cargo is yours.',
    checkpoints: [
      new THREE.Vector3(0, 0, -160),
      new THREE.Vector3(0, 0, -320),
      new THREE.Vector3(0, 0, -380),
    ],
    timeLimit: 70,
    reward: 1100,
  },
];

export function createMissions(scene) {
  const m = {
    active: MISSIONS[2], // GETAWAY ESCAPE live at boot — the cover chase
    index: 0,
    timeLeft: MISSIONS[2].timeLimit,
    beacon: null,
    ring: null,
    state: 'active', // active | done | failed
    flash: 0,
  };

  // glowing waypoint beacon: tall light pillar + ring on the road
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffcf3d, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 60, 20, 1, true), beaconMat);
  beacon.position.y = 30;
  scene.add(beacon);
  m.beacon = beacon;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.2, 0.35, 10, 32),
    new THREE.MeshBasicMaterial({ color: 0xffcf3d, toneMapped: false })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  scene.add(ring);
  m.ring = ring;

  m.start = function (mission) {
    m.active = mission;
    m.index = 0;
    m.timeLeft = mission.timeLimit;
    m.state = 'active';
    m.moveBeacon();
  };

  m.moveBeacon = function () {
    if (!m.active) return;
    const cp = m.active.checkpoints[m.index];
    m.beacon.position.set(cp.x, 30, cp.z);
    m.ring.position.set(cp.x, 0.4, cp.z);
    m.beacon.visible = true;
    m.ring.visible = true;
  };

  m.nextMission = function () {
    const i = (MISSIONS.indexOf(m.active) + 1) % MISSIONS.length;
    m.start(MISSIONS[i]);
  };

  m.update = function (dt, playerPos, onEvent) {
    if (!m.active || m.state !== 'active') return;
    m.timeLeft -= dt;
    m.flash += dt;
    // beacon pulse
    m.beacon.material.opacity = 0.28 + Math.sin(m.flash * 4) * 0.12;
    m.ring.rotation.z += dt * 1.2;
    m.ring.scale.setScalar(1 + Math.sin(m.flash * 4) * 0.08);
    const cp = m.active.checkpoints[m.index];
    const d = Math.hypot(playerPos.x - cp.x, playerPos.z - cp.z);
    if (d < 7) {
      m.index += 1;
      if (m.index >= m.active.checkpoints.length) {
        m.state = 'done';
        m.beacon.visible = false;
        m.ring.visible = false;
        if (onEvent) onEvent('complete', m.active);
      } else {
        m.moveBeacon();
        if (onEvent) onEvent('checkpoint', m.active);
      }
    }
    if (m.timeLeft <= 0 && m.state === 'active') {
      m.state = 'failed';
      m.beacon.visible = false;
      m.ring.visible = false;
      if (onEvent) onEvent('failed', m.active);
    }
  };

  m.moveBeacon();
  return m;
}
