/* ============================================================
   audio/SoundEngine.js — WebAudio by default, files opt-in
   ---------------------------------------------------------
   ⚠️  ASSETS ARE DISABLED BY DEFAULT.
   The game makes NO network requests for audio.

   To use real .mp3 files later:
     1. Drop tap.mp3, play.mp3, draw.mp3, ability.mp3,
        win.mp3, lose.mp3, shuffle.mp3, error.mp3
        into assets/sounds/
     2. Flip USE_AUDIO_FILES to true below.
     3. Reload. Done.
   ============================================================ */
const Sound = (() => {
  let ac = null, muted = false;
  const buffers = {};
  const missing = new Set();

  // ── Toggle this when you've added the .mp3 files ──
  const USE_AUDIO_FILES = false;

  function ctx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(freq, dur = .09, type = 'sine', vol = .06, slide = 0) {
    if (muted) return; const a = ctx(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, a.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), a.currentTime + dur);
    g.gain.setValueAtTime(0, a.currentTime);
    g.gain.linearRampToValueAtTime(vol, a.currentTime + .012);
    g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + dur);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + dur + .02);
  }

  async function preload(name) {
    if (buffers[name]) return buffers[name];
    if (missing.has(name)) return null;
    const a = ctx(); if (!a) return null;
    try {
      const res = await fetch(`assets/sounds/${name}.mp3`);
      if (!res.ok) throw new Error('missing');
      const arr = await res.arrayBuffer();
      buffers[name] = await a.decodeAudioData(arr);
      return buffers[name];
    } catch (e) {
      missing.add(name);
      return null;
    }
  }

  function playFile(name, fallback) {
    if (muted) return;

    // When assets are disabled: WebAudio only. No network. Ever.
    if (!USE_AUDIO_FILES) { fallback && fallback(); return; }

    const buf = buffers[name];
    if (buf) {
      const a = ctx(); if (!a) return;
      const src = a.createBufferSource();
      src.buffer = buf;
      const g = a.createGain();
      g.gain.value = .35;
      src.connect(g); g.connect(a.destination);
      src.start();
      return;
    }
    fallback && fallback();
    if (!missing.has(name)) preload(name);
  }

  return {
    toggle() { muted = !muted; return muted; },
    get muted() { return muted; },
    get useFiles() { return USE_AUDIO_FILES; },

    // No-op when files are disabled
    preloadAll: async () => {
      if (!USE_AUDIO_FILES) return;
      const names = ['tap','play','draw','ability','win','lose','shuffle','error'];
      await Promise.all(names.map(preload));
    },

    click() { playFile('tap',     () => tone(620, .05, 'triangle', .045)); },
    play()  { playFile('play',    () => { tone(520, .07, 'triangle', .05); tone(780, .09, 'sine', .04, 240); }); },
    draw()  { playFile('draw',    () => tone(300, .07, 'sine', .035, 90)); },
    bad()   { playFile('error',   () => tone(170, .13, 'sawtooth', .045, -50)); },
    ability() { playFile('ability', () => { tone(440, .1, 'square', .035); tone(660, .16, 'sine', .045, 420); }); },
    deal()  { playFile('shuffle', () => tone(220, .05, 'sine', .022)); },
    win()   { playFile('win',     () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .24, 'triangle', .06), i * 105))); },
    lose()  { playFile('lose',    () => [400, 330, 250].forEach((f, i) => setTimeout(() => tone(f, .26, 'sawtooth', .045), i * 135))); },
    achievement() { playFile('win', () => [659, 880, 1175].forEach((f, i) => setTimeout(() => tone(f, .22, 'triangle', .05), i * 90))); }
  };
})();