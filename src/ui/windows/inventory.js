// Inventory (ui-inventory-*): side tabs Bubbles / Pets / Eggs / Wands / Boosts.
// The Pets tab is "My Pets": a detail card, the pet grid and the action bar under the panel.
import { BOOSTS, BUBBLES, PETS, PET_LIMITS, WANDS } from '../../config/mechanics.js'
import { deletePet, equipBest, equipBubble, buyWand, equipPet, setAutoDelete, state, unequipPet, useBoost } from '../../state/game.js'
import { boostArt, bubbleArt, check, egg, lungs, petArt, wandArt } from '../art.js'
import { defineWindow, openWindow, render, toast } from './shell.js'

const TABS = [
  { id: 'bubbles', label: 'Bubbles', icon: `<span class="art-bubble shape-galaxy" style="font-size:1em"></span>` },
  { id: 'pets', label: 'Pets', icon: '<span class="emoji">🐶</span>' },
  { id: 'eggs', label: 'Eggs', icon: egg('common') },
  { id: 'wands', label: 'Wands', icon: wandArt('star') },
  { id: 'boosts', label: 'Boosts', icon: boostArt('breath2x') },
]
const TITLES = { bubbles: 'My Bubbles', pets: 'My Pets', eggs: 'My Eggs', wands: 'My Wands', boosts: 'My Boosts' }

let selected = null // pet id shown in the detail card
let sortDesc = true // the yellow arrows flip the grid order

const petMult = (p) => (PETS[p.type]?.mult || 0) * (p.golden ? 2 : 1)
const fmtMult = (m) => `x${+m.toFixed(1)}`

function bubbles() {
  const owned = BUBBLES.filter((b) => state.bubbles.includes(b.id))
  return `<div class="t sub">${owned.length} / ${BUBBLES.length} Bubbles</div>
    <div class="well"><div class="grid">${owned
      .map(
        (b) => `<button class="slot ${state.equippedBubble === b.id ? 'on' : ''}" data-act="bubble" data-id="${b.id}">
          ${bubbleArt(b)}
          <span class="tag t thin">${lungs()}+${b.breath ?? '?'}</span>
          ${state.equippedBubble === b.id ? check() : ''}
        </button>`,
      )
      .join('')}</div></div>`
}

function pets() {
  const owned = [...state.pets.owned].sort((a, b) => {
    const eq = state.pets.equipped.includes(b.id) - state.pets.equipped.includes(a.id)
    return eq || (sortDesc ? petMult(b) - petMult(a) : petMult(a) - petMult(b))
  })
  if (!owned.some((p) => p.id === selected)) selected = state.pets.equipped[0] ?? owned[0]?.id ?? null
  const pet = owned.find((p) => p.id === selected)
  const info = pet && PETS[pet.type]
  const equipped = pet && state.pets.equipped.includes(pet.id)
  const detail = pet
    ? `<span class="t name">${pet.golden ? 'Golden ' : ''}${info.name}</span>
       <span class="pic">${petArt(pet.type, { golden: pet.golden })}</span>
       <span class="t rar rar-${info.rarity}">${info.rarity}</span>
       <span class="t mul row">${lungs()}${fmtMult(petMult(pet))}</span>
       <button class="btn ${equipped ? 'red' : 'green'}" data-act="${equipped ? 'unequip' : 'equip'}"><span class="t">${equipped ? 'UNEQUIP' : 'EQUIP'}</span></button>`
    : `<span class="t empty">Hatch eggs to get pets!</span>`
  return `<div class="pets-head">
      <span class="row t"><span class="emoji">🎒</span>${state.pets.owned.length} / ${PET_LIMITS.owned}<span class="plus t">✚</span></span>
      <span class="row t">Equipped: ${state.pets.equipped.length} / ${PET_LIMITS.equipped}<span class="plus t">✚</span></span>
    </div>
    <div class="pets">
      <div class="detail">${detail}</div>
      <div class="well"><div class="grid">${owned
        .map(
          (p) => `<button class="slot ${p.id === selected ? 'on' : ''}" data-act="pet" data-id="${p.id}">
            ${petArt(p.type, { golden: p.golden })}
            <span class="tag t thin">${lungs()}${fmtMult(petMult(p))}</span>
            ${state.pets.equipped.includes(p.id) ? check() : ''}
          </button>`,
        )
        .join('')}</div></div>
    </div>`
}

