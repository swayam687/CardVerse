/* ============================================================
   ui/RoomExtras.js — v2.13 (NEW)
   Adds Sound Pack selector + Public/Private toggle to the room
   screen for the host. Hooks into Net 'room_update'.
   ============================================================ */
const RoomExtras = {
  _wired: false,

  mount() {
    if (this._wired) return;
    this._wired = true;
    if (typeof Net === 'undefined' || !Net.on) return;
    Net.on('room_update', () => this._refresh());
    Net.on('created',     () => setTimeout(() => this._refresh(), 200));
    Net.on('joined',      () => setTimeout(() => this._refresh(), 200));
  },

  _refresh() {
    const room = Net.room;
    if (!room) { this._remove(); return; }
    const panel = document.getElementById('roomSettings');
    if (!panel) return;

    let extras = document.getElementById('roomExtras');
    if (!extras) {
      extras = document.createElement('div');
      extras.id = 'roomExtras';
      extras.style.cssText = 'margin-top:12px;padding-top:12px;border-top:1px solid var(--border)';
      panel.querySelector('.room-panel')?.appendChild(extras);
    }

    const isHost = Net.isHost;
    const soundPack = room.soundPack || 'default';
    const isPublic  = room.isPublic !== false;

    extras.innerHTML = `
      <div class="settings-grid">
        <div class="settings-cell">
          <label class="fl">Sound Pack</label>
          <select id="rxSoundPack" ${isHost ? '' : 'disabled'}>
            <option value="default" ${soundPack === 'default' ? 'selected' : ''}>Standard</option>
            <option value="meme"    ${soundPack === 'meme'    ? 'selected' : ''}>Meme SFX 🔊</option>
          </select>
        </div>
        <div class="settings-cell">
          <label class="fl">Visibility</label>
          <select id="rxPublic" ${isHost ? '' : 'disabled'}>
            <option value="public"  ${isPublic  ? 'selected' : ''}>Public (browsable)</option>
            <option value="private" ${!isPublic ? 'selected' : ''}>Private (invite only)</option>
          </select>
        </div>
      </div>
      ${!isHost ? '<div class="hint" style="margin-top:8px">Only the host can change these.</div>' : ''}
    `;

    if (isHost) {
      const packSel = extras.querySelector('#rxSoundPack');
      const pubSel  = extras.querySelector('#rxPublic');
      packSel.onchange = () => {
        if (typeof Sound !== 'undefined') Sound.click();
        Net.updateRoom({ soundPack: packSel.value });
      };
      pubSel.onchange = () => {
        if (typeof Sound !== 'undefined') Sound.click();
        Net.updateRoom({ isPublic: pubSel.value === 'public' });
      };
    }
  },

  _remove() {
    const el = document.getElementById('roomExtras');
    if (el) el.remove();
  }
};