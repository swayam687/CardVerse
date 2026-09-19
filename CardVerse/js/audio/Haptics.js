/* ============================================================
   audio/Haptics.js — Vibration API wrapper
   ============================================================ */
const Haptics = {
  enabled: true,

  _load() {
    try { this.enabled = localStorage.getItem('rv_haptics') !== 'off'; } catch(e){}
  },
  _save() {
    try { localStorage.setItem('rv_haptics', this.enabled ? 'on' : 'off'); } catch(e){}
  },
  toggle() { this.enabled = !this.enabled; this._save(); return this.enabled; },

  _vib(pattern) {
    if (!this.enabled) return;
    if (!navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch(e){}
  },

  tap()     { this._vib(12); },
  play()    { this._vib(22); },
  ability() { this._vib([18, 30, 18]); },
  win()     { this._vib([40, 60, 40, 60, 120]); },
  lose()    { this._vib([120, 60, 120]); },
  warn()    { this._vib([50, 40, 50]); },
  error()   { this._vib(80); }
};
Haptics._load();