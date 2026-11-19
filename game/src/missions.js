// Story missions for Talvera Heat — authored in this session.
// Dax Renner, getaway driver, works for fixer Selma Voss against the Hollow Men crew.
// Six missions, each with briefing dialogue, objectives and a cash reward.
import * as THREE from 'three';
import { dist2d, clamp } from './util.js';
import { makePersonMesh } from './player.js';
import { Car } from './vehicles.js';

const DIALOGUE_TIME = 4.5;

export const MISSIONS = [
  {
    id: 'first-gear',
    title: 'First Gear',
    reward: 150,
    briefing: [
      'SELMA: Dax. You drive, I plan. First job is easy.',
      'SELMA: Take the sedan to the Copper Market meet. No trouble, no heat.',
    ],
    steps: [
      { type: 'drive', x: 150, z: 120, radius: 10, label: 'Drive to the Copper Market meet' },
      { type: 'drive', x: -90, z: -66, radius: 10, label: 'Bring the package back to Renner Garage' },
    ],
  },
  {
    id: 'river-run',
    title: 'The River Run',
    reward: 300,
    timeLimit: 150,
    briefing: [
      'SELMA: A client needs a case across the river, fast.',
      'SELMA: Foundry Flats, 150 seconds. The bridges are the only way over.',
    ],
    steps: [
      { type: 'drive', x: -180, z: 180, radius: 10, label: 'Deliver the case to Foundry Flats (150s)' },
      { type: 'drive', x: -90, z: -66, radius: 10, label: 'Return to Renner Garage' },
    ],
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    reward: 400,
    briefing: [
      'SELMA: A gold Comet GT is parked on Glass Row. Unlocked. Unlucky owner.',
      'SELMA: Take it. Bring it to the garage. Cops will notice — drive clean.',
    ],
    steps: [
      { type: 'steal', kind: 'sport', x: 30, z: 30, label: 'Steal the gold sports car on Glass Row' },
      { type: 'drive', x: -90, z: -66, radius: 10, label: 'Deliver the Comet GT to Renner Garage' },
    ],
  },
  {
    id: 'pier-9',
    title: 'Pier 9 Payback',
    reward: 500,
    briefing: [
      'SELMA: The Hollow Men jumped one of ours on the Promenade.',
      'SELMA: Settle it on foot. Three of them. Then get out before the PD arrives.',
    ],
    steps: [
      { type: 'combat', x: 60, z: 270, count: 3, label: 'Deal with the Hollow Men (0/3)' },
      { type: 'goto', x: -90, z: -66, radius: 10, label: 'Get back to Renner Garage' },
    ],
  },
  {
    id: 'long-con',
    title: 'The Long Con',
    reward: 650,
    briefing: [
      'SELMA: Three drops, three districts, one night. The PD is watching, so keep moving.',
      'SELMA: Copper Market, Palm Boulevard, then the Old Mill. Do not stop for anyone.',
    ],
    steps: [
      { type: 'collect', points: [{ x: 150, z: 120 }, { x: -120, z: -60 }, { x: -40, z: 410 }], label: 'Collect the drops (0/3)' },
      { type: 'drive', x: -90, z: -66, radius: 10, label: 'Return to Renner Garage' },
    ],
  },
  {
    id: 'talvera-grand',
    title: 'Talvera Grand',
    reward: 1500,
    briefing: [
      'SELMA: The big one. Grand Talvera Bank, Old Mill Quarter.',
      'SELMA: Crack the vault, then run. Five stars, a helicopter, the whole city.',
      'SELMA: Make it to the garage and we are done. Talvera is ours.',
    ],
    steps: [
      { type: 'drive', x: 0, z: 400, radius: 12, label: 'Reach the Grand Talvera Bank' },
      { type: 'hold', x: 0, z: 400, seconds: 10, label: 'Crack the vault — hold position (10s)' },
      { type: 'escape', x: -90, z: -66, radius: 10, label: 'Escape to Renner Garage with the haul' },
    ],
  },
];

