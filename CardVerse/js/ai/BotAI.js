/* ============================================================
   ai/BotAI.js
   ============================================================ */
const BotAI = {
  takeTurn(state) {
    if (!state || state.winner !== null) return;
    const p = state.players[state.turn];
    if (!p || !p.isBot) return;
    if (ArenaView.awaitingInput) return;
    if (GameEngine.state !== state) return;

    if (state.pendingDraw > 0) {
      const stackable = p.hand.filter(c => RuleEngine.canStack(c, state, state.rules));
      if (stackable.length) {
        const pick = stackable[0];
        ArenaView.executePlay(state.turn, pick,
          pick.color === 'wild' ? GameEngine.botColorChoice(state, state.turn) : null);
        return;
      }
      GameEngine.playerDraw(state, state.turn);
      ArenaView.afterAction();
      return;
    }

    const playable = p.hand.filter(c =>
      RuleEngine.isPlayable(c, state, state.rules) &&
      RuleEngine.meetsRequirement(c, p, state.rules));

    if (!playable.length) {
      if (!state.deck.length && (!state.rules.deal.reshuffle || state.discard.length <= 1)) {
        setTimeout(() => {
          if (state.winner === null && state.turn === state.players.indexOf(p)) {
            GameEngine.playerPass(state, state.turn);
            ArenaView.afterAction();
          }
        }, 400);
        return;
      }
      GameEngine.playerDraw(state, state.turn);

      if (state.rules.draw.playAfterDraw) {
        const np = state.players[state.turn];
        if (!np || state.winner !== null) return;
        const nowPlayable = np.hand.filter(c =>
          RuleEngine.isPlayable(c, state, state.rules) &&
          RuleEngine.meetsRequirement(c, np, state.rules));
        if (nowPlayable.length && Math.random() < 0.85) {
          const pick = this.choose(nowPlayable, state, state.turn);
          setTimeout(() => {
            if (state.winner !== null || GameEngine.state !== state) return;
            ArenaView.executePlay(state.turn, pick,
              pick.color === 'wild' ? GameEngine.botColorChoice(state, state.turn) : null);
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

    const pick = this.choose(playable, state, state.turn);
    setTimeout(() => {
      if (state.winner !== null || GameEngine.state !== state) return;
      ArenaView.executePlay(state.turn, pick,
        pick.color === 'wild' ? GameEngine.botColorChoice(state, state.turn) : null);
    }, 320);
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
          const total = state.players.reduce((a, p, i) => a + (i === actor ? 0 : p.hand.length), 0);
          s += total * 1.4;
        }
        if (e.type === 'SHIELD' || e.type === 'IMMUNE') s += 3;
        if (e.type === 'REVEAL') s += 2;
      }
      if (c.requires?.minHand && me.hand.length < c.requires.minHand + 2) s -= 20;

      const drawsSelf = c.effects.some(e => e.type === 'DRAW' && e.target === 'self');
      if (drawsSelf && myHand <= 2) s -= 25;

      if (s > bestScore) { bestScore = s; best = c; }
    }
    return best;
  }
};