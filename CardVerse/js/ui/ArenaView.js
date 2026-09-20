/* ============================================================
   ui/ArenaView.js — v2.12
   Adds data-player-idx on opponent cards (for taunt bubbles).
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
  _initialDeal: false,
  _lastRevealTs: 0,

  mount(state, localIdx = 0) {
    this.stopTimer();

    this.state = state;
    this.awaitingInput = false;
    this._timerPaused = false;
    this._cardPool = new Map();
    this._prevMyTurn = false;
    this._lastPrivacyTurn = -1;
    this._localIdx = localIdx;
    this._emoteOpen = false;
    this._initialDeal = true;
    this._lastRevealTs = 0;

    if (GameEngine._botTimer) {
      clearTimeout(GameEngine._botTimer);
      GameEngine._botTimer = null;
    }

    if (typeof PrivacyScreen !== 'undefined') {
      PrivacyScreen.hide();
      if (typeof PrivacyScreen.reset === 'function') PrivacyScreen.reset();
    }
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
        if (tray) tray.classList.toggle('on', this._emoteOpen);
        Haptics.tap();
      };
    }

    this._mountCardSheet();
    this._mountDeckPile();
    this._mountRevealOverlay();

    this.render();
    this.renderLog();
    this.startTimer();
    setTimeout(() => Tutorial.start(), 900);
  },

  _mountRevealOverlay() {
    const overlay = document.getElementById('revealOverlay');
    if (!overlay || overlay.dataset.wired) return;
    overlay.dataset.wired = '1';
    overlay.onclick = (e) => { if (e.target === overlay) this._closeReveal(); };
    const closeBtn = document.getElementById('revealClose');
    if (closeBtn) closeBtn.onclick = () => this._closeReveal();
  },

  _mountCardSheet() {
    const sheet = document.getElementById('cardSheet');
    if (!sheet) return;

    const bg = document.getElementById('cardSheetBg');
    const closeBtn = document.getElementById('cardSheetClose');
    if (bg && !bg.dataset.wired) {
      bg.dataset.wired = '1';
      bg.onclick = () => this._closeCardSheet();
    }
    if (closeBtn && !closeBtn.dataset.wired) {
      closeBtn.dataset.wired = '1';
      closeBtn.onclick = () => this._closeCardSheet();
    }

    const handEl = document.getElementById('hand');
    if (!handEl || handEl.dataset.sheetWired) return;
    handEl.dataset.sheetWired = '1';

    let pressTimer = null;
    let suppressClick = false;

    handEl.addEventListener('pointerdown', (e) => {
      const cardEl = e.target.closest('.card');
      if (!cardEl) return;
      suppressClick = false;
      pressTimer = setTimeout(() => {
        suppressClick = true;
        const uid = cardEl.dataset.cardUid || cardEl.dataset.uid;
        if (uid) this._openCardSheet(String(uid));
      }, 350);
    });

    const cancelPress = () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    };
    handEl.addEventListener('pointerup', cancelPress);
    handEl.addEventListener('pointercancel', cancelPress);
    handEl.addEventListener('pointermove', cancelPress);

    handEl.addEventListener('click', (e) => {
      if (suppressClick) {
        e.stopPropagation();
        e.preventDefault();
        suppressClick = false;
      }
    }, true);
  },

  _openCardSheet(uid) {
    const sheet = document.getElementById('cardSheet');
    if (!sheet) return;
    const s = this.state;
    if (!s || s.winner !== null) return;

    const me = s.players[this._localIdx];
    if (!me) return;
    const card = me.hand.find(c => c.uid === uid);
    if (!card) return;

    const playable = RuleEngine.isPlayable(card, s, s.rules)
      && RuleEngine.meetsRequirement(card, me, s.rules);

    const body = document.getElementById('cardSheetBody');
    const playBtn = document.getElementById('cardSheetPlay');
    if (!body) return;

    const effectsHtml = (card.effects || []).length
      ? `<ul class="cs-effects">${card.effects.map(e =>
          `<li><b>${esc(e.type)}</b>${e.amount ? ' ×' + e.amount : ''}${e.target ? ' → ' + esc(e.target) : ''}</li>`
        ).join('')}</ul>`
      : '<p style="opacity:.7;margin:0">No special ability.</p>';

    const reqHtml = card.requires
      ? `<div class="cs-warn">Requires: ${esc(JSON.stringify(card.requires))}</div>` : '';

    body.innerHTML = `
      <h3>${esc(card.name)}</h3>
      <div class="cs-meta">
        <span class="cs-chip" data-color="${esc(card.color)}">${esc(card.color)}</span>
        <span class="cs-chip">${esc(card.type)}${card.type === 'number' ? ' ' + card.value : ''}</span>
        <span class="cs-chip">${esc(card.rarity || 'custom')}</span>
      </div>
      ${card.text ? `<p style="margin:0 0 10px">${esc(card.text)}</p>` : ''}
      ${effectsHtml}
      ${reqHtml}
      ${!playable && s.turn === this._localIdx
        ? '<div class="cs-warn">Not playable right now.</div>' : ''}
    `;

    if (playBtn) {
      playBtn.disabled = !playable || s.turn !== this._localIdx;
      playBtn.onclick = () => {
        this._closeCardSheet();
        this.onCardClick(card, null);
      };
    }

    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden', 'false');
  },

  _closeCardSheet() {
    const sheet = document.getElementById('cardSheet');
    if (!sheet) return;
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden', 'true');
  },

  _mountDeckPile() {
    const deckEl = document.getElementById('deckPile');
    if (!deckEl || deckEl.dataset.wired) return;
    deckEl.dataset.wired = '1';
    const drawFn = () => {
      const b = document.getElementById('btnDraw');
      if (b && !b.disabled) b.click();
    };
    deckEl.addEventListener('click', drawFn);
    deckEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drawFn(); }
    });
  },

  _getBadgeFor(player) {
    if (!player || !player.id) return null;
    if (!Net.active) return null;
    const room = Net.room;
    if (!room || !Array.isArray(room.players)) return null;
    const rp = room.players.find(p => p.id === player.id);
    if (!rp || !rp.badgeId) return null;
    return Achievements.emojiFor(rp.badgeId);
  },

  _findCatchTarget() {
    const s = this.state;
    if (!s || s.winner !== null) return -1;
    if (!Array.isArray(s.lastCardCalled)) return -1;
    for (let i = 0; i < s.players.length; i++) {
      if (i === this._localIdx) continue;
      const p = s.players[i];
      if (p.hand.length === 1 && !s.lastCardCalled[i]) return i;
    }
    return -1;
  },

  afterAction() {
    const s = this.state;
    if (!s) return;

    if (Net.active && Net.isHost) Net.hostBroadcast(s);

    if (s.winner !== null) {
      if (GameEngine._botTimer) {
        clearTimeout(GameEngine._botTimer);
        GameEngine._botTimer = null;
      }
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
        if (!cur.isBot) this.startTimer();
      });
      return;
    }

    this.render();
    if (!cur.isBot) this.startTimer(); else this.stopTimer();

    if (cur.isBot && GameEngine.state === s && !GameEngine._botTimer) {
      const myState = s;
      GameEngine._botTimer = setTimeout(() => {
        GameEngine._botTimer = null;
        if (GameEngine.state !== myState) return;
        if (myState.winner !== null) return;
        try { BotAI.takeTurn(myState); }
        catch (e) { console.error('[bot] afterAction schedule error', e); }
      }, 700);
    }
  },

  render() {
    const s = this.state;
    if (!s) return;
    const humanIdx = this._localIdx;
    if (humanIdx < 0 || humanIdx >= s.players.length) return;

    const initialDeal = this._initialDeal;
    this._initialDeal = false;

    document.getElementById('deckCount').textContent = s.deck.length;

    const opp = document.getElementById('opponents');
    opp.innerHTML = '';
    s.players.forEach((p, i) => {
      if (i === humanIdx) return;
      const isTurn = s.turn === i;
      const el = document.createElement('div');
      el.className = 'opp' + (isTurn ? ' active' : '') + (p.hand.length === 0 ? ' out' : '');
      el.dataset.playerIdx = String(i);

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

      const badge = this._getBadgeFor(p);
      if (badge) {
        const ind = document.createElement('div');
        ind.className = 'think-badge' + ((isTurn && s.winner === null) ? ' pulsing' : '');
        ind.textContent = badge;
        el.appendChild(ind);
      } else if (isTurn && s.winner === null) {
        const dot = document.createElement('div');
        dot.className = 'think-dot';
        el.appendChild(dot);
      }

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

    const pdb = document.getElementById('pendingDrawBadge');
    if (pdb) {
      if (s.pendingDraw > 0) { pdb.textContent = `+${s.pendingDraw}`; pdb.style.display = ''; }
      else pdb.style.display = 'none';
    }

    const hex = COLOR_META[s.activeColor]?.hex || '#9B5DE5';
    const colorLabel = (COLOR_META[s.activeColor]?.label || 'Wild').toUpperCase();
    const lbl = document.getElementById('activeColorLbl');
    lbl.textContent = colorLabel;
    lbl.style.color = hex;
    document.getElementById('dirPill').textContent = s.direction === 1 ? '↻ CW' : '↺ CCW';

    const me = s.players[humanIdx];

    const myBadgeEmoji = (typeof Achievements !== 'undefined' && Achievements.getBadgeEmoji)
      ? Achievements.getBadgeEmoji() : null;
    const myCountEl = document.getElementById('myCount');
    myCountEl.innerHTML = myBadgeEmoji
      ? `<span class="my-badge-chip">${myBadgeEmoji}</span> 🂠 ${me.hand.length}`
      : `🂠 ${me.hand.length}`;

    const modeChip = document.getElementById('modeChip');
    if (modeChip) modeChip.textContent = s.rulesLabel || 'Custom';

    const handEl = document.getElementById('hand');
    const isMyTurn = s.turn === humanIdx && s.winner === null;
    const currentUids = new Set(me.hand.map(c => c.uid));

    for (const [uid, node] of this._cardPool) {
      if (!currentUids.has(uid)) { node.remove(); this._cardPool.delete(uid); }
    }

    me.hand.forEach((card, idx) => {
      let el = this._cardPool.get(card.uid);
      const isNew = !el;
      if (!el) {
        el = CardRenderer.build(card);
        el.addEventListener('click', () => this.onCardClick(card, el));
        this._attachTooltip(el, card);
        this._cardPool.set(card.uid, el);
      }
      if (isNew && initialDeal) {
        el.classList.add('deal-in');
        el.style.animationDelay = (idx * 40) + 'ms';
      }
      el.style.visibility = '';
      const playable = isMyTurn
        && RuleEngine.isPlayable(card, s, s.rules)
        && RuleEngine.meetsRequirement(card, me, s.rules);
      el.classList.toggle('playable', playable);
      el.classList.toggle('dim', !playable);
      if (handEl.children[idx] !== el) {
        handEl.insertBefore(el, handEl.children[idx] || null);
      }
    });

    const tag = document.getElementById('turnTag');
    tag.classList.remove('on', 'urgent');
    if (s.winner !== null) tag.textContent = 'GAME OVER';
    else if (isMyTurn) {
      if (s.pendingDraw > 0) { tag.textContent = `RESPOND TO +${s.pendingDraw}`; tag.classList.add('urgent'); }
      else { tag.textContent = 'YOUR TURN'; tag.classList.add('on'); }
    } else {
      tag.textContent = `${s.players[s.turn].name.toUpperCase()}'S TURN`;
    }

    const arena = document.querySelector('.arena');
    arena.classList.toggle('my-turn', isMyTurn);
    if (isMyTurn && !this._prevMyTurn && s.winner === null) Haptics.warn();
    this._prevMyTurn = isMyTurn;

    const btnDraw = document.getElementById('btnDraw');
    const btnPass = document.getElementById('btnPass');
    const canAct = isMyTurn && !this.awaitingInput;

    if (s.pendingDraw > 0) btnDraw.textContent = `TAKE +${s.pendingDraw}`;
    else btnDraw.textContent = 'DRAW';
    btnDraw.disabled = !canAct;

    const anyPlayable = me.hand.some(c =>
      RuleEngine.isPlayable(c, s, s.rules) &&
      RuleEngine.meetsRequirement(c, me, s.rules));
    const pending = s.pendingDraw > 0;
    const forcePlay = s.rules && s.rules.draw && s.rules.draw.forcePlay;
    btnPass.disabled = !canAct || pending || !s.hasDrawn || (anyPlayable && forcePlay);

    const btnCatch = document.getElementById('btnCatchUno');
    const catchTargetIdx = this._findCatchTarget();
    if (btnCatch) {
      const show = catchTargetIdx !== -1 && s.winner === null;
      btnCatch.style.display = show ? '' : 'none';
      btnCatch.classList.toggle('pulse', show);
      if (show) {
        btnCatch.textContent = `🚨 CATCH ${s.players[catchTargetIdx].name.toUpperCase()}`;
        btnCatch.onclick = () => this._onCatchClick();
      }
    }

    const lastBar = document.getElementById('lastCardBar');
    const btnLast = document.getElementById('btnLastCard');
    if (lastBar && btnLast) {
      const called = !!(s.lastCardCalled && s.lastCardCalled[humanIdx]);
      const needsCall = s.winner === null && me.hand.length === 1 && !called;
      lastBar.style.display = needsCall ? '' : 'none';
      btnLast.onclick = () => this._callLastCard(humanIdx);
    }

    const rev = s.reveal;
    if (rev && rev.viewerIdx === this._localIdx && rev.ts !== this._lastRevealTs) {
      this._lastRevealTs = rev.ts || Date.now();
      this.showReveal(rev);
    }
  },

  _callLastCard(humanIdx) {
    const s = this.state;
    if (!s || s.winner !== null) return;
    if (!Array.isArray(s.lastCardCalled)) s.lastCardCalled = s.players.map(() => false);
    if (s.lastCardCalled[humanIdx]) return;
    if (s.players[humanIdx].hand.length !== 1) return;

    s.lastCardCalled[humanIdx] = true;
    if (typeof Sound !== 'undefined') Sound.click();
    if (typeof Haptics !== 'undefined') Haptics.tap();
    GameEngine.log(`<b>${esc(s.players[humanIdx].name)}</b> calls LAST CARD!`, 'hot');

    if (Net.active && Net.isHost) Net.hostBroadcast(s);
    else if (Net.active && !Net.isHost) Net.sendAction({ kind: 'CALL_LAST' });

    this.render();
  },

  _onCatchClick() {
    const s = this.state;
    if (!s || s.winner !== null) return;
    const targetIdx = this._findCatchTarget();
    if (targetIdx === -1) return;

    if (typeof Sound !== 'undefined') Sound.click();
    if (typeof Haptics !== 'undefined') Haptics.error();

    if (Net.active && !Net.isHost) {
      Net.sendAction({ kind: 'CATCH' });
      const btnCatch = document.getElementById('btnCatchUno');
      if (btnCatch) btnCatch.style.display = 'none';
      return;
    }

    const res = GameEngine.catchUno(s, this._localIdx);
    if (!res.ok) { if (typeof Sound !== 'undefined') Sound.bad(); return; }
    this.afterAction();
  },

  _attachTooltip(el, card) {
    const text = CardRenderer.fullText(card);
    if (!text) return;
    const hoverCapable = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    if (!hoverCapable) return;
    el.addEventListener('mouseenter', () => this._showTooltip(el, text));
    el.addEventListener('mouseleave', () => this._hideTooltip());
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
    tip.style.left = Math.max(10, Math.min(window.innerWidth - tw - 10,
      rect.left + rect.width / 2 - tw / 2)) + 'px';
    tip.style.top = Math.max(10, rect.top - 12) + 'px';
    this._tooltip = tip;
  },

  _hideTooltip() {
    if (this._tooltip) { this._tooltip.remove(); this._tooltip = null; }
  },

  renderLog() {
    const el = document.getElementById('log');
    if (!el || !this.state) return;
    const n = window.innerWidth <= 720 ? 3 : 4;
    el.innerHTML = this.state.log.slice(-n)
      .map(e => `<div class="log-line ${e.cls || ''}">${e.text}</div>`)
      .join('');
  },

  onCardClick(card, sourceEl) {
    const s = this.state;
    if (!s) return;

    if (this.awaitingInput && !Modal._isOpen) {
      console.warn('[RV] awaitingInput stuck — auto-resetting');
      this.awaitingInput = false;
      this.resumeTimer();
    }

    if (s.winner !== null || this.awaitingInput) return;
    if (s.turn !== this._localIdx) return;

    if (!RuleEngine.isPlayable(card, s, s.rules)) {
      console.log('[RV] Not playable:', card.name,
        { pending: s.pendingDraw, active: s.activeColor, cardColor: card.color,
          stackAny: s.rules && s.rules.stacking && s.rules.stacking.anyColor });
      Sound.bad();
      return;
    }
    if (!RuleEngine.meetsRequirement(card, s.players[this._localIdx], s.rules)) {
      Sound.bad(); Toast.show('Requirement not met'); return;
    }

    const abilitiesOn = !s.rules || !s.rules.abilities || s.rules.abilities.enabled !== false;
    const needsColor = card.color === 'wild';
    const needsTarget = abilitiesOn && card.effects.some(e => e.target === 'choose');
    const needsCard = abilitiesOn && card.effects.some(e => e.type === 'STEAL' && e.pick);

    console.log('[RV] Click', card.name, { needsColor, needsTarget, needsCard, abilitiesOn });

    if (!needsColor && !needsTarget && !needsCard) {
      this._playWithFly(card, sourceEl, {});
      return;
    }

    this.awaitingInput = true;
    this.pauseTimer();
    try {
      this._promptChain(card, sourceEl, {});
    } catch (e) {
      console.error('[RV] chain error', e);
      this.awaitingInput = false;
      this.resumeTimer();
      this.render();
    }
  },

  _promptChain(card, sourceEl, collected) {
    const s = this.state;
    const abilitiesOn = !s.rules || !s.rules.abilities || s.rules.abilities.enabled !== false;

    if (collected.cancelled) {
      console.log('[RV] chain cancelled');
      this.awaitingInput = false;
      this.resumeTimer();
      this.render();
      return;
    }

    if (card.color === 'wild' && collected.color === undefined) {
      Modal.colorPick(result => {
        if (result === null) collected.cancelled = true;
        else collected.color = result;
        this._promptChain(card, sourceEl, collected);
      });
      return;
    }

    const needTarget = abilitiesOn && card.effects.some(e => e.target === 'choose');
    if (needTarget && collected.targetIdx === undefined) {
      Modal.pickPlayer(s, this._localIdx, result => {
        if (result === null) collected.cancelled = true;
        else collected.targetIdx = result;
        this._promptChain(card, sourceEl, collected);
      });
      return;
    }

    const stealPick = abilitiesOn && card.effects.find(e => e.type === 'STEAL' && e.pick);
    if (stealPick && collected.cardUid === undefined) {
      const targetIdx = stealPick.target === 'choose'
        ? collected.targetIdx
        : RuleEngine.targets(s, this._localIdx, stealPick.target)[0];
      const target = s.players[targetIdx];
      if (!target || !target.hand.length) {
        collected.cardUid = null;
        this._promptChain(card, sourceEl, collected);
        return;
      }
      Modal.pickCardFrom(target, result => {
        if (result === null) collected.cancelled = true;
        else collected.cardUid = result;
        this._promptChain(card, sourceEl, collected);
      });
      return;
    }

    console.log('[RV] playing with choices:', collected);
    this.awaitingInput = false;
    this.resumeTimer();
    this._playWithFly(card, sourceEl, collected);
  },

  _playWithFly(card, sourceEl, opts = {}) {
    opts = opts || {};
    Haptics.tap();
    const turnAtClick = this.state.turn;

    if (Net.active && !Net.isHost) {
      this.flyCard(card, sourceEl, () => {});
      Net.sendAction({
        kind: 'PLAY',
        uid: card.uid,
        color: opts.color || null,
        targetIdx: opts.targetIdx,
        cardUid: opts.cardUid
      });
      return;
    }

    if (Settings.data.reducedMotion) {
      this.executePlay(turnAtClick, card, opts);
      return;
    }
    if (sourceEl) sourceEl.style.visibility = 'hidden';
    this.flyCard(card, sourceEl, () => this.executePlay(turnAtClick, card, opts));
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

  executePlay(playerIdx, card, opts = {}) {
    opts = opts || {};
    const s = this.state;
    if (!s || s.winner !== null) return;

    const res = GameEngine.playCard(s, playerIdx, card.uid, opts);
    if (!res.ok) {
      Sound.bad();
      Haptics.error();
      Toast.show(res.reason);
      document.querySelectorAll('#hand .card').forEach(c => { c.style.visibility = ''; });
      this.render();
      return;
    }

    const dp = document.getElementById('discardPile').getBoundingClientRect();
    const cx = dp.left + dp.width / 2;
    const cy = dp.top + dp.height / 2;
    const hex = COLOR_META[card.color === 'wild' ? (s.activeColor || 'wild') : card.color]?.hex || '#9B5DE5';

    if (!Settings.data.reducedMotion) {
      FX.burst(cx, cy, hex, card.type === 'number' ? 20 : 40, card.type === 'number' ? .9 : 1.35);
      if (card.type !== 'number') FX.ring(cx, cy, hex, 30);
    }

    if (card.type === 'number') { Sound.play(); Haptics.play(); }
    else { Sound.ability(); Haptics.ability(); }

    if (card.effects.length) this.showAbilityBanner(card, s);
    else if (card.color === 'wild') {
      this.showAbilityBanner(
        { name: card.name, text: `Color → ${COLOR_META[s.activeColor].label}` }, s
      );
    }

    Emotes.maybeBotReact(s, playerIdx, card);
    this.afterAction();
  },

  showAbilityBanner(card, s) {
    if (Settings.data.reducedMotion) return;
    const table = document.querySelector('.table');
    if (!table) return;

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

  startTimer() {
    this.stopTimer();
    const s = this.state;
    if (!s || !s.rules || !s.rules.turn || !s.rules.turn.timer) return;
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

        if (Net.active && !Net.isHost) { Net.sendAction({ kind: 'DRAW' }); return; }

        GameEngine.playerDraw(s, this._localIdx);
        setTimeout(() => {
          if (s.winner === null && s.turn === this._localIdx) {
            GameEngine.playerPass(s, this._localIdx);
          }
          this.afterAction();
        }, 260);
      }
    }, 1000);
  },

  pauseTimer() { this._timerPaused = true; },
  resumeTimer() { this._timerPaused = false; },
  stopTimer() {
    if (this._timerHandle) { clearInterval(this._timerHandle); this._timerHandle = null; }
  },

  showReveal(reveal) {
    if (!reveal) return;

    if (typeof reveal.viewerIdx === 'number' && reveal.viewerIdx !== this._localIdx) return;

    const overlay = document.getElementById('revealOverlay');
    const titleEl = document.getElementById('revealTitle');
    const handEl = document.getElementById('revealHand');
    if (!overlay || !titleEl || !handEl) {
      console.warn('[RV] Reveal overlay missing from DOM');
      return;
    }
    const target = this.state.players[reveal.playerIdx];
    if (!target) return;

    this._lastRevealTs = reveal.ts || Date.now();
    this.pauseTimer();
    titleEl.textContent = `${target.avatar} ${target.name}'s Hand`;
    handEl.innerHTML = '';
    (reveal.cards || []).forEach(c => handEl.appendChild(CardRenderer.build(c, { small: true })));

    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
  },

  _closeReveal() {
    const overlay = document.getElementById('revealOverlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    this.resumeTimer();
  }
};