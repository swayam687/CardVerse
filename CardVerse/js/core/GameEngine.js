/* ============================================================
   core/GameEngine.js
   --------------------------------------------------------
   The orchestrator. Owns GameState + RuleEngine + Player.
   UI and AI read from it; Multiplayer syncs it.
   ============================================================ */
const GameEngine = {
  state: null,
  _botTimer: null,

  create({ players, universeId, customDef, rules, universeName }) {
    if (this._botTimer) { clearTimeout(this._botTimer); this._botTimer = null; }

    const state = makeGameState({ players, universeId, universeName, rules });
    state.deck = buildDeck(universeId, customDef);

    const hs = rules.deal.handSize;
    for (let r = 0; r < hs; r++) {
      for (const p of players) p.hand.push(state.deck.pop());
    }

    let idx = state.deck.findIndex(c => c.type === 'number');
    if (idx === -1) idx = state.deck.length - 1;
    const [first] = state.deck.splice(idx, 1);
    state.discard.push(first);
    state.activeColor = first.color;

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
    if (!state.rules.deal.reshuffle) return;
    if (state.discard.length <= 1) return;
    const top = state.discard.pop();
    state.deck = shuffle(state.discard);
    state.discard = [top];
    this.log('Deck reshuffled from discard pile');
  },

  drawTo(state, playerIdx, amount, silent = false) {
    const p = state.players[playerIdx];
    let n = amount;
    if (p.shield > 0 && n > 0) {
      const blocked = Math.min(p.shield, n);
      p.shield -= blocked; n -= blocked;
      if (!silent && blocked > 0) this.log(`${p.name}'s Shield blocked ${blocked} card${blocked > 1 ? 's' : ''}!`, 'hot');
    }
    for (let i = 0; i < n; i++) {
      if (!state.deck.length) this.reshuffle(state);
      if (!state.deck.length) break;
      p.hand.push(state.deck.pop());
    }
    p.stats.drawn += Math.max(0, n);
    return Math.max(0, n);
  },

  playCard(state, playerIdx, uid, chosenColor = null) {
    const player = state.players[playerIdx];
    const idx = player.hand.findIndex(c => c.uid === uid);
    if (idx === -1) return { ok: false, reason: 'Card not in hand' };

    const card = player.hand[idx];
    if (!RuleEngine.isPlayable(card, state, state.rules))
      return { ok: false, reason: 'Not playable' };
    if (!RuleEngine.meetsRequirement(card, player, state.rules))
      return { ok: false, reason: `${card.name} requires ${card.requires.minHand}+ cards in hand` };

    player.hand.splice(idx, 1);
    state.discard.push(card);
    player.stats.played++;

    const wasPending = state.pendingDraw;
    state.pendingDraw = 0;

    if (card.color === 'wild') {
      state.activeColor = chosenColor || this.botColorChoice(state, playerIdx);
    } else {
      state.activeColor = card.color;
    }

    if (card.effects.length) {
      state.lastAction = card;
      player.stats.abilities++;
    }

    this.log(`<b>${esc(player.name)}</b> played <b>${esc(card.name)}</b>`, 'hot');

    if (typeof Achievements !== 'undefined') Achievements.onCardPlayed(card, state, playerIdx);

    if (player.hand.length === 0) {
      state.winner = playerIdx;
      if (this._botTimer) { clearTimeout(this._botTimer); this._botTimer = null; }
      return { ok: true, card, won: true };
    }

    const ctx = this.resolveEffects(state, playerIdx, card, wasPending);
    this.finishTurn(state, ctx);
    return { ok: true, card, ctx };
  },

  resolveEffects(state, actor, card, wasPending) {
    const ctx = { skip: 0, reverse: false, extraTurn: false };
    const rules = state.rules;

    let effects = card.effects.slice();

    if (!rules.abilities.enabled) {
      effects = effects.filter(e => e.type === 'DRAW' && e.target === 'next');
    }

    if (effects.some(e => e.type === 'COPY')) {
      const last = state.lastAction;
      if (last && last.uid !== card.uid) {
        effects = effects.filter(e => e.type !== 'COPY')
          .concat(last.effects.filter(e => e.type !== 'COPY'));
        this.log(`${card.name} copies ${last.name}'s ability!`, 'hot');
      } else {
        effects = effects.filter(e => e.type !== 'COPY');
      }
    }

    const harmful = new Set(['DRAW', 'DISCARD', 'SWAP_HANDS', 'STEAL']);

    if (actor !== 0) {
      for (const e of effects) {
        if (!harmful.has(e.type)) continue;
        const tgts = RuleEngine.targets(state, actor, e.target || 'self');
        if (tgts.includes(0) && typeof Achievements !== 'undefined') Achievements.onHumanHit();
      }
    }

    for (const e of effects) {
      const targets = RuleEngine.targets(state, actor, e.target || 'self');

      switch (e.type) {
        case EFFECTS.DRAW: {
          if (e.target === 'next') {
            state.pendingDraw += e.amount;
          } else {
            for (const t of targets) {
              if (harmful.has('DRAW') && state.players[t].immune && t !== actor) continue;
              this.drawTo(state, t, e.amount);
            }
          }
          break;
        }
        case EFFECTS.SKIP:
          ctx.skip += 1;
          this.log(`${state.players[RuleEngine.targets(state, actor, 'next')[0]].name} is skipped`);
          break;

        case EFFECTS.REVERSE:
          ctx.reverse = true;
          break;

        case EFFECTS.EXTRA_TURN:
          ctx.extraTurn = true;
          break;

        case EFFECTS.DISCARD: {
          for (const t of targets) {
            if (state.players[t].immune && t !== actor) {
              this.log(`${state.players[t].name} is immune`);
              continue;
            }
            const victim = state.players[t];
            let n = e.amount === -1 ? Math.floor(victim.hand.length / 2) : e.amount;
            n = Math.min(n, victim.hand.length);
            for (let i = 0; i < n; i++) {
              const j = rnd(victim.hand.length);
              const [c] = victim.hand.splice(j, 1);
              state.discard.push(c);
            }
            if (n > 0) this.log(`${victim.name} discards ${n} card${n > 1 ? 's' : ''}`);
          }
          break;
        }

        case EFFECTS.SWAP_HANDS: {
          for (const t of targets) {
            if (state.players[t].immune) { this.log(`${state.players[t].name} is immune`); continue; }
            const tmp = state.players[actor].hand;
            state.players[actor].hand = state.players[t].hand;
            state.players[t].hand = tmp;
            this.log(`${state.players[actor].name} swapped hands with ${state.players[t].name}`, 'hot');
          }
          break;
        }

        case EFFECTS.STEAL: {
          for (const t of targets) {
            if (state.players[t].immune) continue;
            const victim = state.players[t];
            for (let i = 0; i < e.amount; i++) {
              if (!victim.hand.length) break;
              const j = rnd(victim.hand.length);
              const [c] = victim.hand.splice(j, 1);
              state.players[actor].hand.push(c);
            }
          }
          break;
        }

        case EFFECTS.REVEAL: {
          const t = targets[0];
          if (t === undefined) break;
          state.reveal = { playerIdx: t, cards: state.players[t].hand.slice() };
          this.log(`${state.players[actor].name} reveals ${state.players[t].name}'s hand`);
          if (typeof ArenaView !== 'undefined') ArenaView.showReveal(state.reveal);
          break;
        }

        case EFFECTS.SHIELD:
          state.players[actor].shield += 1;
          this.log(`${state.players[actor].name} raises a Shield`);
          break;

        case EFFECTS.IMMUNE:
          state.players[actor].immune = true;
          this.log(`${state.players[actor].name} is untargetable`);
          break;
      }
    }

    return ctx;
  },

  finishTurn(state, ctx) {
    if (state.winner !== null) return;
    const n = state.players.length;

    if (ctx.reverse) {
      state.direction *= -1;
      this.log('Direction reversed');
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
      this.log(`${p.name} must respond to +${state.pendingDraw}`);
    }

    if (typeof ArenaView !== 'undefined') {
      ArenaView.render();
      ArenaView.renderLog();
    }

    if (p.isBot) {
      clearTimeout(this._botTimer);
      const myState = state;
      this._botTimer = setTimeout(() => {
        if (this.state !== myState) return;
        if (myState.winner !== null) return;
        BotAI.takeTurn(myState);
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
      this.log(`${p.name} takes +${n}`);
      if (typeof Sound !== 'undefined') Sound.draw();
      state.turn = mod(state.turn + state.direction, state.players.length);
      this.beginTurn(state);
      return { ok: true, took: n };
    }

    if (!state.deck.length) {
      const canReshuffle = state.rules.deal.reshuffle && state.discard.length > 1;
      if (!canReshuffle) {
        return { ok: false, reason: 'Deck is empty — no cards to draw' };
      }
    }

    const count = state.rules.draw.count;
    let drawn = 0;
    let playableNow = false;

    if (state.rules.turn.drawUntilPlayable) {
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
    this.log(`${p.name} drew ${drawn} card${drawn > 1 ? 's' : ''}`);
    if (typeof Sound !== 'undefined') Sound.draw();

    if (typeof ArenaView !== 'undefined') ArenaView.render();
    return { ok: true, drawn, playableNow };
  },

  playerPass(state, playerIdx) {
    const p = state.players[playerIdx];

    if (state.pendingDraw > 0) {
      return { ok: false, reason: `You must draw +${state.pendingDraw} or stack a card` };
    }
    if (!state.hasDrawn) {
      return { ok: false, reason: 'You must draw first' };
    }
    const playable = p.hand.some(c =>
      RuleEngine.isPlayable(c, state, state.rules) &&
      RuleEngine.meetsRequirement(c, p, state.rules));
    if (playable && state.rules.draw.forcePlay) {
      return { ok: false, reason: 'You must play if you can' };
    }
    this.log(`${p.name} passed`);
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