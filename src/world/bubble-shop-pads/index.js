// bubble-shop-pads (ZONE_SPECS/bubble-shop-pads.md): the white plateau on the -X side of the
// hub with ten "+N Breath" bubble pads in two columns along Z and the Celestial Bubble pedestal
// between them. Layout from PADS (config/world.js), prices from BUBBLES (config/mechanics.js).
// Standing on a pad and holding E buys (Wins) or equips the bubble (interact.js).
import { BoxGeometry, CylinderGeometry, Group, MeshBasicMaterial } from 'three'
import { PADS } from '../../config/world.js'
import { HUB as C, FX, BUBBLE } from '../../config/palette.js'
import { abbreviate } from '../../ui/format.js'
import { BUBBLES } from '../../config/mechanics.js'
import { glossy, legoMaterial, worldUVs } from '../../shared/materials.js'
import { floatingLabel } from '../../shared/labels.js'
import { animateBubbleItem, createBubbleMesh } from '../../shared/bubble.js'
import { put, solidBox } from '../../propkit.js'
import { bake } from '../../bake.js'
import { glowDisc, pedestal } from '../props.js'
import { RAPIER, addFixed } from '../../physics.js'
import { registerZone } from '../../interact.js'
import { chime, errorSound } from '../../sound.js'
import { buyBubble, emit, equipBubble, on, state } from '../../state/game.js'

const fmt = (n) => abbreviate(n)
const priceText = (b) => (b.price === 0 ? 'FREE' : `${fmt(b.price)} Wins`)

// Label lines for a shop pad from the current game state. The price reads yellow when the
// player can afford it and red when not (bubble-shop-pads_01/_03: "4,500 Wins" red at 2,205 Wins).
function padLines(b) {
  const owned = state.bubbles.includes(b.id)
  const equipped = state.equippedBubble === b.id
  const status = equipped ? 'EQUIPPED' : owned ? 'UNLOCKED' : 'LOCKED'
  const statusColor = owned ? '#39e24a' : '#ff3b3b'
  const priceColor = owned || state.wins >= b.price ? '#ffd93d' : '#ff3b3b'
  return [
    { text: status, color: statusColor, size: 0.2 },
    { text: `+${fmt(b.breath)} Breath`, color: '#ffffff', size: 0.32 },
    { text: priceText(b), color: priceColor, size: 0.2 },
  ]
}

const celestialLines = (b) => [
  { text: 'ALWAYS 150% BETTER', color: '#ffd93d', size: 0.17 },
  { text: 'CELESTIAL BUBBLE', color: '#5ad0ff', size: 0.27 },
  { text: state.bubbles.includes(b.id) ? 'OWNED' : priceText(b), color: state.bubbles.includes(b.id) || state.wins >= b.price ? '#ffd93d' : '#ff3b3b', size: 0.2 },
]

// Shop display only: the items read a little more solid over the white plateau than the ride
// bubble does (bubble-shop-pads_01: the +1 sphere is a visible pale-blue ball, the +75 star is
// a solid yellow), and the black hole's core is a shaded navy sphere.
function displayTweaks(item, b) {
  const body = item.getObjectByName('bubbleBody')
  if (!body) return
  if (b.id === 'plain') {
    body.material.color.set('#cfe6ff')
    body.material.opacity = 0.55
  } else if (b.id === 'star') {
    body.material.color.set(BUBBLE.starShop)
    body.material.opacity = 0.75
  } else if (b.id === 'blackHole') {
    body.material = glossy('#1a1050', { roughness: 0.4 })
    body.scale.setScalar(1.25)
  } else if (body.material.transparent) body.material.opacity = Math.max(body.material.opacity, 0.65)
}

