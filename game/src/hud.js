// hud.js — PROJECT VICE. AAA-style HUD: circular GPS radar minimap, 5 wanted stars,
// health & armor bars, cash, weapon + ammo, weather/hurricane timer, digital
// speedometer ring, gear + nitro gauge, district banner, mission tracker, radio,
// MARISOL PD dispatch list, named-character dialogue box with a procedural canvas
// portrait, full 7-slot weapon wheel, car condition % and RESPECT rank bar.
import { WEAPONS } from './player.js';

function el(id) { return document.getElementById(id); }

// Procedural portrait of MIRA the fixer — drawn on canvas, no external image.
export function drawPortrait(canvas, seedName) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#3a1e5e'); grad.addColorStop(1, '#120a24');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  // neon rim
  g.strokeStyle = '#ff4fd8'; g.lineWidth = 4;
  g.strokeRect(2, 2, w - 4, h - 4);
  // shoulders / jacket
  g.fillStyle = '#1a2a3a';
  g.beginPath(); g.moveTo(8, h); g.quadraticCurveTo(w / 2, h * 0.52, w - 8, h); g.closePath(); g.fill();
  g.fillStyle = '#ff2a55';
  g.beginPath(); g.moveTo(w / 2 - 26, h); g.lineTo(w / 2, h * 0.66); g.lineTo(w / 2 + 26, h); g.closePath(); g.fill();
  // head
  g.fillStyle = '#c98a5e';
  g.beginPath(); g.ellipse(w / 2, h * 0.42, 26, 30, 0, 0, 7); g.fill();
  // hair — dark bob with pink neon streak
  g.fillStyle = '#14101e';
  g.beginPath(); g.ellipse(w / 2, h * 0.34, 30, 24, 0, Math.PI, 0); g.fill();
  g.fillRect(w / 2 - 30, h * 0.3, 10, 44);
  g.fillRect(w / 2 + 20, h * 0.3, 10, 44);
  g.fillStyle = '#ff4fd8';
  g.fillRect(w / 2 + 20, h * 0.3, 4, 44);
  // eyes + shades
  g.fillStyle = '#0a0a12';
  g.fillRect(w / 2 - 20, h * 0.4, 16, 7);
  g.fillRect(w / 2 + 4, h * 0.4, 16, 7);
  g.fillStyle = '#37e6ff';
  g.fillRect(w / 2 - 18, h * 0.4, 12, 2);
  g.fillRect(w / 2 + 6, h * 0.4, 12, 2);
  // lips
  g.fillStyle = '#ff2a55';
  g.beginPath(); g.ellipse(w / 2, h * 0.56, 9, 4, 0, 0, 7); g.fill();
  // name tag (short name only — the 64px canvas clips long text)
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(0, h - 18, w, 18);
  g.fillStyle = '#ffcf3d';
  g.font = 'bold 10px Arial';
  g.textAlign = 'center';
  g.fillText((seedName || 'MIRA').slice(0, 8), w / 2, h - 5);
}

