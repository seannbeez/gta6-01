// audio.js — PROJECT VICE. Fully procedural Web Audio: engine rev, tyre screech,
// police sirens, rain + thunder rumble, gunfire, and a toggleable synthwave radio
// (VIBE 104.5 FM). No audio files, no network. Starts on first user gesture.
export function createAudio() {
  const a = {
    ctx: null, master: null, engineOsc: null, engineGain: null, radioOn: true,
    muted: false, sirenNodes: null, rainNode: null, started: false,
  };

  a.ensure = function () {
    if (a.ctx) { if (a.ctx.state === 'suspended') a.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      a.ctx = new AC();
      a.master = a.ctx.createGain();
      a.master.gain.value = 0.5;
      a.master.connect(a.ctx.destination);
      // engine: two detuned saws through a lowpass
      a.engineOsc = a.ctx.createOscillator();
      a.engineOsc.type = 'sawtooth';
      a.engineOsc.frequency.value = 55;
      const osc2 = a.ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.value = 28;
      const lp = a.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 900;
      a.engineGain = a.ctx.createGain();
      a.engineGain.gain.value = 0.0;
      a.engineOsc.connect(lp); osc2.connect(lp);
      lp.connect(a.engineGain); a.engineGain.connect(a.master);
      a.engineOsc.start(); osc2.start();
      a.osc2 = osc2; a.engineFilter = lp;
      // rain: looped filtered noise
      const len = a.ctx.sampleRate * 2;
      const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = a.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const bp = a.ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.4;
      a.rainGain = a.ctx.createGain(); a.rainGain.gain.value = 0;
      src.connect(bp); bp.connect(a.rainGain); a.rainGain.connect(a.master);
      src.start();
      a.started = true;
      a.startRadio();
    } catch (e) { /* audio unavailable — game still plays */ }
  };

  a.setEngine = function (speedNorm, nitro) {
    if (!a.ctx) return;
    const f = 50 + speedNorm * 220 + (nitro ? 60 : 0);
    a.engineOsc.frequency.setTargetAtTime(f, a.ctx.currentTime, 0.08);
    a.osc2.frequency.setTargetAtTime(f / 2, a.ctx.currentTime, 0.08);
    a.engineFilter.frequency.setTargetAtTime(500 + speedNorm * 2400, a.ctx.currentTime, 0.1);
    a.engineGain.gain.setTargetAtTime(0.05 + speedNorm * 0.11, a.ctx.currentTime, 0.1);
  };

  a.setRain = function (on) {
    if (!a.ctx) return;
    a.rainGain.gain.setTargetAtTime(on ? 0.12 : 0, a.ctx.currentTime, 0.5);
  };

  a.thunder = function () {
    if (!a.ctx) return;
    const t = a.ctx.currentTime;
    const o = a.ctx.createOscillator();
    o.type = 'sine'; o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 1.4);
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    o.connect(g); g.connect(a.master);
    o.start(t); o.stop(t + 1.7);
  };

  a.gunshot = function () {
    if (!a.ctx) return;
    const t = a.ctx.currentTime;
    const len = a.ctx.sampleRate * 0.14;
    const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.ctx.createBufferSource(); src.buffer = buf;
    const g = a.ctx.createGain(); g.gain.value = 0.5;
    src.connect(g); g.connect(a.master);
    src.start(t);
  };

  a.siren = function (on) {
    if (!a.ctx) return;
    if (on && !a.sirenNodes) {
      const o = a.ctx.createOscillator();
      o.type = 'sine';
      const lfo = a.ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const lg = a.ctx.createGain(); lg.gain.value = 320;
      lfo.connect(lg); lg.connect(o.frequency);
      o.frequency.value = 750;
      const g = a.ctx.createGain(); g.gain.value = 0.045;
      o.connect(g); g.connect(a.master);
      o.start(); lfo.start();
      a.sirenNodes = { o, lfo, g };
    } else if (!on && a.sirenNodes) {
      try { a.sirenNodes.o.stop(); a.sirenNodes.lfo.stop(); } catch (e) {}
      a.sirenNodes = null;
    }
  };

  a.screech = function () {
    if (!a.ctx) return;
    const t = a.ctx.currentTime;
    const o = a.ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = 1400;
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g); g.connect(a.master);
    o.start(t); o.stop(t + 0.45);
  };

  a.sting = function (kind) {
    if (!a.ctx) return;
    const notes = kind === 'complete' ? [523, 659, 784, 1046] : kind === 'wanted' ? [220, 207, 196] : [392, 330];
    notes.forEach((f, i) => {
      const t = a.ctx.currentTime + i * 0.11;
      const o = a.ctx.createOscillator();
      o.type = 'triangle'; o.frequency.value = f;
      const g = a.ctx.createGain();
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(a.master);
      o.start(t); o.stop(t + 0.32);
    });
  };

  // synthwave radio: tiny step sequencer — bass + arp + pad, VIBE 104.5 FM
  a.startRadio = function () {
    if (!a.ctx || a.radioTimer) return;
    const bass = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
    const arp = [220, 261.6, 329.6, 440, 329.6, 261.6];
    let step = 0;
    a.radioTimer = setInterval(() => {
      if (!a.ctx || !a.radioOn || a.muted) return;
      const t = a.ctx.currentTime;
      const b = a.ctx.createOscillator();
      b.type = 'sawtooth'; b.frequency.value = bass[step % bass.length];
      const bf = a.ctx.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = 500;
      const bg = a.ctx.createGain();
      bg.gain.setValueAtTime(0.11, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      b.connect(bf); bf.connect(bg); bg.connect(a.master);
      b.start(t); b.stop(t + 0.3);
      const n = arp[(step * 2) % arp.length];
      const o = a.ctx.createOscillator();
      o.type = 'square'; o.frequency.value = n * 2;
      const g = a.ctx.createGain();
      g.gain.setValueAtTime(0.035, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(a.master);
      o.start(t); o.stop(t + 0.2);
      step += 1;
    }, 240);
  };

  a.toggleRadio = function () { a.radioOn = !a.radioOn; return a.radioOn; };
  a.toggleMute = function () {
    a.muted = !a.muted;
    if (a.master) a.master.gain.value = a.muted ? 0 : 0.5;
    return a.muted;
  };

  return a;
}
