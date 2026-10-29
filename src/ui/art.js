// Procedural UI art (HTML strings) shared by the HUD and the windows: no image files.
// Everything is sized in `em`, so the caller sets the size with font-size.
import { PETS } from '../config/mechanics.js'

export const lungs = () => `<span class="emoji">🫁</span>`
export const trophy = () => `<span class="emoji">🏆</span>`

export function check() {
  return `<svg class="art-check" viewBox="0 0 100 100"><path d="M14 52 L40 78 L88 22" fill="none" stroke="#111" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 52 L40 78 L88 22" fill="none" stroke="#48e83a" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

export function closeX() {
  return `<svg viewBox="0 0 100 100"><path d="M26 26 L74 74 M74 26 L26 74" stroke="#111" stroke-width="30" stroke-linecap="round"/><path d="M26 26 L74 74 M74 26 L26 74" stroke="#fff" stroke-width="17" stroke-linecap="round"/></svg>`
}

const EGG_COLORS = { common: '#f2f2f2', uncommon: '#3ed65a', rare: '#2f8cff', mythic: '#ffc21a', king: '#ffd84a', royalLion: '#ff9a3a', goal: '#2f8cff' }
export function egg(id = 'common') {
  return `<span class="art-egg" style="--c:${EGG_COLORS[id] || id}"></span>`
}

export function potion(color = '#3a8cff') {
  return `<span class="art-potion" style="--c:${color}"><span class="neck"></span><span class="cork"></span></span>`
}
export const BOOST_COLORS = { breath2x: '#3a8cff', wins2x: '#ffb31a', wins2x20: '#ffb31a', luck2x: '#3ed65a', secretLuck: '#3ed65a', superBubble: 'rainbow' }
export function boostArt(id) {
  if (id === 'superBubble') return `<span class="art-super"><span class="emoji">⭐</span></span>`
  return potion(BOOST_COLORS[id] || '#3a8cff')
}

// --- pets: a rounded cube critter with ears and big eyes --------------------------------
const PET_LOOKS = {
  kitty: { c: '#9cc4f5', ears: 'cat' },
  duck: { c: '#ffe066', ears: 'none', beak: true },
  pink: { c: '#ffa6d6', ears: 'round' },
  fox: { c: '#ff9a4a', ears: 'cat' },
  pup: { c: '#5fd36a', ears: 'round' },
  dragon: { c: '#a8e4ff', ears: 'horn', wings: '#dff6ff' },
  king: { c: '#5a7cff', ears: 'horn', wings: '#ffe58a', halo: true },
  lion: { c: '#ffb02e', ears: 'round' },
  starDragon: { c: '#4b4fd6', ears: 'horn', wings: 'rainbow', halo: true },
}
export const PET_LOOK_IDS = Object.keys(PET_LOOKS)

export function petArt(type, { golden = false, silhouette = false, look } = {}) {
  const l = PET_LOOKS[look || PETS[type]?.look] || PET_LOOKS.kitty
  const cls = ['art-pet', `ears-${l.ears}`, golden ? 'golden' : '', silhouette ? 'sil' : ''].join(' ')
  return `<span class="${cls}" style="--c:${golden ? '#ffcf2a' : l.c}">
    ${l.halo ? '<span class="halo"></span>' : ''}
    ${l.wings ? `<span class="wing l ${l.wings === 'rainbow' ? 'rainbow' : ''}"></span><span class="wing r ${l.wings === 'rainbow' ? 'rainbow' : ''}"></span>` : ''}
    <span class="ear l"></span><span class="ear r"></span>
    <span class="body"><span class="eye l"></span><span class="eye r"></span><span class="cheek l"></span><span class="cheek r"></span>
    ${l.beak ? '<span class="beak"></span>' : '<span class="snout"></span>'}</span>
  </span>`
}

// --- bubbles -----------------------------------------------------------------------
const BUBBLE_TINTS = {
  plain: '#d6f2ff',
  drop: '#2f8cff',
  balloon: '#ff4a6a',
  greenGem: '#3ed67a',
  goldGem: '#ffd23a',
  star: '#ffe94a',
  sparkle: '#9ad8ff',
  meteor: '#8a5a3a',
  planet: '#d9a6ff',
  blackHole: '#3a1a6a',
  celestial: '#7a5aff',
}
export function bubbleArt(bubble) {
  return `<span class="art-bubble shape-${bubble.shape}" style="--c:${BUBBLE_TINTS[bubble.tint] || '#d6f2ff'}"></span>`
}

// --- wands: SVG, a handle and one head shape per wand -------------------------------
const WAND_ART = {
  plastic: { head: 'ring', c: '#ff2a3a', handle: '#e8202f' },
  flower: { head: 'flower', c: '#ff4ad8', handle: '#ffffff' },
  heart: { head: 'heart', c: '#ff4aa8', handle: '#ff6ac0' },
  star: { head: 'star', c: '#ffd21a', handle: '#2f5fe0' },
  crystal: { head: 'hex', c: '#2fb4ff', handle: '#2f6fe0' },
  golden: { head: 'wingRing', c: '#ffcf1a', handle: '#ffcf1a', wing: '#ffe680' },
  diamond: { head: 'beads', c: '#b8e8ff', handle: '#2f4fd0' },
  magic: { head: 'wingRing', c: '#ffcf1a', handle: '#2f4fd0', wing: '#ffffff' },
  galaxy: { head: 'orb', c: '#2a1a9a', ring: '#ffcf1a', handle: '#1a1a4a' },
  blackHole: { head: 'void', c: '#8a2ae0', handle: '#1a1030' },
}

function twice(shape, color, w) {
  // Outline pass then colour pass for the chunky cartoon look.
  return shape('#111', w + 7) + shape(color, w)
}

function head(a) {
  const ring = (stroke, w) => `<circle cx="50" cy="48" r="27" fill="none" stroke="${stroke}" stroke-width="${w}"/>`
  switch (a.head) {
    case 'ring':
      return twice(ring, a.c, 11)
    case 'flower': {
      let s = ''
      for (let i = 0; i < 6; i++) {
        const t = (i / 6) * Math.PI * 2
        s += `<circle cx="${50 + Math.cos(t) * 20}" cy="${48 + Math.sin(t) * 20}" r="13" fill="${a.c}" stroke="#111" stroke-width="3.5"/>`
      }
      return s + `<circle cx="50" cy="48" r="11" fill="#fff" stroke="#111" stroke-width="3.5"/><circle cx="50" cy="48" r="5" fill="#ff9ae8"/>`
    }
    case 'heart': {
      const d = 'M50 78 C20 58 16 36 30 26 C40 19 48 25 50 33 C52 25 60 19 70 26 C84 36 80 58 50 78 Z'
      return twice((st, w) => `<path d="${d}" fill="none" stroke="${st}" stroke-width="${w}" stroke-linejoin="round"/>`, a.c, 9)
    }
    case 'star': {
      let p = ''
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 14 : 32
        const t = -Math.PI / 2 + (i / 10) * Math.PI * 2
        p += `${50 + Math.cos(t) * r},${46 + Math.sin(t) * r} `
      }
      return twice((st, w) => `<polygon points="${p}" fill="none" stroke="${st}" stroke-width="${w}" stroke-linejoin="round"/>`, a.c, 8)
    }
    case 'hex': {
      let p = ''
      for (let i = 0; i < 6; i++) {
        const t = (i / 6) * Math.PI * 2 + Math.PI / 6
        p += `${50 + Math.cos(t) * 27},${48 + Math.sin(t) * 27} `
      }
      return twice((st, w) => `<polygon points="${p}" fill="none" stroke="${st}" stroke-width="${w}" stroke-linejoin="round"/>`, a.c, 10)
    }
    case 'wingRing':
      return (
        `<ellipse cx="24" cy="60" rx="17" ry="10" fill="${a.wing}" stroke="#111" stroke-width="3.5" transform="rotate(-25 24 60)"/>` +
        `<ellipse cx="76" cy="60" rx="17" ry="10" fill="${a.wing}" stroke="#111" stroke-width="3.5" transform="rotate(25 76 60)"/>` +
        twice(ring, a.c, 10) +
        `<path d="M50 70 L58 80 L50 90 L42 80 Z" fill="#ff5a2a" stroke="#111" stroke-width="3"/>`
      )
    case 'beads': {
      let s = ''
      for (let i = 0; i < 12; i++) {
        const t = (i / 12) * Math.PI * 2
        s += `<circle cx="${50 + Math.cos(t) * 27}" cy="${48 + Math.sin(t) * 27}" r="8" fill="${a.c}" stroke="#111" stroke-width="3"/>`
      }
      return s
    }
    case 'orb':
      return (
        `<circle cx="50" cy="48" r="30" fill="${a.c}" stroke="#111" stroke-width="4"/>` +
        `<path d="M50 48 m0 -4 a4 4 0 1 1 -4 4 a9 9 0 1 1 9 9 a15 15 0 1 1 -15 -15" fill="none" stroke="#c9a8ff" stroke-width="4"/>` +
        twice(ring, a.ring, 5)
      )
    case 'void':
      return (
        `<circle cx="50" cy="48" r="30" fill="${a.c}" stroke="#111" stroke-width="4"/>` +
        `<circle cx="50" cy="48" r="20" fill="#5a1aa0" stroke="#c07aff" stroke-width="3"/>` +
        `<circle cx="50" cy="48" r="9" fill="#05000a"/>`
      )
  }
  return ''
}

export function wandArt(id) {
  const a = WAND_ART[id] || WAND_ART.plastic
  return `<svg class="art-wand" viewBox="0 0 100 160">
    <line x1="50" y1="76" x2="50" y2="142" stroke="#111" stroke-width="17" stroke-linecap="round"/>
    <line x1="50" y1="76" x2="50" y2="142" stroke="${a.handle}" stroke-width="10" stroke-linecap="round"/>
    <circle cx="50" cy="146" r="10" fill="${a.c === '#2a1a9a' ? '#ffcf1a' : a.handle}" stroke="#111" stroke-width="4"/>
    ${head(a)}
  </svg>`
}
