/* ============================================================
   audio/SoundPacks.js — v2.13 (NEW)
   Procedurally-synthesized meme SFX. No files, no CORS.
   Packs: 'default' (silent layer), 'meme'.
   ============================================================ */
const SoundPacks = {
  current: 'default',
  _ctx: null,
  _unlocked: false,

  _getCtx() {
    if (this._ctx) return this._ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this._ctx = new AC();
    return this._ctx;
  },

  /** Called once on first user gesture so WebAudio can play. */
  unlock() {
    const ctx = this._getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    this._unlocked = true;
  },

  set(pack) {
    this.current = pack || 'default';
  },

  /** Play by symbolic name. Safe to call anywhere. */
  play(name) {
    if (this.current !== 'meme') return;
    if (!this._unlocked) return;
    if (typeof Settings !== 'undefined' && Settings.data && Settings.data.muted) return;
    const ctx = this._getCtx();
    if (!ctx) return;
    try {
      switch (name) {
        case 'boom':    return this._boom(ctx);
        case 'sus':     return this._sus(ctx);
        case 'bruh':    return this._bruh(ctx);
        case 'airhorn': return this._airhorn(ctx);
        case 'whip':    return this._whip(ctx);
        case 'fail':    return this._fail(ctx);
      }
    } catch (e) { /* never break gameplay on audio */ }
  },

  // ─── Sound primitives ─────────────────────────────────────

  _boom(ctx) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.32);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.75, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.66);
  },

  _sus(ctx) {
    const t = ctx.currentTime;
    [660, 622].forEach((f, i) => {
      const start = t + i * 0.09;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.35, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(g).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  },

  _bruh(ctx) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(112, t);
    osc.frequency.exponentialRampToValueAtTime(72, t + 0.24);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    osc.connect(filter).connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  },

  _airhorn(ctx) {
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const start = t + i * 0.16;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 320;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.35, start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      osc.connect(g).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.14);
    }
  },

  _whip(ctx) {
    const t = ctx.currentTime;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.15), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / data.length * 8);
    }
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, t);
    filter.frequency.exponentialRampToValueAtTime(420, t + 0.12);
    g.gain.value = 0.42;
    src.buffer = buffer;
    src.connect(filter).connect(g).connect(ctx.destination);
    src.start(t);
  },

  _fail(ctx) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.45);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  }
};

// Unlock on first user gesture
if (typeof document !== 'undefined') {
  const un = () => { SoundPacks.unlock(); document.removeEventListener('pointerdown', un); };
  document.addEventListener('pointerdown', un, { once: true });
}