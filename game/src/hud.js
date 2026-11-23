// The HUD: minimap radar, wanted stars, health/armor, cash, car condition,
// respect bar, dispatch list, dialogue box with drawn portrait, weapon wheel,
// speedometer + nitro, district banner, mission tracker, toasts, garage panel.
import { portraitTexture } from './textures.js';
import { GARAGE_CARS, NEONS, PAINTS } from './missions.js';

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', ammo: '∞', key: 'FISTS' },
  { id: 'bat', name: 'BAT', ammo: '∞', key: 'BAT' },
  { id: 'pistol', name: 'PISTOL', ammo: '∞', key: 'PISTOL' },
  { id: 'smg', name: 'SMG', ammo: '120', key: 'SMG' },
  { id: 'shotgun', name: 'SHOTGUN', ammo: '24', key: 'SHOTGUN' },
  { id: 'rifle', name: 'RIFLE', ammo: '0', key: 'RIFLE', locked: true, lockNote: 'LV 6' },
  { id: 'rpg', name: 'RPG', ammo: '0', key: 'RPG', locked: true, lockNote: 'LV 8' },
];

const $ = (id) => document.getElementById(id);

export function createHud(game) {
  const hud = {
    weaponIndex: 2, // pistol
    toastTimer: 0,
    mapCtx: $('minimap').getContext('2d'),
    speedCtx: $('speedoCanvas').getContext('2d'),
    wheelEl: $('wheel'),
    dispatchEl: $('dispatchList'),
  };

  // weapon wheel
  hud.wheelEl.innerHTML = '';
  hud.slots = WEAPONS.map((w, i) => {
    const d = document.createElement('div');
    d.className = 'slot' + (w.locked ? ' locked' : '') + (i === hud.weaponIndex ? ' sel' : '');
    d.innerHTML = `<div class="ico">${w.locked ? '🔒' : '✦'}</div><div class="nm">${w.name}</div><div class="am">${w.locked ? w.lockNote : w.ammo}</div>`;
    hud.wheelEl.appendChild(d);
    return d;
  });

  // dialogue portrait (drawn, procedural)
  const pc = $('portrait').getContext('2d');
  const ptex = portraitTexture('mira');
  pc.drawImage(ptex.image, 0, 0, 128, 128);

  // garage panel buttons
  const paintRow = $('paintRow');
  PAINTS.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (i === game.save.paint ? ' sel' : '');
    b.style.background = '#' + p.color.toString(16).padStart(6, '0');
    b.title = p.name;
    b.addEventListener('click', () => game.onGaragePaint(i));
    paintRow.appendChild(b);
  });
  const neonRow = $('neonRow');
  NEONS.forEach((n, i) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (i === game.save.neon ? ' sel' : '');
    b.style.background = '#' + n.toString(16).padStart(6, '0');
    b.addEventListener('click', () => game.onGarageNeon(i));
    neonRow.appendChild(b);
  });
  const carRow = $('carRow');
  GARAGE_CARS.forEach((c, i) => {
    const b = document.createElement('button');
    b.textContent = c.name + (game.save.owned.includes(i) ? '' : ' — $1,800');
    b.className = i === game.save.carIndex ? '' : 'ghost';
    b.addEventListener('click', () => game.onGarageCar(i));
    carRow.appendChild(b);
  });
  $('repairBtn').addEventListener('click', () => game.onGarageRepair());
  $('garageClose').addEventListener('click', () => game.closeGarage());
  $('helpClose').addEventListener('click', () => game.closeHelp());

  hud.toast = function toast(title, sub = '') {
    const el = $('toast');
    el.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    el.style.display = 'block';
    hud.toastTimer = 2.6;
  };

  hud.say = function say(who, line, kind = 'mira') {
    document.querySelector('#dialogue .who').textContent = who;
    $('dialogueLine').textContent = line;
    const tex = portraitTexture(kind);
    pc.clearRect(0, 0, 128, 128);
    pc.drawImage(tex.image, 0, 0, 128, 128);
    $('dialogue').style.display = 'flex';
  };

  hud.setWeapon = function setWeapon(i) {
    hud.weaponIndex = i;
    hud.slots.forEach((s, j) => s.classList.toggle('sel', j === i));
  };

  hud.showGarage = function showGarage(open) {
    $('garage').classList.toggle('open', open);
  };
  hud.showHelp = function showHelp(open) {
    $('help').classList.toggle('open', open);
  };

  hud.fadeBadge = function fadeBadge() {
    $('badge').style.opacity = '0';
  };
  hud.hideBadge = function hideBadge() {
    $('badge').style.display = 'none';
  };

  return hud;
}

