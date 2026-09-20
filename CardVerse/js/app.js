/* ============================================================
   app.js — boot + GameFlow
   v2.13: browse public rooms, soundPacks, profile hookup.
   ============================================================ */

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const Toast = {
  _queue: [], _busy: false,
  show(msg) { this._queue.push({ kind: 'plain', msg }); this._pump(); },
  achievement(def) { this._queue.push({ kind: 'ach', def }); this._pump(); },
  _pump() {
    if (this._busy) return;
    const item = this._queue.shift();
    if (!item) return;
    this._busy = true;
    if (item.kind === 'ach') this._showAch(item.def);
    else this._showPlain(item.msg);
  },
  _done() { this._busy = false; setTimeout(() => this._pump(), 120); },
  _showPlain(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; }, 1500);
    setTimeout(() => { t.remove(); this._done(); }, 1900);
  },
  _showAch(def) {
    const el = document.createElement('div');
    el.className = 'achievement-toast';
    el.innerHTML = `
      <div class="ach-icon">${esc(def.icon || '🏆')}</div>
      <div class="ach-text">
        <div class="ach-label">ACHIEVEMENT</div>
        <div class="ach-name">${esc(def.name || '')}</div>
        <div class="ach-desc">${esc(def.desc || '')}</div>
      </div>`;
    document.body.appendChild(el);
    if (typeof Sound !== 'undefined' && Sound.achievement) Sound.achievement();
    if (typeof Haptics !== 'undefined') Haptics.win();
    setTimeout(() => el.classList.add('out'), 3800);
    setTimeout(() => { el.remove(); this._done(); }, 4300);
  }
};

function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  if (id === 'screen-win' || id === 'screen-home') ArenaView.stopTimer();
}

const COMMUNITY = { DISCORD_URL: 'https://discord.gg/ruleverse' };

function openCommunityModal() {
  if (typeof Modal === 'undefined') return;
  const m = Modal.open(`
    <h2>💬 Community</h2>
    <div class="community-hero">
      <div class="ch-icon">🌍</div>
      <div class="ch-title">Join the RuleVerse</div>
      <div class="ch-sub">Play, share decks, and vote on what's next.</div>
    </div>
    <div class="community-card"><b>🎨 Vote for upcoming universes</b><br>Head to <code>#universe-votes</code> in the Discord.</div>
    <div class="community-card"><b>🃏 Share custom decks</b><br>Paste your Deck Studio JSON into <code>#deck-share</code>.</div>
    <div class="community-card"><b>🐛 Report bugs &amp; ideas</b><br>Drop them in <code>#feedback</code>.</div>
    <button class="btn primary big" style="width:100%;margin-top:16px" id="joinDiscord">Join Discord →</button>
    <button class="btn ghost big" style="width:100%;margin-top:8px" id="communityClose">Close</button>
  `);
  if (!m) return;
  m.querySelector('#joinDiscord').onclick = () => {
    if (typeof Sound !== 'undefined') Sound.click();
    try { window.open(COMMUNITY.DISCORD_URL, '_blank', 'noopener'); } catch (e) {}
  };
  m.querySelector('#communityClose').onclick = () => Modal.close();
}

