/* ============================================================
   js/network/Net.js — host-authority WebSocket client
   ---------------------------------------------------------
   FIX 2: persistent session so reconnects claim the same seat.
   FIX 4: cancelGame() lets the host abort a running match.
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

  // ── FIX 2: session persistence (per-tab, survives reload)
  _saveSession(code, playerId) {
    try { sessionStorage.setItem('rv_session', JSON.stringify({ code, playerId })); } catch(e){}
  },
  _loadSession() {
    try { return JSON.parse(sessionStorage.getItem('rv_session') || 'null'); } catch(e){ return null; }
  },
  _clearSession() {
    try { sessionStorage.removeItem('rv_session'); } catch(e){}
  },

  connect() {
    if (this.ws && this.ws.readyState <= 1) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(this.url()); }
      catch (e) { return reject(e); }

      const to = setTimeout(() => { try { ws.close(); } catch(e){} reject(new Error('timeout')); }, 8000);

      ws.onopen = () => {
        clearTimeout(to);
        this.ws = ws;
        this.connected = true;
        resolve();
      };
      ws.onmessage = ev => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch(e){ return; }
        this._dispatch(msg);
      };
      ws.onclose = () => {
        this.connected = false;
        if (this._wantToReconnect) this._scheduleReconnect();
      };
      ws.onerror = () => { clearTimeout(to); reject(new Error('connection failed')); };
    });
  },

  _scheduleReconnect() {
    if (this._reconnectTimer) return;
    if (this._reconnectAttempts >= 10) {
      this._wantToReconnect = false;
      this._reconnectAttempts = 0;
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
        if (sess) {
          this._send({ type: 'rejoin', code: sess.code, playerId: sess.playerId });
        }
      } catch (e) {
        this._scheduleReconnect();
      }
    }, delay);
  },

  _send(obj) {
    if (this.ws && this.ws.readyState === 1) {
      try { this.ws.send(JSON.stringify(obj)); } catch(e){}
    }
  },

  on(type, fn) {
    (this._handlers[type] = this._handlers[type] || []).push(fn);
  },

  _dispatch(msg) {
    switch (msg.type) {
      case 'welcome':
        // Don't clobber our persistent room id if we already have one.
        if (!this.playerId) this.playerId = msg.playerId;
        break;
      case 'created':
        this.active = true;
        this.isHost = true;
        this.room = msg.room;
        this.myIndex = 0;
        this.playerId = msg.playerId;
        this._saveSession(msg.code, msg.playerId);
        break;
      case 'joined':
        this.active = true;
        this.isHost = (msg.room.hostId === msg.playerId);
        this.room = msg.room;
        this.myIndex = msg.room.players.findIndex(p => p.id === msg.playerId);
        this.playerId = msg.playerId;
        this._saveSession(msg.code, msg.playerId);
        break;
      case 'rejoined':
        this.active = true;
        this.isHost = (msg.room.hostId === msg.playerId);
        this.room = msg.room;
        this.myIndex = msg.room.players.findIndex(p => p.id === msg.playerId);
        this.playerId = msg.playerId;
        this._saveSession(msg.code, msg.playerId);
        this._reconnectAttempts = 0;
        break;
      case 'room_update':
      case 'game_start':
        if (msg.room) {
          this.room = msg.room;
          this.myIndex = this.room.players.findIndex(p => p.id === this.playerId);
        }
        break;
      case 'room_closed':
      case 'kicked':
        this.active = false;
        this.isHost = false;
        this._wantToReconnect = false;
        this._clearSession();
        break;
    }
    const list = this._handlers[msg.type] || [];
    for (const fn of list) { try { fn(msg); } catch(e){ console.error(e); } }
  },

  async create(name, avatar) {
    this._clearSession();
    this._wantToReconnect = true;
    this._reconnectAttempts = 0;
    await this.connect();
    this._send({ type: 'create', name, avatar });
  },

  async join(code, name, avatar) {
    this._clearSession();
    this._wantToReconnect = true;
    this._reconnectAttempts = 0;
    await this.connect();
    this._send({ type: 'join', code, name, avatar });
  },

  leave() {
    this._send({ type: 'leave' });
    this._wantToReconnect = false;
    this._clearSession();
    if (this.ws) { try { this.ws.close(); } catch(e){} }
    this.ws = null;
    this.active = false;
    this.isHost = false;
    this.room = null;
    this.myIndex = -1;
  },

    updateRoom(patch)  { this._send({ type: 'update_room', ...patch }); },
  addBot()           { this._send({ type: 'add_bot' }); },
  removeBot(botId)   { this._send({ type: 'remove_bot', botId }); },
  kick(playerId)     { this._send({ type: 'kick', playerId }); },
  chat(text)         { this._send({ type: 'chat', text }); },
  sendEmote(emoji)   { this._send({ type: 'emote', emoji }); },
  cancelGame()       { this._send({ type: 'cancel_game' }); },
  clearChat()        { this._send({ type: 'clear_chat' }); },   // ← new

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

  serialize(state) {
    return JSON.parse(JSON.stringify(state));
  },

  indexOf(state, playerId) {
    if (!state) return -1;
    return state.players.findIndex(p => p.id === playerId);
  }
};