// Every rule number (Reference-Screenshots/MECHANICS.md). Values marked (A) are
// assumptions listed in OPEN_QUESTIONS.md.

export const START = { breath: 1, wins: 0, rebirths: 0, level: 1, xp: 0 }

export const MULTIPLIER = {
  rebirthMult: (rebirths) => rebirths + 1, // x4 at 3 rebirths (ui-overlay_02)
  // multiplier = rebirthMult + sum of equipped pet multipliers (A): 4 + 2 = x6
}

export const TRAINING = {
  blowInterval: 1.5, // s between blows on a pad (inflate animation)
  padRadius: 1.3,
  lanes: [
    { id: '1x', mult: 1, unlock: { rebirths: 0 } },
    { id: '4x', mult: 4, unlock: { rebirths: 2 } },
    { id: '10x', mult: 10, unlock: { rebirths: 4 } },
    { id: '20x', mult: 20, unlock: { rebirths: 6 } },
    { id: '3x', mult: 3, unlock: { rebirths: 1 } },
    { id: '15x', mult: 15, unlock: { rebirths: 5 } },
    { id: '50x', mult: 50, unlock: { rebirths: 8 } },
  ],
}

export const BUBBLES = [
  { id: 'plain', name: 'Bubble', breath: 1, price: 0, shape: 'sphere', tint: 'plain' },
  { id: 'drop', name: 'Water Drop', breath: 3, price: 2, shape: 'drop', tint: 'drop' },
  { id: 'balloon', name: 'Balloon', breath: 5, price: 10, shape: 'balloon', tint: 'balloon' },
  { id: 'greenGem', name: 'Green Gem', breath: 12, price: 40, shape: 'cubeGem', tint: 'greenGem' },
  { id: 'goldGem', name: 'Gold Gem', breath: 30, price: 150, shape: 'gem', tint: 'goldGem' },
  { id: 'star', name: 'Star', breath: 75, price: 500, shape: 'star', tint: 'star' },
  { id: 'sparkle', name: 'Sparkle', breath: 200, price: 1500, shape: 'star', tint: 'sparkle' },
  { id: 'meteor', name: 'Meteor', breath: 500, price: 4500, shape: 'meteor', tint: 'meteor' },
  { id: 'planet', name: 'Planet', breath: 1250, price: 14000, shape: 'planet', tint: 'planet' },
  { id: 'blackHole', name: 'Black Hole', breath: 3500, price: 40000, shape: 'blackHole', tint: 'blackHole' },
  { id: 'celestial', name: 'Celestial Bubble', breath: null, bestFactor: 1.5, price: 150000, shape: 'galaxy', tint: 'celestial' },
]

export const BLOW = {
  inflateTime: 1.6,
  diameter: (breath) => Math.min(6, Math.max(1, 1 + 0.7 * Math.log10(breath + 1))), // (A)
  // Scripted shots (blow-zone-strip.md): offsets from the player's feet P, camera on +X looking -X.
  // `facing` = the avatar's yaw during the shot (pi/2 faces +X, the camera; -pi/2 faces the pads).
  shotA: { duration: 1.0, pos: [1.3, 0.85, 0.35], target: [-0.5, 0.7, -0.05], fov: 70, dolly: 0.1, facing: Math.PI / 2 },
  shotB: { duration: 0.8, pos: [1.6, 1.3, -0.9], target: [-1.2, 0.8, 0.4], fov: 70, facing: -Math.PI / 2 },
  bubbleGap: 0.35, // the growing bubble's near side, this far out from the avatar on -X (the wand ring in shot B)
  snapTime: 0.2, // end of the inflate: the bubble slides over the avatar
  rideBlend: 0.4,
  sparkles: 12, // white 4-point stars around the rim over the inflate
  sparkleSize: [0.4, 0.8], // u (blow-zone-strip_02)
}

// Training-pad blow (training-pads.md): a small bubble at the wand that pops.
export const TRAIN_BLOW = { diameter: 1.2, inflateTime: 1.2, stillSpeed: 0.4 }

export const RIDE = {
  speed: 40, // u/s = 200 HUD m/s (Q16)
  bounceLength: 12,
  apexFactor: 1.2, // apex = apexFactor x bubble diameter
  maxApex: 4, // (A) bubble-ride-lane_02/_05/_06 never show it higher than ~3-4 u
  camera: { pos: [0, 6, -10], target: [0, 1, 8], fov: 70, lag: 0.15, shake: 0.05, shakeTime: 0.15 },
  avatarFill: 0.7, // the crouched avatar fits in this share of the bubble's diameter
  wobble: (5 * Math.PI) / 180,
  squash: 0.18, // s of squash-and-stretch on each landing
  dust: { beach: '#f3e3a8', desert: '#f0c05a', snow: '#ffffff' }, // landing puffs per segment
  minDistanceMeters: 250, // (A) a fresh player (Breath 1 -> 22 m, under one bounce) still visibly rides down the lane
  distanceMeters: (breath) => Math.max(RIDE.minDistanceMeters, 22 * Math.pow(breath, 0.37)), // (A) 453K -> ~2,730 m
  breathPerBounce: (bubbleBreath, multiplier) => bubbleBreath * multiplier, // 75 x 6 = 450
  xpPerBreath: 1, // (A, Q24)
}

