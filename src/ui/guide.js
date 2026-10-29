// The tutorial's guide (Bowling Roll's guide.js): a trail of arrowheads crawling from the player
// toward the current TUTORIAL step's target plus a bobbing beacon over it, a bobbing UI arrow on
// the HUD button to press once there (the step's `button`) and a tip under the objective banner
// saying what to do right now (hud.setTip).
// Targets: 'pad' = the best unlocked training pad (gone once on it), 'strip' = the Blow Zone
// (gone once on it; then the arrow points at BLOW), 'bubble' = the next shop bubble, or the Blow
// Zone while it costs more Wins than you have. 'rebirth' trains on the pad until the level
// allows a rebirth, then points at the Rebirth tile (and the window's Rebirth! button).
// Hidden during a run and while a window is open. The banner and its SKIP live in hud.js.
import { ExtrudeGeometry, Group, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, Shape } from 'three'
import { BUBBLES, TRAINING, TUTORIAL } from '../config/mechanics.js'
import { PADS, STRIP, TRAINERS } from '../config/world.js'
import { advanceTutorial, canRebirth, rebirthLevel, state } from '../state/game.js'
import { isOpen } from './windows/shell.js'
import { abbreviate } from './format.js'
import './guide.css'

const SPACING = 1.1 // units between trail arrows
const SPEED = 1.8 // units/s the trail crawls toward the target
const MAX_ARROWS = 120
const HIDE_WITHIN = 2.5 // units from the target where the trail disappears
const BEACON_HEIGHT = 3.2 // units above the target the big arrow floats
const SHOP_BUBBLES = BUBBLES.filter((b) => b.id !== 'celestial') // the pad order (bubble-shop-pads)

