// Spin the Wheel (ui-spin): ten equal wedges, the best prize shown on the left,
// one free spin every WHEEL.freeSpinHours.
import { PETS, WHEEL } from '../../config/mechanics.js'
import { claimSpin, spin, spinWaitMs } from '../../state/game.js'
import { petArt } from '../art.js'
import { defineWindow, render, toast } from './shell.js'

// Per wedge (WHEEL.wedges order, clockwise from the top): colour and icon.
const LOOK = [
  { c: '#3aa8ff', ico: '🧪' },
  { c: '#ffc23a', ico: '🧪' },
  { c: '#ff5ab0', ico: '⭐' },
  { c: '#ff9a2a', ico: '🏆' },
  { c: '#3ac8ff', ico: '🫁' },
  { c: '#9a4aff', ico: '🥚' },
  { c: '#3ed65a', ico: '🍀' },
  { c: '#ff4a5a', ico: '⭐' },
  { c: '#2fbf4a', ico: '🐶' },
  { c: '#ffd84a', ico: '🐉' },
]
const N = WHEEL.wedges.length
const STEP = 360 / N
const R = 240 // wheel radius in svg units (viewBox 520)

let angle = 0 // current wheel rotation, kept across re-renders
let spinning = false

function polar(r, deg) {
  const a = ((deg - 90) * Math.PI) / 180
  return [260 + r * Math.cos(a), 260 + r * Math.sin(a)]
}

function wheelSvg() {
  let s = ''
  WHEEL.wedges.forEach((w, i) => {
    const a0 = i * STEP
    const [x0, y0] = polar(R - 16, a0)
    const [x1, y1] = polar(R - 16, a0 + STEP)
    s += `<path d="M260 260 L${x0} ${y0} A${R - 16} ${R - 16} 0 0 1 ${x1} ${y1} Z" fill="${LOOK[i].c}" stroke="#fff" stroke-width="3"/>`
    // Label, icon and chance stacked along the wedge's centre line, reading outward.
    const mid = a0 + STEP / 2
    const words = w.label.replace(/(\d)x /, '$1x ').split(' ')
    const half = Math.ceil(words.length / 2)
    const lines = words.length > 2 ? [words.slice(0, half).join(' '), words.slice(half).join(' ')] : [w.label]
    s += `<g transform="rotate(${mid} 260 260)">
      ${lines.map((l, k) => `<text x="260" y="${48 + k * 17}" text-anchor="middle" class="wl">${l}</text>`).join('')}
      <text x="260" y="${118}" text-anchor="middle" font-size="34">${LOOK[i].ico}</text>
      <text x="260" y="${168}" text-anchor="middle" class="wp">${w.chance}%</text>
    </g>`
  })
  // Gold rim with studs, hub.
  let studs = ''
  for (let i = 0; i < N * 2; i++) {
    const [x, y] = polar(R - 7, i * (STEP / 2))
    studs += `<circle cx="${x}" cy="${y}" r="6" fill="#fff6c8" stroke="#a87a10" stroke-width="2"/>`
  }
  return `<svg viewBox="0 0 520 520">
    <style>.wl{font:700 15px Fredoka,sans-serif;fill:#fff;stroke:#111;stroke-width:4px;paint-order:stroke}.wp{font:700 18px Fredoka,sans-serif;fill:#fff;stroke:#111;stroke-width:4px;paint-order:stroke}</style>
    <circle cx="260" cy="260" r="${R + 6}" fill="#e8b020" stroke="#8a5a00" stroke-width="5"/>
    ${s}${studs}
    <circle cx="260" cy="260" r="34" fill="url(#hub)" stroke="#a87a10" stroke-width="4"/>
    <defs><radialGradient id="hub" cx="40%" cy="35%"><stop offset="0" stop-color="#fff2a8"/><stop offset="1" stop-color="#d89a10"/></radialGradient></defs>
  </svg>`
}

const POINTER = `<svg class="pointer" viewBox="0 0 50 60"><path d="M4 4 H46 L25 56 Z" fill="#ff2a3a" stroke="#7a0a12" stroke-width="4" stroke-linejoin="round"/><circle cx="25" cy="16" r="5" fill="#ffd23a"/></svg>`

function clock(ms) {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// The rarest pet prize is the showcase.
const best = WHEEL.wedges.filter((w) => w.pet).sort((a, b) => a.chance - b.chance)[0]

defineWindow('spin', {
  title: 'Spin the Wheel!',
  width: 760,
  render() {
    const wait = spinWaitMs()
    const free = wait <= 0 && !spinning ? 1 : 0
    return `<div class="stage">
        <div class="wheel-box">
          ${
            best
              ? `<div class="best"><span class="t nm">${PETS[best.pet].name}</span><span class="pic">${petArt(best.pet)}</span><span class="t pct">${Math.round(PETS[best.pet].mult * 100).toLocaleString('en-US')}% Best</span></div>`
              : ''
          }
          ${POINTER}
          <div class="wheel" style="transform:rotate(${angle}deg)">${wheelSvg()}</div>
        </div>
      </div>
      <div class="buy">
        <div class="opt"><button class="btn ${free ? 'green' : 'gray'} main" data-act="spin" ${free ? '' : 'disabled'}><span class="t">Spin (${free})</span></button>
          <span class="t wait">${spinning ? 'Spinning...' : wait > 0 ? `Spin in: ${clock(wait)}` : 'Free spin ready!'}</span></div>
      </div>`
  },
  // While the wheel turns the DOM must stay put, or the CSS transition restarts.
  tick: () => (spinning ? false : undefined),
  onAction(act) {
    if (act !== 'spin' || spinning) return
    const index = spin()
    if (index < 0) return
    spinning = true
    // Land the wedge's centre under the pointer after 5 full turns, with a little jitter.
    const target = 360 - (index * STEP + STEP / 2) + (Math.random() - 0.5) * STEP * 0.6
    const to = angle + 5 * 360 + ((target - (angle % 360) + 360) % 360)
    render() // disables the button; the wheel is still at the old angle
    const wheel = document.querySelector('.win-spin .wheel')
    wheel.getBoundingClientRect() // commit the start angle before the transition
    wheel.style.transform = `rotate(${to}deg)`
    angle = to
    setTimeout(() => {
      spinning = false
      claimSpin(index)
      toast(`You won ${WHEEL.wedges[index].label}!`)
    }, 4200)
  },
})