export const WINS = {
  perMeter: 1 / 13, // round(distance_m / 13) x multiplier x wandMult (A, Q18)
}

// End of a ride (burst-and-rewards.md): seconds after the burst.
export const REWARD = { fadeOut: 0.3, fadeTime: 0.25, screen: 0.6, teleport: 2.0, fadeIn: 0.3, shower: 2.3, trophies: 12, count: 1.0 }

// First-run objective banner (A; Bowling Roll's TUTORIAL, trimmed): advanced by game events.
export const TUTORIAL = [
  { id: 'train', text: 'Stand on the 1x BREATH pad to train your Breath' },
  { id: 'blow', text: 'Go to the BLOW ZONE and press BLOW!' },
  { id: 'buy', text: 'Step on the +3 Breath pad to buy a better bubble' },
  { id: 'rebirth', text: 'Level up and Rebirth to unlock the 4x pad' },
]

export const WANDS = [
  { id: 'plastic', name: 'Plastic Wand', mult: 1.2, price: 10000 },
  { id: 'flower', name: 'Flower Wand', mult: 1.3, price: 750e3 },
  { id: 'heart', name: 'Heart Wand', mult: 1.4, price: 40e6 },
  { id: 'star', name: 'Star Wand', mult: 1.5, price: 5e9 },
  { id: 'crystal', name: 'Crystal Wand', mult: 1.6, price: 125e9 },
  { id: 'golden', name: 'Golden Wand', mult: 1.7, price: 10e12 },
  { id: 'diamond', name: 'Diamond Wand', mult: 1.8, price: 250e12 },
  { id: 'magic', name: 'Magic Wand', mult: 1.9, price: 30e18 },
  { id: 'galaxy', name: 'Galaxy Wand', mult: 2.0, robux: 115 },
  { id: 'blackHole', name: 'Black Hole Wand', mult: 3.0, robux: 279 },
]

export const LEVELS = {
  xpForLevel: (level) => Math.round(120 * Math.pow(1.075, level)), // L78 -> ~34k (A)
  rebirthLevel: (rebirths) => 20 * (rebirths + 1), // 3 rebirths -> Level 80
  skipRebirthRobux: 25,
}

export const GOALS = [
  { id: 'rebirth-1', rebirths: 1, text: 'Rebirth 1 time', rewards: [{ egg: 'common', n: 1 }] },
  { id: 'rebirth-2', rebirths: 2, text: 'Rebirth 1 more time', rewards: [{ egg: 'uncommon', n: 1 }] },
  { id: 'rebirth-3', rebirths: 3, text: 'Rebirth 1 more time', rewards: [{ boost: 'superBubble', n: 2 }] },
  { id: 'rebirth-5', rebirths: 5, text: 'Rebirth 2 more times', rewards: [{ egg: 'rare', n: 1 }, { boost: 'superBubble', n: 3 }] },
  { id: 'rebirth-8', rebirths: 8, text: 'Rebirth 3 more times', rewards: [{ egg: 'mythic', n: 1 }] },
  { id: 'rebirth-12', rebirths: 12, text: 'Rebirth 4 more times', rewards: [{ egg: 'rare', n: 2 }, { boost: 'superBubble', n: 5 }] },
]

export const EGGS = [
  { id: 'common', name: 'Common Egg', price: 50, pets: ['soapKitty', 'bubbleDuck', 'pinkPuff'], weights: [60, 30, 10] },
  { id: 'uncommon', name: 'Uncommon Egg', price: 500, pets: ['foamFox', 'luckyPup'], weights: [70, 30] },
  { id: 'rare', name: 'Rare Egg', price: 4000, pets: ['frostDragon', 'foamFox'], weights: [40, 60] },
  { id: 'mythic', name: 'Mythic Egg', robux: 30, pets: ['starlightDragon', 'frostDragon'], weights: [20, 80] },
  { id: 'king', name: 'King Egg', price: 25000, pets: ['kingGriffin', 'starlightDragon'], weights: [70, 30] },
  { id: 'royalLion', name: 'Royal Lion', price: 100000, pets: ['royalLion', 'kingGriffin'], weights: [60, 40] },
]