const GameFlow = {
  lastConfig: null, _winnerShown: false, _rematchPending: false,

  startGame() {
    Net.active = false;
    Net.isHost = false;
    const lv = LobbyView;
    const count = lv.players;
    const bots = Math.min(lv.bots, count - 1);
    const names = ['You','Player 2','Player 3','Player 4','Player 5','Player 6','Player 7','Player 8'];
    const botNames = ['Nova','Rift','Echo','Vex','Zephyr','Onyx','Pixel'];
    const botAvatars = ['🤖','👾','🦊','🐲','🦉','🐺','👽'];
    const avatarPool = (typeof AVATARS !== 'undefined' && Array.isArray(AVATARS))
      ? AVATARS : ['🙂','😎','🦊','🐼','🐸','🐙','🦄','🐯'];

    const players = [];
    for (let i = 0; i < count; i++) {
      const isBot = i >= (count - bots);
      if (i === 0) {
        players.push(makePlayer({
          name: lv.profile.name || 'Player',
          avatar: lv.profile.avatar || '🙂',
          isBot: false
        }));
      } else if (isBot) {
        const bi = i - (count - bots);
        players.push(makePlayer({
          name: botNames[bi % botNames.length],
          avatar: botAvatars[bi % botAvatars.length],
          isBot: true
        }));
      } else {
        players.push(makePlayer({
          name: names[i],
          avatar: avatarPool[(i * 3 + 4) % avatarPool.length],
          isBot: false
        }));
      }
    }

    const universeName = lv.customDef
      ? `${lv.customDef.name} (custom)`
      : `${UNIVERSES[lv.universeId].icon} ${UNIVERSES[lv.universeId].name}`;
    const rulesLabel = RULE_PRESETS[RuleStudioView.presetKey]?.name || 'Custom';

    this.lastConfig = {
      players,
      universeId: lv.universeId,
      customDef: lv.customDef,
      rules: JSON.parse(JSON.stringify(RuleStudioView.rules)),
      universeName
    };

    const state = GameEngine.create({
      players, universeId: lv.universeId, customDef: lv.customDef,
      rules: this.lastConfig.rules, universeName
    });
    state.rulesLabel = rulesLabel;

    if (typeof Achievements !== 'undefined') Achievements.onMatchStart();
    if (typeof PrivacyScreen !== 'undefined' && PrivacyScreen.reset) PrivacyScreen.reset();
    this._winnerShown = false;

    if (typeof SoundPacks !== 'undefined') SoundPacks.set('default');

    show('screen-game');
    ArenaView.mount(state, 0);
    ArenaView.afterAction();

    let d = 0;
    for (let i = 0; i < count * 2; i++) setTimeout(() => Sound.deal(), (d++) * 45);
  },

  startMultiplayer() {
    const room = Net.room;
    if (!room || !Net.isHost) return;
    if ((room.players || []).length < 2) { Toast.show('Need at least 2 players'); return; }

    const key = room.rules || room.rulesKey;
    const rules = RULE_PRESETS[key] ? RULE_PRESETS[key].rules() : defaultRules();
    const safeRules = (typeof sanitizeRules === 'function') ? sanitizeRules(rules) : rules;

    const players = (room.players || []).map(p =>
      makePlayer({ id: p.id, name: p.name, avatar: p.avatar, isBot: !!p.isBot }));

    const universeName = room.customDef
      ? `${room.customDef.name} (custom)`
      : (room.universeName || room.universe || room.universeId || 'Marvel');

    const state = GameEngine.create({
      players, universeId: room.universe || room.universeId || 'marvel',
      customDef: room.customDef || null, rules: safeRules, universeName
    });
    state.rulesLabel = RULE_PRESETS[key]?.name || 'Custom';

    if (typeof Achievements !== 'undefined') Achievements.onMatchStart();
    this._winnerShown = false;
    this._rematchPending = false;

    Net.hostStartGame(state, key);
    this.enterMultiplayerGame(state, key);
  },

  enterMultiplayerGame(state, rulesKey) {
    ArenaView._cardPool = new Map();
    this._winnerShown = false;

    if (typeof SoundPacks !== 'undefined') {
      const pack = (Net.room && Net.room.soundPack) || 'default';
      SoundPacks.set(pack);
    }

    const localIdx = state.players.findIndex(p => p.id === Net.playerId);
    show('screen-game');
    ArenaView.mount(state, localIdx >= 0 ? localIdx : 0);
    ArenaView.afterAction();

    let d = 0;
    for (let i = 0; i < state.players.length * 2; i++) setTimeout(() => Sound.deal(), (d++) * 45);
  },

  applyStateUpdate(state) {
    if (!state) return;
    if (!ArenaView.state) { this.enterMultiplayerGame(state, 'classic'); return; }
    ArenaView.state = state;
    ArenaView.render();
    ArenaView.renderLog();
    ArenaView.afterAction();
  },

  applyRemoteAction(fromId, action) {
    const s = ArenaView.state;
    if (!s || s.winner !== null) return;
    if (!fromId || !action) return;
    const idx = s.players.findIndex(p => p.id === fromId);
    if (idx === -1) return;

    if (action.kind === 'CATCH') {
      const res = GameEngine.catchUno(s, idx);
      if (res && res.ok) ArenaView.afterAction();
      return;
    }
    if (action.kind === 'CALL_LAST') {
      if (!Array.isArray(s.lastCardCalled)) s.lastCardCalled = s.players.map(() => false);
      if (s.players[idx].hand.length === 1) {
        s.lastCardCalled[idx] = true;
        GameEngine.log(`<b>${esc(s.players[idx].name)}</b> calls LAST CARD!`, 'hot');
        ArenaView.afterAction();
      }
      return;
    }
    if (s.turn !== idx) return;

    if (action.kind === 'PLAY') {
      const player = s.players[idx];
      const card = player.hand.find(c => c.uid === action.uid);
      if (!card) return;
      if (!RuleEngine.isPlayable(card, s, s.rules)) return;
      if (!RuleEngine.meetsRequirement(card, player, s.rules)) return;
    }

    let res;
    if (action.kind === 'PLAY') {
      res = GameEngine.playCard(s, idx, action.uid, {
        color: action.color || null,
        targetIdx: action.targetIdx,
        cardUid: action.cardUid
      });
    } else if (action.kind === 'DRAW') res = GameEngine.playerDraw(s, idx);
    else if (action.kind === 'PASS') res = GameEngine.playerPass(s, idx);
    else return;

    if (!res || !res.ok) return;
    ArenaView.afterAction();
  },

  showWinner(idx) {
    if (this._winnerShown) return;
    this._winnerShown = true;
    ArenaView.stopTimer();
    if (GameEngine._botTimer) { clearTimeout(GameEngine._botTimer); GameEngine._botTimer = null; }

    const s = ArenaView.state;
    if (!s) return;
    if (idx === -1) {
      document.getElementById('winEmoji').textContent = '🤝';
      document.getElementById('winTitle').textContent = 'Stalemate';
      document.getElementById('winSub').textContent = 'Deck ran out with no winner.';
      document.getElementById('winStats').innerHTML = '';
      show('screen-win');
      return;
    }
    const p = s.players[idx];
    if (!p) return;
    const isMe = (Net.active && s.players[idx].id === Net.playerId) ||
                 (!Net.active && idx === 0);
    if (typeof Achievements !== 'undefined') Achievements.onMatchEnd(idx, s);

    document.getElementById('winEmoji').textContent = isMe ? '🏆' : '💀';
    document.getElementById('winTitle').textContent = isMe ? 'Victory!' : `${p.name} wins`;
    document.getElementById('winSub').textContent = isMe
      ? 'You emptied your hand first.' : 'Better luck next round.';

    const elapsed = Math.round((Date.now() - s.startedAt) / 1000);
    const abilities = s.players.reduce((a, x) => a + (x.stats?.abilities || 0), 0);
    document.getElementById('winStats').innerHTML = `
      <div class="win-stat"><div class="sv">${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}</div><div class="sk">Duration</div></div>
      <div class="win-stat"><div class="sv">${s.turnCount}</div><div class="sk">Turns</div></div>
      <div class="win-stat"><div class="sv">${abilities}</div><div class="sk">Abilities</div></div>
      <div class="win-stat"><div class="sv">${s.players.length}</div><div class="sk">Players</div></div>
    `;

    const btnRematch = document.getElementById('btnRematch');
    if (btnRematch) {
      if (Net.active) btnRematch.textContent = Net.isHost ? 'Rematch Now' : 'Request Rematch';
      else btnRematch.textContent = 'Rematch';
    }

    show('screen-win');
    if (isMe) { Sound.win(); if (typeof Haptics !== 'undefined') Haptics.win(); }
    else { Sound.lose(); if (typeof Haptics !== 'undefined') Haptics.lose(); }

    // Meme SFX on win
    if (typeof SoundPacks !== 'undefined') SoundPacks.play('airhorn');

    const cx = innerWidth / 2, cy = innerHeight * .35;
    for (let i = 0; i < 7; i++) {
      setTimeout(() => {
        const colors = ['#E63946','#3A7BD5','#2A9D8F','#E9C46A','#9B5DE5','#FF4D6D'];
        FX.burst(cx + (Math.random() - .5) * 320, cy + (Math.random() - .5) * 140,
          colors[rnd(colors.length)], 34, 1.3);
      }, i * 180);
    }
  },

  rematch() {
    if (Net.active) {
      const s = ArenaView.state;
      const gameEnded = !s || s.winner !== null;
      if (!gameEnded) return;
      if (Net.isHost) { this.startMultiplayer(); }
      else {
        Net.sendRematchRequest();
        Toast.show('Rematch requested');
        const btn = document.getElementById('btnRematch');
        if (btn) { btn.textContent = 'Requested ✓'; btn.disabled = true; }
      }
      return;
    }
    if (!this.lastConfig) return;
    ArenaView.stopTimer();
    if (GameEngine._botTimer) { clearTimeout(GameEngine._botTimer); GameEngine._botTimer = null; }
    this._winnerShown = false;
    const cfg = this.lastConfig;
    cfg.players.forEach(p => {
      p.hand = []; p.shield = 0; p.immune = false;
      p.stats = { played: 0, drawn: 0, abilities: 0 };
    });
    const state = GameEngine.create({
      players: cfg.players, universeId: cfg.universeId,
      customDef: cfg.customDef, rules: cfg.rules, universeName: cfg.universeName
    });
    state.rulesLabel = RULE_PRESETS[RuleStudioView.presetKey]?.name || 'Custom';
    if (typeof Achievements !== 'undefined') Achievements.onMatchStart();
    if (typeof PrivacyScreen !== 'undefined' && PrivacyScreen.reset) PrivacyScreen.reset();
    show('screen-game');
    ArenaView.mount(state, 0);
    ArenaView.afterAction();
  }
};