export function createGuide(scene, { hud, player, ride, director }) {
  // --- UI arrow ----------------------------------------------------------------
  const arrow = document.createElement('div')
  arrow.className = 'tut-arrow'
  arrow.innerHTML = '<svg viewBox="0 0 60 80"><path d="M18 4h24v34h14L30 76 4 38h14z" fill="#ffd23a" stroke="#121212" stroke-width="6" stroke-linejoin="round"/></svg>'
  arrow.hidden = true
  document.body.appendChild(arrow)
  let hl = null // the element glowing under the arrow
  function clearUi() {
    arrow.hidden = true
    hl?.classList.remove('tut-hl')
    hl = null
  }
  function pointAt(selector) {
    const el = document.querySelector(selector)
    const r = el?.getBoundingClientRect()
    if (!r || r.width === 0 || r.height === 0) return clearUi() // not on screen
    if (hl !== el) {
      hl?.classList.remove('tut-hl')
      el.classList.add('tut-hl')
      hl = el
    }
    arrow.hidden = false
    arrow.style.left = `${r.left + r.width / 2}px`
    arrow.style.top = `${r.top - 6}px`
  }

  // --- 3D trail + beacon ----------------------------------------------------------
  const shape = new Shape()
  shape.moveTo(0, 0.42)
  shape.lineTo(0.34, -0.2)
  shape.lineTo(0, -0.05)
  shape.lineTo(-0.34, -0.2)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 })
  geometry.center()
  // Drawn over everything so walls and props never hide the way.
  const trailMat = new MeshStandardMaterial({ color: '#eef1f6', roughness: 0.5, depthTest: false, transparent: true })
  const beaconMat = new MeshStandardMaterial({ color: '#ffd23a', emissive: '#ff9a1f', emissiveIntensity: 0.6, roughness: 0.4, fog: false, depthTest: false, transparent: true })
  const guide = new Group()
  const trail = new InstancedMesh(geometry, trailMat, MAX_ARROWS)
  trail.frustumCulled = false
  trail.renderOrder = 20
  trail.count = 0
  const beacon = new Mesh(geometry, beaconMat)
  beacon.scale.setScalar(2.5)
  beacon.frustumCulled = false
  beacon.renderOrder = 21
  beacon.visible = false
  guide.add(trail, beacon)
  scene.add(guide)
  const dummy = new Object3D()

  // --- where things are (logic frame, y = the floor there) ---------------------------
  const target = { x: 0, y: 0, z: 0 }
  const set = (x, y, z) => ((target.x = x), (target.y = y), (target.z = z), target)
  const flat = (x, z) => Math.hypot(player.position.x - x, player.position.z - z)
  // The best training pad the rebirths unlock (the 1x pad on a fresh save).
  function bestPad() {
    let best = 0
    TRAINING.lanes.forEach((l, i) => {
      if (state.rebirths >= (l.unlock.rebirths ?? Infinity) && l.mult > TRAINING.lanes[best].mult) best = i
    })
    return { x: TRAINERS.padX, y: TRAINERS.slabHeight, z: TRAINERS.firstZ - best * TRAINERS.pitch }
  }
  const onPad = (pad) => flat(pad.x, pad.z) <= TRAINING.padRadius
  const onStrip = () => {
    const p = player.position
    return p.x > STRIP.x0 && p.x < STRIP.x1 && p.z > STRIP.z0 && p.z < STRIP.z1
  }
  // The cheapest shop bubble not owned yet, with its pad.
  function nextBubble() {
    const i = SHOP_BUBBLES.findIndex((b) => !state.bubbles.includes(b.id))
    if (i < 0) return null
    return { b: SHOP_BUBBLES[i], x: PADS.columnX[i < 5 ? 'cheap' : 'dear'], z: PADS.rowZ[i % 5] }
  }

  // One frame's plan for a step: { to (3D target or null), tip, button (selector or null) }.
  const plan = { to: null, tip: '', button: null }
  function toPad(prefix, here) {
    const pad = bestPad()
    plan.to = onPad(pad) ? null : set(pad.x, pad.y, pad.z)
    plan.tip = prefix + (plan.to ? 'Follow the arrows to the training pad' : here)
  }
  function toStrip(prefix) {
    const touch = document.body.classList.contains('touch-ui')
    if (onStrip()) {
      plan.button = '.hud-blow'
      plan.tip = prefix + (touch ? 'Tap BLOW! and bounce as far as you can' : 'Press BLOW! (F) and bounce as far as you can')
      return
    }
    plan.to = set(Math.min(STRIP.x1 - 2, Math.max(STRIP.x0 + 2, player.position.x)), 0, (STRIP.z0 + STRIP.z1) / 2)
    plan.tip = prefix + 'Follow the arrows to the Blow Zone'
  }
  function planFor(step) {
    plan.to = null
    plan.tip = ''
    plan.button = null
    if (step.id === 'train') return toPad('', 'Stand still: every bubble you blow pays Breath')
    if (step.id === 'blow') return toStrip('')
    if (step.id === 'buy') {
      const n = nextBubble()
      if (!n) return
      // Short of Wins: the count leads every tip and the way goes to the Blow Zone.
      if (state.wins < n.b.price) return toStrip(`Wins ${abbreviate(state.wins)} / ${abbreviate(n.b.price)}: `)
      if (flat(n.x, n.z) > PADS.padSize / 2) {
        plan.to = set(n.x, PADS.plateau.height, n.z)
        plan.tip = 'Better bubbles give more Breath per blow'
      } else {
        plan.tip = document.body.classList.contains('touch-ui') ? 'Hold the Buy button to buy it' : 'Hold E to buy it'
      }
      return
    }
    if (step.id === 'rebirth') {
      if (!canRebirth()) return toPad(`Level ${state.level} / ${rebirthLevel()}: `, 'Keep training (BLOW for even more Breath)')
      plan.button = step.button
      plan.tip = 'Open Rebirth and press Rebirth!'
    }
  }

  function draw(to, t) {
    trail.count = 0
    beacon.visible = !!to
    if (!to) return
    const from = player.position
    const dx = to.x - from.x
    const dz = to.z - from.z
    const dist = Math.hypot(dx, dz)
    const ux = dx / (dist || 1)
    const uz = dz / (dist || 1)
    const heading = Math.atan2(ux, uz)
    const phase = (t * SPEED) % SPACING
    let n = 0
    if (dist > HIDE_WITHIN) {
      for (let d = 1.4 + phase; d < dist - 0.6 && n < MAX_ARROWS; d += SPACING) {
        // The floor between here and there, roughly: blend the two ends' heights.
        const y = from.y + (to.y - from.y) * (d / dist)
        dummy.position.set(from.x + ux * d, y + 0.25, from.z + uz * d)
        dummy.rotation.set(Math.PI / 2 - 0.35, heading, 0, 'YXZ') // lie flat, tip toward the target
        dummy.updateMatrix()
        trail.setMatrixAt(n++, dummy.matrix)
      }
    }
    trail.count = n
    trail.instanceMatrix.needsUpdate = true
    beacon.position.set(to.x, to.y + BEACON_HEIGHT + Math.sin(t * 4) * 0.3, to.z)
    beacon.rotation.set(0, t * 2, Math.PI, 'YXZ') // point down, spin about the vertical
  }

  function hideAll(t) {
    draw(null, t)
    hud.setTip('')
    clearUi()
  }

  return {
    update(t) {
      // Saves from before a step existed (or gifts) can already be past it.
      if (state.bubbles.length > 1) advanceTutorial('buy')
      if (state.rebirths > 0) advanceTutorial('rebirth')
      const step = TUTORIAL[state.tutorial]
      if (!step || ride.active || director.active) return hideAll(t)
      if (isOpen()) {
        hideAll(t)
        // The Rebirth window: point at its Rebirth! button.
        if (step.id === 'rebirth' && isOpen('rebirth')) pointAt('.win-layer [data-act="rebirth"]')
        return
      }
      planFor(step)
      draw(plan.to, t)
      hud.setTip(plan.tip)
      if (plan.button) pointAt(plan.button)
      else clearUi()
    },
  }
}
