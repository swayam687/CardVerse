/* ============================================================
   core/GameEngine.js — v2.12
   · Stacking accumulates
   · Win-by-loss protected
   · REVERSE = SKIP in 2p
   · Uno Classic filter
   · reveal has viewerIdx + ts
   · opts defensive
   · Bot try/catch
   · ▼ wild abilities (Thanos/Kaguya) gated at resolve, not play
   ============================================================ */
const GameEngine = {
  state: null,
  _botTimer: null,

  _nm(state, idx) {
    const p = state.players[idx];
    return p ? esc(p.name) : '???';
  },

  _abilitiesOn(state) {
    const r = state && state.rules;
    if (!r || !r.abilities) return true;
    return r.abilities.enabled !== false;
  },

  blockedByDefense(state, targetIdx, actor) {
    if (targetIdx === actor) return false;
    const t = state.players[targetIdx];
    if (!t) return true;
    if (t.immune) { this.log(`${esc(t.name)} is immune`); return true; }
    if (t.shield > 0) {
      t.shield--;
      this.log(`${esc(t.name)}'s Shield absorbed the hit`);
      return true;
    }
    return false;
  },

  checkWin(state, allowedWinner = null) {
    if (state.winner !== null) return;
    for (let i = 0; i < state.players.length; i++) {
      if (state.players[i].hand.length !== 0) continue;
      if (allowedWinner !== null && i !== allowedWinner) {
        this.drawTo(state, i, 1, true);
        this.log(`${this._nm(state, i)} was saved by the rules — drew 1`, 'hot');
        continue;
      }
      state.winner = i;
      if (this._botTimer) { clearTimeout(this._botTimer); this._botTimer = null; }
      this.log(`<b>${this._nm(state, i)}</b> wins!`, 'hot');
      return;
    }
  },

  create({ players, universeId, customDef, rules, universeName }) {
    if (this._botTimer) { clearTimeout(this._botTimer); this._botTimer = null; }

    const state = makeGameState({ players, universeId, universeName, rules });
    state.deck = buildDeck(universeId, customDef);

    const deckMode = rules && rules.deal && rules.deal.deckMode;
    if (deckMode === 'allWild') {
      state.deck = state.deck.map(card => {
        if (card.type === 'number') return { ...card, color: 'wild', effects: [], icon: '🌈' };
        return { ...card, color: 'wild' };
      });
    }

    const hs = (rules && rules.deal && rules.deal.handSize) || 7;
    for (let r = 0; r < hs; r++) {
      for (const p of players) p.hand.push(state.deck.pop());
    }

    let idx = state.deck.findIndex(c => c.type === 'number');
    if (idx === -1) idx = state.deck.length - 1;
    const [first] = state.deck.splice(idx, 1);
    state.discard.push(first);
    state.activeColor = first.color === 'wild'
      ? ['red','blue','green','yellow'][Math.floor(Math.random() * 4)]
      : first.color;

    this.state = state;
    this.log(`Game started · ${hs} cards each`, 'hot');
    return state;
  },

  log(text, cls = '') {
    const s = this.state; if (!s) return;
    s.log.push({ text, cls, t: Date.now() });
    if (s.log.length > 40) s.log.shift();
    if (typeof ArenaView !== 'undefined') ArenaView.renderLog();
  },

  reshuffle(state) {
    const canReshuffle = state.rules && state.rules.deal && state.rules.deal.reshuffle !== false;
    if (!canReshuffle) return false;
    if (state.discard.length <= 1) return false;
    const top = state.discard.pop();
    state.deck = shuffle(state.discard.splice(0));
    state.discard = [top];
    this.log('Deck reshuffled from discard pile');
    return true;
  },

  drawTo(state, playerIdx, amount, silent = false) {
    const p = state.players[playerIdx];
    let n = amount;
    if (p.shield > 0 && n > 0) {
      const blocked = Math.min(p.shield, n);
      p.shield -= blocked; n -= blocked;
      if (!silent && blocked > 0) {
        this.log(`${esc(p.name)}'s Shield blocked ${blocked} card${blocked > 1 ? 's' : ''}!`, 'hot');
      }
    }
    for (let i = 0; i < n; i++) {
      if (!state.deck.length) this.reshuffle(state);
      if (!state.deck.length) break;
      p.hand.push(state.deck.pop());
    }
    p.stats.drawn += Math.max(0, n);
    return Math.max(0, n);
  },

  playCard(state, playerIdx, uid, opts = {}) {
    opts = opts || {};

    const player = state.players[playerIdx];
    const idx = player.hand.findIndex(c => c.uid === uid);
    if (idx === -1) return { ok: false, reason: 'Card not in hand' };

    const card = player.hand[idx];
    if (!RuleEngine.isPlayable(card, state, state.rules))
      return { ok: false, reason: 'Not playable' };
    if (!RuleEngine.meetsRequirement(card, player, state.rules))
      return { ok: false, reason: `${card.name} requires ${card.requires.minHand}+ cards in hand` };

    // ▼▼▼ v2.12 CHANGE — capture ability unlock BEFORE removing card ▼▼▼
    // Wilds may be played as plain color changes even when their ability
    // cost isn't met (Thanos, Kaguya).
    const abilityUnlocked = !card.requires
      || !card.requires.minHand
      || player.hand.length >= card.requires.minHand;
    // ▲▲▲

    const abilitiesOn = this._abilitiesOn(state);
    const needChoose = abilitiesOn && Array.isArray(card.effects)
      && card.effects.some(e => e.target === 'choose');
    if (needChoose) {
      const ti = opts.targetIdx;
      if (typeof ti !== 'number' || ti === playerIdx || ti < 0 || ti >= state.players.length)
        return { ok: false, reason: 'Choose a target player' };
    }

    player.hand.splice(idx, 1);
    state.discard.push(card);
    player.stats.played++;

    if (!Array.isArray(state.lastCardCalled) || state.lastCardCalled.length !== state.players.length) {
      state.lastCardCalled = state.players.map(() => false);
    }

    const wasPending = state.pendingDraw || 0;
    const stackAmt = this.stackAmount(card);
    const isStacking = wasPending > 0 && stackAmt > 0;
    if (!isStacking) state.pendingDraw = 0;

    if (card.color === 'wild') {
      state.activeColor = opts.color || this.botColorChoice(state, playerIdx);
    } else {
      state.activeColor = card.color;
    }

    if (Array.isArray(card.effects) && card.effects.length) {
      state.lastAction = card;
      player.stats.abilities++;
    }

    this.log(`<b>${esc(player.name)}</b> played <b>${esc(card.name)}</b>`, 'hot');
    if (isStacking) this.log(`Stack → pending draw now +${wasPending + stackAmt}`, 'hot');

    if (typeof Achievements !== 'undefined') Achievements.onCardPlayed(card, state, playerIdx);

    state.lastCardCalled[playerIdx] = false;
    if (player.hand.length === 1 && player.isBot) state.lastCardCalled[playerIdx] = true;

    if (player.hand.length === 0) {
      state.winner = playerIdx;
      if (this._botTimer) { clearTimeout(this._botTimer); this._botTimer = null; }
      this.log(`<b>${esc(player.name)}</b> wins!`, 'hot');
      return { ok: true, card, won: true };
    }

    // ▼▼▼ v2.12 CHANGE — pass abilityUnlocked through ▼▼▼
    const ctx = this.resolveEffects(state, playerIdx, card, wasPending, opts, abilityUnlocked);
    // ▲▲▲

    this.checkWin(state, playerIdx);
    if (state.winner !== null) return { ok: true, card, ctx, won: true };

    this.finishTurn(state, ctx);
    return { ok: true, card, ctx };
  },

  stackAmount(card) {
    if (!card || !Array.isArray(card.effects)) return 0;
    const e = card.effects.find(x => x.type === 'DRAW' && x.target === 'next');
    return e ? e.amount : 0;
  },

  catchUno(state, catcherIdx) {
    if (!state || state.winner !== null) return { ok: false };
    if (!Array.isArray(state.lastCardCalled)) {
      state.lastCardCalled = state.players.map(() => false);
    }
    for (let i = 0; i < state.players.length; i++) {
      if (i === catcherIdx) continue;
      const p = state.players[i];
      if (p.hand.length === 1 && !state.lastCardCalled[i]) {
        this.drawTo(state, i, 2);
        state.lastCardCalled[i] = false;
        this.log(`<b>${esc(state.players[catcherIdx].name)}</b> caught <b>${esc(p.name)}</b> — didn't say UNO! +2 cards`, 'hot');
        if (typeof Sound !== 'undefined') Sound.bad();
        return { ok: true, targetIdx: i };
      }
    }
    return { ok: false, reason: 'No one to catch' };
  },

  // ▼▼▼ v2.12 CHANGE — extra abilityUnlocked param ▼▼▼
  resolveEffects(state, actor, card, wasPending, opts = {}, abilityUnlocked = true) {
    opts = opts || {};
    const ctx = { skip: 0, reverse: false, extraTurn: false };
    const rules = state.rules || {};
    let effects = Array.isArray(card.effects) ? card.effects.slice() : [];

    // Ability cost not met → play as a plain card (color change only).
    if (!abilityUnlocked && card.requires) {
      const need = card.requires.minHand || '?';
      this.log(`<b>${esc(card.name)}</b> — ability skipped (needs ${need}+ cards)`);
      effects = [];
    }
    // ▲▲▲

    if (!this._abilitiesOn(state)) {
      const isWild = card.color === 'wild';
      effects = effects.filter(e => {
        if (e.type === 'SKIP' && (!e.target || e.target === 'next')) return true;
        if (e.type === 'REVERSE') return true;
        if (e.type === 'DRAW' && e.target === 'next') {
          if (e.amount === 2) return true;
          if (e.amount === 4 && isWild) return true;
        }
        return false;
      });
    }

    if (effects.some(e => e.type === 'COPY')) {
      const last = state.lastAction;
      if (last && last.uid !== card.uid && Array.isArray(last.effects)) {
        effects = effects.filter(e => e.type !== 'COPY')
          .concat(last.effects.filter(e => e.type !== 'COPY'));
        this.log(`${esc(card.name)} copies ${esc(last.name)}'s ability!`, 'hot');
      } else {
        effects = effects.filter(e => e.type !== 'COPY');
        this.log(`${esc(card.name)} has nothing to copy`);
      }
    }

    const harmful = new Set(['DRAW', 'DISCARD', 'SWAP_HANDS', 'STEAL']);
    if (actor !== 0) {
      for (const e of effects) {
        if (!harmful.has(e.type)) continue;
        let tgts;
        if (e.target === 'choose') {
          tgts = (typeof opts.targetIdx === 'number') ? [opts.targetIdx] : [];
        } else {
          tgts = RuleEngine.targets(state, actor, e.target || 'self');
        }
        if (tgts.includes(0) && typeof Achievements !== 'undefined') Achievements.onHumanHit();
      }
    }

    for (const e of effects) {
      let targets;
      if (e.target === 'choose') {
        const ti = (typeof opts.targetIdx === 'number') ? opts.targetIdx : -1;
        targets = (ti >= 0 && ti < state.players.length && ti !== actor) ? [ti] : [];
      } else {
        targets = RuleEngine.targets(state, actor, e.target || 'self');
      }

      switch (e.type) {
        case EFFECTS.DRAW: {
          if (e.target === 'next') {
            state.pendingDraw = (state.pendingDraw || 0) + e.amount;
          } else {
            for (const t of targets) this.drawTo(state, t, e.amount);
          }
          break;
        }
        case EFFECTS.SKIP: {
          const nxt = RuleEngine.targets(state, actor, 'next')[0];
          ctx.skip += 1;
          this.log(`${this._nm(state, nxt)} is skipped`);
          break;
        }
        case EFFECTS.REVERSE: ctx.reverse = true; break;
        case EFFECTS.EXTRA_TURN:
          ctx.extraTurn = true;
          this.log(`${this._nm(state, actor)} gets another turn`);
          break;

        case EFFECTS.DISCARD: {
          for (const t of targets) {
            if (t === actor) continue;
            if (this.blockedByDefense(state, t, actor)) continue;
            const victim = state.players[t];
            let n = e.amount === -1 ? Math.floor(victim.hand.length / 2) : e.amount;
            n = Math.min(n, victim.hand.length);
            for (let i = 0; i < n; i++) {
              const j = rnd(victim.hand.length);
              const [c] = victim.hand.splice(j, 1);
              state.discard.push(c);
            }
            if (n > 0) this.log(`${esc(victim.name)} discards ${n} card${n > 1 ? 's' : ''}`);
          }
          break;
        }

        case EFFECTS.SWAP_HANDS: {
          for (const t of targets) {
            if (t === actor) continue;
            if (this.blockedByDefense(state, t, actor)) continue;
            const tmp = state.players[actor].hand;
            state.players[actor].hand = state.players[t].hand;
            state.players[t].hand = tmp;
            this.log(`${this._nm(state, actor)} swapped hands with ${this._nm(state, t)}`, 'hot');
          }
          break;
        }

        case EFFECTS.STEAL: {
          for (const t of targets) {
            if (t === actor) continue;
            if (this.blockedByDefense(state, t, actor)) continue;
            const victim = state.players[t];
            if (e.pick && typeof opts.cardUid === 'string') {
              const ci = victim.hand.findIndex(c => c.uid === opts.cardUid);
              if (ci >= 0) {
                const [c] = victim.hand.splice(ci, 1);
                state.players[actor].hand.push(c);
                this.log(`${this._nm(state, actor)} took ${esc(c.name)} from ${this._nm(state, t)}`, 'hot');
              } else {
                this.log(`Card gone — steal cancelled`);
              }
            } else {
              const amt = e.amount || 1;
              let taken = 0;
              for (let i = 0; i < amt; i++) {
                if (!victim.hand.length) break;
                const j = rnd(victim.hand.length);
                const [c] = victim.hand.splice(j, 1);
                state.players[actor].hand.push(c);
                taken++;
              }
              if (taken > 0) this.log(`${this._nm(state, actor)} stole ${taken} from ${this._nm(state, t)}`, 'hot');
            }
          }
          break;
        }

        case EFFECTS.REVEAL: {
          const t = targets[0];
          if (t === undefined) break;
          state.reveal = {
            playerIdx: t,
            cards: state.players[t].hand.slice(),
            viewerIdx: actor,
            ts: Date.now()
          };
          this.log(`${this._nm(state, actor)} reveals ${this._nm(state, t)}'s hand`);
          if (typeof ArenaView !== 'undefined') {
            const isMe = actor === ArenaView._localIdx;
            if (isMe) ArenaView.showReveal(state.reveal);
          }
          break;
        }

        case EFFECTS.SHIELD:
          state.players[actor].shield += 1;
          this.log(`${this._nm(state, actor)} raises a Shield`);
          break;

        case EFFECTS.IMMUNE:
          state.players[actor].immune = true;
          this.log(`${this._nm(state, actor)} is untargetable`);
          break;
      }
    }

    this.checkWin(state, actor);
    return ctx;
  },

  finishTurn(state, ctx) {
    if (state.winner !== null) return;
    const n = state.players.length;

    if (ctx.reverse) {
      state.direction *= -1;
      this.log('Direction reversed');
      if (n === 2) ctx.skip = (ctx.skip || 0) + 1;
    }

    const advance = ctx.extraTurn ? 0 : (1 + ctx.skip);
    state.turn = mod(state.turn + state.direction * advance, n);
    state.turnCount++;
    this.beginTurn(state);
  },

  beginTurn(state) {
    const p = state.players[state.turn];
    p.immune = false;
    p.shield = 0;
    state.hasDrawn = false;
    state.turnStart = Date.now();

    if (state.pendingDraw > 0) {
      this.log(`${esc(p.name)} must respond to +${state.pendingDraw}`);
    }

    if (typeof ArenaView !== 'undefined') {
      ArenaView.render();
      ArenaView.renderLog();
    }

    if (p.isBot) {
      clearTimeout(this._botTimer);
      const myState = state;
      this._botTimer = setTimeout(() => {
        this._botTimer = null;
        if (this.state !== myState) return;
        if (myState.winner !== null) return;
        try { BotAI.takeTurn(myState); }
        catch (e) {
          console.error('[bot] turn error', e);
          setTimeout(() => {
            if (this.state !== myState) return;
            if (myState.winner !== null) return;
            try { BotAI.takeTurn(myState); }
            catch (e2) { console.error('[bot] retry error', e2); }
          }, 800);
        }
      }, 850);
    } else if (typeof ArenaView !== 'undefined') {
      ArenaView.startTimer();
    }
  },

  playerDraw(state, playerIdx) {
    const p = state.players[playerIdx];

    if (state.pendingDraw > 0) {
      const n = state.pendingDraw;
      state.pendingDraw = 0;
      this.drawTo(state, playerIdx, n);
      this.log(`${esc(p.name)} takes +${n}`);
      if (typeof Sound !== 'undefined') Sound.draw();
      state.turn = mod(state.turn + state.direction, state.players.length);
      this.beginTurn(state);
      return { ok: true, took: n };
    }

    if (!state.deck.length) {
      const canReshuffle = state.rules && state.rules.deal && state.rules.deal.reshuffle !== false && state.discard.length > 1;
      if (!canReshuffle) {
        state.winner = -1;
        this.log('⚠ Deck exhausted — no winner.', 'hot');
        return { ok: true, drawn: 0, stalemate: true };
      }
    }

    const count = (state.rules && state.rules.draw && state.rules.draw.count) || 1;
    let drawn = 0;
    let playableNow = false;

    const untilPlayable = state.rules && state.rules.turn && state.rules.turn.drawUntilPlayable;
    if (untilPlayable) {
      let guard = 0;
      while (guard++ < 30) {
        const before = p.hand.length;
        this.drawTo(state, playerIdx, 1, true);
        if (p.hand.length === before) break;
        drawn++;
        const last = p.hand[p.hand.length - 1];
        if (RuleEngine.isPlayable(last, state, state.rules)) { playableNow = true; break; }
      }
    } else {
      this.drawTo(state, playerIdx, count);
      drawn = count;
      const last = p.hand[p.hand.length - 1];
      playableNow = last ? RuleEngine.isPlayable(last, state, state.rules) : false;
    }

    state.hasDrawn = true;
    this.log(`${esc(p.name)} drew ${drawn} card${drawn > 1 ? 's' : ''}`);
    if (typeof Sound !== 'undefined') Sound.draw();

    if (typeof ArenaView !== 'undefined') ArenaView.render();
    return { ok: true, drawn, playableNow };
  },

  playerPass(state, playerIdx) {
    const p = state.players[playerIdx];
    if (state.pendingDraw > 0) return { ok: false, reason: `You must draw +${state.pendingDraw} or stack a card` };
    if (!state.hasDrawn) return { ok: false, reason: 'You must draw first' };

    const playable = p.hand.some(c =>
      RuleEngine.isPlayable(c, state, state.rules) &&
      RuleEngine.meetsRequirement(c, p, state.rules));
    const forcePlay = state.rules && state.rules.draw && state.rules.draw.forcePlay;
    if (playable && forcePlay) return { ok: false, reason: 'You must play if you can' };

    this.log(`${esc(p.name)} passed`);
    state.turn = mod(state.turn + state.direction, state.players.length);
    this.beginTurn(state);
    return { ok: true };
  },

  botColorChoice(state, playerIdx) {
    const p = state.players[playerIdx];
    const tally = { red: 0, blue: 0, green: 0, yellow: 0 };
    for (const c of p.hand) if (tally[c.color] !== undefined) tally[c.color]++;
    let best = 'red', bv = -1;
    for (const k in tally) if (tally[k] > bv) { bv = tally[k]; best = k; }
    return best;
  },

  currentPlayer(state) { return state.players[state.turn]; }
};