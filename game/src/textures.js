// Procedural canvas textures: every surface in the city is painted in code — no
// image files, no network. Each maker returns a THREE.CanvasTexture.
import * as THREE from 'three';
import { pick, range } from './rng.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Lit windows for tower facades: dark glass with warm/cool lit cells and floor bands.
export function windowsTexture(random, base = '#1b2340', lit = ['#ffd27d', '#9be8ff', '#ff9de2']) {
  const [c, g] = canvas(256, 512);
  g.fillStyle = base; g.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const on = random() < 0.42;
      g.fillStyle = on ? pick(random, lit) : '#0a0f22';
      g.globalAlpha = on ? range(random, 0.55, 1) : 1;
      g.fillRect(8 + x * 30, 8 + y * 15, 22, 10);
    }
  }
  g.globalAlpha = 1;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 0; y < 512; y += 64) g.fillRect(0, y, 256, 3);
  return toTexture(c);
}

// A glowing neon sign: bold letters with a coloured halo, on a transparent plate
// that sits proud of a facade. Text is drawn, never loaded.
export function neonSignTexture(text, color = '#ff2fb3', sub = '') {
  const [c, g] = canvas(512, 160);
  g.clearRect(0, 0, 512, 160);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 62px Arial Black, Arial, sans-serif';
  g.shadowColor = color; g.shadowBlur = 26;
  g.fillStyle = color;
  g.fillText(text, 256, sub ? 62 : 80);
  g.shadowBlur = 8; g.fillStyle = '#ffffff';
  g.fillText(text, 256, sub ? 62 : 80);
  if (sub) {
    g.font = '900 30px Arial, sans-serif';
    g.shadowBlur = 14; g.fillStyle = '#7df9ff';
    g.fillText(sub, 256, 124);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Wet asphalt: near-black with lane dashes, centre lines and faint neon streaks
// reflected along the driving line.
export function roadTexture(random) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#14141c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i += 1) {
    g.fillStyle = `rgba(255,255,255,${range(random, 0.02, 0.08)})`;
    g.fillRect(random() * 256, random() * 256, 2, 2);
  }
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let y = 0; y < 256; y += 64) g.fillRect(124, y + 8, 8, 34); // centre dashes
  g.fillStyle = 'rgba(255,210,80,0.9)';
  g.fillRect(6, 0, 4, 256); g.fillRect(246, 0, 4, 256); // edge lines
  g.fillStyle = 'rgba(255,47,179,0.20)'; g.fillRect(60, 0, 26, 256); // neon wash
  g.fillStyle = 'rgba(0,229,255,0.16)'; g.fillRect(170, 0, 26, 256);
  return toTexture(c, 1, 8);
}

export function sidewalkTexture(random) {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#3a3f4d'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3;
  for (let i = 0; i <= 128; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke();
  }
  for (let i = 0; i < 200; i += 1) {
    g.fillStyle = `rgba(0,0,0,${range(random, 0.04, 0.12)})`;
    g.fillRect(random() * 128, random() * 128, 3, 3);
  }
  return toTexture(c, 6, 6);
}

// Big billboard art: gradient sky, sun disc and a tagline, painted per board.
export function billboardTexture(random, lines, hue = 300) {
  const [c, g] = canvas(512, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, `hsl(${hue},90%,55%)`);
  grad.addColorStop(0.55, `hsl(${(hue + 40) % 360},95%,45%)`);
  grad.addColorStop(1, '#12041f');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#ffe14d';
  g.beginPath(); g.arc(386, 74, 44, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 5; i += 1) g.fillRect(40 + random() * 380, 150 + random() * 70, 60, 5);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 44px Arial Black, Arial, sans-serif';
  g.shadowColor = '#ff00a8'; g.shadowBlur = 18; g.fillStyle = '#fff';
  g.fillText(lines[0], 256, 84);
  if (lines[1]) {
    g.font = '900 26px Arial, sans-serif'; g.shadowColor = '#00e5ff';
    g.fillText(lines[1], 256, 132);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Drawn portrait for the dialogue box: a stylised fixer with neon rim light.
// Pure canvas shapes — no photo, no external image.
export function portraitTexture(kind = 'mira') {
  const [c, g] = canvas(128, 128);
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#2b0a4d'); grad.addColorStop(1, '#0a0420');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  // neon halo
  g.strokeStyle = kind === 'mira' ? '#ff2fb3' : '#00e5ff';
  g.lineWidth = 5; g.shadowColor = g.strokeStyle; g.shadowBlur = 14;
  g.beginPath(); g.arc(64, 64, 46, 0, Math.PI * 2); g.stroke();
  g.shadowBlur = 0;
  // shoulders / jacket
  g.fillStyle = kind === 'mira' ? '#3d0a5e' : '#0a3d4d';
  g.beginPath(); g.moveTo(14, 128); g.quadraticCurveTo(64, 84, 114, 128); g.closePath(); g.fill();
  // face
  g.fillStyle = '#e8b98d';
  g.beginPath(); g.ellipse(64, 62, 24, 30, 0, 0, Math.PI * 2); g.fill();
  // hair
  g.fillStyle = kind === 'mira' ? '#1a0530' : '#20242e';
  g.beginPath(); g.ellipse(64, 44, 27, 20, 0, Math.PI, 0); g.fill();
  if (kind === 'mira') {
    g.fillRect(36, 40, 10, 44); g.fillRect(82, 40, 10, 44); // long dark hair
    g.fillStyle = '#ff2fb3'; g.fillRect(38, 40, 4, 40); g.fillRect(86, 40, 4, 40); // pink streaks
  }
  // shades
  g.fillStyle = '#0a0a12';
  g.fillRect(42, 56, 20, 10); g.fillRect(66, 56, 20, 10);
  g.fillRect(60, 59, 8, 3);
  // smile / jaw line
  g.strokeStyle = '#8a5a3b'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(56, 82); g.quadraticCurveTo(64, 87, 72, 82); g.stroke();
  // earring / chain
  g.fillStyle = '#ffe14d';
  g.beginPath(); g.arc(40, 74, 3, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
