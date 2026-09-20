/* ============================================================
   data/presets.js — v2.12 (adds Blitz)
   ============================================================ */
const RULE_PRESETS = {
  classic: {
    icon: '🎴', name: 'Classic',
    desc: 'Standard RuleVerse. Abilities on, light stacking.',
    rules() {
      const r = defaultRules();
      r.matching.color = true;
      r.matching.rank = true;
      r.stacking.draw2OnDraw2 = true;
      r.stacking.anyColor = false;
      r.draw.count = 1;
      r.draw.playAfterDraw = true;
      r.draw.forcePlay = false;
      r.abilities.enabled = true;
      r.deal.handSize = 7;
      r.deal.deckMode = 'normal';
      return r;
    }
  },
  blitz: {
    icon: '⚡', name: 'Blitz',
    desc: 'Four cards, fifteen seconds. Ninety-second games.',
    rules() {
      const r = defaultRules();
      r.matching.color = true;
      r.matching.rank = true;
      r.stacking.draw2OnDraw2 = true;
      r.stacking.anyColor = false;
      r.turn.timer = 15;
      r.draw.count = 1;
      r.draw.playAfterDraw = true;
      r.draw.forcePlay = false;
      r.abilities.enabled = true;
      r.deal.handSize = 4;
      r.deal.deckMode = 'normal';
      return r;
    }
  },
  chaos: {
    icon: '🌪️', name: 'Chaos',
    desc: 'Heavy stacking, big draws, faster games.',
    rules() {
      const r = defaultRules();
      r.matching.color = true;
      r.matching.rank = true;
      r.stacking.draw2OnDraw2 = true;
      r.stacking.draw4OnDraw2 = true;
      r.stacking.draw4OnDraw4 = true;
      r.stacking.draw2OnDraw4 = true;
      r.stacking.anyColor = false;
      r.draw.count = 1;
      r.draw.playAfterDraw = true;
      r.abilities.enabled = true;
      r.deal.handSize = 7;
      r.deal.deckMode = 'normal';
      return r;
    }
  },
  tactical: {
    icon: '🧠', name: 'Tactical',
    desc: 'Match more, plan more, force-play is on.',
    rules() {
      const r = defaultRules();
      r.matching.color = true;
      r.matching.rank = true;
      r.matching.type = true;
      r.matching.character = true;
      r.stacking.draw2OnDraw2 = false;
      r.stacking.anyColor = false;
      r.draw.count = 1;
      r.draw.forcePlay = true;
      r.abilities.enabled = true;
      r.deal.handSize = 7;
      r.deal.deckMode = 'normal';
      return r;
    }
  },
  purge: {
    icon: '☠️', name: 'Purge',
    desc: 'Brutal draws, no mercy, no reshuffle safety net.',
    rules() {
      const r = defaultRules();
      r.matching.color = true;
      r.matching.rank = true;
      r.stacking.draw2OnDraw2 = true;
      r.stacking.draw4OnDraw2 = true;
      r.stacking.draw4OnDraw4 = true;
      r.stacking.anyColor = true;
      r.draw.count = 2;
      r.draw.playAfterDraw = false;
      r.abilities.enabled = true;
      r.deal.handSize = 7;
      r.deal.reshuffle = false;
      r.deal.deckMode = 'normal';
      return r;
    }
  },
  unoClassic: {
    icon: '🎯', name: 'Uno Classic',
    desc: 'Pure Uno — only SKIP, REVERSE, +2, wild +4 fire.',
    rules() {
      const r = defaultRules();
      r.matching.color = true;
      r.matching.rank = true;
      r.matching.universe = false;
      r.matching.character = false;
      r.matching.type = false;
      r.stacking.draw2OnDraw2 = false;
      r.stacking.draw4OnDraw2 = false;
      r.stacking.draw4OnDraw4 = false;
      r.stacking.draw2OnDraw4 = false;
      r.stacking.anyColor = false;
      r.draw.count = 1;
      r.draw.playAfterDraw = true;
      r.draw.forcePlay = false;
      r.abilities.enabled = false;
      r.deal.handSize = 7;
      r.deal.deckMode = 'normal';
      return r;
    }
  },
  noMercy: {
    icon: '💀', name: 'No Mercy',
    desc: 'Full stacking — any color. Big hands, draw-until-playable.',
    rules() {
      const r = defaultRules();
      r.matching.color = true;
      r.matching.rank = true;
      r.matching.universe = false;
      r.matching.character = false;
      r.matching.type = false;
      r.stacking.draw2OnDraw2 = true;
      r.stacking.draw4OnDraw2 = true;
      r.stacking.draw4OnDraw4 = true;
      r.stacking.draw2OnDraw4 = true;
      r.stacking.anyColor = true;
      r.turn.drawUntilPlayable = true;
      r.turn.timer = 0;
      r.draw.count = 1;
      r.draw.playAfterDraw = true;
      r.draw.forcePlay = false;
      r.abilities.enabled = true;
      r.deal.handSize = 10;
      r.deal.deckMode = 'normal';
      return r;
    }
  },
  goWild: {
    icon: '🌈', name: 'Go Wild',
    desc: 'Every card is a wild. Match the announced color.',
    rules() {
      const r = defaultRules();
      r.matching.color = true;
      r.matching.rank = false;
      r.matching.universe = false;
      r.matching.character = false;
      r.matching.type = false;
      r.stacking.draw2OnDraw2 = true;
      r.stacking.draw4OnDraw2 = true;
      r.stacking.draw4OnDraw4 = true;
      r.stacking.draw2OnDraw4 = true;
      r.stacking.anyColor = true;
      r.turn.drawUntilPlayable = false;
      r.draw.count = 1;
      r.draw.playAfterDraw = true;
      r.abilities.enabled = true;
      r.deal.handSize = 7;
      r.deal.deckMode = 'allWild';
      return r;
    }
  }
};