export function buildZone({ scene, particles, floatingTexts, player }) {
  const group = new Group()
  group.name = 'zone:bubble-shop-pads'
  const statics = new Group()
  const P = PADS.plateau
  const top = P.height

  // --- Plateau: white lego tiles, 0.3 u step, with a thin lighter kerb around the top edge.
  const padMat = legoMaterial('#f7fafe', '#f7fafe', 2, { studStrength: 0.35 }) // pads + kerb (one draw)
  const plateauMat = legoMaterial(C.padsPlateau, C.padsPlateauAlt, 2, { studStrength: 0.45 })
  const pw = P.x1 - P.x0
  const pd = P.z1 - P.z0
  const slab = new BoxGeometry(pw, P.height, pd)
  worldUVs(slab, 2, 'xz', (P.x0 + P.x1) / 2, (P.z0 + P.z1) / 2)
  const slabMesh = put(statics, slab, plateauMat, (P.x0 + P.x1) / 2, P.height / 2, (P.z0 + P.z1) / 2, false)
  slabMesh.receiveShadow = true
  const kerb = 0.18
  for (const [x, z, w, d] of [
    [(P.x0 + P.x1) / 2, P.z0 + kerb / 2, pw, kerb],
    [(P.x0 + P.x1) / 2, P.z1 - kerb / 2, pw, kerb],
    [P.x0 + kerb / 2, (P.z0 + P.z1) / 2, kerb, pd],
    [P.x1 - kerb / 2, (P.z0 + P.z1) / 2, kerb, pd],
  ]) put(statics, new BoxGeometry(w, 0.04, d), padMat, x, top + 0.02, z, false)
  solidBox(pw / 2, P.height / 2, pd / 2, (P.x0 + P.x1) / 2, P.height / 2, (P.z0 + P.z1) / 2)

  // --- Pads: raised white lego squares (0.1 u) with a thin bright rim and a faint inner square
  // (bubble-shop-pads_03: the pads read as slightly lighter tiles with a thin lighter edge).
  const outlineMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false })
  const S = PADS.padSize
  const padH = 0.1
  function padAt(x, z) {
    const g = new BoxGeometry(S, padH, S)
    worldUVs(g, 2, 'xz', x, z)
    put(statics, g, padMat, x, top + padH / 2, z, false)
    const y = top + padH + 0.01
    const t = 0.05
    for (const [ox, oz, w, d] of [[0, -S / 2 + t / 2, S, t], [0, S / 2 - t / 2, S, t], [-S / 2 + t / 2, 0, t, S], [S / 2 - t / 2, 0, t, S]]) {
      put(statics, new BoxGeometry(w, 0.02, d), outlineMat, x + ox, y, z + oz, false)
    }
  }

  // Pad list: column A (cheap, plaza side) then column B (dear, wall side), +Z -> -Z.
  const shopBubbles = BUBBLES.filter((b) => b.id !== 'celestial')
  const pads = []
  shopBubbles.forEach((b, i) => {
    const col = i < 5 ? 'cheap' : 'dear'
    const x = PADS.columnX[col]
    const z = PADS.rowZ[i % 5]
    padAt(x, z)
    const item = createBubbleMesh(b.id, PADS.itemSize)
    item.traverse((o) => { if (o.isMesh) o.castShadow = false }) // the reference shows only a faint soft shadow
    displayTweaks(item, b)
    item.userData.baseY = top + PADS.itemHeight
    item.position.set(x, item.userData.baseY, z)
    group.add(item)
    const pad = { b, x, z, item, label: null, phase: i * 0.7, cooldown: 0, inside: false, pop: 0, glow: b.id === 'star' || b.id === 'sparkle' }
    group.add(pad.anchor = new Group())
    pad.anchor.position.set(x, top + PADS.labelHeight, z)
    pads.push(pad)
  })

  function refreshLabels() {
    for (const p of pads) {
      if (p.label) {
        p.anchor.remove(p.label)
        p.label.material.map?.dispose()
        p.label.material.dispose()
      }
      p.label = floatingLabel(padLines(p.b), { lineGap: 0.06 })
      p.anchor.add(p.label)
    }
  }
  refreshLabels()
  on('bubbleEquipped', refreshLabels)
  on('bubbleBought', refreshLabels)
  on('winsChanged', refreshLabels)

  // --- Celestial Bubble: low gold octagonal pedestal on a purple glow disc, galaxy sphere with
  // a cyan orbit ring and yellow sparkles. It stands on the plaza side of the cheap column at the
  // +5 row (bubble-shop-pads_01/_02/_03 all show it beyond the +5 pad, next to the claim chest).
  const ce = PADS.celestial
  const ped = pedestal(ce.radius, ce.height, C.celestialGold, 3)
  ped.position.set(ce.x, top, ce.z)
  put(ped, new CylinderGeometry(ce.radius * 0.5, ce.radius * 0.5, 0.03, 8), glossy(C.celestialGoldTop), 0, ce.height + 0.015, 0, false) // darker inner octagon
  statics.add(ped)
  const celestialGlow = glowDisc(ce.radius + 0.5, '#bff4ff', 0.2)
  celestialGlow.position.set(ce.x, top + 0.02, ce.z)
  group.add(celestialGlow)
  const celestial = createBubbleMesh('celestial', 1.0)
  celestial.traverse((o) => { if (o.isMesh) o.castShadow = false })
  celestial.userData.baseY = top + ce.height + 0.8
  celestial.position.set(ce.x, celestial.userData.baseY, ce.z)
  group.add(celestial)
  const celestialDef = BUBBLES.find((b) => b.id === 'celestial')
  let celestialLabel = null
  function refreshCelestial() {
    if (celestialLabel) {
      group.remove(celestialLabel)
      celestialLabel.material.map?.dispose()
      celestialLabel.material.dispose()
    }
    celestialLabel = floatingLabel(celestialLines(celestialDef), { lineGap: 0.06 })
    celestialLabel.position.set(ce.x, top + ce.height + 1.45, ce.z)
    group.add(celestialLabel)
  }
  refreshCelestial()
  on('bubbleBought', refreshCelestial)
  on('winsChanged', refreshCelestial)
  addFixed(RAPIER.ColliderDesc.cylinder(ce.height / 2, ce.radius), { x: ce.x, y: top + ce.height / 2, z: ce.z })

  const baked = bake(statics, false)
  baked.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true
  })
  group.add(baked)
  scene.add(group)

  // --- Mechanics: stand on a pad and hold E to buy (Wins) or equip.
  function onPlateau(pos) {
    return pos.x > P.x0 && pos.x < P.x1 && pos.z > P.z0 && pos.z < P.z1 && pos.y < top + 1
  }
  function activate(p) {
    const owned = state.bubbles.includes(p.b.id)
    if (state.equippedBubble === p.b.id) return
    const ok = owned ? equipBubble(p.b.id) : state.wins >= p.b.price && buyBubble(p.b.id)
    if (!ok) {
      errorSound()
      floatingTexts?.spawn('padFail', `Need ${fmt(Math.max(1, p.b.price - state.wins))} more Wins!`, p.x, top + 1.2, p.z, { scale: 0.6 })
      return
    }
    chime()
    particles.glowRing(p.x, top + padH + 0.05, p.z, 0.5, S * 0.8, '#ffffff', 0.3)
    particles.sparkle(p.x, p.item.userData.baseY, p.z, { count: 18, radius: 0.8, size: 0.5, life: 0.9, up: 0.6 })
    floatingTexts?.spawn('padGain', owned ? 'Equipped!' : 'Unlocked!', p.x, top + 1.2, p.z, { scale: 0.7 })
    p.pop = 0.45
  }

  for (const p of pads) {
    registerZone({
      id: `bubble:${p.b.id}`,
      isNear: () => p.inside,
      label: () => {
        if (state.equippedBubble === p.b.id) return null
        if (state.bubbles.includes(p.b.id)) return 'Equip'
        return p.b.price === 0 ? 'Claim' : `Buy (${priceText(p.b)})`
      },
      onConfirm: () => activate(p),
    })
  }

  registerZone({
    id: 'bubble:celestial',
    isNear: () => !!player?.position && Math.hypot(player.position.x - ce.x, player.position.z - ce.z) <= ce.radius + 1.4,
    label: () => {
      if (state.equippedBubble === 'celestial') return null
      return state.bubbles.includes('celestial') ? 'Equip' : `Buy (${priceText(celestialDef)})`
    },
    onConfirm: () => {
      const owned = state.bubbles.includes('celestial')
      const y = top + ce.height + 1.2
      if (!(owned ? equipBubble('celestial') : state.wins >= celestialDef.price && buyBubble('celestial'))) {
        errorSound()
        floatingTexts?.spawn('padFail', `Need ${fmt(Math.max(1, celestialDef.price - state.wins))} more Wins!`, ce.x, y, ce.z, { scale: 0.6 })
        return
      }
      chime()
      particles.sparkle(ce.x, y - 0.4, ce.z, { count: 24, radius: 0.9, size: 0.5, life: 1, up: 0.8 })
      floatingTexts?.spawn('padGain', owned ? 'Equipped!' : 'Unlocked!', ce.x, y, ce.z, { scale: 0.7 })
    },
  })

  let sparkleAcc = 0
  return {
    group,
    update(dt, elapsed) {
      for (const p of pads) {
        animateBubbleItem(p.item, elapsed + p.phase)
        if (p.pop > 0) {
          p.pop -= dt
          const k = 1 - p.pop / 0.45
          p.item.scale.setScalar(PADS.itemSize * (1 + 0.3 * Math.sin(k * Math.PI)))
        }
        if (p.cooldown > 0) p.cooldown -= dt
        const pos = player?.position
        if (!pos) continue
        const dx = pos.x - p.x
        const dz = pos.z - p.z
        const inside = onPlateau(pos) && dx * dx + dz * dz < 1.3 * 1.3
        if (inside && !p.inside) {
          emit('padEntered', { zone: 'bubble-shop-pads', id: p.b.id })
        } else if (!inside && p.inside) emit('padLeft', { zone: 'bubble-shop-pads', id: p.b.id })
        p.inside = inside
      }
      animateBubbleItem(celestial, elapsed, { spin: 0.2, bob: 0.08 })
      sparkleAcc += dt
      if (sparkleAcc > 0.25) {
        sparkleAcc = 0
        particles.pedestalSparkle(ce.x, top + ce.height + 0.5, ce.z, 2)
        for (const p of pads) if (p.glow && Math.random() < 0.5) particles.sparkle(p.x, p.item.userData.baseY, p.z, { count: 1, radius: 0.6, size: 0.3, color: FX.pedestalSparkle, life: 0.8, up: 0.3 })
      }
    },
  }
}
