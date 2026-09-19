/* ============================================================
   ui/ArenaView.js — Pulse, network-aware
   ---------------------------------------------------------
   · _localIdx = your index in the state (net) OR turn (hotseat)
   · Non-host clients send actions; host applies + broadcasts
   · After every action, if host, broadcast state
   ============================================================ */
const ArenaView = {
  state: null,
  awaitingInput: false,
  _timerHandle: null,
  _timerPaused: false,
  _tooltip: null,
  _cardPool: null,
  _prevMyTurn: false,
  _lastPrivacyTurn: -1,
  _localIdx: 0,
  _emoteOpen: false,

/* ============================================================
   ui/ArenaView.js — replace only the mount() and afterAction()
   methods with these two versions. Everything else is unchanged.
   ============================================================ */

  mount(state, localIdx = 0) {
    this.state = state;
    this.awaitingInput = false;
    this._timerPaused = false;
    this._cardPool = new Map();
    this._prevMyTurn = false;
    this._lastPrivacyTurn = -1;
    this._localIdx = localIdx;
    this._emoteOpen = false;

    if (GameEngine._botTimer) { clearTimeout(GameEngine._botTimer); GameEngine._botTimer = null; }
    PrivacyScreen.hide();
    this._hideTooltip();

    ['hand', 'opponents', 'log', 'discardPile'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });

    const arenaRoot = document.getElementById('arenaRoot');
    if (arenaRoot) arenaRoot.dataset.universe = state.universeId || 'marvel';

    Emotes.init();
    const tray = document.getElementById('emoteTray');
    if (tray) tray.classList.remove('on');
    const emoteBtn = document.getElementById('btnEmote');
    if (emoteBtn) {
      emoteBtn.onclick = () => {
        this._emoteOpen = !this._emoteOpen;
        tray.classList.toggle('on', this._emoteOpen);
        Haptics.tap();
      };
    }

    this.render();
    this.renderLog();
    this.startTimer();
    setTimeout(() => Tutorial.start(), 900);
  },

  // ── FIX 8 + FIX 10 ──
  afterAction() {
    const s = this.state;
    if (!s) return;

    if (Net.active && Net.isHost) Net.hostBroadcast(s);

    if (s.winner !== null) {
      if (GameEngine._botTimer) { clearTimeout(GameEngine._botTimer); GameEngine._botTimer = null; }
      this.render();
      setTimeout(() => GameFlow.showWinner(s.winner), 750);
      return;
    }

    const cur = s.players[s.turn];
    const hotseat = !Net.active && PrivacyScreen.shouldShow(s);

    if (hotseat && !cur.isBot && s.turn !== this._localIdx && this._lastPrivacyTurn !== s.turn) {
      this._lastPrivacyTurn = s.turn;
      this._localIdx = s.turn;
      document.querySelector('.arena').classList.add('privacy-hidden');
      this.render();
      this.stopTimer();
      PrivacyScreen.showFor(cur, () => {
        document.querySelector('.arena').classList.remove('privacy-hidden');
        this.render();
        // ── FIX 8: restart turn timer after handoff
        if (!cur.isBot) this.startTimer();
      });
      return;
    }

    this.render();
    if (!cur.isBot) this.startTimer(); else this.stopTimer();

    // (Removed redundant bot-timer block — beginTurn() in GameEngine already
    //  schedules bots on the host. Leaving it in was causing a double schedule.)
  },
 

  render() {
    const s = this.state; if (!s) return;
    const humanIdx = this._localIdx;
    if (humanIdx < 0 || humanIdx >= s.players.length) return;

    document.getElementById('deckCount').textContent = s.deck.length;

    const opp = document.getElementById('opponents');
    opp.innerHTML = '';
    s.players.forEach((p, i) => {
      if (i === humanIdx) return;
      const isTurn = s.turn === i;
      const el = document.createElement('div');
      el.className = 'opp' + (isTurn ? ' active' : '') + (p.hand.length === 0 ? ' out' : '');
      el.innerHTML = `
        <div class="opp-top">
          <span class="opp-av">${p.avatar}</span>
          <span class="opp-nm">${esc(p.name)}</span>
        </div>
        <div class="opp-cnt">${p.hand.length}<small>CARDS</small></div>
      `;
      el.appendChild(CardRenderer.miniStack(p.hand.length));
      const badges = document.createElement('div');
      badges.className = 'opp-badges';
      if (p.shield > 0) badges.innerHTML += '<span class="badge" title="Shield">🛡️</span>';
      if (p.immune) badges.innerHTML += '<span class="badge" title="Immune">✨</span>';
      if (badges.innerHTML) el.appendChild(badges);
      opp.appendChild(el);
    });

    const dp = document.getElementById('discardPile');
    dp.innerHTML = '';
    const top = RuleEngine.top(s);
    if (top) {
      const el = CardRenderer.build(top);
      el.style.position = 'absolute';
      el.style.inset = '0';
      dp.appendChild(el);
    }

    const hex = COLOR_META[s.activeColor]?.hex || '#9B5DE5';
    const colorLabel = (COLOR_META[s.activeColor]?.label || 'Wild').toUpperCase();
    const lbl = document.getElementById('activeColorLbl');
    lbl.textContent = colorLabel;
    lbl.style.color = hex;
    document.getElementById('dirPill').textContent = s.direction === 1 ? '↻ CW' : '↺ CCW';

    const me = s.players[humanIdx];
    document.getElementById('myCount').textContent = `🂠 ${me.hand.length}`;

    const handEl = document.getElementById('hand');
    const isMyTurn = s.turn === humanIdx && s.winner === null;
    const currentUids = new Set(me.hand.map(c => c.uid));

    for (const [uid, node] of this._cardPool) {
      if (!currentUids.has(uid)) { node.remove(); this._cardPool.delete(uid); }
    }
    Array.from(handEl.children).forEach(child => {
      const uid = parseInt(child.dataset.uid, 10);
      if (!Number.isNaN(uid) && !currentUids.has(uid)) child.remove();
    });

    me.hand.forEach((card, idx) => {
      let el = this._cardPool.get(card.uid);
      if (!el) {
        el = CardRenderer.build(card);
        el.addEventListener('click', () => this.onCardClick(card, el));
        this._attachTooltip(el, card);
        this._cardPool.set(card.uid, el);
      }
      el.style.visibility = '';
      const playable = isMyTurn &&
        RuleEngine.isPlayable(card, s, s.rules) &&
        RuleEngine.meetsRequirement(card, me, s.rules);
      el.classList.toggle('playable', playable);
      el.classList.toggle('dim', !playable);
      if (handEl.children[idx] !== el) {
        handEl.insertBefore(el, handEl.children[idx] || null);
      }
    });

    const tag = document.getElementById('turnTag');
    tag.classList.remove('on', 'urgent');
    if (s.winner !== null) {
      tag.textContent = 'GAME OVER';
    } else if (isMyTurn) {
      if (s.pendingDraw > 0) {
        tag.textContent = `RESPOND TO +${s.pendingDraw}`;
        tag.classList.add('urgent');
      } else {
        tag.textContent = 'YOUR TURN';
        tag.classList.add('on');
      }
    } else {
      const name = s.players[s.turn].name;
      tag.textContent = `${name.toUpperCase()}'S TURN`;
    }

    const arena = document.querySelector('.arena');
    arena.classList.toggle('my-turn', isMyTurn);
    if (isMyTurn && !this._prevMyTurn && s.winner === null) Haptics.warn();
    this._prevMyTurn = isMyTurn;

    const btnDraw = document.getElementById('btnDraw');
    const btnPass = document.getElementById('btnPass');
    const canAct = isMyTurn && !this.awaitingInput;

    if (s.pendingDraw > 0) btnDraw.textContent = `TAKE +${s.pendingDraw}`;
    else btnDraw.textContent = s.rules.turn.drawUntilPlayable ? 'DRAW UNTIL PLAYABLE' : 'DRAW';
    btnDraw.disabled = !canAct;

    const anyPlayable = me.hand.some(c =>
      RuleEngine.isPlayable(c, s, s.rules) &&
      RuleEngine.meetsRequirement(c, me, s.rules));

    const pending = s.pendingDraw > 0;
    btnPass.disabled = !canAct || pending || !s.hasDrawn || (anyPlayable && s.rules.draw.forcePlay);
  },

  _attachTooltip(el, card) {
    const text = CardRenderer.fullText(card);
    if (!text) return;
    let pressTimer = null;
    const show = () => this._showTooltip(el, text);
    const hide = () => this._hideTooltip();
    el.addEventListener('mouseenter', show);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('touchstart', () => { pressTimer = setTimeout(show, 400); }, { passive: true });
    el.addEventListener('touchend', () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      setTimeout(hide, 1200);
    });
    el.addEventListener('touchmove', () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    }, { passive: true });
  },

  _showTooltip(anchor, text) {
    this._hideTooltip();
    const rect = anchor.getBoundingClientRect();
    const tip = document.createElement('div');
    tip.className = 'card-tooltip';
    tip.textContent = text;
    document.body.appendChild(tip);
    const tw = Math.min(260, window.innerWidth - 20);
    tip.style.maxWidth = tw + 'px';
    tip.style.left = Math.max(10, Math.min(window.innerWidth - tw - 10, rect.left + rect.width / 2 - tw / 2)) + 'px';
    tip.style.top = Math.max(10, rect.top - 12) + 'px';
    this._tooltip = tip;
  },
  _hideTooltip() { if (this._tooltip) { this._tooltip.remove(); this._tooltip = null; } },

  renderLog() {
    const el = document.getElementById('log'); if (!el || !this.state) return;
    const n = window.innerWidth <= 720 ? 3 : 4;
    el.innerHTML = this.state.log.slice(-n)
      .map(e => `<div class="log-line ${e.cls}">${e.text}</div>`)
      .join('');
  },

  onCardClick(card, sourceEl) {
    const s = this.state;
    if (!s) return;
    if (s.winner !== null || this.awaitingInput) return;
    if (s.turn !== this._localIdx) return;

    if (!RuleEngine.isPlayable(card, s, s.rules)) { Sound.bad(); return; }
    if (!RuleEngine.meetsRequirement(card, s.players[this._localIdx], s.rules)) {
      Sound.bad(); Toast.show('Requirement not met'); return;
    }

    if (card.color === 'wild') {
      this.awaitingInput = true;
      this.pauseTimer();
      Modal.colorPick(color => {
        this.awaitingInput = false;
        this.resumeTimer();
        this._playWithFly(card, sourceEl, color);
      }, () => {
        this.awaitingInput = false;
        this.resumeTimer();
        this.render();
      });
      return;
    }
    this._playWithFly(card, sourceEl, null);
  },

  _playWithFly(card, sourceEl, color) {
    Haptics.tap();
    const turnAtClick = this.state.turn;

    if (Net.active && !Net.isHost) {
      this.flyCard(card, sourceEl, () => {});
      Net.sendAction({ kind: 'PLAY', uid: card.uid, color: color || null });
      return;
    }

    if (Settings.data.reducedMotion) { this.executePlay(turnAtClick, card, color); return; }
    if (sourceEl) sourceEl.style.visibility = 'hidden';
    this.flyCard(card, sourceEl, () => this.executePlay(turnAtClick, card, color));
  },

  flyCard(card, sourceEl, onDone) {
    const to = document.getElementById('discardPile').getBoundingClientRect();
    const from = sourceEl ? sourceEl.getBoundingClientRect() : to;
    const ghost = CardRenderer.build(card);
    ghost.style.cssText = `
      position: fixed;
      left: ${from.left}px; top: ${from.top}px;
      width: ${from.width}px; height: ${from.height}px;
      z-index: 9999;
      pointer-events: none;
      transition: transform .38s cubic-bezier(.2,.8,.3,1), opacity .38s;
      will-change: transform;
    `;
    document.body.appendChild(ghost);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    const rot = (Math.random() - .5) * 22;
    requestAnimationFrame(() => {
      ghost.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(.94)`;
    });
    setTimeout(() => { ghost.remove(); onDone && onDone(); }, 400);
  },

  executePlay(playerIdx, card, color) {
    const s = this.state;
    if (!s || s.winner !== null) return;

    const res = GameEngine.playCard(s, playerIdx, card.uid, color);
    if (!res.ok) {
      Sound.bad(); Haptics.error(); Toast.show(res.reason);
      document.querySelectorAll('#hand .card').forEach(c => { c.style.visibility = ''; });
      this.render();
      return;
    }

    const dp = document.getElementById('discardPile').getBoundingClientRect();
    const cx = dp.left + dp.width / 2, cy = dp.top + dp.height / 2;
    const hex = COLOR_META[card.color === 'wild' ? (s.activeColor || 'wild') : card.color]?.hex || '#9B5DE5';
    if (!Settings.data.reducedMotion) {
      FX.burst(cx, cy, hex, card.type === 'number' ? 20 : 40, card.type === 'number' ? .9 : 1.35);
      if (card.type !== 'number') FX.ring(cx, cy, hex, 30);
    }
    if (card.type === 'number') { Sound.play(); Haptics.play(); }
    else { Sound.ability(); Haptics.ability(); }

    if (card.effects.length) this.showAbilityBanner(card, s);
    else if (card.color === 'wild')
      this.showAbilityBanner({ name: card.name, text: `Color → ${COLOR_META[s.activeColor].label}` }, s);

    Emotes.maybeBotReact(s, playerIdx, card);
    this.afterAction(res);
  },

  showAbilityBanner(card, s) {
    if (Settings.data.reducedMotion) return;
    const table = document.querySelector('.table'); if (!table) return;
    const el = document.createElement('div');
    el.className = 'fx-pop';
    el.style.color = COLOR_META[s.activeColor]?.hex || 'var(--accent)';
    el.textContent = card.name.toUpperCase();
    table.appendChild(el);
    setTimeout(() => el.remove(), 1050);
    const sub = document.createElement('div');
    sub.className = 'fx-pop';
    sub.style.fontSize = 'clamp(12px,2.6vw,17px)';
    sub.style.top = '62%';
    sub.style.color = 'var(--text-primary)';
    sub.textContent = (card.text || '').replace(/^.*?—\s*/, '');
    if (sub.textContent) {
      table.appendChild(sub);
      setTimeout(() => sub.remove(), 1150);
    }
  },

  afterAction() {
    const s = this.state;
    if (!s) return;

    if (Net.active && Net.isHost) Net.hostBroadcast(s);

    if (s.winner !== null) {
      if (GameEngine._botTimer) { clearTimeout(GameEngine._botTimer); GameEngine._botTimer = null; }
      this.render();
      setTimeout(() => GameFlow.showWinner(s.winner), 750);
      return;
    }

    const cur = s.players[s.turn];
    const hotseat = !Net.active && PrivacyScreen.shouldShow(s);

    if (hotseat && !cur.isBot && s.turn !== this._localIdx && this._lastPrivacyTurn !== s.turn) {
      this._lastPrivacyTurn = s.turn;
      this._localIdx = s.turn;
      document.querySelector('.arena').classList.add('privacy-hidden');
      this.render();
      PrivacyScreen.showFor(cur, () => {
        document.querySelector('.arena').classList.remove('privacy-hidden');
        this.render();
      });
      this.stopTimer();
      return;
    }

    this.render();
    if (!cur.isBot) this.startTimer(); else this.stopTimer();

    if (Net.active && Net.isHost && cur.isBot) {
      clearTimeout(GameEngine._botTimer);
      const myState = s;
      GameEngine._botTimer = setTimeout(() => {
        if (GameEngine.state !== myState) return;
        if (myState.winner !== null) return;
        BotAI.takeTurn(myState);
      }, 850);
    }
  },

  startTimer() {
    this.stopTimer();
    const s = this.state;
    if (!s || !s.rules.turn.timer) return;
    const cur = s.players[s.turn];
    if (cur.isBot || this._timerPaused) return;
    if (s.turn !== this._localIdx) return;

    let left = s.rules.turn.timer;
    this._timerHandle = setInterval(() => {
      if (this._timerPaused) return;
      if (this.state.winner !== null) { this.stopTimer(); return; }
      if (this.state.turn !== this._localIdx) { this.stopTimer(); return; }
      left--;
      const tag = document.getElementById('turnTag');
      if (tag) tag.textContent = `YOUR TURN · ${left}s`;
      if (left <= 0) {
        this.stopTimer();
        if (this.state.winner !== null || this.state.turn !== this._localIdx) return;
        Sound.bad(); Haptics.error();
        if (Net.active && !Net.isHost) {
          Net.sendAction({ kind: 'DRAW' });
        } else {
          GameEngine.playerDraw(s, this._localIdx);
          setTimeout(() => {
            if (s.winner === null && s.turn === this._localIdx) {
              GameEngine.playerPass(s, this._localIdx);
              this.afterAction();
            }
          }, 260);
        }
      }
    }, 1000);
  },

  pauseTimer() { this._timerPaused = true; },
  resumeTimer() { this._timerPaused = false; },
  stopTimer() { if (this._timerHandle) { clearInterval(this._timerHandle); this._timerHandle = null; } },

  showReveal(reveal) {
    if (!reveal) return;
    this.pauseTimer();
    Modal.revealHand(this.state.players[reveal.playerIdx], reveal.cards, () => this.resumeTimer());
  }
};