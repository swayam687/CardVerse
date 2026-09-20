/* ============================================================
   js/ui/PrivacyScreen.js — hotseat pass-and-play overlay
   ============================================================ */

const PrivacyScreen = {
  _overlay: null,

  /**
   * Hotseat handoff check. Returns true when ≥2 humans are in the
   * game. Same-player suppression (EXTRA_TURN, etc.) is handled
   * by the caller via the `s.turn !== _localIdx` guard in
   * ArenaView.afterAction().
   */
  shouldShow(state) {
    if (!state) return false;
    const humans = state.players.filter(p => !p.isBot).length;
    return humans >= 2;
  },

  showFor(player, onReady) {
    this.hide();

    const el = document.createElement('div');
    el.className = 'privacy-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `
      <div class="privacy-inner">
        <div class="privacy-avatar">${esc(player.avatar)}</div>
        <div class="privacy-title">Pass to ${esc(player.name)}</div>
        <div class="privacy-sub">Tap when ready — others look away.</div>
        <button class="btn primary" id="privacyGo" style="margin-top:22px">I'm ${esc(player.name)} →</button>
      </div>
    `;
    document.body.appendChild(el);
    this._overlay = el;

    const btn = el.querySelector('#privacyGo');
    btn.focus();

    const done = () => {
      if (typeof Haptics !== 'undefined') Haptics.tap();
      this.hide();
      onReady && onReady();
    };

    btn.onclick = done;
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); done(); }
    });
  },

  /** Call between games / on rematch so the first handoff isn't skipped. */
  reset() {},

  hide() {
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
  }
};