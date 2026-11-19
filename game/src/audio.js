// Procedural Web Audio: music sequencer + SFX, authored in this recorded build session.
// No audio files, no network: everything is synthesized. M toggles mute.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicOn = false;
    this.step = 0;
    this.nextTime = 0;
    this.bpm = 112;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.32;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.6;
    this.sfxGain.connect(this.master);
    // Engine hum: two detuned saws through a lowpass, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const eng2 = this.ctx.createOscillator();
    eng2.type = 'sawtooth';
    eng2.frequency.value = 55.7;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    this.engineOsc.connect(lp); eng2.connect(lp);
    lp.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start(); eng2.start();
    this._engineOsc2 = eng2;
  }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }
  setEngine(speed01, on) {
    if (!this.ctx) return;
    const f = 48 + speed01 * 140;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
    this._engineOsc2.frequency.setTargetAtTime(f * 1.012, this.ctx.currentTime, 0.05);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0, this.ctx.currentTime, 0.08);
  }
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    // A minor-key driving loop: bass roots, off-beat hats, sparse lead.
    this._bass = [45, 45, 48, 43, 45, 45, 50, 48]; // A2 A2 C3 G2 ...
    this._lead = [69, 0, 72, 0, 76, 0, 74, 72, 69, 0, 67, 0, 64, 67, 69, 0];
    const tick = () => {
      if (!this.musicOn) return;
      const spb = 60 / this.bpm / 2; // eighth notes
      while (this.nextTime < this.ctx.currentTime + 0.25) {
        this._scheduleStep(this.step, this.nextTime, spb);
        this.step = (this.step + 1) % 32;
        this.nextTime += spb;
      }
      this._musicTimer = setTimeout(tick, 90);
    };
    tick();
  }
  stopMusic() {
    this.musicOn = false;
    if (this._musicTimer) clearTimeout(this._musicTimer);
  }
  _note(freq, t, dur, type, gain, dest) {
    if (freq <= 0) return;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest || this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  _hat(t, open) {
    const len = open ? 0.18 : 0.05;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * len), this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = this.ctx.createGain(); g.gain.value = open ? 0.10 : 0.06;
    src.connect(hp); hp.connect(g); g.connect(this.musicGain);
    src.start(t);
  }
  _scheduleStep(s, t, spb) {
    const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
    if (s % 4 === 0) this._note(midi(this._bass[(s / 4) | 0]), t, spb * 3.5, 'triangle', 0.5);
    if (s % 2 === 1) this._hat(t, s % 8 === 7);
    if (s % 8 === 0 || s % 8 === 4) this._note(midi(this._bass[(s / 4) | 0] + 12), t, spb, 'square', 0.05);
    const lead = this._lead[s % 16];
    if (lead) this._note(midi(lead), t, spb * 1.8, 'sawtooth', 0.07);
  }
  _burst(t, dur, filterFreq, gain, type = 'lowpass') {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t);
  }
  sfx(name) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (name === 'shoot') { this._burst(t, 0.12, 1800, 0.5); this._note(220, t, 0.08, 'square', 0.15, this.sfxGain); }
    else if (name === 'punch') { this._burst(t, 0.08, 500, 0.5); }
    else if (name === 'crash') { this._burst(t, 0.3, 300, 0.7); }
    else if (name === 'pickup') { this._note(660, t, 0.09, 'sine', 0.3, this.sfxGain); this._note(990, t + 0.09, 0.12, 'sine', 0.3, this.sfxGain); }
    else if (name === 'cash') { this._note(880, t, 0.08, 'sine', 0.25, this.sfxGain); this._note(1174, t + 0.08, 0.08, 'sine', 0.25, this.sfxGain); this._note(1568, t + 0.16, 0.15, 'sine', 0.25, this.sfxGain); }
    else if (name === 'mission') { [523, 659, 784, 1046].forEach((f, i) => this._note(f, t + i * 0.1, 0.18, 'triangle', 0.3, this.sfxGain)); }
    else if (name === 'fail') { [392, 330, 262].forEach((f, i) => this._note(f, t + i * 0.14, 0.22, 'sawtooth', 0.15, this.sfxGain)); }
    else if (name === 'door') { this._burst(t, 0.06, 900, 0.25); }
    else if (name === 'busted') { this._note(196, t, 0.5, 'sawtooth', 0.2, this.sfxGain); }
  }
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      let hi = false;
      this.sirenTimer = setInterval(() => {
        if (!this.sirenOsc) return;
        hi = !hi;
        this.sirenOsc.frequency.setTargetAtTime(hi ? 960 : 720, this.ctx.currentTime, 0.05);
      }, 380);
    } else if (!on && this.sirenOsc) {
      clearInterval(this.sirenTimer);
      this.sirenTimer = null;
      const o = this.sirenOsc; this.sirenOsc = null;
      try { o.stop(); } catch { /* already stopped */ }
    }
  }
}