export const PETS = {
  soapKitty: { name: 'Soap Kitty', rarity: 'Common', mult: 2, egg: 'common', look: 'kitty' },
  bubbleDuck: { name: 'Bubble Duck', rarity: 'Common', mult: 2.5, egg: 'common', look: 'duck' },
  pinkPuff: { name: 'Pink Puff', rarity: 'Common', mult: 3, egg: 'common', look: 'pink' },
  foamFox: { name: 'Foam Fox', rarity: 'Uncommon', mult: 4, egg: 'uncommon', look: 'fox' },
  luckyPup: { name: 'Lucky Pup', rarity: 'Uncommon', mult: 5, egg: 'uncommon', look: 'pup' },
  frostDragon: { name: 'Frost Dragon', rarity: 'Rare', mult: 8, egg: 'rare', look: 'dragon' },
  kingGriffin: { name: 'King Griffin', rarity: 'Legendary', mult: 20, egg: 'king', look: 'king' },
  royalLion: { name: 'Royal Lion', rarity: 'Legendary', mult: 35, egg: 'royalLion', look: 'lion' },
  starlightDragon: { name: 'Starlight Dragon', rarity: 'Mythic', mult: 12.5, egg: 'mythic', look: 'starDragon' },
}
export const PET_LIMITS = { owned: 200, equipped: 3 }
export const PET_INDEX = { normal: 48, golden: 82, exclusive: 34 }

export const BOOSTS = {
  breath2x: { name: '2x Breath Potion', minutes: 10 },
  wins2x: { name: '2x Wins Potion', minutes: 10 },
  wins2x20: { name: '2x Wins Potion', minutes: 20 },
  luck2x: { name: '2x Luck Potion', minutes: 10 },
  secretLuck: { name: 'Secret Luck', minutes: 15 },
  superBubble: { name: 'Super Bubble Boost', factor: 1.5 },
}

export const GIFTS = {
  unlockMinutes: [1, 3, 5, 8, 12, 16, 20, 25, 30, 45, 60, 90],
  slots: [
    { label: '+162K BREATH', breathFactor: 0.36 },
    { label: '+1,250 WINS', wins: 1250 },
    { label: 'COMMON EGG', egg: 'common' },
    { label: '2X BREATH 10M', boost: 'breath2x' },
    { label: '+25,000 WINS', wins: 25000 },
    { label: '+648K BREATH', breathFactor: 1.43 },
    { label: '2X WINS 10M', boost: 'wins2x' },
    { label: 'UNCOMMON EGG', egg: 'uncommon' },
    { label: 'SECRET LUCK 15M', boost: 'secretLuck' },
    { label: '+50,000 WINS', wins: 50000 },
    { label: '+1.3M BREATH', breathFactor: 2.87 },
    { label: 'RARE EGG', egg: 'rare' },
  ],
}

export const DAILY = [
  { day: 1, label: '+12,500 WINS', wins: 12500 },
  { day: 2, label: '2X BREATH 10M', boost: 'breath2x' },
  { day: 3, label: 'UNCOMMON EGG', egg: 'uncommon' },
  { day: 4, label: '2 SUPER BUBBLES', boost: 'superBubble', n: 2 },
  { day: 5, label: '+1.62M BREATH', breathFactor: 3.57 },
  { day: 6, label: '2X WINS 20M', boost: 'wins2x20' },
  { day: 7, label: 'DIAMOND BUBBLE', bubbleBreath: 5000 },
]

export const WHEEL = {
  freeSpinHours: 4,
  wedges: [
    { label: '2x Breath Potion 10m', chance: 22, boost: 'breath2x' },
    { label: '2x Wins Potion 10m', chance: 20, boost: 'wins2x' },
    { label: '2 Super Bubble Boosts', chance: 15, boost: 'superBubble', n: 2 },
    { label: '+25,000 Wins', chance: 15, wins: 25000 },
    { label: '+2.5M Breath', chance: 12, breath: 2.5e6 },
    { label: '1 Mythic Egg', chance: 8, egg: 'mythic' },
    { label: '2x Luck Potion 10m', chance: 5, boost: 'luck2x' },
    { label: '10 Super Bubble Boosts', chance: 2, boost: 'superBubble', n: 10 },
    { label: 'Lucky Pup', chance: 0.9, pet: 'luckyPup' },
    { label: 'Starlight Dragon', chance: 0.1, pet: 'starlightDragon' },
  ],
  robux: { x5: 35, x15: 85 },
}

export const ROBUX_ITEMS = {
  autoBlow: 15,
  breath2x: 2,
  wins2x: 9,
  breathPacks: [
    { label: '+2.5M', robux: 9 },
    { label: '+10M', robux: 35 },
    { label: '+25M', robux: 69 },
  ],
  packs: [
    { id: 'starter', label: 'STARTER PACK', off: '-80%' },
    { id: 'pro', label: 'PRO PACK', off: '-34%' },
    { id: 'royal', label: 'ROYAL PACK', off: '-69%' },
  ],
}

export const SAVE_KEY = 'bubble-bounce.save.v1'
