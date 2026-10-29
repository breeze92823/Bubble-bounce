// Playtime Rewards (ui-gifts) and Daily Rewards (ui-daily): grids of reward tiles.
import { DAILY, GIFTS } from '../../config/mechanics.js'
import { claimDaily, claimGift, dailyReady, giftClaimed, giftWaitMs, state } from '../../state/game.js'
import { boostArt, check, egg, lungs, trophy } from '../art.js'
import { defineWindow, toast } from './shell.js'

export function rewardArt(r) {
  if (r.egg) return egg(r.egg)
  if (r.boost) return boostArt(r.boost)
  if (r.wins) return trophy()
  if (r.bubbleBreath) return DIAMOND
  return lungs()
}

const DIAMOND = `<svg class="art-diamond" viewBox="0 0 130 90"><path d="M20 4 H110 L128 30 L65 88 L2 30 Z" fill="#7ee0ff" stroke="#111" stroke-width="5" stroke-linejoin="round"/><path d="M2 30 H128 M40 4 L30 30 L65 88 L100 30 L90 4" fill="none" stroke="#3ab0e8" stroke-width="4"/><path d="M20 4 H110 L128 30 H2 Z" fill="#c4f2ff" opacity=".7"/><circle cx="30" cy="38" r="6" fill="#fff"/></svg>`

function clock(ms) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

defineWindow('gifts', {
  title: 'Playtime Rewards',
  icon: '🎁',
  width: 916,
  render() {
    return `<div class="tiles">${GIFTS.slots
      .map((r, i) => {
        const pic = `<span class="t lbl">${r.label}</span><span class="pic">${rewardArt(r)}</span>`
        if (giftClaimed(i)) return `<div class="tile navy done">${pic}<span class="big-check">${check()}</span></div>`
        const wait = giftWaitMs(i)
        if (wait <= 0) return `<button class="tile purple rays ready" data-act="claim" data-i="${i}">${pic}<span class="bar green t">Claim</span></button>`
        return `<div class="tile orange rays">${pic}<span class="bar red t">${clock(wait)}</span></div>`
      })
      .join('')}</div>`
  },
  tick() {},
  onAction(act, el) {
    if (act === 'claim' && claimGift(+el.dataset.i)) toast(`Claimed ${GIFTS.slots[+el.dataset.i].label}!`)
  },
})

defineWindow('daily', {
  title: 'Daily Rewards',
  icon: '📅',
  width: 916,
  render() {
    const ready = dailyReady()
    const tiles = DAILY.map((r) => {
      const done = r.day < state.daily.day && !(ready && state.daily.lastClaim && Date.now() - state.daily.lastClaim > 48 * 3600000)
      const claimable = ready && r.day === state.daily.day
      const cls = `tile ${r.day === 7 ? 'day7 rainbow' : 'orange rays'} ${done ? 'done' : ''} ${claimable ? 'ready' : ''}`
      const tag = claimable ? 'button' : 'div'
      const inner =
        r.day === 7
          ? `<span class="pic">${rewardArt(r)}</span><span class="t lbl big">DIAMOND<br>BUBBLE</span>`
          : `<span class="t lbl">${r.label.replace('2 SUPER BUBBLES', '2 SUPER<br>BUBBLES')}</span><span class="pic">${rewardArt(r)}</span>`
      return `<${tag} class="${cls}" ${claimable ? 'data-act="claim"' : ''}><span class="day t">DAY ${r.day}</span>${inner}${done ? `<span class="big-check">${check()}</span>` : ''}</${tag}>`
    })
    const next = ready ? `Claim Day ${state.daily.day}!` : `Next reward in: ${clock(state.daily.lastClaim + 24 * 3600000 - Date.now())}`
    return `<div class="tiles">${tiles.join('')}</div><div class="t next">${next}</div>`
  },
  tick() {},
  onAction(act) {
    if (act !== 'claim') return
    const r = claimDaily()
    if (r) toast(`Claimed ${r.label}!`)
  },
})
