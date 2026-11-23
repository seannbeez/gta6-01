// Procedural Web Audio: engine, sirens, rain, thunder, gunfire and a synthwave
// radio loop — all synthesised, zero audio files.
export function createAudio() {
  const a = {
    ctx: null, muted: false, radioOn: true, radioTimer: null, nextNote: 0,
    engineOsc: null, engineGain: null, windGain: null, sirenOsc: null, sirenGain: null,
    rainGain: null, master: null,
  };

  function noiseBuffer(ctx, seconds = 2) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  a.init = function init() {
    if (a.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    a.ctx = ctx;
    a.master = ctx.createGain();
    a.master.gain.value = 0.5;
    a.master.connect(ctx.destination);
    // engine: sawtooth + lowpass, pitch follows speed
    a.engineOsc = ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineOsc.frequency.value = 60;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass'; engineFilter.frequency.value = 500;
    a.engineGain = ctx.createGain(); a.engineGain.gain.value = 0.0;
    a.engineOsc.connect(engineFilter); engineFilter.connect(a.engineGain); a.engineGain.connect(a.master);
    a.engineOsc.start();
    // rain: looped filtered noise
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = noiseBuffer(ctx, 3); rainSrc.loop = true;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass'; rainFilter.frequency.value = 1800; rainFilter.Q.value = 0.4;
    a.rainGain = ctx.createGain(); a.rainGain.gain.value = 0.0;
    rainSrc.connect(rainFilter); rainFilter.connect(a.rainGain); a.rainGain.connect(a.master);
    rainSrc.start();
    // siren: two-tone triangle, LFO-driven
    a.sirenOsc = ctx.createOscillator();
    a.sirenOsc.type = 'triangle'; a.sirenOsc.frequency.value = 700;
    a.sirenGain = ctx.createGain(); a.sirenGain.gain.value = 0.0;
    a.sirenOsc.connect(a.sirenGain); a.sirenGain.connect(a.master);
    a.sirenOsc.start();
    a.sirenPhase = 0;
  };

  a.resume = function resume() {
    if (a.ctx && a.ctx.state === 'suspended') a.ctx.resume();
  };

  a.setEngine = function setEngine(speedNorm, nitro) {
    if (!a.ctx) return;
    a.engineOsc.frequency.value = 55 + speedNorm * 220 + (nitro ? 60 : 0);
    a.engineGain.gain.value = 0.05 + speedNorm * 0.09 + (nitro ? 0.05 : 0);
  };

  a.setRain = function setRain(amount) {
    if (!a.ctx) return;
    a.rainGain.gain.value = amount * 0.12;
  };

  a.setSiren = function setSiren(on, dt) {
    if (!a.ctx) return;
    a.sirenPhase = (a.sirenPhase || 0) + dt * 2.4;
    a.sirenOsc.frequency.value = Math.sin(a.sirenPhase * Math.PI) > 0 ? 960 : 700;
    a.sirenGain.gain.value = on ? 0.045 : 0.0;
  };

  a.thunder = function thunder() {
    if (!a.ctx || a.muted) return;
    const ctx = a.ctx;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 1.5);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(400, ctx.currentTime);
    f.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    src.connect(f); f.connect(g); g.connect(a.master);
    src.start(); src.stop(ctx.currentTime + 1.5);
  };

  a.shot = function shot(kind) {
    if (!a.ctx || a.muted) return;
    const ctx = a.ctx;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 0.18);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 900;
    const g = ctx.createGain();
    const vol = kind === 'shotgun' ? 0.5 : kind === 'smg' ? 0.25 : 0.35;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    src.connect(f); f.connect(g); g.connect(a.master);
    src.start(); src.stop(ctx.currentTime + 0.2);
    const o = ctx.createOscillator();
    o.type = 'square'; o.frequency.setValueAtTime(220, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.2, ctx.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    o.connect(og); og.connect(a.master);
    o.start(); o.stop(ctx.currentTime + 0.12);
  };

  a.crash = function crash() {
    if (!a.ctx || a.muted) return;
    const ctx = a.ctx;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 0.4);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.6, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    src.connect(f); f.connect(g); g.connect(a.master);
    src.start(); src.stop(ctx.currentTime + 0.45);
  };

  a.chime = function chime(win) {
    if (!a.ctx || a.muted) return;
    const ctx = a.ctx;
    const notes = win ? [523, 659, 784, 1046] : [392, 330, 262];
    notes.forEach((n, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = n;
      const g = ctx.createGain();
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g); g.connect(a.master);
      o.start(t); o.stop(t + 0.55);
    });
  };

  // VIBE 104.5 FM: a tiny synthwave loop — bassline + arpeggio, scheduled ahead.
  const BASS = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4]; // A1 A1 C2 G1 ...
  const ARP = [220, 261.6, 329.6, 440, 329.6, 261.6];
  a.radioTick = function radioTick() {
    if (!a.ctx || !a.radioOn || a.muted) return;
    const ctx = a.ctx;
    const step = 0.22;
    while (a.nextNote < ctx.currentTime + 0.4) {
      const t = Math.max(a.nextNote, ctx.currentTime + 0.02);
      const idx = Math.floor(a.nextNote / step);
      const bass = BASS[idx % BASS.length];
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = bass;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + step * 0.95);
      o.connect(f); f.connect(g); g.connect(a.master);
      o.start(t); o.stop(t + step);
      if (idx % 2 === 0) {
        const a2 = ctx.createOscillator();
        a2.type = 'square'; a2.frequency.value = ARP[(idx / 2) % ARP.length] * 2;
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.05, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        a2.connect(g2); g2.connect(a.master);
        a2.start(t); a2.stop(t + 0.2);
      }
      a.nextNote += step;
    }
    if (a.nextNote < ctx.currentTime) a.nextNote = ctx.currentTime + 0.05;
  };

  a.toggleMute = function toggleMute() {
    a.muted = !a.muted;
    if (a.master) a.master.gain.value = a.muted ? 0 : 0.5;
    return a.muted;
  };

  a.toggleRadio = function toggleRadio() {
    a.radioOn = !a.radioOn;
    return a.radioOn;
  };

  return a;
}
