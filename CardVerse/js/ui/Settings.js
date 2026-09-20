/* ============================================================
   ui/Settings.js — preferences + theme (Pulse)

   Fixes applied:
     · reduced-motion writes both a class AND a data-motion
       attribute so both CSS conventions work
     · Sound mute toggle added + persisted
     · theme-color meta updated dynamically
   ============================================================ */
const Settings = {
  data: {
    theme: 'system',
    haptics: true,
    colorBlind: false,
    reducedMotion: false,
    muted: false
  },

  init() {
    try {
      const saved = JSON.parse(localStorage.getItem('rv_settings') || '{}');
      this.data = { ...this.data, ...saved };
    } catch (e) {}

    // Back-compat: old builds persisted mute separately.
    try {
      if (localStorage.getItem('rv_muted') === '1') this.data.muted = true;
    } catch (e) {}

    this.apply();

    const btn = document.getElementById('btnOpenSettings');
    if (btn) btn.onclick = () => { Sound.click(); this.open(); };
  },

  save() {
    try { localStorage.setItem('rv_settings', JSON.stringify(this.data)); } catch (e) {}
    try { localStorage.setItem('rv_muted', this.data.muted ? '1' : '0'); } catch (e) {}
    this.apply();
  },

  apply() {
    // ── Theme ──
    let theme = this.data.theme;
    if (theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', theme);

    // ── Colorblind ──
    document.documentElement.classList.toggle('cb-mode', this.data.colorBlind);

    // ── Reduced motion: class AND data attribute ──
    document.documentElement.classList.toggle('reduced-motion', this.data.reducedMotion);
    if (this.data.reducedMotion) {
      document.documentElement.setAttribute('data-motion', 'reduced');
    } else {
      document.documentElement.removeAttribute('data-motion');
    }

    // ── Haptics ──
    if (typeof Haptics !== 'undefined') Haptics.enabled = this.data.haptics;
    try { localStorage.setItem('rv_haptics', this.data.haptics ? 'on' : 'off'); } catch (e) {}

    // ── Sound mute ──
    if (typeof Sound !== 'undefined' && Sound.muted !== this.data.muted) {
      Sound.toggle();
    }

    // ── theme-color meta ──
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#F7F7FA' : '#12121A');

    // ── Re-render any active game so cards pick up the new theme ──
    if (typeof ArenaView !== 'undefined' && ArenaView.state) {
      if (ArenaView._cardPool) ArenaView._cardPool.clear();
      const handEl = document.getElementById('hand');
      if (handEl) handEl.innerHTML = '';
      ArenaView.render();
    }
  },

  open() {
    const m = Modal.open(`
      <h2>Settings</h2>
      <div class="hint">Preferences save to this device.</div>

      <div class="rule-row" style="flex-direction:column;align-items:stretch;gap:10px;padding:14px">
        <div class="rl">Appearance</div>
        <div class="segmented" id="setTheme" style="margin:0">
          <button class="seg" data-t="dark">Dark</button>
          <button class="seg" data-t="light">Light</button>
          <button class="seg" data-t="system">System</button>
        </div>
      </div>

      <div class="rule-row">
        <div>
          <div class="rl">Haptic Feedback</div>
          <div class="rn">Vibration on taps, plays and wins</div>
        </div>
        <label class="switch"><input type="checkbox" id="setHaptics"><span class="sl"></span></label>
      </div>

      <div class="rule-row">
        <div>
          <div class="rl">Sound</div>
          <div class="rn">Taps, plays and abilities</div>
        </div>
        <label class="switch"><input type="checkbox" id="setSound"><span class="sl"></span></label>
      </div>

      <div class="rule-row">
        <div>
          <div class="rl">Color-Blind Mode</div>
          <div class="rn">Adds shapes + patterns to cards</div>
        </div>
        <label class="switch"><input type="checkbox" id="setCB"><span class="sl"></span></label>
      </div>

      <div class="rule-row">
        <div>
          <div class="rl">Reduced Motion</div>
          <div class="rn">Minimises animations</div>
        </div>
        <label class="switch"><input type="checkbox" id="setRM"><span class="sl"></span></label>
      </div>

      <button class="btn primary big" style="width:100%;margin-top:20px" id="setClose">Done</button>
    `);
    if (!m) return;

    const seg = m.querySelector('#setTheme');
    seg.querySelectorAll('.seg').forEach(b => {
      if (b.dataset.t === this.data.theme) b.classList.add('on');
      b.onclick = () => {
        this.data.theme = b.dataset.t;
        seg.querySelectorAll('.seg').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        this.save();
        Sound.click();
      };
    });

    const cb1 = m.querySelector('#setHaptics');
    const cbS = m.querySelector('#setSound');
    const cb2 = m.querySelector('#setCB');
    const cb3 = m.querySelector('#setRM');

    cb1.checked = this.data.haptics;
    // "Sound ON" is the opposite of data.muted
    cbS.checked = !this.data.muted;
    cb2.checked = this.data.colorBlind;
    cb3.checked = this.data.reducedMotion;

    cb1.onchange = () => {
      this.data.haptics = cb1.checked;
      this.save();
      if (cb1.checked && typeof Haptics !== 'undefined') Haptics.tap();
    };
    cbS.onchange = () => {
      this.data.muted = !cbS.checked;
      this.save();
      if (!this.data.muted) Sound.click(); // audible confirmation
    };
    cb2.onchange = () => { this.data.colorBlind = cb2.checked; this.save(); Sound.click(); };
    cb3.onchange = () => { this.data.reducedMotion = cb3.checked; this.save(); Sound.click(); };

    m.querySelector('#setClose').onclick = () => Modal.close();
  }
};