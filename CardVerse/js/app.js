/* ============================================================
   app.js — boot + GameFlow (Pulse, multiplayer-aware)
   ============================================================ */

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const rnd = n => Math.floor(Math.random() * n);
const mod = (n, m) => ((n % m) + m) % m;
const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const Toast = {
  show(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; }, 1500);
    setTimeout(() => t.remove(), 1900);
  },
  achievement(def) {
    const el = document.createElement('div');
    el.className = 'achievement-toast';
    el.innerHTML = `
      <div class="ach-icon">${def.icon}</div>
      <div class="ach-text">
        <div class="ach-label">ACHIEVEMENT</div>
        <div class="ach-name">${esc(def.name)}</div>
        <div class="ach-desc">${esc(def.desc)}</div>
      </div>
    `;
    document.body.appendChild(el);
    if (typeof Sound !== 'undefined' && Sound.achievement) Sound.achievement();
    if (typeof Haptics !== 'undefined') Haptics.win();
    setTimeout(() => el.classList.add('out'), 4200);
    setTimeout(() => el.remove(), 4700);
  }
};

function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  if (id === 'screen-win' || id === 'screen-home') ArenaView.stopTimer();
}

const GameFlow = {
  lastConfig: null,

  startGame() {
    Net.active = false;
    Net.isHost = false;

    const lv = LobbyView;
    const count = lv.players;
    const bots = Math.min(lv.bots, count - 1);

    const names = ['You', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6', 'Player 7', 'Player 8'];
    const botNames = ['Nova', 'Rift', 'Echo', 'Vex', 'Zephyr', 'Onyx', 'Pixel'];
    const botAvatars = ['🤖', '👾', '🦊', '🐲', '🦉', '🐺', '👽'];

    const players = [];
    for (let i = 0; i < count; i++) {
      const isBot = i >= (count - bots);
      if (i === 0) {
        players.push(makePlayer({ name: lv.profile.name || 'Player', avatar: lv.profile.avatar, isBot: false }));
      } else if (isBot) {
        const bi = i - (count - bots);
        players.push(makePlayer({ name: botNames[bi % botNames.length], avatar: botAvatars[bi % botAvatars.length], isBot: true }));
      } else {
        players.push(makePlayer({ name: names[i], avatar: AVATARS[(i * 3 + 4) % AVATARS.length], isBot: false }));
      }
    }

    const universeName = lv.customDef
      ? `${lv.customDef.name} (custom)`
      : `${UNIVERSES[lv.universeId].icon} ${UNIVERSES[lv.universeId].name}`;

    const rulesLabel = RULE_PRESETS[RuleStudioView.presetKey]?.name || 'Custom';

    this.lastConfig = {
      players, universeId: lv.universeId, customDef: lv.customDef,
      rules: JSON.parse(JSON.stringify(RuleStudioView.rules)),
      universeName
    };

    const state = GameEngine.create({
      players,
      universeId: lv.universeId,
      customDef: lv.customDef,
      rules: this.lastConfig.rules,
      universeName
    });
    state.rulesLabel = rulesLabel;

    if (typeof Achievements !== 'undefined') Achievements.onMatchStart();

    show('screen-game');
    ArenaView.mount(state, 0);
    ArenaView.afterAction();

    let d = 0;
    for (let i = 0; i < count * 2; i++) setTimeout(() => Sound.deal(), (d++) * 45);

    if (state.players[state.turn].isBot) setTimeout(() => BotAI.takeTurn(state), 1200);
  },

  startMultiplayer() {
    const room = Net.room;
    if (!room || !Net.isHost) return;
    if (room.players.length < 2) { Toast.show('Need at least 2 players'); return; }

    const rules = RULE_PRESETS[room.rulesKey]
      ? RULE_PRESETS[room.rulesKey].rules()
      : defaultRules();

    const players = room.players.map(p =>
      makePlayer({ id: p.id, name: p.name, avatar: p.avatar, isBot: !!p.isBot }));

    const universeName = room.customDef
      ? `${room.customDef.name} (custom)`
      : room.universeName;

    const state = GameEngine.create({
      players,
      universeId: room.universeId,
      customDef: room.customDef,
      rules,
      universeName
    });
    state.rulesLabel = RULE_PRESETS[room.rulesKey]?.name || 'Custom';

    if (typeof Achievements !== 'undefined') Achievements.onMatchStart();

    Net.hostStartGame(state, room.rulesKey);
    this.enterMultiplayerGame(state, room.rulesKey);
  },

  enterMultiplayerGame(state, rulesKey) {
    ArenaView._cardPool = new Map();

    const localIdx = state.players.findIndex(p => p.id === Net.playerId);
    show('screen-game');
    ArenaView.mount(state, localIdx >= 0 ? localIdx : 0);
    ArenaView.afterAction();

    let d = 0;
    for (let i = 0; i < state.players.length * 2; i++) setTimeout(() => Sound.deal(), (d++) * 45);

    const cur = state.players[state.turn];
    if (cur && cur.isBot && Net.isHost) {
      setTimeout(() => BotAI.takeTurn(state), 1200);
    }
  },

  applyStateUpdate(state) {
    if (!state) return;
    if (!ArenaView.state) {
      this.enterMultiplayerGame(state, 'classic');
      return;
    }
    ArenaView.state = state;
    ArenaView.render();
    ArenaView.renderLog();
    ArenaView.afterAction();
  },

  applyRemoteAction(fromId, action) {
    const s = ArenaView.state;
    if (!s || s.winner !== null) return;
    const idx = s.players.findIndex(p => p.id === fromId);
    if (idx === -1) return;
    // Only the current player can act
    if (s.turn !== idx) return;

    let res;
    if (action.kind === 'PLAY') {
      res = GameEngine.playCard(s, idx, action.uid, action.color || null);
    } else if (action.kind === 'DRAW') {
      res = GameEngine.playerDraw(s, idx);
    } else if (action.kind === 'PASS') {
      res = GameEngine.playerPass(s, idx);
    } else {
      return;
    }

    if (!res || !res.ok) return;
    ArenaView.afterAction();
  },

  showWinner(idx) {
    ArenaView.stopTimer();
    if (GameEngine._botTimer) { clearTimeout(GameEngine._botTimer); GameEngine._botTimer = null; }

    const s = ArenaView.state;
    const p = s.players[idx];
    const isMe = (Net.active && s.players[idx].id === Net.playerId) || (!Net.active && idx === 0);

    if (typeof Achievements !== 'undefined') Achievements.onMatchEnd(idx, s);

    document.getElementById('winEmoji').textContent = isMe ? '🏆' : '💀';
    document.getElementById('winTitle').textContent = isMe ? 'Victory!' : `${p.name} wins`;
    document.getElementById('winSub').textContent = isMe ? 'You emptied your hand first.' : 'Better luck next round.';

    const elapsed = Math.round((Date.now() - s.startedAt) / 1000);
    const abilities = s.players.reduce((a, x) => a + x.stats.abilities, 0);

    document.getElementById('winStats').innerHTML = `
      <div class="win-stat"><div class="sv">${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}</div><div class="sk">Duration</div></div>
      <div class="win-stat"><div class="sv">${s.turnCount}</div><div class="sk">Turns</div></div>
      <div class="win-stat"><div class="sv">${abilities}</div><div class="sk">Abilities</div></div>
      <div class="win-stat"><div class="sv">${s.players.length}</div><div class="sk">Players</div></div>
    `;

    show('screen-win');
    if (isMe) { Sound.win(); if (typeof Haptics !== 'undefined') Haptics.win(); }
    else { Sound.lose(); if (typeof Haptics !== 'undefined') Haptics.lose(); }

    const cx = innerWidth / 2, cy = innerHeight * .35;
    for (let i = 0; i < 7; i++) {
      setTimeout(() => {
        const colors = ['#E63946', '#3A7BD5', '#2A9D8F', '#E9C46A', '#9B5DE5', '#FF4D6D'];
        FX.burst(cx + (Math.random() - .5) * 320, cy + (Math.random() - .5) * 140,
          colors[rnd(colors.length)], 34, 1.3);
      }, i * 180);
    }
  },

  rematch() {
    if (Net.active) {
      ArenaView.state = null;
      show('screen-room');
      RoomView.render();
      return;
    }

    if (!this.lastConfig) return;
    ArenaView.stopTimer();
    if (GameEngine._botTimer) { clearTimeout(GameEngine._botTimer); GameEngine._botTimer = null; }

    const cfg = this.lastConfig;
    cfg.players.forEach(p => {
      p.hand = []; p.shield = 0; p.immune = false;
      p.stats = { played: 0, drawn: 0, abilities: 0 };
    });
    const state = GameEngine.create({
      players: cfg.players,
      universeId: cfg.universeId,
      customDef: cfg.customDef,
      rules: cfg.rules,
      universeName: cfg.universeName
    });
    state.rulesLabel = RULE_PRESETS[RuleStudioView.presetKey]?.name || 'Custom';

    if (typeof Achievements !== 'undefined') Achievements.onMatchStart();

    show('screen-game');
    ArenaView.mount(state, 0);
    ArenaView.afterAction();
    if (state.players[state.turn].isBot) setTimeout(() => BotAI.takeTurn(state), 1200);
  }
};

// ---------- Net event wiring ----------
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

  Net.on('game_start', msg => {
    if (!Net.isHost) GameFlow.enterMultiplayerGame(msg.state, msg.rulesKey);
  });

  Net.on('state_update', msg => {
    if (Net.isHost) return;
    GameFlow.applyStateUpdate(msg.state);
  });

  Net.on('action', msg => {
    if (!Net.isHost) return;
    GameFlow.applyRemoteAction(msg.fromId, msg.action);
  });
}