function eggs() {
  // Eggs hatch the moment they are bought or won, so there is never one waiting here.
  return `<div class="t sub">0 Eggs</div><div class="well"></div>`
}

function wands() {
  const owned = WANDS.filter((w) => state.wands.owned.includes(w.id))
  return `<div class="t sub">${owned.length} / ${WANDS.length} Wands</div>
    <div class="well"><div class="grid">${owned
      .map(
        (w) => `<button class="slot ${state.wands.equipped === w.id ? 'on' : ''}" data-act="wand" data-id="${w.id}">
          ${wandArt(w.id)}
          <span class="tag t thin">x${w.mult.toFixed(1)}</span>
          ${state.wands.equipped === w.id ? check() : ''}
        </button>`,
      )
      .join('')}</div></div>`
}

function boosts() {
  const inv = Object.entries(state.boosts.inventory).filter(([, n]) => n > 0)
  const total = inv.reduce((a, [, n]) => a + n, 0)
  return `<div class="t sub">${total} Boosts - Click a boost to use</div>
    <div class="well"><div class="grid">${inv
      .map(([id, n]) => `<button class="slot rays" data-act="boost" data-id="${id}" style="background-color:#3a7ad0;background-image:repeating-conic-gradient(from 0deg at 50% 45%, rgba(255,255,255,.14) 0 9deg, transparent 9deg 18deg),linear-gradient(#5aa0f0,#2f6fc8)">
          <span style="margin-bottom:.25em">${boostArt(id)}</span>
          <span class="count t thin">x${n}</span>
        </button>`)
      .join('')}</div></div>`
}

const BODIES = { bubbles, pets, eggs, wands, boosts }

defineWindow('inventory', {
  title: (tab) => TITLES[tab],
  icon: (tab) => (tab === 'pets' ? '🐾' : '🎒'),
  width: 916,
  tabs: TABS,
  defaultArg: 'bubbles',
  render: (tab) => (BODIES[tab] || bubbles)(),
  below(tab) {
    if (tab !== 'pets') return ''
    return `<button class="btn blue index-btn" data-act="index"><span class="t">INDEX</span></button>
      <div class="pet-bar">
        <button class="btn red ${state.pets.autoDelete ? '' : 'off'}" data-act="autodelete"><small class="t thin">Auto Delete</small><span class="emoji">🗑️</span></button>
        <button class="btn red" data-act="delete"><span class="emoji">🗑️</span></button>
        <button class="btn green big" data-act="best"><span class="t">Equip Best</span></button>
        <button class="btn yellow" data-act="sort"><span class="emoji">${sortDesc ? '🔃' : '🔁'}</span></button>
      </div>`
  },
  afterRender(wrap, tab) {
    wrap.classList.toggle('has-pets', tab === 'pets')
  },
  onAction(act, el) {
    const id = el.dataset.id
    switch (act) {
      case 'bubble':
        equipBubble(id)
        break
      case 'wand':
        buyWand(id)
        break
      case 'boost':
        if (useBoost(id, BOOSTS[id]?.minutes || 10)) toast(`${BOOSTS[id]?.name || 'Boost'} active!`)
        break
      case 'pet':
        selected = +id
        render()
        break
      case 'equip':
        if (!equipPet(selected)) toast(`You can equip ${PET_LIMITS.equipped} pets!`)
        break
      case 'unequip':
        unequipPet(selected)
        break
      case 'delete':
        if (selected == null) return
        if (state.pets.equipped.includes(selected)) return toast('Unequip the pet first!')
        deletePet(selected)
        selected = null
        break
      case 'best':
        equipBest()
        break
      case 'autodelete':
        setAutoDelete(!state.pets.autoDelete)
        toast(`Auto Delete Commons: ${state.pets.autoDelete ? 'ON' : 'OFF'}`)
        break
      case 'sort':
        sortDesc = !sortDesc
        render()
        break
      case 'index':
        openWindow('index', 'normal')
        break
    }
  },
})