export function createHud() {
  const hud = { minimapCtx: el('minimap').getContext('2d') };
  drawPortrait(el('portrait'), 'MIRA');

  hud.setStars = function (n) {
    const s = el('stars');
    s.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
    s.classList.toggle('hot', n >= 3);
  };

  hud.setHealth = function (hp, armor) {
    el('hp-fill').style.width = hp + '%';
    el('armor-fill').style.width = armor + '%';
    el('hp-num').textContent = Math.round(hp);
  };

  hud.setCash = function (cash) { el('cash').textContent = '$' + Math.round(cash).toLocaleString('en-US'); };

  hud.setWeapon = function (idx) {
    const w = WEAPONS[idx];
    el('weapon-name').textContent = w.name;
    el('weapon-ammo').textContent = w.ammo === Infinity ? '∞' : w.ammo;
    const wheel = el('weapon-wheel');
    const slots = wheel.querySelectorAll('.wslot');
    slots.forEach((slot, i) => {
      slot.classList.toggle('active', i === idx);
      slot.classList.toggle('locked', WEAPONS[i].id === 'rpg');
    });
  };

  hud.setSpeed = function (mph, gear, nitro) {
    el('speed-num').textContent = Math.round(mph);
    el('gear').textContent = 'GEAR ' + gear;
    el('nitro-fill').style.width = nitro + '%';
    el('speed-ring').style.setProperty('--p', Math.min(100, (mph / 180) * 100));
  };

  hud.setDistrict = function (name, alert) {
    el('district').textContent = name;
    el('district-alert').textContent = alert || '';
  };

  hud.setMission = function (text, timeLeft) {
    el('mission-text').textContent = text;
    el('mission-timer').textContent = timeLeft != null ? Math.ceil(timeLeft) + 's' : '';
  };

  hud.setWeather = function (label, timerText) {
    el('weather-label').textContent = label;
    el('weather-timer').textContent = timerText || '';
  };

  hud.setRadio = function (on) {
    el('radio').textContent = on ? '♪ VIBE 104.5 FM' : '♪ RADIO OFF';
    el('radio').classList.toggle('off', !on);
  };

  hud.setCondition = function (pct) {
    el('condition').textContent = Math.round(pct) + '%';
    el('condition-fill').style.width = pct + '%';
  };

  hud.setRespect = function (level, title, pct) {
    el('respect-label').textContent = 'RESPECT LV ' + level + ' · ' + title;
    el('respect-fill').style.width = pct + '%';
  };

  hud.setDispatch = function (units) {
    const list = el('dispatch-list');
    list.innerHTML = units.map((u) =>
      `<div class="dispatch-row"><span class="d-call">${u.call}</span><span class="d-role">${u.role}</span><span class="d-dist">${u.dist}m</span><span class="d-tactic">${u.tactic}</span></div>`
    ).join('');
  };

  hud.setDialogue = function (name, line) {
    el('dlg-name').textContent = name;
    el('dlg-line').textContent = line;
    // redraw the portrait name tag for the current speaker
    drawPortrait(el('portrait'), name.split('—')[0].trim().toUpperCase());
    el('dialogue').classList.remove('hidden');
  };

  hud.hideDialogue = function () { el('dialogue').classList.add('hidden'); };

  hud.flash = function (text, cls) {
    const f = el('flash');
    f.textContent = text;
    f.className = 'show ' + (cls || '');
    clearTimeout(hud._flashT);
    hud._flashT = setTimeout(() => { f.className = ''; }, 2200);
  };

  hud.setGarage = function (open) {
    el('garage-panel').classList.toggle('hidden', !open);
  };

  hud.setPause = function (open) {
    el('pause-panel').classList.toggle('hidden', !open);
  };

  hud.setHint = function (visible) {
    el('hint').classList.toggle('hidden', !visible);
  };

  // ---- minimap: circular GPS radar ----
  hud.drawMinimap = function (playerPos, heading, policePos, missionPos, garagePos, heliPos) {
    const c = hud.minimapCtx;
    const S = 168, R = S / 2;
    c.clearRect(0, 0, S, S);
    // radar disc
    c.save();
    c.beginPath(); c.arc(R, R, R - 2, 0, 7); c.clip();
    c.fillStyle = 'rgba(8,14,24,0.92)';
    c.fillRect(0, 0, S, S);
    // ocean west
    c.fillStyle = '#14406a';
    c.fillRect(0, 0, 26, S);
    // roads: boulevard + cross streets
    const toMap = (x, z) => [R + x * 0.32, R + (z - playerPos.z) * 0.32];
    c.strokeStyle = '#3a4556'; c.lineWidth = 10;
    c.beginPath(); c.moveTo(R, -20); c.lineTo(R, S + 20); c.stroke();
    c.strokeStyle = '#2c3547'; c.lineWidth = 6;
    for (let dz = -140; dz <= 140; dz += 46) {
      const [, y] = toMap(0, playerPos.z + dz);
      c.beginPath(); c.moveTo(0, y); c.lineTo(S, y); c.stroke();
    }
    c.strokeStyle = '#e8b820'; c.lineWidth = 1.5;
    c.setLineDash([8, 8]);
    c.beginPath(); c.moveTo(R, -20); c.lineTo(R, S + 20); c.stroke();
    c.setLineDash([]);
    // bridge
    c.strokeStyle = '#ff5a3c'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(R - 50, 8); c.lineTo(R + 50, 8); c.stroke();
    // garage icon
    if (garagePos) {
      const [gx, gy] = toMap(garagePos.x, garagePos.z);
      c.fillStyle = '#37e6ff';
      c.font = 'bold 13px Arial'; c.textAlign = 'center';
      c.fillText('⌂', gx, gy + 4);
    }
    // mission beacon
    if (missionPos) {
      const [mx, my] = toMap(missionPos.x, missionPos.z);
      c.fillStyle = '#ffcf3d';
      c.beginPath(); c.arc(mx, my, 6, 0, 7); c.fill();
      c.strokeStyle = '#ffcf3d'; c.lineWidth = 2;
      c.beginPath(); c.arc(mx, my, 10 + Math.sin(performance.now() / 200) * 3, 0, 7); c.stroke();
    }
    // police cones (red/blue)
    for (const pp of policePos) {
      const [px, py] = toMap(pp.x, pp.z);
      c.fillStyle = '#ff2020';
      c.beginPath(); c.moveTo(px, py - 7); c.lineTo(px - 5, py + 5); c.lineTo(px + 5, py + 5); c.closePath(); c.fill();
      c.fillStyle = '#2040ff';
      c.beginPath(); c.arc(px, py, 2.5, 0, 7); c.fill();
    }
    // heli
    if (heliPos) {
      const [hx, hy] = toMap(heliPos.x, heliPos.z);
      c.fillStyle = '#ffffff';
      c.font = 'bold 12px Arial';
      c.fillText('✈', hx, hy + 4);
    }
    // player arrow (centre)
    c.save();
    c.translate(R, R);
    c.rotate(-heading + Math.PI);
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#ff2a55'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -11); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath();
    c.fill(); c.stroke();
    c.restore();
    c.restore();
    // radar ring + label (drawn AFTER the clip restore so nothing is cut off)
    c.strokeStyle = 'rgba(55,230,255,0.9)'; c.lineWidth = 2.5;
    c.beginPath(); c.arc(R, R, R - 2, 0, 7); c.stroke();
    c.fillStyle = 'rgba(6,10,18,0.85)';
    c.fillRect(R - 44, S - 26, 88, 12);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.font = 'bold 8px Arial'; c.textAlign = 'center';
    c.fillText('OCEAN DRIVE', R, S - 17);
  };

  return hud;
}