function drawMinimap(hud, game) {
  const ctx = hud.mapCtx;
  const S = 376, C = S / 2;
  ctx.clearRect(0, 0, S, S);
  // ocean west
  ctx.fillStyle = '#0a2a4a';
  ctx.fillRect(0, 0, 58, S);
  ctx.fillStyle = '#0c1a2e';
  ctx.fillRect(58, 0, S - 58, S);
  const px = (x) => 58 + ((x + 14) / 154) * (S - 58 - 8);
  const pz = (z) => 8 + ((z + 300) / 600) * (S - 16);
  // roads
  ctx.strokeStyle = '#3d4458'; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px(0), pz(-290)); ctx.lineTo(px(0), pz(290)); ctx.stroke();
  ctx.lineWidth = 7;
  for (const z of [-180, -90, 0, 90, 180]) {
    ctx.beginPath(); ctx.moveTo(px(-12), pz(z)); ctx.lineTo(px(138), pz(z)); ctx.stroke();
  }
  // bridge
  ctx.strokeStyle = '#9d4edd'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(px(-60), pz(-292)); ctx.lineTo(px(40), pz(-292)); ctx.stroke();
  // marina
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(px(-38) - 3, pz(250) - 3, 6, 6);
  // garage
  ctx.fillStyle = '#00e5ff';
  ctx.fillRect(px(30) - 5, pz(150) - 5, 10, 10);
  ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2;
  ctx.strokeRect(px(30) - 5, pz(150) - 5, 10, 10);
  // mission beacon
  if (game.missions.active) {
    const t = game.missions.active.mission.checkpoints[game.missions.active.cp];
    const bx = px(t.x), by = pz(t.z);
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(bx, by, 14, 0, Math.PI * 2); ctx.stroke();
  }
  // police (red cones)
  ctx.fillStyle = '#ff2d55';
  for (const c of game.police.cruisers) {
    ctx.beginPath(); ctx.arc(px(c.mesh.position.x), pz(c.mesh.position.z), 5, 0, Math.PI * 2); ctx.fill();
  }
  if (game.police.heliActive) {
    ctx.fillStyle = '#c77dff';
    ctx.beginPath(); ctx.arc(px(game.player.pos.x + 14), pz(game.player.pos.z - 10), 6, 0, Math.PI * 2); ctx.fill();
  }
  // traffic (white dots)
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const t of game.traffic) {
    ctx.fillRect(px(t.mesh.position.x) - 2, pz(t.mesh.position.z) - 2, 4, 4);
  }
  // player arrow
  const pxp = px(game.player.pos.x), pzp = pz(game.player.pos.z);
  ctx.save();
  ctx.translate(pxp, pzp);
  ctx.rotate(game.player.heading);
  ctx.fillStyle = '#ffe14d';
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  // north tick
  ctx.fillStyle = '#7df9ff'; ctx.font = 'bold 20px Arial';
  ctx.fillText('N', C - 7, 24);
}

function drawSpeedo(hud, game) {
  const ctx = hud.speedCtx;
  const S = 256, C = S / 2;
  ctx.clearRect(0, 0, S, S);
  ctx.lineWidth = 14;
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.arc(C, C, 104, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
  const mph = Math.abs(game.player.speedMph);
  const frac = Math.min(1, mph / 180);
  const grad = ctx.createLinearGradient(0, S, S, 0);
  grad.addColorStop(0, '#00e5ff'); grad.addColorStop(0.6, '#ff2fb3'); grad.addColorStop(1, '#ff2020');
  ctx.strokeStyle = grad;
  ctx.beginPath(); ctx.arc(C, C, 104, Math.PI * 0.75, Math.PI * 0.75 + frac * Math.PI * 1.5); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center';
  for (let i = 0; i <= 6; i += 1) {
    const a = Math.PI * 0.75 + (i / 6) * Math.PI * 1.5;
    const x = C + Math.cos(a) * 82, y = C + Math.sin(a) * 82;
    ctx.fillText(String(i * 30), x, y + 5);
  }
  // needle
  const na = Math.PI * 0.75 + frac * Math.PI * 1.5;
  ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(C, C);
  ctx.lineTo(C + Math.cos(na) * 88, C + Math.sin(na) * 88); ctx.stroke();
}

export function updateHud(hud, game, dt) {
  if (hud.toastTimer > 0) {
    hud.toastTimer -= dt;
    if (hud.toastTimer <= 0) $('toast').style.display = 'none';
  }
  const p = game.player, s = game.save;
  // stars
  const starsEl = $('stars');
  starsEl.textContent = '★'.repeat(game.police.stars) + '☆'.repeat(5 - game.police.stars);
  starsEl.classList.toggle('hot', game.police.stars >= 3);
  $('healthBar').style.width = `${Math.round(p.health)}%`;
  $('armorBar').style.width = `${Math.round(p.armor)}%`;
  $('cashLine').textContent = `$ ${s.cash.toLocaleString('en-US')}`;
  const w = WEAPONS[hud.weaponIndex];
  $('condLine').textContent = `CONDITION ${Math.round(p.condition)}%  •  WEAPON: ${w.name} ${w.locked ? '🔒' : w.ammo}`;
  $('respectBar').style.width = `${s.respect}%`;
  document.querySelector('#respectWrap').firstChild.textContent =
    `RESPECT LV ${s.respectLevel} · ${['ROOKIE', 'HUSTLER', 'STREET KING', 'FIXER', 'VICE LEGEND'][Math.min(4, s.respectLevel - 1)]}`;
  $('nitroFill').style.width = `${Math.round(p.nitro * 100)}%`;
  $('mph').textContent = String(Math.round(Math.abs(p.speedMph)));
  $('gear').textContent = `MPH · ${p.gear}`;
  // district + weather
  const d = $('district');
  const storm = game.city.weather === 'storm';
  d.textContent = `${game.district} — ${storm ? 'HURRICANE WARNING' : 'GOLDEN SUNSET'}`;
  d.classList.toggle('warn', storm);
  // mission tracker
  const obj = game.missionObjective();
  $('missionTitle').textContent = obj.title;
  $('missionText').textContent = obj.text;
  $('radio').textContent = game.audio.radioOn
    ? '♪ VIBE 104.5 FM — SYNTHWAVE [R]' : '♪ RADIO OFF — PRESS R';
  // dispatch list
  const list = game.dispatchList();
  hud.dispatchEl.innerHTML = list.map((u) =>
    `<li><b>${u.name}</b> · ${u.callsign} — ${u.role}<br>` +
    `<span class="tactic">${u.tactic}</span> · ${u.dist > 0 ? u.dist + 'm' : '—'}</li>`).join('');
  drawMinimap(hud, game);
  drawSpeedo(hud, game);
}
