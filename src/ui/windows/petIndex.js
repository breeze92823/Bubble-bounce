// Pet Index (ui-index-*): Normal / Golden / Exclusive tabs, discovered pets in colour,
// the rest as silhouettes; tap a discovered pet for its card.
import { EGGS, PETS, PET_INDEX } from '../../config/mechanics.js'
import { state } from '../../state/game.js'
import { lungs, petArt, PET_LOOK_IDS } from '../art.js'
import { defineWindow, openWindow, render } from './shell.js'

const TABS = [
  { id: 'normal', label: 'Normal', icon: '<span class="emoji">🐾</span>' },
  { id: 'golden', label: 'Golden', icon: '<span class="emoji" style="filter:sepia(1) saturate(6) hue-rotate(5deg) brightness(1.1)">🐾</span>' },
  { id: 'exclusive', label: 'Exclusive', icon: '<span class="emoji" style="filter:hue-rotate(140deg) saturate(2)">🐾</span>' },
]
const TITLES = { normal: 'Pet Index', golden: 'Golden Index', exclusive: 'Exclusive Index' }
const TYPES = Object.keys(PETS)

let tip = null // { tab, i }

function entries(tab) {
  // Real pet types fill the first slots; the remaining index slots are pets not in the game yet.
  const total = PET_INDEX[tab]
  return Array.from({ length: total }, (_, i) => {
    const type = tab === 'exclusive' ? null : TYPES[i] || null
    const known =
      !!type && (tab === 'golden' ? state.pets.owned.some((p) => p.type === type && p.golden) : state.pets.discovered.includes(type))
    return { type, known, look: PET_LOOK_IDS[(i * 3 + (tab === 'golden' ? 1 : tab === 'exclusive' ? 2 : 0)) % PET_LOOK_IDS.length] }
  })
}

defineWindow('index', {
  title: (tab) => TITLES[tab],
  icon: '📖',
  width: 916,
  tabs: TABS,
  defaultArg: 'normal',
  onOpen: () => (tip = null),
  render(tab) {
    const list = entries(tab)
    const found = list.filter((e) => e.known).length
    const pct = Math.floor((found / list.length) * 100)
    const golden = tab === 'golden'
    const slots = list
      .map((e, i) =>
        e.known
          ? `<button class="slot known" data-act="tip" data-i="${i}">${petArt(e.type, { golden })}<span class="tag t thin">${lungs()}x${+(PETS[e.type].mult * (golden ? 2 : 1)).toFixed(1)}</span></button>`
          : `<div class="slot">${petArt(null, { silhouette: true, look: e.look })}</div>`,
      )
      .join('')
    let card = ''
    if (tip && tip.tab === tab && list[tip.i]?.known) {
      const p = PETS[list[tip.i].type]
      card = `<div class="tip t thin">
        <span>${golden ? 'Golden ' : ''}${p.name}</span>
        <span class="t rar">${p.rarity}</span>
        <span class="row mul">${lungs()}x${+(p.mult * (golden ? 2 : 1)).toFixed(1)}</span>
        <hr><span>${EGGS.find((g) => g.id === p.egg)?.name || ''}</span>
      </div>`
    }
    return `<div class="head"><span class="t">${found} / ${list.length}</span>
        <div class="prog"><div class="fill" style="width:${pct}%"></div><span class="t">${pct}% discovered</span></div></div>
      <div class="well"><div class="grid scroll">${slots}</div>${card}</div>`
  },
  afterRender(wrap) {
    // Pin the card over the tapped slot (after layout, so it follows the grid's scroll).
    const card = wrap.querySelector('.tip')
    const slot = card && wrap.querySelector(`.slot[data-i="${tip.i}"]`)
    if (!slot) return
    const well = card.parentElement.getBoundingClientRect()
    const r = slot.getBoundingClientRect()
    const left = Math.min(Math.max(0, r.left - well.left + r.width / 2 - card.offsetWidth / 2), well.width - card.offsetWidth)
    card.style.left = `${left}px`
    // Over the slot when there is room in the well, else under it (the body clips above).
    const above = r.top - well.top - card.offsetHeight + r.height * 0.4
    card.style.top = `${above >= 0 ? above : r.bottom - well.top - r.height * 0.2}px`
  },
  below: () => `<button class="btn yellow mypets" data-act="mypets"><span class="t">MY PETS</span></button>`,
  onAction(act, el, tab) {
    if (act === 'mypets') return openWindow('inventory', 'pets')
    if (act === 'tip') {
      const i = +el.dataset.i
      tip = tip && tip.i === i && tip.tab === tab ? null : { tab, i }
      render()
    }
  },
})