function wireNet() {
  Net.on('created',       msg => { RoomView.onCreated(msg); show('screen-room'); });
  Net.on('joined',        msg => { RoomView.onJoined(msg);  show('screen-room'); });
  Net.on('rejoined',      msg => RoomView.onRejoined(msg));
  Net.on('room_update',   msg => RoomView.onRoomUpdate(msg));
  Net.on('player_left',   msg => RoomView.onPlayerLeft(msg));
  Net.on('room_closed',   msg => RoomView.onRoomClosed(msg));
  Net.on('kicked',        msg => RoomView.onKicked(msg));
  Net.on('error',         msg => RoomView.onError(msg));
  Net.on('chat',          msg => RoomView.onChat(msg));
  Net.on('chat_cleared',  msg => RoomView.onChatCleared(msg));
  Net.on('emote',         msg => RoomView.onEmote(msg));

  const onStart = msg => {
    if (Net.isHost) return;
    const state = msg.state || (msg.room && msg.room.state);
    const rulesKey = msg.rulesKey || (msg.room && msg.room.rulesKey) || 'classic';
    if (state) GameFlow.enterMultiplayerGame(state, rulesKey);
  };
  Net.on('start',      onStart);
  Net.on('game_start', onStart);

  Net.on('state_update', msg => {
    if (Net.isHost) return;
    GameFlow.applyStateUpdate(msg.state);
  });

  Net.on('action', msg => {
    if (!Net.isHost) return;
    const from = msg.playerId || msg.fromId || msg.from;
    GameFlow.applyRemoteAction(from, msg.action);
  });

  Net.on('rematch_request', msg => {
    if (!Net.isHost) return;
    const s = ArenaView.state;
    if (s && s.winner === null) return;
    if (GameFlow._rematchPending) return;
    GameFlow._rematchPending = true;
    Toast.show(`${msg.fromName || 'A player'} started a rematch`);
    setTimeout(() => {
      GameFlow._rematchPending = false;
      const s2 = ArenaView.state;
      if (Net.isHost && (!s2 || s2.winner !== null)) GameFlow.startMultiplayer();
    }, 450);
  });
}

