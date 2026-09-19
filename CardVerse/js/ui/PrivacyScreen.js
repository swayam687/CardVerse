/* ============================================================
   ui/PrivacyScreen.js — pass-and-play handoff overlay
   ---------------------------------------------------------
   FIX 1: shows whenever 2+ humans are seated, regardless of bots.
   ============================================================ */
const PrivacyScreen = {
  _overlay: null,

  shouldShow(state) {
    if (!state) return false;
    const humans = state.players.filter(p => !p.isBot).length;
    return humans >= 2;   // ── FIX 1 (was `humans >= 2 && bots === 0`)
  },

  showFor(player, onReady) {
    this.hide();
    const el = document.createElement('div');
    el.className = 'privacy-overlay';
    el.innerHTML = `
      <div class="privacy-inner">
        <div class="privacy-avatar">${player.avatar}</div>
        <div class="privacy-title">Pass to ${esc(player.name)}</div>
        <div class="privacy-sub">Tap when ready — others look away.</div>
        <button class="btn primary" id="privacyGo" style="margin-top:22px">I'm ${esc(player.name)} →</button>
      </div>
    `;
    document.body.appendChild(el);
    this._overlay = el;
    el.querySelector('#privacyGo').onclick = () => {
      Haptics.tap();
      this.hide();
      onReady && onReady();
    };
  },

  hide() {
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
  }
};