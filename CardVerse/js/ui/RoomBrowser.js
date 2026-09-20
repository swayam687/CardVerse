/* ============================================================
   ui/RoomBrowser.js — v2.13 (NEW)
   Public room list. Modals in via Modal.open().
   ============================================================ */
const RoomBrowser = {
  _wired: false,
  _refreshTimer: null,

  mount() {
    if (this._wired) return;
    this._wired = true;

    if (typeof Net === 'undefined' || !Net.on) return;

    Net.on('room_list', msg => this._renderList(msg.rooms || []));
  },

  open() {
    if (typeof Modal === 'undefined') return;
    Modal.open(`
      <h2>🌐 Public Rooms</h2>
      <div class="hint">Join an open game near you.</div>
      <div id="roomListWrap" style="margin-top:12px;min-height:120px">
        <div class="hint" id="roomListLoading">Loading…</div>
      </div>
      <button class="btn ghost big" style="width:100%;margin-top:14px" id="roomListClose">Close</button>
    `);
    const m = document.getElementById('modal');
    if (!m) return;
    m.querySelector('#roomListClose').onclick = () => Modal.close();

    if (typeof Net !== 'undefined' && Net._send) {
      Net._send({ type: 'list_rooms' });
    }
  },

  _renderList(rooms) {
    const wrap = document.getElementById('roomListWrap');
    if (!wrap) return;

    if (!rooms.length) {
      wrap.innerHTML = '<div class="hint" style="padding:20px 0;text-align:center">No public rooms right now.<br>Create one and toggle it public.</div>';
      return;
    }

    wrap.innerHTML = '';
    const grid = document.createElement('div');
    grid.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow-y:auto';

    rooms.forEach(r => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'player-pick-btn';
      btn.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%';
      const count = (r.players || []).length;
      btn.innerHTML = `
        <span class="pp-av">🌐</span>
        <span class="pp-name">
          <b>${esc(r.name || 'Room')}</b>
          <div style="font-size:11px;opacity:.75;margin-top:2px;font-weight:700">
            ${esc(r.universe || 'marvel')} · ${esc(r.rules || 'classic')} · ${count}/8
          </div>
        </span>
        <span class="pp-cnt" style="font-family:ui-monospace,monospace;letter-spacing:2px">${esc(r.code)}</span>
      `;
      btn.onclick = () => this._join(r.code);
      grid.appendChild(btn);
    });
    wrap.appendChild(grid);
  },

  async _join(code) {
    if (!code) return;
    if (typeof Sound !== 'undefined') Sound.click();
    try {
      if (typeof Modal !== 'undefined') Modal.close();
      await Net.join(code, LobbyView.profile.name, LobbyView.profile.avatar);
    } catch (e) {
      if (typeof Toast !== 'undefined') Toast.show('Could not join that room');
    }
  }
};