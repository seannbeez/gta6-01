// Talvera Heat — boot, loop, camera, combat, crime, save/load.
// Authored in this recorded build session for gta6-01.
// ?seed=N fixes traffic/pedestrian randomness. ?shot=start|chase|street|heli stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady.
import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32, clamp, dist2d } from './util.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { buildCity } from './city.js';
import { Car, Traffic } from './vehicles.js';
import { Player, Pedestrians } from './player.js';
import { Police } from './police.js';
import { MissionSys, MISSIONS } from './missions.js';
import { HUD } from './hud.js';
import { stageShot } from './shots.js';
import { UPGRADES, freshUpgrades, nextPrice, maxHealth, pistolDamage, fireInterval } from './garage.js';
import { FX } from './fx.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : CFG.seed;

class Game {
  constructor() {
    this.rng = mulberry32(seed);
    this.canvas = document.getElementById('game');
    this.status = document.getElementById('status');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
    this.city = buildCity(this.scene);
    this.input = new Input();
    this.audio = new AudioSys();
    this.hud = new HUD(this.city);
    this.player = new Player(this.scene, this.city.playerSpawn.x, this.city.playerSpawn.z);
    this.traffic = new Traffic(this.scene, this.city, this.rng);
    this.traffic.spawn(18, this.player.x, this.player.z);
    this.peds = new Pedestrians(this.scene, this.city, this.rng);
    this.peds.spawn(22, this.player.x, this.player.z);
    this.police = new Police(this.scene, this.city, this.rng);
    this.missions = new MissionSys(this.scene, this.city, this.rng);
    this.parked = [];
    this.state = 'menu';
    this.cash = 0;
    this.upgrades = freshUpgrades();
    this.garageReturn = 'menu';
    // Hurricane lightning: a far-off flash light, fired at random intervals.
    this.flash = new THREE.PointLight(0xcdd8ff, 0, 900);
    this.flash.position.set(0, 300, 0);
    this.scene.add(this.flash);
    this.flashT = 0;
    this.nextFlash = 6 + this.rng() * 8;
    // Weather: the hurricane storm is the default mood; KeyR toggles it to
    // a clear golden hour (and back). T stays the mission-start key.
    this.weather = { storm: true };
    // Juice: particle bursts, screen shake and hit-stop (freeze frames).
    this.fx = new FX(this.scene);
    this.shake = 0;
    this.hitStop = 0;
    this._lastWanted = 0;
    this._driftT = 0;
    this.clockMinutes = 17 * 60 + 40;
    this.time = 0;
    this.camYawOffset = 0;
    this.menuOrbit = 0;
    this.frozen = false;
    this.shotInput = null;
    this._synthetic = [];
    this._saveTimer = 0;
    this._pedHitCooldown = 0;
    this._danger = null;
    this.failedIndex = 0;
    this.tracer = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.wireButtons();
    this.missions.onMissionComplete = (m) => this.onMissionComplete(m);
    this.missions.onMissionFailed = () => this.onMissionFailed();
    window.__talvera = this;
  }
  get respect() { return this.missions.completedCount * 10; }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  wireButtons() {
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
    on('btn-start', () => { this.audio.ensure(); this.audio.startMusic(); this.startGame(); });
    on('btn-continue', () => {
      this.audio.ensure(); this.audio.startMusic();
      if (!this.loadSave()) this.startGame();
    });
    on('btn-resume', () => { this.state = 'playing'; this.hud.hideMenus(); });
    on('btn-save-quit', () => { this.saveGame(); this.state = 'menu'; this.hud.showMenu('start'); });
    on('btn-busted', () => this.respawn('busted'));
    on('btn-wasted', () => this.respawn('wasted'));
    on('btn-complete', () => { this.state = 'playing'; this.hud.hideMenus(); });
    on('btn-garage-close', () => this.closeGarage());
    on('btn-buy-engine', () => this.buyUpgrade('engine'));
    on('btn-buy-armor', () => this.buyUpgrade('armor'));
    on('btn-buy-weapon', () => this.buyUpgrade('weapon'));
    on('btn-retry', () => {
      this.missions.start(this.failedIndex);
      this.state = 'playing'; this.hud.hideMenus();
    });
    on('btn-freeroam', () => { this.state = 'playing'; this.hud.hideMenus(); });
  }
  announce(msg) { this.status.textContent = msg; }
  openGarage(from) {
    this.garageReturn = from;
    this.state = 'garage';
    this.hud.setGarage(this.cash, this.upgrades);
    this.hud.showMenu('garage');
    this.audio.sfx('door');
    this.announce('Renner Garage. Spend mission cash on the car and the crew.');
  }
  closeGarage() {
    this.state = this.garageReturn === 'menu' ? 'menu' : 'playing';
    if (this.state === 'menu') this.hud.showMenu('start');
    else this.hud.hideMenus();
  }
  // Weather toggle (KeyR): storm ↔ clear golden hour. Storm is the default
  // hurricane mood (lightning, mauve fog, low sun); clear lifts the fog,
  // warms the haze and brightens the sun, and stops the lightning.
  toggleWeather() {
    this.weather.storm = !this.weather.storm;
    if (this.weather.storm) {
      this.scene.fog.color.setHex(CFG.fog);
      this.scene.fog.near = 120; this.scene.fog.far = 620;
      this.city.sun.intensity = 2.6;
      this.hud.callout('STORM ROLLS IN — LIGHTNING', '#9fb7ff');
    } else {
      this.scene.fog.color.setHex(0xffc98a);
      this.scene.fog.near = 200; this.scene.fog.far = 900;
      this.city.sun.intensity = 3.4;
      this.hud.callout('SKY CLEARS — GOLDEN HOUR', '#ffd23e');
    }
    this.audio.sfx('door');
  }
  buyUpgrade(kind) {
    const level = this.upgrades[kind];
    const price = nextPrice(kind, level);
    if (price === null) { this.hud.callout(`${UPGRADES[kind].name} ALREADY MAXED`); return; }
    if (this.cash < price) { this.hud.callout('NOT ENOUGH CASH — run a job first', '#ff5347'); return; }
    this.cash -= price;
    this.upgrades[kind] = level + 1;
    if (kind === 'armor') this.player.health = maxHealth(this.upgrades.armor);
    if (kind === 'weapon') this.player.fireInterval = fireInterval(this.upgrades.weapon);
    this.audio.sfx('cash');
    this.hud.callout(`${UPGRADES[kind].name} LV${this.upgrades[kind]} INSTALLED`, '#7be495');
    this.saveGame();
    this.hud.setGarage(this.cash, this.upgrades);
  }
  startGame(opts = {}) {
    if (!opts.keepSave) {
      // Fresh run keeps any loaded save; a plain start resets position only.
    }
    this.state = 'playing';
    this.hud.hideMenus();
    this.announce('Playing Talvera Heat. Drive to the teal garage marker and press T for your first job.');
  }
  saveGame() {
    try {
      window.localStorage.setItem(CFG.saveKey, JSON.stringify({
        cash: this.cash,
        upgrades: this.upgrades,
        missionIndex: this.missions.index,
        completed: this.missions.completedCount,
        health: this.player.health,
        x: this.player.inCar ? this.player.inCar.x : this.player.x,
        z: this.player.inCar ? this.player.inCar.z : this.player.z,
        muted: this.audio.muted,
      }));
    } catch { /* storage off: the save lasts this visit only */ }
  }
  loadSave() {
    try {
      const raw = window.localStorage.getItem(CFG.saveKey);
      if (!raw) return false;
      const s = JSON.parse(raw);
      this.cash = s.cash || 0;
      this.upgrades = { ...freshUpgrades(), ...(s.upgrades || {}) };
      this.player.fireInterval = fireInterval(this.upgrades.weapon);
      this.missions.index = Math.min(s.missionIndex || 0, MISSIONS.length - 1);
      this.missions.completedCount = s.completed || 0;
      this.player.health = s.health || CFG.playerHealth;
      this.player.x = s.x ?? this.city.playerSpawn.x;
      this.player.z = s.z ?? this.city.playerSpawn.z;
      this.player.sync();
      this.audio.setMuted(!!s.muted);
      this.startGame({ keepSave: true });
      this.hud.callout('SAVE LOADED — welcome back, Dax');
      return true;
    } catch { return false; }
  }
  respawn(kind) {
    const fine = kind === 'busted' ? Math.min(this.cash, 100) : Math.floor(this.cash * 0.1);
    this.cash = Math.max(0, this.cash - fine);
    if (this.player.inCar) { this.parked.push(this.player.inCar); this.player.inCar = null; }
    this.player.mesh.visible = true;
    this.player.x = this.city.garage.x;
    this.player.z = this.city.garage.z;
    this.player.health = maxHealth(this.upgrades.armor);
    this.player.sync();
    this.police.clearHeat();
    this.state = 'playing';
    this.hud.hideMenus();
    this.hud.callout(kind === 'busted' ? `FINE PAID — $${fine}` : 'PATCHED UP — back on the streets');
  }
  onMissionComplete(m) {
    this.saveGame();
    this.hud.setComplete(m.title, m.reward);
    this.hud.callout(`JOB DONE — ${m.title}  +$${m.reward}`, '#7be495');
    this.state = 'complete';
    this.hud.showMenu('complete');
    this.audio.sfx('mission');
    // Juice: a freeze frame, a shake kick and a gold/green confetti burst.
    this.hitStop = 0.15;
    this.shake = Math.max(this.shake, 0.25);
    this.fx.burst(this.player.x, 2, this.player.z, 0xffd23e, 40, 9, 0.9, 6);
    this.fx.burst(this.player.x, 2, this.player.z, 0x7be495, 24, 7, 0.8, 6);
    this.announce(`Job complete: ${m.title}. $${m.reward} earned.`);
  }
  onMissionFailed() {
    this.failedIndex = this.missions.index;
    this.state = 'failed';
    this.hud.showMenu('failed');
    this.audio.sfx('fail');
    this.announce('Job failed.');
  }
  putPlayerInCar(kind, color, x, z, heading) {
    const car = new Car(this.scene, kind, color, x, z, heading);
    car.engineLevel = this.upgrades.engine;
    car.speed = 0;
    this.player.inCar = car;
    this.player.mesh.visible = false;
    this.player.x = x; this.player.z = z;
    return car;
  }
  teleportPlayer(x, z, heading) {
    this.player.x = x; this.player.z = z;
    this.player.heading = heading;
    this.player.camYaw = heading;
    this.player.sync();
  }
  nearestDriveable(x, z, maxD) {
    let best = this.traffic.nearestCar(x, z, maxD);
    let bestD = best ? dist2d(x, z, best.x, best.z) : maxD;
    for (const c of this.parked) {
      const d = dist2d(x, z, c.x, c.z);
      if (d < bestD) { best = c; bestD = d; }
    }
    if (this.missions.targetCar) {
      const c = this.missions.targetCar;
      const d = dist2d(x, z, c.x, c.z);
      if (d < bestD) { best = c; bestD = d; }
    }
    for (const c of this.police.cars) {
      const d = dist2d(x, z, c.x, c.z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }
  enterCar(car) {
    // Stealing a stranger's car is a crime — unless it is the mission car (also a crime).
    const isPolice = this.police.cars.includes(car);
    if (isPolice) return; // cruisers cannot be stolen
    const i = this.traffic.cars.indexOf(car);
    if (i >= 0) this.traffic.cars.splice(i, 1);
    const j = this.parked.indexOf(car);
    if (j >= 0) this.parked.splice(j, 1);
    this.player.inCar = car;
    car.engineLevel = this.upgrades.engine;
    car.speed = 0;
    this.player.mesh.visible = false;
    this.audio.sfx('door');
    if (!car.stolen) {
      car.stolen = true;
      this.police.addHeat(1, this.time);
      this.hud.callout('CAR STOLEN — HEAT +1');
    }
  }
  exitCar() {
    const car = this.player.inCar;
    if (!car) return;
    car.speed = 0;
    const side = car.heading + Math.PI / 2;
    this.player.x = car.x + Math.sin(side) * 2.6;
    this.player.z = car.z + Math.cos(side) * 2.6;
    this.player.heading = car.heading;
    this.player.camYaw = car.heading;
    this.player.inCar = null;
    this.player.mesh.visible = true;
    this.player.sync();
    this.parked.push(car);
    this.audio.sfx('door');
  }
  punch() {
    const px = this.player.x, pz = this.player.z;
    const fx = Math.sin(this.player.heading), fz = Math.cos(this.player.heading);
    // Rivals first.
    for (const r of this.missions.rivals) {
      if (!r.alive) continue;
      const d = dist2d(px, pz, r.x, r.z);
      const dot = ((r.x - px) * fx + (r.z - pz) * fz) / (d || 1);
      if (d < 2.4 && dot > 0.3) {
        this.missions.damageRival(r, CFG.punchDamage, this);
        this.audio.sfx('punch');
        return;
      }
    }
    const ped = this.peds.nearest(px, pz, 2.4);
    if (ped) {
      ped.alive = false;
      this.scene.remove(ped.mesh);
      this.police.addHeat(1, this.time);
      this.hud.callout('ASSAULT — HEAT +1');
      this.audio.sfx('punch');
    } else this.audio.sfx('punch');
  }
  shoot() {
    // Hitscan from the camera through the centre of the screen.
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0; dir.normalize();
    const ox = this.player.inCar ? this.player.inCar.x : this.player.x;
    const oz = this.player.inCar ? this.player.inCar.z : this.player.z;
    const fx = dir.x, fz = dir.z;
    let best = null, bestD = CFG.pistolRange, bestKind = null;
    const test = (x, z, kind, ref) => {
      const dx = x - ox, dz = z - oz;
      const along = dx * fx + dz * fz;
      if (along < 1 || along > bestD) return;
      const side = Math.abs(dx * -fz + dz * fx);
      if (side < 1.6) { best = ref; bestD = along; bestKind = kind; }
    };
    for (const r of this.missions.rivals) if (r.alive) test(r.x, r.z, 'rival', r);
    for (const p of this.peds.list) if (p.alive) test(p.x, p.z, 'ped', p);
    this.showTracer(ox, oz, ox + fx * bestD, oz + fz * bestD);
    this.audio.sfx('shoot');
    // Muzzle flash: a yellow-white burst at the gun, plus a small kick.
    this.fx.burst(ox + fx * 1.2, 1.4, oz + fz * 1.2, 0xffe9a8, 10, 5, 0.3, 0);
    this.shake = Math.max(this.shake, 0.12);
    this._danger = { x: ox + fx * bestD, z: oz + fz * bestD, r: 30 };
    if (bestKind === 'rival') this.missions.damageRival(best, pistolDamage(this.upgrades.weapon), this);
    else if (bestKind === 'ped') {
      best.alive = false;
      this.scene.remove(best.mesh);
      this.police.addHeat(1, this.time);
      this.hud.callout('CIVILIAN DOWN — HEAT +1');
    }
  }
  showTracer(x1, z1, x2, z2) {
    if (this.tracer) this.scene.remove(this.tracer);
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1, 1.4, z1), new THREE.Vector3(x2, 1.4, z2),
    ]);
    this.tracer = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    this.scene.add(this.tracer);
    setTimeout(() => { if (this.tracer) { this.scene.remove(this.tracer); this.tracer = null; } }, 90);
  }
  step(dt) {
    if (this.frozen) return;
    this.time += dt;
    this.clockMinutes += dt * (60 / 90);
    // Synthetic shot inputs (screenshot staging only).
    for (const c of this._synthetic) this.input.keys.delete(c);
    this._synthetic = [];
    if (this.shotInput) {
      if (this.shotInput.fwd) { this.input.keys.add('KeyW'); this._synthetic.push('KeyW'); }
      if (this.shotInput.steer === -1) { this.input.keys.add('KeyA'); this._synthetic.push('KeyA'); }
      if (this.shotInput.steer === 1) { this.input.keys.add('KeyD'); this._synthetic.push('KeyD'); }
    }
    const input = this.input;
    if (this.state === 'garage') {
      // Garage pauses the world; G or Esc closes it back where it came from.
      if (input.pressed('KeyG') || input.pressed('Escape')) this.closeGarage();
      this.hud.update(this.hudState());
      input.endFrame();
      return;
    }
    if (this.state === 'menu') {
      this.menuOrbit += dt * 0.05;
      const cx = Math.sin(this.menuOrbit) * 130, cz = Math.cos(this.menuOrbit) * 130;
      this.camera.position.set(cx, 55, cz);
      this.camera.lookAt(0, 8, 0);
      this.traffic.update(dt, 0, 0);
      this.peds.update(dt, 0, 0, null, null, 0);
      this.updateSun(0, 0);
      this.hud.update(this.hudState());
      if (input.pressed('KeyG')) this.openGarage('menu');
      input.endFrame();
      return;
    }
    if (this.state !== 'playing') { input.endFrame(); return; }
    // Hit-stop: freeze the world for a beat after a crucial action (mission
    // complete, wanted up, hard collision). The render loop still runs, so
    // the freeze reads as a punchy frame hold, not a stall.
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.fx.update(dt);
      input.endFrame();
      return;
    }
    // Pause / mute / mission keys.
    if (input.pressedAny('KeyP', 'Escape')) {
      this.state = 'paused';
      this.hud.showMenu('pause');
      this.saveGame();
      input.endFrame();
      return;
    }
    if (input.pressed('KeyM')) {
      this.audio.setMuted(!this.audio.muted);
      this.hud.callout(this.audio.muted ? 'SOUND OFF' : 'SOUND ON');
    }
    if (input.pressed('KeyR')) this.toggleWeather();
    // G at the garage marker opens Renner Garage (and eats the press, so it
    // does not also fire the pistol); anywhere else G still shoots.
    const px0 = this.player.inCar ? this.player.inCar.x : this.player.x;
    const pz0 = this.player.inCar ? this.player.inCar.z : this.player.z;
    if (input.pressed('KeyG') && dist2d(px0, pz0, this.city.garage.x, this.city.garage.z) < 14) {
      input.consume('KeyG');
      this.openGarage('playing');
      input.endFrame();
      return;
    }
    if (input.pressed('KeyT') && !this.missions.active && this.missions.index < MISSIONS.length) {
      const d = dist2d(this.player.x, this.player.z, this.city.garage.x, this.city.garage.z);
      if (d < 14) {
        this.missions.start(this.missions.index);
        this.hud.callout(`JOB STARTED — ${MISSIONS[this.missions.index].title}`, '#7be495');
      } else this.hud.callout('GO TO THE GARAGE MARKER TO START THE JOB');
    }
    // Enter / exit car.
    if (input.pressed('KeyE')) {
      if (this.player.inCar) this.exitCar();
      else {
        const car = this.nearestDriveable(this.player.x, this.player.z, 4.5);
        if (car) this.enterCar(car);
      }
    }
    // Player / car update.
    let hitSomething = false;
    if (this.player.inCar) {
      const car = this.player.inCar;
      const others = [...this.traffic.cars, ...this.police.cars, ...this.parked.filter((c) => c !== car)];
      hitSomething = car.drive(input, dt, this.city.colliders, others);
      this.player.x = car.x; this.player.z = car.z;
      this.player.heading = car.heading;
      // Drift smoke: handbrake + speed throws grey puffs off the rear.
      this._driftT -= dt;
      if (input.down('Space') && Math.abs(car.speed) > 10 && this._driftT <= 0) {
        this._driftT = 0.09;
        const bx = car.x - Math.sin(car.heading) * 2.2;
        const bz = car.z - Math.cos(car.heading) * 2.2;
        this.fx.burst(bx, 0.6, bz, 0x9aa0a8, 5, 2.5, 0.7, -1.5);
      }
      // Running over a pedestrian at speed is a crime.
      this._pedHitCooldown -= dt;
      const ped = this.peds.nearest(car.x, car.z, 2.6);
      if (ped && Math.abs(car.speed) > 8 && this._pedHitCooldown <= 0) {
        ped.alive = false;
        this.scene.remove(ped.mesh);
        this._pedHitCooldown = 2;
        this.police.addHeat(1, this.time);
        this.hud.callout('PEDESTRIAN HIT — HEAT +1');
        this.audio.sfx('crash');
        hitSomething = true;
      }
      this.audio.setEngine(Math.abs(car.speed) / CFG.carMaxSpeed, true);
    } else {
      const action = this.player.update(input, dt, this.city.colliders);
      if (action === 'punch') this.punch();
      else if (action === 'shoot') this.shoot();
      this.audio.setEngine(0, false);
    }
    if (hitSomething) {
      // Hard hit: proportional shake, damage sparks, a beat of hit-stop.
      this.shake = Math.max(this.shake, 0.5);
      this.hitStop = Math.max(this.hitStop, 0.05);
      const cx = this.player.inCar.x, cz = this.player.inCar.z;
      this.fx.burst(cx, 1.2, cz, 0xffa63e, 14, 7, 0.5, 12);
      if (this.rng() < 0.5) this.audio.sfx('crash');
    }
    // World updates.
    const px = this.player.inCar ? this.player.inCar.x : this.player.x;
    const pz = this.player.inCar ? this.player.inCar.z : this.player.z;
    this.traffic.update(dt, px, pz);
    this.peds.update(dt, px, pz, this._danger ? this._danger.x : null, this._danger ? this._danger.z : null, this._danger ? this._danger.r : 0);
    this._danger = null;
    const busted = this.police.update(dt, this);
    // Wanted up: a beat of hit-stop + a shake kick when the heat rises.
    if (this.police.wanted > this._lastWanted) {
      this.hitStop = Math.max(this.hitStop, 0.08);
      this.shake = Math.max(this.shake, 0.3);
    }
    this._lastWanted = this.police.wanted;
    this.missions.update(dt, this);
    // Dialogue line.
    this.hud.setDialogue(this.missions.dialogue.length ? this.missions.dialogue[0] : null);
    // Health / busted / wasted.
    if (this.player.health <= 0) {
      this.state = 'wasted';
      this.hud.showMenu('wasted');
      this.audio.sfx('busted');
      this.announce('Wasted.');
    } else if (busted) {
      this.state = 'busted';
      this.hud.showMenu('busted');
      this.audio.sfx('busted');
      this.announce('Busted by the Talvera PD.');
    }
    // Particles + shake decay.
    this.fx.update(dt);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    // Camera + sun follow.
    this.updateCamera(dt);
    this.updateSun(px, pz);
    // Autosave.
    this._saveTimer += dt;
    if (this._saveTimer > 20) { this._saveTimer = 0; this.saveGame(); }
    this.hud.update(this.hudState());
    input.endFrame();
  }
  hudState() {
    const inCar = !!this.player.inCar;
    const px = inCar ? this.player.inCar.x : this.player.x;
    const pz = inCar ? this.player.inCar.z : this.player.z;
    const heading = inCar ? this.player.inCar.heading : this.player.heading;
    const step = this.missions.current;
    let marker = null;
    if (this.missions.markerMesh.visible) marker = { x: this.missions.markerMesh.position.x, z: this.missions.markerMesh.position.z };
    else if (!this.missions.active && this.missions.index < MISSIONS.length) marker = { x: this.city.garage.x, z: this.city.garage.z };
    return {
      cash: this.cash,
      health: this.player.health,
      maxHealth: maxHealth(this.upgrades.armor),
      garageNear: dist2d(px, pz, this.city.garage.x, this.city.garage.z) < 14,
      wanted: this.police.wanted,
      objective: this.missions.objectiveText,
      speed: inCar ? this.player.inCar.speed : 0,
      inCar,
      clockMinutes: this.clockMinutes,
      respect: this.respect,
      time: this.time,
      playerX: px, playerZ: pz, playerHeading: heading,
      marker,
      traffic: this.traffic.cars,
      police: this.police.cars,
      rivals: this.missions.rivals.filter((r) => r.alive),
    };
  }
  updateCamera(dt) {
    const inCar = !!this.player.inCar;
    const px = inCar ? this.player.inCar.x : this.player.x;
    const pz = inCar ? this.player.inCar.z : this.player.z;
    const heading = inCar ? this.player.inCar.heading : this.player.camYaw;
    this.camYawOffset += this.input.mouseDX * 0.0035;
    this.camYawOffset *= Math.max(0, 1 - dt * 1.4);
    const yaw = heading + this.camYawOffset;
    const dist = inCar ? 11.5 : 7.5;
    const height = inCar ? 4.6 : 3.4;
    const tx = px - Math.sin(yaw) * dist;
    const tz = pz - Math.cos(yaw) * dist;
    const k = Math.min(1, dt * (inCar ? 5 : 8));
    this.camera.position.x += (tx - this.camera.position.x) * k;
    this.camera.position.y += (height - this.camera.position.y) * k;
    this.camera.position.z += (tz - this.camera.position.z) * k;
    this.camera.lookAt(px + Math.sin(yaw) * 6, inCar ? 1.6 : 1.4, pz + Math.cos(yaw) * 6);
  }
  updateSun(px, pz) {
    const sun = this.city.sun;
    sun.position.set(px + 220, 150, pz + 140);
    sun.target.position.set(px, 0, pz);
    sun.target.updateMatrixWorld();
    // River shimmer: the teal water breathes between two close tones.
    if (this.city.water) {
      const s = 0.5 + 0.5 * Math.sin(this.time * 0.8);
      this.city.water.material.color.setHex(s > 0.5 ? 0x3a9aa8 : 0x2e7f8f);
    }
    // Hurricane lightning: a distant flash every 8–16 seconds, gone in a blink.
    // Only while the storm is on (KeyR clears the sky).
    this.nextFlash -= 1 / 60;
    if (this.weather.storm && this.nextFlash <= 0) { this.flashT = 0.28; this.nextFlash = 8 + this.rng() * 8; }
    if (this.flashT > 0) {
      this.flashT -= 1 / 60;
      this.flash.intensity = Math.max(0, this.flashT) * 22;
    } else this.flash.intensity = 0;
  }
  render() {
    // Screen shake: a decaying random offset on the camera, proportional to
    // the last hard hit. Applied for the render only, then restored so the
    // camera never drifts.
    let sx = 0, sy = 0, sz = 0;
    if (this.shake > 0.001) {
      const s = this.shake;
      sx = (this.rng() - 0.5) * s;
      sy = (this.rng() - 0.5) * s * 0.6;
      sz = (this.rng() - 0.5) * s;
      this.camera.position.x += sx;
      this.camera.position.y += sy;
      this.camera.position.z += sz;
    }
    this.renderer.render(this.scene, this.camera);
    this.camera.position.x -= sx;
    this.camera.position.y -= sy;
    this.camera.position.z -= sz;
  }
  run() {
    let last = performance.now();
    let acc = 0;
    const frame = (now) => {
      requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, MAX_FRAME);
      last = now;
      if (!this.frozen) {
        acc += dt;
        while (acc >= 1 / 60) { this.step(1 / 60); acc -= 1 / 60; }
      }
      this.render();
    };
    requestAnimationFrame(frame);
  }
}

const game = new Game();
if (shotName) stageShot(shotName, game);
else {
  game.hud.showMenu('start');
  game.run();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') {
      game.state = 'paused';
      game.hud.showMenu('pause');
      game.saveGame();
    }
  });
}
