/* ============================================================
   js/network/Net.js — v2.13
   Adds: avatarImage in create/join, listRooms().
   ============================================================ */
const Net = {
  ws: null,
  active: false,
  isHost: false,
  playerId: null,
  myIndex: -1,
  room: null,
  connected: false,

  _reconnectAttempts: 0,
  _reconnectTimer: null,
  _url: null,
  _wantToReconnect: false,
  _handlers: {},

  url() {
    if (this._url) return this._url;
    const loc = window.location;
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    this._url = `${proto}//${loc.host}`;
    return this._url;
  },

  _saveSession(code, playerId) {
    if (!code || !playerId) return;
    try { sessionStorage.setItem('rv_session', JSON.stringify({ code, playerId })); } catch (e) {}
  },
  _loadSession() {
    try { return JSON.parse(sessionStorage.getItem('rv_session') || 'null'); }
    catch (e) { return null; }
  },
  _clearSession() {
    try { sessionStorage.removeItem('rv_session'); } catch (e) {}
  },

  connect() {
    if (this.ws && this.ws.readyState <= 1) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(this.url()); }
      catch (e) { return reject(e); }

      const to = setTimeout(() => {
        try { ws.close(); } catch (e) {}
        reject(new Error('timeout'));
      }, 8000);

      let settled = false;
      const settle = (fn, arg) => {
        if (settled) return;
        settled = true;
        clearTimeout(to);
        fn(arg);
      };

      ws.onopen = () => {
        this.ws = ws;
        this.connected = true;
        settle(resolve);
      };
      ws.onmessage = ev => {
        let msg;
        try { msg = JSON.parse(ev.data); }
        catch (e) { return; }
        if (!msg || typeof msg.type !== 'string') return;
        try { this._dispatch(msg); }
        catch (e) { console.error('[net] dispatch error', msg.type, e); }
      };
      ws.onclose = () => {
        this.connected = false;
        this.ws = null;
        if (!this._wantToReconnect) settle(reject, new Error('closed'));
        else this._scheduleReconnect();
      };
      ws.onerror = () => {
        if (!this._wantToReconnect) settle(reject, new Error('connection failed'));
      };
    });
  },

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    if (!this._wantToReconnect) return;

    if (this._reconnectAttempts >= 10) {
      this._reconnectAttempts = 0;
      this._wantToReconnect = false;
      this._clearSession();
      if (typeof Toast !== 'undefined') Toast.show('Could not reconnect');
      return;
    }

    const delay = Math.min(8000, 500 * Math.pow(1.6, this._reconnectAttempts++));
    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;
      try {
        await this.connect();
        const sess = this._loadSession();
        if (sess && sess.code && sess.playerId) {
          const me = this.room && this.room.players &&
                     this.room.players[this.myIndex];
          this._send({
            type: 'rejoin',
            code: sess.code,
            playerId: sess.playerId,
            playerName: (me && me.name) || 'Player',
            avatar: (me && me.avatar) || '🙂',
            avatarImage: (me && me.avatarImage) || null,
            badgeId: (typeof Achievements !== 'undefined' && Achievements.getBadgeId)
              ? Achievements.getBadgeId() : null
          });
        }
      } catch (e) {
        this._scheduleReconnect();
      }
    }, delay);
  },

  _send(obj) {
    if (this.ws && this.ws.readyState === 1) {
      try { this.ws.send(JSON.stringify(obj)); } catch (e) {}
    }
  },

  on(type, fn) {
    (this._handlers[type] = this._handlers[type] || []).push(fn);
  },

  _dispatch(msg) {
    switch (msg.type) {
      case 'welcome':
        if (!this.playerId) this.playerId = msg.playerId || msg.you;
        break;

      case 'created': {
        this.active = true;
        this.isHost = true;
        this.myIndex = 0;
        this.playerId = msg.playerId || msg.you;
        if (msg.room) this.room = msg.room;
        this._saveSession(msg.code, this.playerId);
        break;
      }

      case 'joined': {
        this.active = true;
        this.room = msg.room || this.room;
        this.playerId = msg.playerId || msg.you;
        this.myIndex = (this.room && this.room.players)
          ? this.room.players.findIndex(p => p.id === this.playerId) : -1;
        this.isHost = this._deriveIsHost(msg);
        this._saveSession(msg.code, this.playerId);
        break;
      }

      case 'rejoined': {
        this.active = true;
        this.room = msg.room || this.room;
        this.playerId = msg.playerId || msg.you;
        this.myIndex = (this.room && this.room.players)
          ? this.room.players.findIndex(p => p.id === this.playerId) : -1;
        this.isHost = this._deriveIsHost(msg);
        this._saveSession(msg.code, this.playerId);
        this._reconnectAttempts = 0;
        break;
      }

      case 'room_update':
      case 'start':
      case 'cancel_game': {
        if (msg.room) {
          this.room = msg.room;
          this.myIndex = this.room.players
            ? this.room.players.findIndex(p => p.id === this.playerId) : -1;
          this.isHost = this._deriveIsHost({ room: this.room });
          if (this.room.soundPack && typeof SoundPacks !== 'undefined') {
            SoundPacks.set(this.room.soundPack);
          }
        }
        break;
      }

      case 'room_closed':
      case 'kicked':
        this.active = false;
        this.isHost = false;
        this._wantToReconnect = false;
        this._clearSession();
        break;
    }

    const list = this._handlers[msg.type] || [];
    for (const fn of list) {
      try { fn(msg); }
      catch (e) { console.error('[net] handler error', msg.type, e); }
    }
  },

  _deriveIsHost(msg) {
    if (!this.playerId) return false;
    if (msg && msg.isHost === true) return true;
    const room = (msg && msg.room) || this.room;
    if (!room) return false;
    if (room.hostId) return room.hostId === this.playerId;
    if (Array.isArray(room.players)) {
      const me = room.players.find(p => p.id === this.playerId);
      if (me && me.isHost) return true;
    }
    return false;
  },

  _avatarPayload() {
    const p = (typeof LobbyView !== 'undefined' && LobbyView.profile) || {};
    return {
      name: p.name || 'Player',
      playerName: p.name || 'Player',
      avatar: p.avatar || '🙂',
      avatarImage: p.avatarImage || null,
      badgeId: (typeof Achievements !== 'undefined' && Achievements.getBadgeId)
        ? Achievements.getBadgeId() : null
    };
  },

  async create(name, avatar) {
    this._clearSession();
    this._wantToReconnect = true;
    this._reconnectAttempts = 0;
    await this.connect();
    const pay = this._avatarPayload();
    if (name) { pay.name = name; pay.playerName = name; }
    if (avatar) pay.avatar = avatar;
    this._send({ type: 'create', ...pay });
  },

  async join(code, name, avatar) {
    this._clearSession();
    this._wantToReconnect = true;
    this._reconnectAttempts = 0;
    await this.connect();
    const pay = this._avatarPayload();
    if (name) { pay.name = name; pay.playerName = name; }
    if (avatar) pay.avatar = avatar;
    this._send({ type: 'join', code: code.toUpperCase(), ...pay });
  },

  leave() {
    this._wantToReconnect = false;
    this._send({ type: 'leave' });
    this._clearSession();
    const ws = this.ws;
    this.ws = null;
    if (ws) { try { ws.close(); } catch (e) {} }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this.active = false;
    this.isHost = false;
    this.room = null;
    this.myIndex = -1;
    this.playerId = null;
    this.connected = false;
    this._reconnectAttempts = 0;
  },

  updateRoom(patch)  { this._send({ type: 'update_room', ...patch }); },
  addBot()           { this._send({ type: 'add_bot' }); },
  removeBot(botId)   { this._send({ type: 'remove_bot', botId }); },
  kick(playerId)     { this._send({ type: 'kick', playerId }); },
  chat(text)         { this._send({ type: 'chat', text }); },
  sendEmote(emoji)   { this._send({ type: 'emote', emoji }); },
  cancelGame()       { this._send({ type: 'cancel_game' }); },
  clearChat()        { this._send({ type: 'clear_chat' }); },
  setBadge(badgeId)  { this._send({ type: 'set_badge', badgeId: badgeId || null }); },
  listRooms()        { this._send({ type: 'list_rooms' }); },
  sendTaunt(text) {
    const t = String(text || '').slice(0, 80);
    if (t) this._send({ type: 'taunt', text: t });
  },
  sendRematchRequest() { this._send({ type: 'rematch_request' }); },

  hostBroadcast(state) {
    if (!this.active || !this.isHost || !state) return;
    this._send({ type: 'state_update', state: this.serialize(state) });
  },
  hostStartGame(state, rulesKey) {
    if (!this.active || !this.isHost) return;
    this._send({ type: 'start', state: this.serialize(state), rulesKey });
  },
  sendAction(action) {
    if (!this.active) return;
    this._send({ type: 'action', action });
  },

  serialize(state) { return JSON.parse(JSON.stringify(state)); },

  indexOf(a, b) {
    let state, playerId;
    if (b === undefined) {
      state = (typeof ArenaView !== 'undefined' && ArenaView.state) || null;
      playerId = a;
    } else { state = a; playerId = b; }
    if (!state || !Array.isArray(state.players)) return -1;
    return state.players.findIndex(p => p.id === playerId);
  }
};