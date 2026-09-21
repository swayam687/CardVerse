/* ============================================================
   ui/RoomBrowser.js — v2.14
   · Ensures Net WS is connected before requesting the list.
   · Times out gracefully with a Refresh button.
   ============================================================ */
const RoomBrowser = {
  _wired: false,
  _pending: false,
  _timeoutHandle: null,

  mount() {
    if (this._wired) return;
    this._wired = true;
    if (typeof Net === 'undefined' || !Net.on) return;
    Net.on('room_list', msg => {
      this._pending = false;
      if (this._timeoutHandle) { clearTimeout(this._timeoutHandle); this._timeoutHandle = null; }
      this._renderList(msg.rooms || []);
    });
    // If WS closes while we're waiting, unstick.
    Net.on('__disconnect', () => {
      if (!this._pending) return;
      this._pending = false;
      if (this._timeoutHandle) { clearTimeout(this._timeoutHandle); this._timeoutHandle = null; }
      const wrap = document.getElementById('roomListWrap');
      if (wrap) {
        wrap.innerHTML = '<div class="hint" style="padding:20px 0;text-align:center;color:var(--danger)">Connection lost. Tap Refresh.</div>';
      }
    });
  },

  async open() {
    if (typeof Modal === 'undefined') return;
    Modal.open(`
      <h2>🌐 Public Rooms</h2>
      <div class="hint">Join an open game near you.</div>
      <div id="roomListWrap" style="margin-top:12px;min-height:120px">
        <div class="hint" style="padding:20px 0;text-align:center">Loading…</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn ghost big" style="flex:1" id="roomListRefresh">🔄 Refresh</button>
        <button class="btn ghost big" style="flex:1" id="roomListClose">Close</button>
      </div>
    `);
    const m = document.getElementById('modal');
    if (!m) return;
    m.querySelector('#roomListClose').onclick = () => Modal.close();
    m.querySelector('#roomListRefresh').onclick = () => {
      if (typeof Sound !== 'undefined') Sound.click();
      this._request();
    };
    this._request();
  },

  async _request() {
    const wrap = document.getElementById('roomListWrap');
    if (wrap) wrap.innerHTML = '<div class="hint" style="padding:20px 0;text-align:center">Loading…</div>';

    // 1. Ensure WS is connected
    if (typeof Net === 'undefined') {
      if (wrap) wrap.innerHTML = '<div class="hint" style="padding:20px 0;text-align:center;color:var(--danger)">Net module not loaded.</div>';
      return;
    }
    if (!Net.ws || Net.ws.readyState > 1) {
      try {
        Net._wantToReconnect = true;
        await Net.connect();
      } catch (e) {
        if (wrap) wrap.innerHTML = '<div class="hint" style="padding:20px 0;text-align:center;color:var(--danger)">Could not reach the server.<br>Try again in a moment.</div>';
        return;
      }
    }

    // 2. Send the query
    this._pending = true;
    Net._send({ type: 'list_rooms' });

    // 3. Timeout
    if (this._timeoutHandle) clearTimeout(this._timeoutHandle);
    this._timeoutHandle = setTimeout(() => {
      this._timeoutHandle = null;
      if (!this._pending) return;
      this._pending = false;
      const w = document.getElementById('roomListWrap');
      if (w) w.innerHTML = '<div class="hint" style="padding:20px 0;text-align:center;color:var(--danger)">Server took too long. Tap Refresh.</div>';
    }, 6000);
  },

  _renderList(rooms) {
    const wrap = document.getElementById('roomListWrap');
    if (!wrap) return; // modal closed

    if (!rooms.length) {
      wrap.innerHTML = '<div class="hint" style="padding:20px 0;text-align:center">No public rooms right now.<br>Create one and leave it public — it appears here for everyone.</div>';
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

(function selfMount() {
  const go = () => {
    try { RoomBrowser.mount(); }
    catch (e) { console.error('[RoomBrowser] self-mount error', e); }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', go, { once: true });
  } else {
    setTimeout(go, 0);
  }
})();