function checkUrlInvite() {
  let code = null;
  try {
    const params = new URLSearchParams(location.search);
    code = params.get('room');
  } catch (e) {}
  if (!code) {
    const m = location.pathname.match(/^\/r\/([A-Za-z0-9]{4,8})\/?$/);
    if (m) code = m[1];
  }
  if (!code) return;
  code = String(code).toUpperCase();
  if (!/^[A-Z0-9]{4,8}$/.test(code)) return;

  setTimeout(() => {
    if (typeof Modal === 'undefined') return;
    const m = Modal.open(`
      <h2>🔗 Join Room</h2>
      <div class="hint">You've been invited to a RuleVerse room.</div>
      <div class="code-card" style="margin:14px 0">
        <div class="cc-label">Room Code</div>
        <div class="cc-code">${esc(code)}</div>
      </div>
      <button class="btn primary big" id="urlJoinGo" style="width:100%">Join Room</button>
      <button class="btn ghost big" id="urlJoinCancel" style="width:100%;margin-top:8px">Not now</button>
    `);
    if (!m) return;
    m.querySelector('#urlJoinGo').onclick = async () => {
      const btn = m.querySelector('#urlJoinGo');
      btn.disabled = true; btn.textContent = 'Joining…';
      try {
        await Net.join(code, LobbyView.profile.name, LobbyView.profile.avatar);
        setTimeout(() => { if (Modal._isOpen) Modal.close(); }, 120);
        try { history.replaceState(null, '', '/'); } catch (e) {}
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Join Room';
        Toast.show('Could not reach the server');
      }
    };
    m.querySelector('#urlJoinCancel').onclick = () => {
      Modal.close();
      try { history.replaceState(null, '', '/'); } catch (e) {}
    };
  }, 400);
}