// ---------- boot ----------
(function boot() {
  Settings.init();
  Achievements.init();
  LobbyView.init();
  RoomView.init();
  wireNet();

  document.getElementById('btnDraw').onclick = () => {
    const s = ArenaView.state;
    if (!s || s.winner !== null) return;
    if (s.turn !== ArenaView._localIdx) return;
    Sound.click(); Haptics.tap();
    if (Net.active && !Net.isHost) {
      Net.sendAction({ kind: 'DRAW' });
      return;
    }
    const res = GameEngine.playerDraw(s, ArenaView._localIdx);
    if (!res.ok) { Toast.show(res.reason); Haptics.error(); return; }
    ArenaView.afterAction();
  };

  document.getElementById('btnPass').onclick = () => {
    const s = ArenaView.state;
    if (!s || s.winner !== null) return;
    if (s.turn !== ArenaView._localIdx) return;
    Sound.click(); Haptics.tap();
    if (Net.active && !Net.isHost) {
      Net.sendAction({ kind: 'PASS' });
      return;
    }
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
      (a.value ?? 99) - (b.value ?? 99)
    );
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
    PrivacyScreen.hide();
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

  document.getElementById('btnJoinRoom').onclick = () => {
    Sound.click();
    const m = Modal.open(`
      <h2>🔗 Join a Room</h2>
      <div class="hint">Enter the code your friend shared.</div>
      <label class="fl">Room Code</label>
      <input id="joinCode" placeholder="ABCD-42" maxlength="10"
             style="text-transform:uppercase;letter-spacing:3px;font-weight:900">
      <button class="btn primary big" id="joinGo" style="width:100%;margin-top:16px">Join</button>
      <div class="hint" id="joinErr" style="color:var(--danger);display:none;margin-top:10px;font-weight:800"></div>
    `);
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

  addEventListener('keydown', e => {
    if (e.key === 'Escape') Modal.close();
    if (e.key === 'd' && document.getElementById('screen-game').classList.contains('active'))
      document.getElementById('btnDraw').click();
    if (e.key === ' ') {
      e.preventDefault();
      if (document.getElementById('screen-game').classList.contains('active'))
        document.getElementById('btnPass').click();
    }
  });

  const unlock = () => {
    Sound.click();
    document.removeEventListener('pointerdown', unlock);
  };
  document.addEventListener('pointerdown', unlock);

  window.RuleVerse = {
    UNIVERSES, RULE_SCHEMA, RULE_PRESETS, defaultRules,
    GameEngine, RuleEngine, BotAI, ArenaView, GameFlow, Net, RoomView,
    Achievements, Settings, Haptics,
    simulate(games = 200, playerCount = 4, universeId = 'marvel', presetKey = 'classic') {
      const results = { wins: {}, turns: 0, errors: 0, maxTurns: 0 };
      for (let g = 0; g < games; g++) {
        const players = [];
        for (let i = 0; i < playerCount; i++)
          players.push(makePlayer({ name: 'P' + i, avatar: '🤖', isBot: true }));
        const st = GameEngine.create({
          players, universeId, customDef: null,
          rules: RULE_PRESETS[presetKey].rules(),
          universeName: universeId
        });
        let guard = 0;
        try {
          while (st.winner === null && guard++ < 3000) {
            const p = st.players[st.turn];
            if (st.pendingDraw > 0) {
              const stackable = p.hand.filter(c => RuleEngine.canStack(c, st, st.rules));
              if (stackable.length) {
                GameEngine.playCard(st, st.turn, stackable[0].uid, GameEngine.botColorChoice(st, st.turn));
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
            GameEngine.playCard(st, st.turn, pick.uid,
              pick.color === 'wild' ? GameEngine.botColorChoice(st, st.turn) : null);
          }
          if (st.winner === null) results.errors++;
          else results.wins[st.winner] = (results.wins[st.winner] || 0) + 1;
          results.turns += guard;
          results.maxTurns = Math.max(results.maxTurns, guard);
        } catch (e) { results.errors++; console.error('Sim error:', e); }
      }
      results.avgTurns = Math.round(results.turns / games);
      console.table({ games, playerCount, universeId, presetKey, avgTurns: results.avgTurns, maxTurns: results.maxTurns, errors: results.errors });
      return results;
    }
  };

  console.log('%c RULEVERSE ', 'background:linear-gradient(90deg,#FF4D6D,#9B5DE5);color:#fff;font-weight:900;padding:3px 8px;border-radius:4px',
    '\nMultiplayer wired. Start the server with: cd server && npm start');
})();