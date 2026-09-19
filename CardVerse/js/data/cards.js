/* ============================================================
   data/cards.js — UNIVERSES
   ============================================================ */
const COLOR_META = {
  red:    { label: 'Red',    hex: '#E63946', theme: 'Power' },
  blue:   { label: 'Blue',   hex: '#3A7BD5', theme: 'Tech' },
  green:  { label: 'Green',  hex: '#2A9D8F', theme: 'Strength' },
  yellow: { label: 'Yellow', hex: '#E9C46A', theme: 'Speed' },
  wild:   { label: 'Wild',   hex: '#9B5DE5', theme: 'Any' }
};

const RARITY_META = {
  common:   { label: 'Common',   hex: '#9A9AB0' },
  uncommon: { label: 'Uncommon', hex: '#3A7BD5' },
  rare:     { label: 'Rare',     hex: '#9B5DE5' },
  ultimate: { label: 'Ultimate', hex: '#E9C46A' }
};

const UNIVERSES = {
  marvel: {
    id: 'marvel', name: 'Marvel', icon: '🦸',
    tagline: 'Heroes, villains and one very expensive glove.',
    colors: ['red', 'blue', 'green', 'yellow'],
    numberNames: {
      red:    ['Red Guardian','Hawkeye','Black Widow','Falcon','War Machine','Heimdall','Sif','Winter Soldier','Mockingbird','Punisher'],
      blue:   ['Shuri','Nick Fury','Wong','Mantis','Star-Lord','Captain Marvel','Maria Hill','Agent Coulson','Everett Ross','Hank Pym'],
      green:  ['Okoye','Valkyrie','Korg',"M'Baku",'Wasp','Rocket','Nebula','Yondu','Groot','Drax'],
      yellow: ['Darcy Lewis','Jimmy Woo','Happy Hogan','Ned Leeds','Jane Foster','Erik Selvig','Pepper Potts','Nakia','Luis','Katy']
    },
    actions: [
      { name:'Hulk', color:'red', type:'action', icon:'💥', rarity:'common', count:2,
        text:'Smash — next player draws 2.',
        effects:[{type:'DRAW',target:'next',amount:2}] },
      { name:'Thor', color:'red', type:'action', icon:'🔨', rarity:'uncommon', count:1,
        text:'Mjolnir — next player discards 1, then draws 1.',
        effects:[{type:'DISCARD',target:'next',amount:1},{type:'DRAW',target:'next',amount:1}] },
      { name:'Scarlet Witch', color:'red', type:'action', icon:'🔮', rarity:'rare', count:1,
        text:'Chaos Magic — reverse direction; next player draws 1.',
        effects:[{type:'REVERSE'},{type:'DRAW',target:'next',amount:1}] },
      { name:'Deadpool', color:'red', type:'action', icon:'🗡️', rarity:'rare', count:1,
        text:'Fourth Wall — take another turn immediately.',
        effects:[{type:'EXTRA_TURN'}] },
      { name:'Killmonger', color:'red', type:'action', icon:'🐆', rarity:'uncommon', count:1,
        text:'Challenge — the next player skips their turn.',
        effects:[{type:'SKIP',target:'next'}] },

      { name:'Iron Man', color:'blue', type:'action', icon:'🤖', rarity:'rare', count:1,
        text:'Repulsor Blast — next player draws 2 and skips.',
        effects:[{type:'DRAW',target:'next',amount:2},{type:'SKIP',target:'next'}] },
      { name:'Doctor Strange', color:'blue', type:'action', icon:'🌀', rarity:'rare', count:1,
        text:'Time Manipulation — reverse direction and take another turn.',
        effects:[{type:'REVERSE'},{type:'EXTRA_TURN'}] },
      { name:'Vision', color:'blue', type:'action', icon:'💎', rarity:'common', count:2,
        text:'Mind Stone — reveal the next player\'s hand.',
        effects:[{type:'REVEAL',target:'next'}] },
      { name:'Spider-Man', color:'blue', type:'action', icon:'🕷️', rarity:'uncommon', count:1,
        text:'Spider-Sense — negate the next Draw effect on you.',
        effects:[{type:'SHIELD',target:'self'}] },
      { name:'Ultron', color:'blue', type:'action', icon:'⚙️', rarity:'rare', count:1,
        text:'Replication — copy the last action card\'s ability.',
        effects:[{type:'COPY'}] },

      { name:'Captain America', color:'green', type:'action', icon:'🛡️', rarity:'uncommon', count:1,
        text:'Shield — negate the next Draw effect on you.',
        effects:[{type:'SHIELD',target:'self'}] },
      { name:'Groot', color:'green', type:'action', icon:'🌳', rarity:'uncommon', count:1,
        text:'I Am Groot — you cannot be targeted until your next turn.',
        effects:[{type:'IMMUNE',target:'self'}] },
      { name:'Black Panther', color:'green', type:'action', icon:'🐾', rarity:'uncommon', count:1,
        text:'Vibranium Suit — reverse direction and draw 1.',
        effects:[{type:'REVERSE'},{type:'DRAW',target:'self',amount:1}] },
      { name:'Gamora', color:'green', type:'action', icon:'⚔️', rarity:'uncommon', count:1,
        text:'Assassin — the next player skips their turn.',
        effects:[{type:'SKIP',target:'next'}] },
      { name:'Ant-Man', color:'green', type:'action', icon:'🐜', rarity:'rare', count:1,
        text:'Pym Particles — swap hands with the next player.',
        effects:[{type:'SWAP_HANDS',target:'next'}] },

      { name:'Quicksilver', color:'yellow', type:'action', icon:'⚡', rarity:'rare', count:1,
        text:'Super Speed — take another turn immediately.',
        effects:[{type:'EXTRA_TURN'}] },
      { name:'Green Goblin', color:'yellow', type:'action', icon:'🎃', rarity:'common', count:2,
        text:'Pumpkin Bomb — next player draws 1.',
        effects:[{type:'DRAW',target:'next',amount:1}] },
      { name:'Mysterio', color:'yellow', type:'action', icon:'🌫️', rarity:'common', count:1,
        text:'Illusions — reveal the next player\'s hand.',
        effects:[{type:'REVEAL',target:'next'}] },
      { name:'Vulture', color:'yellow', type:'action', icon:'🦅', rarity:'uncommon', count:1,
        text:'Scavenge — draw 2 cards.',
        effects:[{type:'DRAW',target:'self',amount:2}] },

      { name:'Loki', color:'wild', type:'special', icon:'🎭', rarity:'uncommon', count:2,
        text:'Illusion — change the active color.',
        effects:[] },
      { name:'Kang the Conqueror', color:'wild', type:'special', icon:'⏳', rarity:'rare', count:1,
        text:'Timeline Shift — change the color; next player draws 4.',
        effects:[{type:'DRAW',target:'next',amount:4}] },
      { name:'Thanos', color:'wild', type:'special', icon:'🧤', rarity:'ultimate', count:1,
        text:'The Snap — every other player discards half their hand (rounded down). Requires 6+ cards in hand.',
        requires:{ minHand: 6 },
        effects:[{type:'DISCARD',target:'others',amount:-1}] }
    ]
  },

  naruto: {
    id: 'naruto', name: 'Naruto', icon: '🍥',
    tagline: 'Chakra natures, jutsu and a lot of shouting.',
    colors: ['red', 'blue', 'green', 'yellow'],
    numberNames: {
      red:    ['Kagami','Sakura','Ino','Choji','Asuma','Kurenai','Anko','Hayate','Genma','Rin'],
      blue:   ['Karin','Jugo','Haku','Mei','Yagura','Ao','Mangetsu','Kushimaru','Juzo','Ameyuri'],
      green:  ['Kankuro','Shino','Kiba','Hinata','Neji','Rock Lee','TenTen','Yamato','Sai','Shikamaru'],
      yellow: ['Killer B','Darui','C','A','Omoi','Samui','Izumo','Kotetsu','Shikaku','Inoichi']
    },
    actions: [
      { name:'Itachi', color:'red', type:'action', icon:'🔥', rarity:'uncommon', count:1,
        text:'Amaterasu — next player draws 2.',
        effects:[{type:'DRAW',target:'next',amount:2}] },
      { name:'Madara', color:'red', type:'action', icon:'👁️', rarity:'rare', count:1,
        text:'Perfect Susanoo — reverse direction; next player draws 2.',
        effects:[{type:'REVERSE'},{type:'DRAW',target:'next',amount:2}] },
      { name:'Obito', color:'red', type:'action', icon:'🌀', rarity:'rare', count:1,
        text:'Kamui — swap hands with the next player.',
        effects:[{type:'SWAP_HANDS',target:'next'}] },

      { name:'Kisame', color:'blue', type:'action', icon:'🦈', rarity:'uncommon', count:1,
        text:'Samehada — next player draws 1 and skips.',
        effects:[{type:'DRAW',target:'next',amount:1},{type:'SKIP',target:'next'}] },
      { name:'Zabuza', color:'blue', type:'action', icon:'🌫️', rarity:'uncommon', count:1,
        text:'Hidden Mist — all opponents draw 1.',
        effects:[{type:'DRAW',target:'others',amount:1}] },
      { name:'Tobirama', color:'blue', type:'action', icon:'💧', rarity:'rare', count:1,
        text:'Flying Raijin — take another turn.',
        effects:[{type:'EXTRA_TURN'}] },
      { name:'Suigetsu', color:'blue', type:'action', icon:'💦', rarity:'uncommon', count:1,
        text:'Hydrification — you cannot be targeted until your next turn.',
        effects:[{type:'IMMUNE',target:'self'}] },

      { name:'Naruto', color:'green', type:'action', icon:'🍥', rarity:'uncommon', count:1,
        text:'Shadow Clone Jutsu — draw 2 cards.',
        effects:[{type:'DRAW',target:'self',amount:2}] },
      { name:'Gaara', color:'green', type:'action', icon:'🏜️', rarity:'uncommon', count:1,
        text:'Sand Shield — negate the next Draw effect on you.',
        effects:[{type:'SHIELD',target:'self'}] },
      { name:'Temari', color:'green', type:'action', icon:'🌪️', rarity:'common', count:1,
        text:'Kamaitachi — reverse the turn direction.',
        effects:[{type:'REVERSE'}] },
      { name:'Jiraiya', color:'green', type:'action', icon:'🐸', rarity:'common', count:1,
        text:'Sage Mode — reveal the next player\'s hand.',
        effects:[{type:'REVEAL',target:'next'}] },

      { name:'Sasuke', color:'yellow', type:'action', icon:'⚡', rarity:'uncommon', count:1,
        text:'Chidori — the next player skips their turn.',
        effects:[{type:'SKIP',target:'next'}] },
      { name:'Kakashi', color:'yellow', type:'action', icon:'👁️', rarity:'rare', count:1,
        text:'Sharingan — copy the last action card\'s ability.',
        effects:[{type:'COPY'}] },
      { name:'Minato', color:'yellow', type:'action', icon:'💠', rarity:'rare', count:1,
        text:'Flying Thunder God — take another turn.',
        effects:[{type:'EXTRA_TURN'}] },

      { name:'Rinnegan', color:'wild', type:'special', icon:'👁️', rarity:'uncommon', count:2,
        text:'Change the active color.',
        effects:[] },
      { name:'Ten-Tails', color:'wild', type:'special', icon:'🐉', rarity:'rare', count:1,
        text:'Change the color; next player draws 4.',
        effects:[{type:'DRAW',target:'next',amount:4}] },
      { name:'Kaguya', color:'wild', type:'special', icon:'🌙', rarity:'ultimate', count:1,
        text:'Infinite Tsukuyomi — every other player discards half their hand (rounded down). Requires 6+ cards in hand.',
        requires:{ minHand: 6 },
        effects:[{type:'DISCARD',target:'others',amount:-1}] }
    ]
  }
};