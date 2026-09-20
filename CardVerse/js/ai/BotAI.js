/* ============================================================
   ai/BotAI.js — v2.10
   FIXES:
     · Bots now build a proper `opts` object (color/targetIdx/cardUid)
       instead of passing a color string or null. This was throwing
       a TypeError on cards with target:'choose' or STEAL pick:true,
       which killed the bot's setTimeout and froze the game.
     · awaitingInput no longer bails out — the bot retries shortly.
     · Every executePlay path passes an explicit opts object.
   ============================================================ */
const BotAI = {
  _retryTimer: null,

  takeTurn(state) {
    if (!state || state.winner !== null) return;
    const p = state.players[state.turn];
    if (!p || !p.isBot) return;
    if (GameEngine.state !== state) return;

    // If a human is mid-decision (rare), retry rather than freeze.
    if (ArenaView.awaitingInput) {
      clearTimeout(this._retryTimer);
      const myState = state;
      this._retryTimer = setTimeout(() => {
        if (GameEngine.state !== myState) return;
        if (myState.winner !== null) return;
        this.takeTurn(myState);
      }, 500);
      return;
    }

    const actor = state.turn;
    const opts = (card) => this._buildOpts(state, actor, card);

    // ── Responding to a pending draw ─────────────────────
    if (state.pendingDraw > 0) {
      const stackable = p.hand.filter(c => RuleEngine.canStack(c, state, state.rules));
      if (stackable.length) {
        const pick = this.choose(stackable, state, actor);
        ArenaView.executePlay(actor, pick, opts(pick));
        return;
      }
      GameEngine.playerDraw(state, actor);
      ArenaView.afterAction();
      return;
    }

    const playable = p.hand.filter(c =>
      RuleEngine.isPlayable(c, state, state.rules) &&
      RuleEngine.meetsRequirement(c, p, state.rules));

    // ── No playable card ─────────────────────────────────
    if (!playable.length) {
      if (!state.deck.length &&
          (!state.rules.deal.reshuffle || state.discard.length <= 1)) {
        state.winner = -1;
        GameEngine.log('⚠ Deck exhausted — no winner.', 'hot');
        ArenaView.afterAction();
        return;
      }

      GameEngine.playerDraw(state, actor);

      if (state.rules.draw.playAfterDraw) {
        const np = state.players[state.turn];
        if (!np || state.winner !== null) return;
        const nowPlayable = np.hand.filter(c =>
          RuleEngine.isPlayable(c, state, state.rules) &&
          RuleEngine.meetsRequirement(c, np, state.rules));
        if (nowPlayable.length && Math.random() < 0.85) {
          const pick = this.choose(nowPlayable, state, state.turn);
          const newActor = state.turn;
          setTimeout(() => {
            if (state.winner !== null || GameEngine.state !== state) return;
            ArenaView.executePlay(newActor, pick, this._buildOpts(state, newActor, pick));
          }, 520);
          return;
        }
      }
      setTimeout(() => {
        if (state.winner !== null || GameEngine.state !== state) return;
        GameEngine.playerPass(state, state.turn);
        ArenaView.afterAction();
      }, 520);
      return;
    }

    // ── Play ─────────────────────────────────────────────
    const pick = this.choose(playable, state, actor);
    setTimeout(() => {
      if (state.winner !== null || GameEngine.state !== state) return;
      ArenaView.executePlay(actor, pick, this._buildOpts(state, actor, pick));
    }, 320);
  },

  /** Build the opts object the engine needs for this card. */
  _buildOpts(state, actor, card) {
    const out = {};
    if (!card || !Array.isArray(card.effects)) return out;

    if (card.color === 'wild') {
      out.color = GameEngine.botColorChoice(state, actor);
    }

    // target: 'choose' → pick the opponent with the most cards.
    const needChoose = card.effects.some(e => e.target === 'choose');
    if (needChoose) {
      let bestIdx = -1, bestHand = -1;
      state.players.forEach((q, qi) => {
        if (qi === actor) return;
        if (q.hand.length > bestHand) { bestHand = q.hand.length; bestIdx = qi; }
      });
      if (bestIdx !== -1) out.targetIdx = bestIdx;
    }

    // STEAL with pick:true → choose the victim's best card.
    const stealPick = card.effects.find(e => e.type === 'STEAL' && e.pick);
    if (stealPick) {
      const tIdx = stealPick.target === 'choose'
        ? out.targetIdx
        : RuleEngine.targets(state, actor, stealPick.target)[0];
      const victim = state.players[tIdx];
      if (victim && victim.hand.length) {
        const rarityScore = { ultimate: 4, rare: 3, uncommon: 2, common: 1 };
        let bestCard = victim.hand[0];
        let bestScore = -Infinity;
        for (const c of victim.hand) {
          const sc = (rarityScore[c.rarity] || 1) * 100 + (c.value || 0);
          if (sc > bestScore) { bestScore = sc; bestCard = c; }
        }
        out.cardUid = bestCard.uid;
      }
    }

    return out;
  },

  choose(options, state, actor) {
    const n = state.players.length;
    const me = state.players[actor];
    const nextIdx = mod(actor + state.direction, n);
    const nextP = state.players[nextIdx];
    const myHand = me.hand.length;

    let best = options[0], bestScore = -Infinity;
    for (const c of options) {
      let s = 10 + Math.random() * 6;

      if (c.color === 'wild') s -= 42;
      if (c.type === 'number') s += 6 + (c.value ?? 0) * .5;
      if (c.type === 'action' || c.type === 'special') s += 4;

      if (myHand <= 2 && c.type === 'number') s += 20;
      if (myHand <= 2 && c.color === 'wild') s -= 30;

      for (const e of c.effects) {
        if (e.type === 'DRAW' && e.target === 'next') {
          s += (8 - Math.min(nextP.hand.length, 8)) * 4;
          s += e.amount * 3;
        }
        if (e.type === 'SKIP' && nextP.hand.length <= 2) s += 26;
        if (e.type === 'EXTRA_TURN') s += myHand <= 3 ? 24 : 12;
        if (e.type === 'SWAP_HANDS') {
          const delta = me.hand.length - nextP.hand.length;
          s += delta * 3;
          if (delta < 0) s -= 12;
        }
        if (e.type === 'REVERSE') {
          if (n === 2) s += 5;
          if (n > 2) s -= 2;
        }
        if (e.type === 'DISCARD' && e.target === 'others') {
          const total = state.players.reduce(
            (a, p, i) => a + (i === actor ? 0 : p.hand.length), 0);
          s += total * 1.4;
        }
        if (e.type === 'SHIELD' || e.type === 'IMMUNE') s += 3;
        if (e.type === 'REVEAL') s += 2;
        if (e.type === 'STEAL') s += 8;
      }
      if (c.requires && c.requires.minHand && me.hand.length < c.requires.minHand + 2) s -= 20;

      const drawsSelf = c.effects.some(e => e.type === 'DRAW' && e.target === 'self');
      if (drawsSelf && myHand <= 2) s -= 25;

      if (s > bestScore) { bestScore = s; best = c; }
    }
    return best;
  }
};