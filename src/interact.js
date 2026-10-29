import './interact.css'
import { INTERACT } from './config.js'

// Hold-E interactions (ported from Bowling Roll's interact.js): a proximity prompt
// "Press E to <label>" with a key cap ringed by a progress ring that fills while E (or a finger on
// the prompt) is held for INTERACT.holdMs, then the zone's action fires once.
//
//   registerZone({ id, isNear: () => bool, label: () => string | null, onConfirm, instant? })
// `instant: true` fires onConfirm on press instead of after the hold.
//
// The first registered zone that is near wins (even when its label is null: keep zones from
// overlapping). A null label hides the prompt. Re-registering an id replaces the zone.

const zones = []
let active = null
let held = false
let heldSince = 0
let fired = false
let enabled = true

export function registerZone(zone) {
  const i = zones.findIndex((z) => z.id === zone.id)
  if (i >= 0) zones[i] = zone
  else zones.push(zone)
  return () => {
    const k = zones.indexOf(zone)
    if (k >= 0) zones.splice(k, 1)
  }
}

// Off while a window is open or a run is on screen.
export function setInteractEnabled(on) {
  enabled = on
}

let el = null
let textEl = null
let ring = null
function build() {
  el = document.createElement('div')
  el.className = 'interact'
  el.innerHTML = `<div class="interact-key"><svg viewBox="0 0 44 44"><circle class="interact-track" cx="22" cy="22" r="19"/><circle class="interact-ring" cx="22" cy="22" r="19"/></svg><span>E</span></div><div class="interact-text"></div>`
  textEl = el.querySelector('.interact-text')
  ring = el.querySelector('.interact-ring')
  document.body.appendChild(el)
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    press(true)
  })
  const up = () => press(false)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
  el.addEventListener('pointerleave', up)
}

function press(on) {
  if (on && active?.instant && enabled && el.classList.contains('show')) {
    active.onConfirm() // instant zones (hub) fire on press, no hold (key repeats are ignored upstream)
  } else if (on && !held) {
    held = true
    heldSince = performance.now()
    fired = false
  } else if (!on) held = false
}

export function installInteract() {
  build()
  window.addEventListener('keydown', (e) => {
    if (e.code !== INTERACT.key || e.repeat || e.target instanceof HTMLInputElement) return
    press(true)
  })
  window.addEventListener('keyup', (e) => {
    if (e.code === INTERACT.key) press(false)
  })
  window.addEventListener('blur', () => press(false))
}

const CIRC = 2 * Math.PI * 19
export function updateInteract() {
  let zone = null
  if (enabled) for (const z of zones) if (z.isNear()) { zone = z; break }
  const label = zone ? (typeof zone.label === 'function' ? zone.label() : zone.label) : null
  if (zone !== active) {
    active = zone
    held = false
  }
  const show = !!label
  el.classList.toggle('show', show)
  if (!show) {
    held = false
    ring.style.strokeDashoffset = CIRC
    el.classList.remove('held')
    return
  }
  textEl.textContent = `Press E to ${label}`
  const progress = held ? Math.min(1, (performance.now() - heldSince) / INTERACT.holdMs) : 0
  ring.style.strokeDasharray = CIRC
  ring.style.strokeDashoffset = CIRC * (1 - progress)
  el.classList.toggle('held', held)
  if (progress >= 1 && !fired) {
    fired = true
    held = false
    zone.onConfirm()
  }
}
