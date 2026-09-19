/* ============================================================
   ui/Emotes.js — reaction emojis (players + bots)
   ---------------------------------------------------------
   FIX 5: sender sees their own emote locally too.
   ============================================================ */
const Emotes = {
  EMOJIS: ['👍','😂','😱','🔥','🧠','💀','🎉'],
  _aiCooldown: 0,

  init() {
    const tray = document.getElementById('emoteTray');
    if (!tray) return;
    tray.innerHTML = '';
    this.EMOJIS.forEach(e => {
      const b = document.createElement('button');
      b.className = 'emote-btn';
      b.textContent = e;
      b.onclick = () => {
        this.send(e);                     // ── FIX 5: always show locally
        if (Net.active) Net.sendEmote(e); // and broadcast to other players
      };
      tray.appendChild(b);
    });
  },

  send(emoji) {
    const table = document.querySelector('.table');
    if (!table) return;
    const el = document.createElement('div');
    el.className = 'emote-float';
    el.textContent = emoji;
    el.style.left = (30 + Math.random() * 40) + '%';
    table.appendChild(el);
    setTimeout(() => el.remove(), 1700);
    Haptics.tap();
  },

  maybeBotReact(state, actorIdx, card) {
    if (actorIdx === 0) return;
    if (Math.random() > 0.35) return;
    const now = Date.now();
    if (now - this._aiCooldown < 2200) return;
    this._aiCooldown = now;

    let emoji = null;
    const isBigDraw = card.effects.some(e => e.type === 'DRAW' && e.target === 'next' && e.amount >= 2);
    const isHugeDraw = card.effects.some(e => e.type === 'DRAW' && e.target === 'next' && e.amount >= 4);
    const isUltimate = card.rarity === 'ultimate';
    const isReverse = card.effects.some(e => e.type === 'REVERSE');
    const isSwap = card.effects.some(e => e.type === 'SWAP_HANDS');

    if (isUltimate)      emoji = '💀';
    else if (isHugeDraw) emoji = '😂';
    else if (isSwap)     emoji = '😱';
    else if (isBigDraw)  emoji = Math.random() < .5 ? '😂' : '🔥';
    else if (isReverse)  emoji = '🧠';
    else if (card.type === 'action') emoji = Math.random() < .5 ? '🔥' : '👍';

    if (emoji) setTimeout(() => this.send(emoji), 380);
  }
};