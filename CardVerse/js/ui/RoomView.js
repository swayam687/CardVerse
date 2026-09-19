/* ============================================================
   ui/RoomView.js
   ---------------------------------------------------------
   Multiplayer lobby. Host controls settings + start.
   Everyone sees the player list and chat.
   Host can clear the chat for all players.
   ============================================================ */
const RoomView = {
  _bound: false,

  init() {
    if (this._bound) return;
    this._bound = true;

    document.getElementById('btnRoomBack').onclick = () => {
      Sound.click();
      if (Net.active) Net.leave();
      show('screen-home');
    };

    document.getElementById('codeCard').onclick = () => {
      const code = Net.room?.code || '';
      if (!code) return;
      try { navigator.clipboard.writeText(code); } catch(e){}
      Toast.show('Code copied');
      Haptics.tap();
    };

    document.getElementById('btnAddBot').onclick = () => {
      Sound.click();
      Net.addBot();
    };

    document.getElementById('btnStartMatch').onclick = () => {
      Sound.click();
      GameFlow.startMultiplayer();
    };

    document.getElementById('chatForm').onsubmit = e => {
      e.preventDefault();
      const inp = document.getElementById('chatInput');
      const text = inp.value.trim();
      if (!text) return;
      Net.chat(text);
      inp.value = '';
    };

    // Host-only: clear chat for everyone
    document.getElementById('btnClearChat').onclick = () => {
      Sound.click();
      Net.clearChat();
    };

    const ru = document.getElementById('roomUniverse');
    Object.values(UNIVERSES).forEach(u => {
      const o = document.createElement('option');
      o.value = u.id;
      o.textContent = `${u.icon} ${u.name}`;
      ru.appendChild(o);
    });
    ru.onchange = () => {
      const u = UNIVERSES[ru.value];
      Net.updateRoom({
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
      Net.updateRoom({ rulesKey: rr.value });
    };
  },

  // ────────────────────── Net event handlers ──────────────────────

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
    if (msg.room.started && msg.room.state) {
      if (ArenaView.state) {
        GameFlow.applyStateUpdate(msg.room.state);
      } else {
        GameFlow.enterMultiplayerGame(msg.room.state, msg.room.rulesKey);
      }
    }
  },

  onRoomUpdate(msg) {
    this.render();
    // If the host cancelled the match, drop back to the room
    if (!msg.room.started && ArenaView.state) {
      this._teardownGame();
      show('screen-room');
      Toast.show('Match ended');
      return;
    }
    if (msg.room.started && msg.room.state && !ArenaView.state) {
      GameFlow.enterMultiplayerGame(msg.room.state, msg.room.rulesKey);
    }
  },

  onChat(msg) {
    const log = document.getElementById('chatLog');
    if (!log) return;
    const line = document.createElement('div');
    if (msg.system) {
      line.className = 'chat-line system';
      line.textContent = msg.text;
    } else {
      line.className = 'chat-line';
      line.innerHTML = `<span class="who">${esc(msg.name)}:</span><span class="txt">${esc(msg.text)}</span>`;
    }
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
    if (msg.from !== Net.playerId) Haptics.tap();
  },

  onChatCleared(msg) {
    const log = document.getElementById('chatLog');
    if (!log) return;
    log.innerHTML = '';
    const line = document.createElement('div');
    line.className = 'chat-line system';
    line.textContent = msg.by ? `${msg.by} cleared the chat` : 'Chat cleared';
    log.appendChild(line);
  },

  onEmote(msg) {
    const el = document.createElement('div');
    el.className = 'emoji-float';
    el.textContent = msg.emoji;
    el.style.left = (10 + Math.random() * 80) + '%';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  },

  // Host takes over the disconnected player's seat with a bot
  onPlayerLeft(msg) {
    const log = document.getElementById('chatLog');
    if (log) {
      const line = document.createElement('div');
      line.className = 'chat-line system';
      line.textContent = `${msg.name} left`;
      log.appendChild(line);
      log.scrollTop = log.scrollHeight;
    }

    if (!Net.isHost) return;
    const s = ArenaView.state;
    if (!s || s.winner !== null) return;

    const idx = s.players.findIndex(p => p.id === msg.id);
    if (idx === -1 || s.players[idx].isBot) return;

    s.players[idx].isBot = true;
    s.players[idx].name += ' (AI)';
    GameEngine.log(`${s.players[idx].name} disconnected — bot took over`, 'hot');
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
    Toast.show(msg.reason || 'Room closed');
    this._teardownGame();
    Net.active = false;
    Net.isHost = false;
    Net.room = null;
    show('screen-home');
  },

  onKicked(msg) {
    Toast.show(msg.reason || 'Removed from room');
    this._teardownGame();
    Net.active = false;
    Net.isHost = false;
    Net.room = null;
    show('screen-home');
  },

  onError(msg) {
    Toast.show(msg.reason || 'Something went wrong');
    Sound.bad();
  },

  // ────────────────────── Helpers ──────────────────────

  _resetChatLog() {
    const log = document.getElementById('chatLog');
    if (log) log.innerHTML = '';
  },

  _teardownGame() {
    ArenaView.stopTimer();
    if (GameEngine._botTimer) { clearTimeout(GameEngine._botTimer); GameEngine._botTimer = null; }
    ArenaView.state = null;
    ArenaView._cardPool = null;
    PrivacyScreen.hide();
    ['hand', 'opponents', 'log', 'discardPile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
  },

  // ────────────────────── Rendering ──────────────────────

  render() {
    const room = Net.room;
    if (!room) return;

    document.getElementById('roomCode').textContent = room.code;

    // Show Clear button only for the host
    const clearBtn = document.getElementById('btnClearChat');
    if (clearBtn) clearBtn.style.display = Net.isHost ? '' : 'none';

    const onlineCount = room.players.filter(p => p.connected).length;
    document.getElementById('roomCount').textContent = `${room.players.length}/8`;
    document.getElementById('roomStatusLine').textContent =
      Net.isHost ? `You're the host · ${onlineCount} online`
                 : `Waiting for host · ${onlineCount} online`;

    const list = document.getElementById('playerList');
    list.innerHTML = '';
    room.players.forEach(p => {
      const isHost = p.id === room.hostId;
      const isMe = p.id === Net.playerId;
      const row = document.createElement('div');
      row.className = 'player-row' + (!p.connected && !p.isBot ? ' disconnected' : '');
      row.innerHTML = `
        <div class="player-av">${p.avatar}</div>
        <div class="player-info">
          <div class="player-name">
            ${esc(p.name)}${isMe ? ' <span style="color:var(--text-tertiary);font-size:11px">(you)</span>' : ''}
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
    addBotRow.style.display = (Net.isHost && room.players.length < 8) ? '' : 'none';

    const settings = document.getElementById('roomSettings');
    settings.style.display = Net.isHost ? '' : 'none';
    if (Net.isHost) {
      const ru = document.getElementById('roomUniverse');
      const rr = document.getElementById('roomRules');
      if (ru.value !== room.universeId) ru.value = room.universeId;
      if (rr.value !== room.rulesKey) rr.value = room.rulesKey;
    }

    const startBtn = document.getElementById('btnStartMatch');
    const waiting = document.getElementById('waitingBanner');
    const canStart = Net.isHost && room.players.length >= 2;
    startBtn.style.display = canStart ? '' : 'none';
    waiting.style.display = (!Net.isHost || !canStart) ? '' : 'none';
    if (!Net.isHost) {
      waiting.textContent = 'Waiting for the host to start…';
    } else if (room.players.length < 2) {
      waiting.textContent = 'Need at least 2 players to start.';
    } else {
      waiting.textContent = '';
    }
  }
};