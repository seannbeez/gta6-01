// HUD, minimap, menus, callouts and dialogue — authored in this recorded session.
// All HUD chrome is DOM over the WebGL canvas; the minimap is a 2D canvas.
import { CFG } from './config.js';
import { clamp } from './util.js';

export class HUD {
  constructor(city) {
    this.city = city;
    this.el = (id) => document.getElementById(id);
    this.map = this.el('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.mapStatic = document.createElement('canvas');
    this.mapStatic.width = 190; this.mapStatic.height = 190;
    this.prerenderMap();
    this.calloutTimer = null;
    this.dialogueEl = this.el('dialogue');
  }
  prerenderMap() {
    const c = this.mapStatic.getContext('2d');
    const S = 190 / 780; // world -300..480 -> 0..190 (x), -300..480 (z)
    const X = (x) => (x + 300) * S;
    const Z = (z) => (z + 300) * S;
    c.fillStyle = '#c9b18a';
    c.fillRect(0, 0, 190, 190);
    // River.
    c.fillStyle = '#2e7f8f';
    c.fillRect(0, Z(CFG.riverNear), 190, (CFG.riverFar - CFG.riverNear) * S);
    // Roads.
    c.fillStyle = '#3d3a38';
    for (let i = -240; i <= 240; i += 60) {
      c.fillRect(X(i) - 1.7, Z(-280), 3.4, 560 * S);
      c.fillRect(X(-280), Z(i) - 1.7, 560 * S, 3.4);
    }
    c.fillRect(X(-120) - 1.7, Z(280), 3.4, (CFG.southBankFar - 280) * S);
    c.fillRect(X(120) - 1.7, Z(280), 3.4, (CFG.southBankFar - 280) * S);
    c.fillRect(X(-280), Z(410) - 1.7, 560 * S, 3.4);
    // Buildings.
    c.fillStyle = '#8a6f4d';
    for (const b of this.city.buildings) {
      c.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), Math.max(1, b.w * S), Math.max(1, b.d * S));
    }
    // Garage.
    c.fillStyle = '#2ec4b6';
    c.fillRect(X(-90) - 3, Z(-66) - 3, 6, 6);
  }
  update(state) {
    // Wanted stars.
    const stars = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    const wEl = this.el('wanted');
    wEl.textContent = stars;
    wEl.className = 'wanted' + (state.wanted >= 3 ? ' hot' : '');
    this.el('cash').textContent = `$${state.cash.toLocaleString('en-US')}`;
    this.el('respect').textContent = `RESPECT ${state.respect}`;
    this.el('health-fill').style.width = `${clamp(state.health, 0, 100)}%`;
    this.el('health-fill').style.background = state.health > 50 ? '#3aa655' : state.health > 25 ? '#e0a92e' : '#c23b2e';
    const hh = String(Math.floor(state.clockMinutes / 60) % 24).padStart(2, '0');
    const mm = String(Math.floor(state.clockMinutes % 60)).padStart(2, '0');
    this.el('clock').textContent = `${hh}:${mm}`;
    this.el('objective').textContent = state.objective;
    this.el('speedo').textContent = state.inCar ? `${Math.round(Math.abs(state.speed) * 2.4)} km/h` : '';
    this.el('hint').textContent = state.inCar
      ? 'WASD drive · Space handbrake · E exit car · P pause · M mute'
      : 'WASD move · Shift sprint · E enter car · F punch · Click shoot · T start job · P pause · M mute';
    this.drawMinimap(state);
  }
  drawMinimap(state) {
    const c = this.mapCtx;
    const S = 190 / 780;
    const X = (x) => (x + 300) * S;
    const Z = (z) => (z + 300) * S;
    c.clearRect(0, 0, 190, 190);
    c.drawImage(this.mapStatic, 0, 0);
    const dot = (x, z, color, r = 3) => {
      c.fillStyle = color;
      c.beginPath(); c.arc(X(x), Z(z), r, 0, Math.PI * 2); c.fill();
    };
    if (state.marker) {
      const pulse = 4 + Math.sin(state.time * 4) * 1.5;
      c.strokeStyle = '#ffd23e'; c.lineWidth = 2;
      c.beginPath(); c.arc(X(state.marker.x), Z(state.marker.z), pulse + 3, 0, Math.PI * 2); c.stroke();
      dot(state.marker.x, state.marker.z, '#ffd23e', 3);
    }
    for (const t of state.traffic) dot(t.x, t.z, '#e8e4da', 2);
    for (const p of state.police) dot(p.x, p.z, '#2e6fd8', 3);
    for (const r of state.rivals || []) dot(r.x, r.z, '#c23b2e', 3);
    // Player arrow.
    const px = X(state.playerX), pz = Z(state.playerZ);
    c.save();
    c.translate(px, pz);
    c.rotate(-state.playerHeading + Math.PI);
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#222';
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(-5, 6); c.closePath();
    c.fill(); c.stroke();
    c.restore();
  }
  callout(text, color = '#ffd23e') {
    const el = this.el('callout');
    el.textContent = text;
    el.style.color = color;
    el.classList.remove('show');
    void el.offsetWidth; // restart the animation
    el.classList.add('show');
    if (this.calloutTimer) clearTimeout(this.calloutTimer);
    this.calloutTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  setDialogue(text) {
    if (!text) { this.dialogueEl.classList.remove('show'); return; }
    this.dialogueEl.textContent = text;
    this.dialogueEl.classList.add('show');
  }
  showMenu(name) {
    for (const m of ['start', 'pause', 'busted', 'wasted', 'complete', 'failed']) {
      const el = this.el(`menu-${m}`);
      if (el) el.classList.toggle('show', m === name);
    }
    this.el('hud').classList.toggle('dim', name !== null);
  }
  hideMenus() { this.showMenu(null); }
  setComplete(title, reward) {
    this.el('complete-title').textContent = `JOB DONE — ${title}`;
    this.el('complete-reward').textContent = `+$${reward.toLocaleString('en-US')}`;
  }
}
