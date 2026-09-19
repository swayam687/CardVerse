/* ============================================================
   data/achievements.js — 10 achievements with tracking + toasts
   ============================================================ */
const ACHIEVEMENTS = {
  first_blood:  { icon: '🏆', name: 'First Blood',   desc: 'Win your first match' },
  hot_streak:   { icon: '🔥', name: 'Hot Streak',    desc: 'Win 3 matches in a row' },
  snap:         { icon: '💀', name: 'Snap',          desc: 'Play Thanos or Kaguya' },
  untouchable:  { icon: '🛡️', name: 'Untouchable',   desc: 'Win without abilities hitting you' },
  speed_demon:  { icon: '⚡', name: 'Speed Demon',   desc: 'Win in under 60 seconds' },
  collector:    { icon: '🃏', name: 'Collector',     desc: 'Play 100 action cards' },
  rainbow:      { icon: '🌈', name: 'Rainbow',       desc: 'Win having played all 4 colors' },
  dominator:    { icon: '👑', name: 'Dominator',     desc: 'Win a match with 5+ players' },
  copycat:      { icon: '🎭', name: 'Copycat',       desc: 'Copy an Ultimate ability' },
  slow_steady:  { icon: '🐢', name: 'Slow & Steady', desc: 'Win with 10+ cards at some point' }
};

const Achievements = {
  unlocked: {},
  stats: { wins: 0, streak: 0, cardsPlayed: 0 },
  _match: null,

  init() {
    try { this.unlocked = JSON.parse(localStorage.getItem('rv_achievements') || '{}'); } catch(e){ this.unlocked = {}; }
    try {
      const s = JSON.parse(localStorage.getItem('rv_achievement_stats') || '{}');
      this.stats.wins = s.wins || 0;
      this.stats.streak = s.streak || 0;
      this.stats.cardsPlayed = s.cardsPlayed || 0;
    } catch(e){}
    this._match = this._newMatch();
  },

  _newMatch() {
    return {
      colorsPlayed: new Set(),
      gotHit: false,
      minHand: 999,
      lastPlayed: null
    };
  },

  _save() {
    try { localStorage.setItem('rv_achievements', JSON.stringify(this.unlocked)); } catch(e){}
    try { localStorage.setItem('rv_achievement_stats', JSON.stringify(this.stats)); } catch(e){}
  },

  unlock(id) {
    if (this.unlocked[id]) return false;
    this.unlocked[id] = Date.now();
    this._save();
    const def = ACHIEVEMENTS[id];
    if (def && typeof Toast !== 'undefined') Toast.achievement(def);
    return true;
  },

  onMatchStart() { this._match = this._newMatch(); },

  onCardPlayed(card, state, actorIdx) {
    const isCopy = card.effects.some(e => e.type === 'COPY');
    if (isCopy && this._match.lastPlayed && this._match.lastPlayed.rarity === 'ultimate') {
      if (actorIdx === 0) this.unlock('copycat');
    }
    this._match.lastPlayed = { rarity: card.rarity, name: card.name };

    if (actorIdx === 0) {
      if (card.color !== 'wild') this._match.colorsPlayed.add(card.color);
      if (card.type === 'action' || card.type === 'special') {
        this.stats.cardsPlayed++;
        if (this.stats.cardsPlayed >= 100) this.unlock('collector');
      }
      if (card.name === 'Thanos' || card.name === 'Kaguya') this.unlock('snap');
    }

    for (const p of state.players) {
      if (p.hand.length < this._match.minHand) this._match.minHand = p.hand.length;
    }
    this._save();
  },

  onHumanHit() { this._match.gotHit = true; },

  onMatchEnd(winnerIdx, state) {
    const elapsed = (Date.now() - state.startedAt) / 1000;
    if (winnerIdx === 0) {
      this.stats.wins++;
      this.stats.streak++;
      this.unlock('first_blood');
      if (this.stats.streak >= 3) this.unlock('hot_streak');
      if (elapsed < 60) this.unlock('speed_demon');
      if (!this._match.gotHit) this.unlock('untouchable');
      if (state.players.length >= 5) this.unlock('dominator');
      if (this._match.colorsPlayed.size >= 4) this.unlock('rainbow');
      if (this._match.minHand >= 10) this.unlock('slow_steady');
    } else {
      this.stats.streak = 0;
    }
    this._save();
  },

  getUnlockedIds() { return Object.keys(this.unlocked); }
};