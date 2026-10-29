// Wands shop (ui-wands): a horizontal strip of numbered cards with Wins prices (Robux-only wands are left out).
import { WANDS } from '../../config/mechanics.js'
import { buyWand, state } from '../../state/game.js'
import { abbreviate } from '../hud.js'
import { check, wandArt } from '../art.js'
import { chime, errorSound } from '../../sound.js'
import { defineWindow, toast } from './shell.js'

// Card colours, one per wand in order.
const COLORS = ['#9da1ab', '#22c04a', '#ff4aa0', '#ffc21a', '#2fa8ff', '#ff961a', '#7a46ff', '#a43aef', '#2a2aa8', '#4a1a80']
const SHOP = WANDS.filter((w) => !w.robux)
const price = (n) => abbreviate(n)

function button(w) {
  if (state.wands.equipped === w.id) return `<button class="btn green" data-act="wand" data-id="${w.id}">${check()}<span class="t">Equipped</span></button>`
  if (state.wands.owned.includes(w.id)) return `<button class="btn green" data-act="wand" data-id="${w.id}"><span class="t">Equip</span></button>`
  return `<button class="btn gray" data-act="wand" data-id="${w.id}" style="background:linear-gradient(color-mix(in srgb, var(--c) 45%, #8e93a0), color-mix(in srgb, var(--c) 40%, #50545f))"><span class="t">${price(w.price)} Wins</span></button>`
}

defineWindow('wands', {
  title: 'Wands',
  icon: () => wandArt('plastic'),
  width: 966,
  render() {
    return `<div class="strip scroll">${SHOP.map(
      (w, i) => `<div class="card ${state.wands.equipped === w.id ? 'equipped' : ''}" style="--c:${COLORS[i]}">
        <span class="t num">${i + 1}</span>
        ${wandArt(w.id)}
        <span class="t name">${w.name.replace(' Wand', '<br>Wand')}</span>
        <div class="stat"><span class="t x">x${w.mult.toFixed(1)}</span><span class="t w">Wins</span></div>
        ${button(w)}
      </div>`,
    ).join('')}</div>`
  },
  afterRender(wrap) {
    // Mouse wheel scrolls the strip sideways.
    const strip = wrap.querySelector('.strip')
    strip.onwheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        strip.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }
  },
  onAction(act, el) {
    const w = WANDS.find((x) => x.id === el.dataset.id)
    if (!w) return
    const owned = state.wands.owned.includes(w.id)
    if (buyWand(w.id)) chime()
    else if (!owned) {
      errorSound()
      toast(`Need ${price(Math.max(1, w.price - state.wins))} more Wins!`, true)
    }
  },
})
