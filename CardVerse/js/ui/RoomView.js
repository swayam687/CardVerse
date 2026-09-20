/* ============================================================
   ui/RoomView.js
   ---------------------------------------------------------
   Multiplayer lobby. Host controls settings + start.
   Everyone sees the player list and chat.
   Host can clear the chat for all players.

   Fixes applied:
     · chat render tolerates {name} and {from}
     · player_left tolerates {id} and {playerId}
     · universe/rules selectors tolerate old and new server field names
     · player avatars escaped (XSS fix)
     · rejoin mid-game uses top-level msg.state
     · start button disabled during start
   ============================================================ */
const RoomView = {
  _bound: false,
  _starting: false,

  init() {
    if (this._bound) return;
    this._bound = true;

    document.getElementById('btnRoomBack').onclick = () => {
      Sound.click();
      if (Net.active) Net.leave();
      show('screen-home');
    };

    document.getElementById('codeCard').onclick = () => {
      const code = (Net.room && Net.room.code) || '';
      if (!code) return;
      try { navigator.clipboard.writeText(code); } catch (e) {}
      Toast.show('Code copied');
      if (typeof Haptics !== 'undefined') Haptics.tap();
    };

    document.getElementById('btnAddBot').onclick = () => {
      Sound.click();
      Net.addBot();
    };

    document.getElementById('btnStartMatch').onclick = () => {
      if (this._starting) return;
      this._starting = true;
      const btn = document.getElementById('btnStartMatch');
      if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }
      Sound.click();
      try { GameFlow.startMultiplayer(); }
      finally {
        setTimeout(() => {
          this._starting = false;
          if (btn) { btn.disabled = false; btn.textContent = 'Start Match'; }
        }, 1200);
      }
    };

    document.getElementById('chatForm').onsubmit = e => {
      e.preventDefault();
      const inp = document.getElementById('chatInput');
      const text = inp.value.trim();
      if (!text) return;
      Net.chat(text);
      inp.value = '';
    };

    document.getElementById('btnClearChat').onclick = () => {
      Sound.click();
      Net.clearChat();
    };

    // Populate universe + rules dropdowns once.
    const ru = document.getElementById('roomUniverse');
    Object.values(UNIVERSES).forEach(u => {
      const o = document.createElement('option');
      o.value = u.id;
      o.textContent = `${u.icon} ${u.name}`;
      ru.appendChild(o);
    });
    ru.onchange = () => {
      const u = UNIVERSES[ru.value];
      if (!u) return;
      // Send both field naming conventions so it works with either server.
      Net.updateRoom({
        universe: u.id,
        universeId: u.id,
        universeName: `${u.icon} ${u.name}`,
        customDef: null
      });
    };

    const rr = document.getElementById('roomRules');
    Object.entries(RULE_PRESETS).forEach(([k, p]) => {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = `${p.icon} ${p.name}`;
      rr.appendChild(o);
    });
    rr.onchange = () => {
      Net.updateRoom({ rules: rr.value, rulesKey: rr.value });
    };
  },

  /* ── Net event handlers ────────────────────────────────── */

  onCreated() {
    this._resetChatLog();
    this.render();
  },

  onJoined() {
    this._resetChatLog();
    this.render();
  },

  onRejoined(msg) {
    this.render();
    // Server may attach state at the top level (my server) or under msg.room.
    const state = msg.state || (msg.room && msg.room.state) || null;
    const rulesKey = msg.rulesKey || (msg.room && msg.room.rulesKey) || 'classic';
    if (state) {
      if (ArenaView.state) GameFlow.applyStateUpdate(state);
      else GameFlow.enterMultiplayerGame(state, rulesKey);
    }
  },

  onRoomUpdate(msg) {
    this.render();
    if (!msg.room) return;

    // Host cancelled the match → drop everyone back to the room.
    if (msg.room.started === false && ArenaView.state) {
      this._teardownGame();
      show('screen-room');
      Toast.show('Match ended');
      return;
    }
    // Host started a match and state is embedded.
    if (msg.room.started && msg.room.state && !ArenaView.state) {
      GameFlow.enterMultiplayerGame(msg.room.state, msg.room.rulesKey);
    }
  },

    onChat(msg) {
    const log = document.getElementById('chatLog');
    if (!log) return;

    // Server may nest payload under msg.line, or send flat fields.
    // Accept both shapes so a server update can't break this.
    const data = msg.line || msg;

    const line = document.createElement('div');

    if (msg.system || data.system) {
      line.className = 'chat-line system';
      line.textContent = data.text || '';
    } else {
      line.className = 'chat-line';
      const who = data.name || data.from || 'Player';
      const av  = data.avatar || '🙂';
      const txt = data.text || '';
      line.innerHTML =
        `<span class="chat-av">${esc(av)}</span>` +
        `<span class="who">${esc(who)}:</span>` +
        `<span class="txt">${esc(txt)}</span>`;
    }
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;

    const fromId = data.from || data.playerId;
    if (fromId && fromId !== Net.playerId && typeof Haptics !== 'undefined') Haptics.tap();
  },

  onChatCleared(msg) {
    const log = document.getElementById('chatLog');
    if (!log) return;
    log.innerHTML = '';
    const line = document.createElement('div');
    line.className = 'chat-line system';
    line.textContent = (msg && msg.by) ? `${msg.by} cleared the chat` : 'Chat cleared';
    log.appendChild(line);
  },

  onEmote(msg) {
    const el = document.createElement('div');
    el.className = 'emoji-float';
    el.textContent = msg.emoji || '';
    el.style.left = (10 + Math.random() * 80) + '%';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  },

  onPlayerLeft(msg) {
    const id = msg.playerId || msg.id;
    const name = msg.name || 'A player';

    const log = document.getElementById('chatLog');
    if (log) {
      const line = document.createElement('div');
      line.className = 'chat-line system';
      line.textContent = `${name} left`;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    }

    if (!Net.isHost) return;
    const s = ArenaView.state;
    if (!s || s.winner !== null) return;

    const idx = s.players.findIndex(p => p.id === id);
    if (idx === -1 || s.players[idx].isBot) return;

    s.players[idx].isBot = true;
    s.players[idx].name += ' (AI)';
    GameEngine.log(`${esc(s.players[idx].name)} disconnected — bot took over`, 'hot');
    ArenaView.render();

    if (s.turn === idx) {
      clearTimeout(GameEngine._botTimer);
      const myState = s;
      GameEngine._botTimer = setTimeout(() => {
        if (GameEngine.state !== myState) return;
        if (myState.winner !== null) return;
        BotAI.takeTurn(myState);
      }, 600);
    }
  },

  onRoomClosed(msg) {
    Toast.show((msg && msg.reason) || 'Room closed');
    this._teardownGame();
    Net.active = false;
    Net.isHost = false;
    Net.room = null;
    show('screen-home');
  },

  onKicked(msg) {
    Toast.show((msg && msg.reason) || 'Removed from room');
    this._teardownGame();
    Net.active = false;
    Net.isHost = false;
    Net.room = null;
    show('screen-home');
  },

  onError(msg) {
    Toast.show((msg && (msg.reason || msg.message)) || 'Something went wrong');
    Sound.bad();
  },

  /* ── Helpers ──────────────────────────────────────────── */

  _resetChatLog() {
    const log = document.getElementById('chatLog');
    if (log) log.innerHTML = '';
  },

  _teardownGame() {
    ArenaView.stopTimer();
    if (GameEngine._botTimer) { clearTimeout(GameEngine._botTimer); GameEngine._botTimer = null; }
    ArenaView.state = null;
    ArenaView._cardPool = null;
    if (typeof PrivacyScreen !== 'undefined') PrivacyScreen.hide();
    ['hand', 'opponents', 'log', 'discardPile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
  },

  /* ── Rendering ────────────────────────────────────────── */

  render() {
    const room = Net.room;
    if (!room) return;

    document.getElementById('roomCode').textContent = room.code || '·····';

    const clearBtn = document.getElementById('btnClearChat');
    if (clearBtn) clearBtn.style.display = Net.isHost ? '' : 'none';

    const players = room.players || [];
    const onlineCount = players.filter(p => p.connected).length;
    document.getElementById('roomCount').textContent = `${players.length}/8`;
    document.getElementById('roomStatusLine').textContent =
      Net.isHost ? `You're the host · ${onlineCount} online`
                 : `Waiting for host · ${onlineCount} online`;

    const list = document.getElementById('playerList');
    list.innerHTML = '';
    players.forEach(p => {
      const isHost = (p.id === room.hostId) ||
                     (Array.isArray(players) && p.isHost === true);
      const isMe = p.id === Net.playerId;
      const row = document.createElement('div');
      row.className = 'player-row' + (!p.connected && !p.isBot ? ' disconnected' : '');
      row.innerHTML = `
        <div class="player-av">${esc(p.avatar || '🙂')}</div>
        <div class="player-info">
          <div class="player-name">
            ${esc(p.name || 'Player')}${isMe ? ' <span style="color:var(--text-tertiary);font-size:11px">(you)</span>' : ''}
            ${isHost ? '<span class="crown">Host</span>' : ''}
          </div>
          <div class="player-meta">${p.isBot ? 'Bot' : (p.connected ? 'Ready' : 'Disconnected')}</div>
        </div>
      `;
      const actions = document.createElement('div');
      actions.className = 'player-actions';
      if (Net.isHost && !isMe) {
        const b = document.createElement('button');
        b.className = 'btn-mini';
        b.textContent = p.isBot ? 'Remove' : 'Kick';
        b.onclick = () => {
          if (p.isBot) Net.removeBot(p.id);
          else Net.kick(p.id);
        };
        actions.appendChild(b);
      }
      row.appendChild(actions);
      list.appendChild(row);
    });

    const addBotRow = document.getElementById('addBotRow');
    if (addBotRow) addBotRow.style.display =
      (Net.isHost && players.length < 8) ? '' : 'none';

    const settings = document.getElementById('roomSettings');
    if (settings) settings.style.display = Net.isHost ? '' : 'none';
    if (Net.isHost) {
      const ru = document.getElementById('roomUniverse');
      const rr = document.getElementById('roomRules');
      // Accept both field names.
      const uniKey = room.universe || room.universeId;
      const rulesKey = room.rules || room.rulesKey;
      if (uniKey && ru.value !== uniKey) ru.value = uniKey;
      if (rulesKey && rr.value !== rulesKey) rr.value = rulesKey;
    }

    const startBtn = document.getElementById('btnStartMatch');
    const waiting = document.getElementById('waitingBanner');
    const canStart = Net.isHost && players.length >= 2;
    if (startBtn) startBtn.style.display = canStart ? '' : 'none';
    if (waiting) {
      waiting.style.display = (!Net.isHost || !canStart) ? '' : 'none';
      if (!Net.isHost) waiting.textContent = 'Waiting for the host to start…';
      else if (players.length < 2) waiting.textContent = 'Need at least 2 players to start.';
      else waiting.textContent = '';
    }
  }
};