export class MissionSys {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.index = 0; // next mission to start
    this.active = null; // active mission definition
    this.stepIdx = 0;
    this.stepState = null;
    this.targetCar = null;
    this.rivals = [];
    this.dialogue = [];
    this.dialogueT = 0;
    this.missionT = 0;
    this.marker = null;
    this.failed = false;
    this.completedCount = 0;
    this.markerMesh = this.makeMarker();
    this.markerMesh.visible = false;
    scene.add(this.markerMesh);
    this.startMarker = this.makeMarker(0x2ec4b6);
    this.startMarker.position.set(-90, 0, -66);
    scene.add(this.startMarker);
  }
  makeMarker(color = 0xffd23e) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.0, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.25;
    g.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 1.6, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 13;
    g.add(beam);
    g.userData.ring = ring;
    return g;
  }
  get current() { return this.active ? this.active.steps[this.stepIdx] : null; }
  get objectiveText() {
    if (this.active) {
      const s = this.current;
      if (!s) return '';
      if (s.type === 'combat') return s.label.replace('(0/3)', `(${this.stepState.killed}/${s.count})`);
      if (s.type === 'collect') return s.label.replace('(0/3)', `(${this.stepState.got}/${s.points.length})`);
      if (s.type === 'hold') return `${s.label.split('(')[0]} (${Math.ceil(this.stepState.holdLeft)}s)`;
      return s.label;
    }
    if (this.index >= MISSIONS.length) return 'All missions complete — Talvera is yours. Free roam.';
    return `Next job: ${MISSIONS[this.index].title} — go to Renner Garage (teal marker)`;
  }
  start(i) {
    const m = MISSIONS[i];
    this.active = m;
    this.stepIdx = 0;
    this.missionT = 0;
    this.dialogue = [...m.briefing];
    this.dialogueT = 0;
    this.markerMesh.visible = true;
    this.startMarker.visible = false;
    this.setupStep();
    return m;
  }
  setupStep() {
    const s = this.current;
    this.stepState = { got: 0, killed: 0, holdLeft: s.seconds || 0, pointIdx: 0 };
    if (s.type === 'steal') {
      // The gold Comet GT, parked where the step says.
      this.targetCar = new Car(this.scene, 'sport', 0xe0a92e, s.x, s.z, Math.PI / 2);
      this.targetCar.stolen = false;
    }
    if (s.type === 'combat') {
      this.rivals = [];
      for (let k = 0; k < s.count; k++) {
        const mesh = makePersonMesh(0x3a3f4a, 0x1c1e26);
        const rx = s.x + (this.rng() * 2 - 1) * 8;
        const rz = s.z + (this.rng() * 2 - 1) * 8;
        mesh.position.set(rx, 0, rz);
        this.scene.add(mesh);
        this.rivals.push({ mesh, x: rx, z: rz, health: 60, punchT: 0, alive: true });
      }
    }
    this.moveMarker();
  }
  moveMarker() {
    const s = this.current;
    if (!s) { this.markerMesh.visible = false; return; }
    let x = s.x, z = s.z;
    if (s.type === 'collect') { const p = s.points[this.stepState.pointIdx]; x = p.x; z = p.z; }
    this.markerMesh.position.set(x, 0, z);
    this.markerMesh.visible = true;
  }
  clearStepEntities() {
    if (this.targetCar && !this.targetCar.stolen) {
      // Leave the car in the world as a normal traffic car if the player did not take it.
      this.targetCar = null;
    }
    for (const r of this.rivals) this.scene.remove(r.mesh);
    this.rivals = [];
  }
  advance(ctx) {
    this.clearStepEntities();
    this.stepIdx++;
    if (this.stepIdx >= this.active.steps.length) {
      const m = this.active;
      ctx.cash += m.reward;
      ctx.audio.sfx('cash');
      this.completedCount++;
      this.index++;
      this.active = null;
      this.markerMesh.visible = false;
      this.startMarker.visible = this.index < MISSIONS.length;
      ctx.onMissionComplete(m);
      return;
    }
    this.setupStep();
  }
  fail(ctx) {
    this.clearStepEntities();
    this.active = null;
    this.markerMesh.visible = true;
    this.startMarker.visible = true;
    this.failed = true;
    ctx.onMissionFailed();
  }
  update(dt, ctx) {
    const { player } = ctx;
    const px = player.inCar ? player.inCar.x : player.x;
    const pz = player.inCar ? player.inCar.z : player.z;
    // Dialogue lines, one at a time.
    if (this.dialogue.length) {
      this.dialogueT += dt;
      if (this.dialogueT > DIALOGUE_TIME) { this.dialogue.shift(); this.dialogueT = 0; }
    }
    // Marker pulse.
    this.markerMesh.rotation.y += dt * 0.8;
    const s = 1 + Math.sin(ctx.time * 3) * 0.08;
    this.markerMesh.scale.set(s, 1, s);
    this.startMarker.rotation.y += dt * 0.5;
    if (!this.active) return;
    this.missionT += dt;
    const m = this.active;
    const step = this.current;
    if (m.timeLimit && this.missionT > m.timeLimit) { this.fail(ctx); return; }
    if (step.type === 'goto' || step.type === 'drive' || step.type === 'escape') {
      if (dist2d(px, pz, step.x, step.z) < step.radius) {
        if (step.type === 'escape') ctx.police.clearHeat();
        this.advance(ctx);
      }
    } else if (step.type === 'steal') {
      if (this.targetCar && player.inCar === this.targetCar) {
        this.targetCar.stolen = true;
        ctx.audio.sfx('door');
        ctx.police.addHeat(1, ctx.time);
        ctx.hud.callout('CAR STOLEN — the PD is on you');
        this.advance(ctx);
      }
    } else if (step.type === 'collect') {
      const p = step.points[this.stepState.pointIdx];
      if (dist2d(px, pz, p.x, p.z) < 9) {
        this.stepState.got++;
        this.stepState.pointIdx++;
        ctx.audio.sfx('pickup');
        ctx.cash += 50;
        if (this.stepState.pointIdx >= step.points.length) this.advance(ctx);
        else this.moveMarker();
      }
    } else if (step.type === 'hold') {
      if (dist2d(px, pz, step.x, step.z) < step.radius) {
        this.stepState.holdLeft -= dt;
        if (Math.random() < dt * 0.5) ctx.police.addHeat(0.2, ctx.time);
        if (this.stepState.holdLeft <= 0) {
          ctx.police.addHeat(5, ctx.time);
          this.advance(ctx);
        }
      }
    } else if (step.type === 'combat') {
      // Rivals close in and swing; the player fights back (handled in main via hits).
      for (const r of this.rivals) {
        if (!r.alive) continue;
        const d = dist2d(r.x, r.z, player.x, player.z);
        if (!player.inCar) {
          const want = Math.atan2(player.x - r.x, player.z - r.z);
          r.x += Math.sin(want) * 3.2 * dt;
          r.z += Math.cos(want) * 3.2 * dt;
          r.mesh.position.set(r.x, 0, r.z);
          r.mesh.rotation.y = -want;
          const u = r.mesh.userData;
          const swing = Math.sin(ctx.time * 8) * 0.5;
          u.legL.rotation.x = swing; u.legR.rotation.x = -swing;
          r.punchT -= dt;
          if (d < 1.6 && r.punchT <= 0) {
            r.punchT = 1.1;
            player.damage(8);
            ctx.audio.sfx('punch');
          }
        }
      }
      if (this.stepState.killed >= step.count) this.advance(ctx);
    }
  }
  // Damage one rival from combat (punch or pistol). Returns 'killed' | 'hit' | null.
  damageRival(r, damage, ctx) {
    if (!r.alive) return null;
    r.health -= damage;
    if (r.health <= 0) {
      r.alive = false;
      this.scene.remove(r.mesh);
      if (this.active && this.current && this.current.type === 'combat') {
        this.stepState.killed++;
        ctx.hud.callout(`HOLLOW MAN DOWN (${this.stepState.killed}/${this.current.count})`);
      }
      return 'killed';
    }
    return 'hit';
  }
  // Called from main when the player lands a hit: returns 'killed' when a rival died.
  hitRival(originX, originZ, range, damage, ctx) {
    if (!this.active || this.current.type !== 'combat') return null;
    for (const r of this.rivals) {
      if (!r.alive) continue;
      const d = dist2d(originX, originZ, r.x, r.z);
      if (d < range) {
        r.health -= damage;
        if (r.health <= 0) {
          r.alive = false;
          this.scene.remove(r.mesh);
          this.stepState.killed++;
          ctx.audio.sfx('shoot');
          return 'killed';
        }
        return 'hit';
      }
    }
    return null;
  }
}