(function boot() {
  Settings.init();
  if (typeof Achievements !== 'undefined') Achievements.init();
  LobbyView.init();
  RoomView.init();
  wireNet();
  if (typeof Taunts !== 'undefined') Taunts.mount();
  if (typeof ShareRoom !== 'undefined') ShareRoom.mount();
  if (typeof RoomBrowser !== 'undefined') RoomBrowser.mount();
  if (typeof RoomExtras !== 'undefined') RoomExtras.mount();

  document.getElementById('btnDraw').onclick = () => {
    const s = ArenaView.state;
    if (!s || s.winner !== null) return;
    if (s.turn !== ArenaView._localIdx) return;
    Sound.click(); Haptics.tap();
    if (Net.active && !Net.isHost) { Net.sendAction({ kind: 'DRAW' }); return; }
    const res = GameEngine.playerDraw(s, ArenaView._localIdx);
    if (!res.ok) { Toast.show(res.reason); Haptics.error(); return; }
    ArenaView.afterAction();
  };

  document.getElementById('btnPass').onclick = () => {
    const s = ArenaView.state;
    if (!s || s.winner !== null) return;
    if (s.turn !== ArenaView._localIdx) return;
    Sound.click(); Haptics.tap();
    if (Net.active && !Net.isHost) { Net.sendAction({ kind: 'PASS' }); return; }
    const res = GameEngine.playerPass(s, ArenaView._localIdx);
    if (!res.ok) { Toast.show(res.reason); Haptics.error(); return; }
    ArenaView.afterAction();
  };

  document.getElementById('btnSortHand').onclick = () => {
    const s = ArenaView.state;
    if (!s) return;
    const p = s.players[ArenaView._localIdx];
    const colorOrder = { red: 0, blue: 1, green: 2, yellow: 3, wild: 4 };
    const typeOrder  = { number: 0, action: 1, special: 2 };
    p.hand.sort((a, b) =>
      colorOrder[a.color] - colorOrder[b.color] ||
      typeOrder[a.type] - typeOrder[b.type] ||
      (a.value ?? 99) - (b.value ?? 99));
    if (ArenaView._cardPool) ArenaView._cardPool.clear();
    const handEl = document.getElementById('hand');
    if (handEl) handEl.innerHTML = '';
    ArenaView.render();
    Haptics.tap();
  };

  document.getElementById('btnQuit').onclick = () => {
    ArenaView.stopTimer();
    if (GameEngine._botTimer) { clearTimeout(GameEngine._botTimer); GameEngine._botTimer = null; }
    ArenaView.state = null;
    ArenaView._cardPool = null;
    if (typeof PrivacyScreen !== 'undefined') PrivacyScreen.hide();
    const handEl = document.getElementById('hand');
    if (handEl) handEl.innerHTML = '';
    Sound.click();
    if (Net.active) {
      if (Net.isHost) Net.cancelGame();
      show('screen-room');
      RoomView.render();
    } else {
      show('screen-home');
    }
  };

  document.getElementById('btnRematch').onclick = () => { Sound.click(); GameFlow.rematch(); };
  document.getElementById('btnHome').onclick = () => {
    Sound.click();
    if (Net.active) Net.leave();
    show('screen-home');
  };

  document.getElementById('btnCreateRoom').onclick = async () => {
    Sound.click();
    const btn = document.getElementById('btnCreateRoom');
    btn.disabled = true;
    const orig = btn.textContent;
    btn.textContent = '🌐 Connecting…';
    try {
      await Net.create(LobbyView.profile.name, LobbyView.profile.avatar);
    } catch (e) {
      Toast.show('Could not reach the server. Is it running?');
      Sound.bad();
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  };

  document.getElementById('btnBrowseRooms').onclick = () => {
    Sound.click();
    if (typeof RoomBrowser !== 'undefined') RoomBrowser.open();
  };

  document.getElementById('btnJoinRoom').onclick = () => {
    Sound.click();
    const m = Modal.open(`
      <h2>🔗 Join a Room</h2>
      <div class="hint">Enter the code your friend shared.</div>
      <label class="fl">Room Code</label>
      <input id="joinCode" placeholder="ABCDE" maxlength="10"
             style="text-transform:uppercase;letter-spacing:3px;font-weight:900">
      <button class="btn primary big" id="joinGo" style="width:100%;margin-top:16px">Join</button>
      <div class="hint" id="joinErr" style="color:var(--danger);display:none;margin-top:10px;font-weight:800"></div>
    `);
    if (!m) return;
    const codeInp = m.querySelector('#joinCode');
    codeInp.focus();
    m.querySelector('#joinGo').onclick = async () => {
      const code = codeInp.value.trim().toUpperCase();
      if (!code) return;
      const err = m.querySelector('#joinErr');
      err.style.display = 'none';
      try {
        await Net.join(code, LobbyView.profile.name, LobbyView.profile.avatar);
        setTimeout(() => { if (Modal._isOpen) Modal.close(); }, 100);
      } catch (e) {
        err.style.display = 'block';
        err.textContent = 'Could not reach the server.';
      }
    };
    codeInp.addEventListener('keydown', e => {
      if (e.key === 'Enter') m.querySelector('#joinGo').click();
    });
  };

  const btnAch = document.getElementById('btnAchievements');
  if (btnAch) btnAch.onclick = () => {
    Sound.click();
    if (typeof Achievements !== 'undefined') Achievements.openHistoryModal();
  };
  const btnComm = document.getElementById('btnCommunity');
  if (btnComm) btnComm.onclick = () => { Sound.click(); openCommunityModal(); };

  addEventListener('keydown', e => {
    if (isTyping()) {
      if (e.key === 'Escape' && Modal._isOpen && !Modal._forceChoice) Modal.close();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape' && Modal._isOpen && !Modal._forceChoice) { Modal.close(); return; }

    const inGame = document.getElementById('screen-game').classList.contains('active');
    if (!inGame) return;

    if (e.key === 'd') document.getElementById('btnDraw').click();
    if (e.key === ' ') { e.preventDefault(); document.getElementById('btnPass').click(); }
    if (e.key === 'c' || e.key === 'C') {
      const bar = document.getElementById('lastCardBar');
      if (bar && bar.style.display !== 'none') {
        const b = document.getElementById('btnLastCard');
        if (b) b.click();
        return;
      }
      const cbtn = document.getElementById('btnCatchUno');
      if (cbtn && cbtn.style.display !== 'none') cbtn.click();
    }
    if (e.key === 't' || e.key === 'T') {
      if (typeof Taunts !== 'undefined') Taunts.toggle();
    }
  });

  const unlock = () => {
    if (typeof Sound !== 'undefined' && !Sound.muted) Sound.click();
    if (typeof SoundPacks !== 'undefined') SoundPacks.unlock();
    document.removeEventListener('pointerdown', unlock);
  };
  document.addEventListener('pointerdown', unlock);

  window.RuleVerse = {
    UNIVERSES, RULE_SCHEMA, RULE_PRESETS, defaultRules,
    GameEngine, RuleEngine, BotAI, ArenaView, GameFlow, Net, RoomView,
    Taunts, ShareRoom, RoomBrowser, RoomExtras, SoundPacks, ProfileEdit,
    Achievements, Settings, Haptics,
    simulate(games = 200, playerCount = 4, universeId = 'marvel', presetKey = 'classic') {
      const results = { wins: {}, turns: 0, errors: 0, maxTurns: 0 };
      for (let g = 0; g < games; g++) {
        const players = [];
        for (let i = 0; i < playerCount; i++)
          players.push(makePlayer({ name: 'P' + i, avatar: '🤖', isBot: true }));
        const st = GameEngine.create({
          players, universeId, customDef: null,
          rules: RULE_PRESETS[presetKey].rules(), universeName: universeId
        });
        let guard = 0;
        try {
          while (st.winner === null && guard++ < 3000) {
            const p = st.players[st.turn];
            if (st.pendingDraw > 0) {
              const stackable = p.hand.filter(c => RuleEngine.canStack(c, st, st.rules));
              if (stackable.length) {
                GameEngine.playCard(st, st.turn, stackable[0].uid, {
                  color: GameEngine.botColorChoice(st, st.turn)
                });
                continue;
              }
              GameEngine.playerDraw(st, st.turn);
              continue;
            }
            const playable = p.hand.filter(c =>
              RuleEngine.isPlayable(c, st, st.rules) &&
              RuleEngine.meetsRequirement(c, p, st.rules));
            if (!playable.length) {
              GameEngine.playerDraw(st, st.turn);
              if (st.winner === null) GameEngine.playerPass(st, st.turn);
              continue;
            }
            const pick = BotAI.choose(playable, st, st.turn);
            const opts = {};
            if (pick.color === 'wild') opts.color = GameEngine.botColorChoice(st, st.turn);
            const needsTarget = pick.effects.some(e => e.target === 'choose');
            if (needsTarget) {
              let bestT = -1, bestHand = -1;
              st.players.forEach((q, qi) => {
                if (qi === st.turn) return;
                if (q.hand.length > bestHand) { bestHand = q.hand.length; bestT = qi; }
              });
              if (bestT === -1) continue;
              opts.targetIdx = bestT;
            }
            const pickSteal = pick.effects.find(e => e.type === 'STEAL' && e.pick);
            if (pickSteal && typeof opts.targetIdx === 'number') {
              const victim = st.players[opts.targetIdx];
              if (victim.hand.length) opts.cardUid = victim.hand[0].uid;
            }
            GameEngine.playCard(st, st.turn, pick.uid, opts);
          }
          if (st.winner === null) results.errors++;
          else results.wins[st.winner] = (results.wins[st.winner] || 0) + 1;
          results.turns += guard;
          results.maxTurns = Math.max(results.maxTurns, guard);
        } catch (e) { results.errors++; console.error('Sim error:', e); }
      }
      results.avgTurns = Math.round(results.turns / games);
      console.table({ games, playerCount, universeId, presetKey,
        avgTurns: results.avgTurns, maxTurns: results.maxTurns, errors: results.errors });
      return results;
    }
  };

  checkUrlInvite();
  console.log('%c RULEVERSE ', 'background:linear-gradient(90deg,#FF4D6D,#9B5DE5);color:#fff;font-weight:900;padding:3px 8px;border-radius:4px',
    '\nMultiplayer wired. Start the server with: cd server && npm start');
})();