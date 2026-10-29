// training-pads (ZONE_SPECS/training-pads.md): the seven "Nx BREATH" bubble-trainer lanes on
// the +X side of the hub. Layout from TRAINERS (config/world.js), rules from TRAINING
// (config/mechanics.js), colours from LANES (config/palette.js). Everything static is drawn
// with three shared vertex-coloured materials (studded floor, glossy plastic, glass) and baked,
// so the zone costs a handful of draw calls; the UFO, clownfish and crown stay separate.
import { BoxGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SphereGeometry, TorusGeometry } from 'three'
import { TRAINERS } from '../../config/world.js'
import { TRAIN_BLOW, TRAINING } from '../../config/mechanics.js'
import { LANES, WORLD } from '../../config/palette.js'
import { glossy, legoMaterial, worldUVs } from '../../shared/materials.js'
import { badgeLabel } from '../../shared/labels.js'
import { glow, neon, solidBox } from '../../propkit.js'
import { bake } from '../../bake.js'
import { mulberry32 } from '../../textures.js'
import { activeBoost, addBreath, advanceTutorial, emit, equippedBubble, multiplier, on, state } from '../../state/game.js'

// Per-lane look, in TRAINING.lanes order (1x, 4x, 10x, 20x, 3x, 15x, 50x).
const LOOK = {
  '1x': { floor: LANES.cyan, kerb: LANES.kerbWhite, icon: 'rebirth', strip: 'neonWhite' },
  '4x': { floor: LANES.teal, kerb: LANES.mint, icon: 'rebirth', strip: 'neonWhite' },
  '10x': { floor: LANES.purple, kerb: LANES.violet, icon: 'rebirth', strip: 'neonPink' },
  '20x': { floor: LANES.red, kerb: LANES.darkRed, icon: 'rebirth', strip: 'neonPink' },
  '3x': { floor: LANES.blue, kerb: LANES.kerbWhite, icon: 'rebirth', strip: 'neonWhite' },
  '15x': { floor: LANES.gold, kerb: LANES.gold, icon: 'rebirth', strip: 'neonGold' },
  '50x': { floor: LANES.black, kerb: null, icon: 'rebirth', strip: 'neonGreen' }, // checker kerb
}

// --- shared materials (vertex colours carry the per-part colour) --------------------------
let mats = null
function materials() {
  if (mats) return mats
  const lego = legoMaterial('#ffffff', '#ffffff', 1, { studStrength: 0.8 })
  lego.vertexColors = true
  const plastic = glossy('#ffffff', { vertexColors: true })
  const glass = new MeshStandardMaterial({ color: '#ffffff', vertexColors: true, transparent: true, opacity: 0.5, roughness: 0.08, metalness: 0, depthWrite: false })
  const pad = new MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.82, roughness: 0.15, metalness: 0, depthWrite: false })
  const neonWhite = neon('#ffffff', 2.5)
  const neonYellow = neon(LANES.postYellow, 3, { transparent: true })
  const softYellow = neon(LANES.postYellow, 1.3) // lit stripe: bright but below the bloom threshold
  const softWhite = neon('#ffffff', 1.5) // 1x floor dots
  const neonPink = neon(LANES.neonPink, 2.5)
  const neonGold = neon(LANES.gold, 2.2)
  const neonGreen = neon(LANES.ufoLight, 2.2)
  const padGlow = glow('#ffffff', 0.35)
  const beam = glow(LANES.beamCyan, 0.22)
  mats = { lego, plastic, glass, pad, neonWhite, neonYellow, softYellow, softWhite, neonPink, neonGold, neonGreen, padGlow, beam }
  return mats
}

// Clones `geo` with a constant vertex colour so it can share a vertex-coloured material.
const colorCache = new Map()
// A hex colour mixed toward white (for glass/hoop tints).
const pale = (hex, k = 0.5) => '#' + new Color(hex).lerp(new Color('#ffffff'), k).getHexString()
function tinted(geo, hex) {
  const g = geo.clone()
  let c = colorCache.get(hex)
  if (!c) colorCache.set(hex, (c = new Color(hex)))
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new Float32BufferAttribute(arr, 3))
  return g
}

function add(parent, geo, mat, x, y, z, shadows = true) {
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = shadows
  m.receiveShadow = true
  parent.add(m)
  return m
}
// Glossy plastic part in `hex`.
const part = (parent, geo, hex, x, y, z, shadows = true) => add(parent, tinted(geo, hex), materials().plastic, x, y, z, shadows)
// Studded (lego) part in `hex`, with world-space UVs so studs line up (1 u tile).
function brick(parent, w, h, d, hex, x, y, z) {
  const geo = worldUVs(new BoxGeometry(w, h, d), 1, 'xz', x, z)
  return add(parent, tinted(geo, hex), materials().lego, x, y, z)
}
const glassPart = (parent, geo, hex, x, y, z) => add(parent, tinted(geo, hex), materials().glass, x, y, z, false)

// Bakes a prop group that moves as a whole (keeps its position).
function bakeProp(raw) {
  raw.updateMatrixWorld(true)
  const out = bake(raw, true)
  out.position.copy(raw.position)
  out.rotation.copy(raw.rotation)
  return out
}

const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K` : Math.round(n).toLocaleString())

export function buildZone({ scene, particles, floatingTexts, inflater, player }) {
  const group = new Group()
  group.name = 'zone:training-pads'
  const statics = new Group()
  const M = materials()
  const T = TRAINERS
  const rand = mulberry32(2026)
  const xc = T.x0 + T.length / 2
  const top = T.slabHeight
  const decoX0 = T.hoopX + 1.0 // floor decor starts past the hoop
  const decoX1 = T.gateX - 0.6

  const lanes = [] // { id, z, mult, unlock, icon, badge, dyn... }
  const dyn = { ufo: null, fish: null, crown: null, sparkleZ: null }

  TRAINING.lanes.forEach((rule, i) => {
    const z = T.firstZ - i * T.pitch
    const look = LOOK[rule.id]
    const lane = { ...rule, z, icon: look.icon, badge: null }
    lanes.push(lane)

    // --- slab + kerbs (studded) -------------------------------------------------------
    brick(statics, T.length, T.slabHeight, T.width, look.floor, xc, T.slabHeight / 2, z)
    const kw = T.kerbWidth
    const kz = T.width / 2 - kw / 2
    if (look.kerb) {
      for (const s of [-1, 1]) brick(statics, T.length, T.kerbHeight, kw, look.kerb, xc, T.kerbHeight / 2, z + s * kz)
      brick(statics, kw, T.kerbHeight, T.width, look.kerb, T.x0 + T.length - kw / 2, T.kerbHeight / 2, z)
      brick(statics, kw * 0.6, T.kerbHeight * 0.8, T.width, look.kerb, T.x0 + kw * 0.3, T.kerbHeight * 0.4, z) // start-end rim
    } else {
      // 50x: black/white checker kerb of 0.5 u cubes
      const n = Math.round(T.length / 0.5)
      for (const s of [-1, 1]) for (let k = 0; k < n; k++) brick(statics, 0.5, T.kerbHeight, kw, k % 2 ? LANES.postBlack : WORLD.tileWhite, T.x0 + (k + 0.5) * 0.5, T.kerbHeight / 2, z + s * kz)
      const m = Math.round(T.width / 0.5)
      for (let k = 0; k < m; k++) brick(statics, kw, T.kerbHeight, T.width / m, k % 2 ? WORLD.tileWhite : LANES.postBlack, T.x0 + T.length - kw / 2, T.kerbHeight / 2, z - T.width / 2 + (k + 0.5) * (T.width / m))
      for (let k = 0; k < m; k++) brick(statics, kw * 0.6, T.kerbHeight * 0.8, T.width / m, k % 2 ? LANES.postBlack : WORLD.tileWhite, T.x0 + kw * 0.3, T.kerbHeight * 0.4, z - T.width / 2 + (k + 0.5) * (T.width / m))
    }
    solidBox(T.length / 2, T.slabHeight / 2, T.width / 2, xc, T.slabHeight / 2, z)

    // --- floor pattern ----------------------------------------------------------------
    const disc = (r) => new CylinderGeometry(r, r, 0.03, 14)
    const scatter = (count, fn) => {
      for (let k = 0; k < count; k++) fn(decoX0 + rand() * (decoX1 - decoX0), z + (rand() - 0.5) * 2.2)
    }
    const iceCubes = () => {
      for (let k = 0; k < 4; k++) {
        const c = glassPart(statics, new BoxGeometry(0.5, 0.5, 0.5), LANES.ice, decoX0 + 0.8 + k * ((decoX1 - decoX0 - 1.6) / 3) + (rand() - 0.5), top + 0.25, z + (k % 2 ? 0.8 : -0.8) * (0.6 + rand() * 0.4))
        c.rotation.y = rand() * Math.PI
      }
    }
    if (rule.id === '1x') {
      scatter(14, (x, zz) => add(statics, disc(0.22), M.softWhite, x, top + 0.015, zz, false))
      iceCubes()
    } else if (rule.id === '4x') {
      scatter(14, (x, zz) => part(statics, disc(0.18), WORLD.tileWhite, x, top + 0.015, zz, false))
    } else if (rule.id === '10x') {
      scatter(12, (x, zz) => part(statics, disc(0.3), LANES.lilac, x, top + 0.015, zz, false))
      const pastel = [LANES.lilac, LANES.mint, LANES.ice, LANES.neonPink]
      for (let x = decoX0; x < decoX1; x += 1.2) for (const s of [-1, 1]) part(statics, new SphereGeometry(0.16, 10, 8), pastel[Math.floor(rand() * pastel.length)], x, T.kerbHeight + 0.12, z + s * kz)
    } else if (rule.id === '20x') {
      const len = decoX1 - decoX0 + 0.4
      add(statics, new BoxGeometry(len, 0.03, 0.3), M.softYellow, (decoX0 + decoX1) / 2, top + 0.015, z, false)
      for (let k = 0; k < 6; k++) {
        const x = decoX0 + 0.3 + k * ((decoX1 - decoX0 - 0.6) / 5)
        for (const s of [-1, 1]) {
          const pz = z + s * kz
          const base = T.kerbHeight
          part(statics, new CylinderGeometry(0.1, 0.1, 0.3, 8), LANES.postBlack, x, base + 0.15, pz)
          part(statics, new CylinderGeometry(0.1, 0.1, 0.3, 8), LANES.postYellow, x, base + 0.45, pz)
          part(statics, new CylinderGeometry(0.1, 0.1, 0.3, 8), LANES.postBlack, x, base + 0.75, pz)
          add(statics, new SphereGeometry(0.14, 10, 8), M.neonYellow, x, base + 0.95, pz, false)
        }
      }
    } else if (rule.id === '3x') {
      for (let x = decoX0; x < decoX1; x += 1.5) part(statics, new BoxGeometry(0.25, 0.03, 2.4), WORLD.tileWhite, x, top + 0.015, z, false)
      iceCubes()
    } else if (rule.id === '15x') {
      const len = decoX1 - decoX0 + 0.4
      const cx = (decoX0 + decoX1) / 2
      part(statics, new BoxGeometry(len, 0.04, 1.8), LANES.carpet, cx, top + 0.02, z, false)
      for (const s of [-1, 1]) {
        part(statics, new BoxGeometry(len, 0.06, 0.12), LANES.gold, cx, top + 0.03, z + s * 0.95, false)
        for (let x = decoX0; x < decoX1; x += 0.8) {
          const nug = part(statics, new SphereGeometry(0.15, 7, 5), LANES.gold, x + (rand() - 0.5) * 0.3, top + 0.12, z + s * (1.05 + rand() * 0.15))
          nug.rotation.set(rand(), rand(), rand())
        }
      }
    } else if (rule.id === '50x') {
      dyn.sparkleZ = z
    }

    // --- start pad (glass, glowing outline, L brackets, under-glow) -------------------
    const px = T.padX
    const padTop = top + 0.15
    glassPart(statics, new BoxGeometry(2.4, 0.15, 2.4), pale(look.floor, 0.55), px, top + 0.075, z)
    for (const s of [-1, 1]) {
      add(statics, new BoxGeometry(2.4, 0.04, 0.05), M.neonWhite, px, padTop + 0.02, z + s * 1.18, false)
      add(statics, new BoxGeometry(0.05, 0.04, 2.4), M.neonWhite, px + s * 1.18, padTop + 0.02, z, false)
    }
    // continuous light strip along the top of both kerbs (judge round 2)
    for (const s of [-1, 1]) add(statics, new BoxGeometry(T.length - 0.2, 0.04, 0.1), M[look.strip], xc, T.kerbHeight + 0.02, z + s * kz, false)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(statics, new BoxGeometry(0.22, 0.1, 0.22), M.neonWhite, px + sx * 1.0, padTop + 0.05, z + sz * 1.0, false) // corner lights
    for (const s of [-1, 1]) {
      const arm = part(statics, new BoxGeometry(0.9, 0.02, 0.1), WORLD.tileWhite, px + 0.28, padTop + 0.015, z + s * 0.3, false) // "^" chevron pointing +X
      arm.rotation.y = s * Math.PI / 4
    }
    const strip = new Mesh(new PlaneGeometry(3.1, 3.1), M.padGlow)
    strip.rotation.x = -Math.PI / 2
    strip.position.set(px, top + 0.005, z)
    statics.add(strip)
    solidBox(1.2, 0.075, 1.2, px, top + 0.075, z)

    // --- ring hoop (standing in the YZ plane) ---------------------------------------------
    const hy = top + 0.3 + 1.0
    const hoop = glassPart(statics, new TorusGeometry(1.0, 0.22, 14, 40), pale(look.floor, 0.35), T.hoopX, hy, z)
    hoop.rotation.y = Math.PI / 2
    const rim = add(statics, new TorusGeometry(1.22, 0.03, 6, 48), M.neonWhite, T.hoopX, hy, z, false)
    rim.rotation.y = Math.PI / 2
    part(statics, new BoxGeometry(0.9, 0.12, 0.9), look.kerb || WORLD.tileWhite, T.hoopX, top + 0.06, z)
    part(statics, new BoxGeometry(0.36, 0.3, 0.36), look.kerb || WORLD.tileWhite, T.hoopX, top + 0.27, z)

    // --- gate ------------------------------------------------------------------------
    const gate = new Group()
    gate.position.set(T.gateX, top, z)
    gate.scale.set(...T.gateScale)
    const moving = new Group() // the lane's animated props, same transform as the gate
    moving.position.copy(gate.position)
    moving.scale.copy(gate.scale)
    buildGate(rule.id, gate, moving, dyn)
    statics.add(gate)
    group.add(moving)
  })

  // --- badges (rebuilt on rebirth) --------------------------------------------------------
  function refreshBadges() {
    for (const lane of lanes) {
      if (lane.badge) {
        group.remove(lane.badge)
        lane.badge.material.map?.dispose()
        lane.badge.material.dispose()
      }
      const unlocked = isUnlocked(lane)
      const value = lane.unlock.robux ?? lane.unlock.rebirths
      const s = badgeLabel({ icon: lane.icon, value, status: unlocked ? 'UNLOCKED' : 'LOCKED', title: `${lane.id} BREATH` })
      s.scale.multiplyScalar(1.6)
      s.position.set(T.badgeX, T.badgeY, lane.z)
      group.add(s)
      lane.badge = s
    }
  }
  const isUnlocked = (lane) => lane.unlock.rebirths !== undefined && state.rebirths >= lane.unlock.rebirths
  refreshBadges()
  on('rebirth', refreshBadges)

  // Bake the statics (one mesh per material) and add the moving props.
  const baked = bake(statics, true)
  const noShadow = new Set([M.glass, M.neonWhite, M.neonYellow, M.softYellow, M.softWhite, M.neonPink, M.neonGold, M.neonGreen, M.padGlow])
  baked.traverse((o) => {
    if (!o.isMesh) return
    o.receiveShadow = true
    if (noShadow.has(o.material)) o.castShadow = false
  })
  group.add(baked)
  scene.add(group)

  // --- mechanics: stand still on an unlocked pad and the wand blows on a loop -------------
  // Each blow: a small bubble grows at the wand, pops, and pays Breath (MECHANICS §Breath
  // training). Walking off the pad pops a bubble in progress. Locked pads say what opens them.
  let current = null // lane the player stands on
  let cooldown = 0
  let busy = false
  const padR2 = TRAINING.padRadius * TRAINING.padRadius
  function laneAt(p) {
    for (const lane of lanes) {
      const dx = p.x - T.padX
      const dz = p.z - lane.z
      if (dx * dx + dz * dz <= padR2 && p.y < top + 1) return lane
    }
    return null
  }
  function lockedNote(lane) {
    const text = lane.unlock.rebirths !== undefined ? `Rebirth ${lane.unlock.rebirths}x to unlock` : 'Robux lane (not available)'
    floatingTexts.spawn('padGain', text, T.padX, top + 2.4, lane.z, { scale: 0.6 })
  }
  function blowOn(lane) {
    busy = true
    cooldown = TRAINING.blowInterval
    player.facing = Math.PI / 2 // down the lane (+X)
    const bubble = equippedBubble()
    inflater.start(bubble.id, TRAIN_BLOW.diameter, () => {
      inflater.stop()
      busy = false
      const gain = bubble.breath * lane.mult * multiplier()
      addBreath(gain, 'train')
      advanceTutorial('train')
      const p = player.position
      floatingTexts.spawn('padGain', `+${fmt(activeBoost('breath2x') ? gain * 2 : gain)} Breath`, p.x, p.y + 2, p.z)
      particles.sparkle(p.x, p.y + 1, p.z, { count: 16, radius: 0.8, size: 0.5, life: 0.8, up: 0.6 })
    }, { duration: TRAIN_BLOW.inflateTime })
  }
  function cancel() {
    if (!busy) return
    busy = false
    if (inflater.active) inflater.stop()
  }

  let sparkleAcc = 0
  const fishCentre = dyn.fishCentre
  return {
    group,
    update(dt, elapsed) {
      cooldown = Math.max(0, cooldown - dt)
      const lane = player.riding ? null : laneAt(player.position)
      if (lane !== current) {
        if (current) {
          emit('padLeft', { zone: 'training-pads', id: current.id })
          cancel()
        }
        if (lane) {
          emit('padEntered', { zone: 'training-pads', id: lane.id })
          if (!isUnlocked(lane)) lockedNote(lane)
        }
        current = lane
      }
      const still = Math.hypot(player.velocity.x, player.velocity.z) < TRAIN_BLOW.stillSpeed && player.grounded
      if (busy && !still) cancel()
      else if (lane && isUnlocked(lane) && still && !busy && cooldown <= 0 && !inflater.active) blowOn(lane)
      if (dyn.ufo) dyn.ufo.position.y = dyn.ufoY + Math.sin(elapsed * 1.5) * 0.2
      if (dyn.fish) dyn.fish.rotation.x = -elapsed * 0.3 * Math.PI * 2
      if (dyn.crown) {
        dyn.crown.position.y = dyn.crownY + Math.sin(elapsed * 1.2) * 0.15
        dyn.crown.rotation.y = elapsed * 0.4
      }
      M.neonYellow.opacity = 0.8 + 0.2 * Math.sin(elapsed * Math.PI)
      M.padGlow.opacity = 0.3 + 0.08 * Math.sin(elapsed * Math.PI)
      if (dyn.sparkleZ !== null) {
        sparkleAcc += dt
        if (sparkleAcc > 0.5) {
          sparkleAcc = 0
          particles.laneSparkle((decoX0 + decoX1) / 2, top + 0.1, dyn.sparkleZ, (decoX1 - decoX0) / 2, 1.2, 10)
          // a few larger sparkles so the drift reads at chase-cam distance
          for (let k = 0; k < 3; k++) particles.sparkle(decoX0 + Math.random() * (decoX1 - decoX0), top + 0.2, dyn.sparkleZ + (Math.random() - 0.5) * 2.2, { count: 1, radius: 0.2, size: 0.35, color: Math.random() < 0.5 ? LANES.sparkleCyan : LANES.sparkleYellow, life: 2.5, up: 0.1 })
        }
      }
    },
  }
}

// --- gate props (local: x 0 at the gate line, y 0 on the slab top, z 0 lane centre) -----------
function buildGate(id, g, moving, dyn) {
  const M = materials()
  const pane = (w = 2.4, h = 2.4, y = 1.4) => glassPart(g, new BoxGeometry(0.08, h, w), LANES.glass, 0, y, 0)
  const frame = (hex, w = 2.4, h = 2.4, t = 0.12, y = 1.4) => {
    for (const s of [-1, 1]) {
      part(g, new BoxGeometry(t, h + t, t), hex, 0, y, s * (w / 2 + t / 2))
      part(g, new BoxGeometry(t, t, w + t * 2), hex, 0, y + s * (h / 2 + t / 2), 0)
    }
  }
  const half = TRAINERS.width / 2 - 0.2 // post centre line (on the kerb)
  // Horizontally striped square posts either side of the lane.
  const stripedPosts = (parent, a, b, h, zOff, size) => {
    const n = Math.round(h / 0.4)
    for (const s of [-1, 1]) for (let k = 0; k < n; k++) part(parent, new BoxGeometry(size, h / n, size), k % 2 ? b : a, 0, (k + 0.5) * (h / n), s * zOff)
  }

  if (id === '1x') {
    // Shower tap: white pipe post with a cross of red/blue knobs, an arm over the lane with a head.
    const w = LANES.pipeWhite
    part(g, new CylinderGeometry(0.12, 0.12, 3, 10), w, 0, 1.5, -half)
    const arm = part(g, new CylinderGeometry(0.12, 0.12, 2.2, 10), w, 0, 2.9, -half + 1.1)
    arm.rotation.x = Math.PI / 2
    const cross = part(g, new CylinderGeometry(0.1, 0.1, 0.9, 8), w, 0, 3.0, -half)
    cross.rotation.z = Math.PI / 2
    part(g, new SphereGeometry(0.2, 12, 10), LANES.jewelBlue, -0.45, 3.0, -half)
    part(g, new SphereGeometry(0.2, 12, 10), LANES.red, 0.45, 3.0, -half)
    part(g, new CylinderGeometry(0.28, 0.2, 0.2, 12), w, 0, 2.75, -half + 2.1)
    stripedPosts(g, LANES.cyan, WORLD.tileWhite, 2.6, 1.2, 0.3)
    frame(w)
    pane()
  } else if (id === '4x') {
    // Lemonade: green glass frame with a lime wedge; a tall cup on a green block beside the post.
    stripedPosts(g, LANES.lemonGreen, WORLD.tileWhite, 2.8, 1.35, 0.32)
    part(g, new BoxGeometry(0.3, 0.3, 3.0), LANES.lemonGreen, 0, 2.85, 0)
    pane(2.4, 2.6, 1.45)
    const wedge = part(g, new CylinderGeometry(0.35, 0.35, 0.12, 16, 1, false, 0, Math.PI), LANES.lime, 0.1, 2.95, -half)
    wedge.rotation.set(0, 0, Math.PI / 2)
    part(g, new BoxGeometry(1, 1, 1), LANES.lemonGreen, 0, 0.5, half)
    glassPart(g, new CylinderGeometry(0.5, 0.42, 2.4, 16), LANES.cupWhite, 0, 2.2, half)
    part(g, new CylinderGeometry(0.45, 0.38, 2.1, 16), LANES.teal, 0, 2.05, half)
    part(g, new SphereGeometry(0.4, 12, 10), WORLD.tileWhite, 0, 3.35, half)
    const straw = part(g, new CylinderGeometry(0.06, 0.06, 1.6, 8), LANES.straw, 0.15, 3.9, half + 0.1)
    straw.rotation.z = 0.2
    for (const s of [-1, 1]) {
      const slice = part(g, new CylinderGeometry(0.45, 0.45, 0.1, 16), LANES.lime, 0, 2.9, half + s * 0.5)
      slice.rotation.z = Math.PI / 2
    }
  } else if (id === '10x') {
    // Purple arch with a lilac "jellyfish" dome on top.
    for (const s of [-1, 1]) for (let k = 0; k < 6; k++) part(g, new BoxGeometry(0.5, 0.5, 0.5), k % 2 ? WORLD.tileWhite : LANES.purple, 0, 0.25 + k * 0.5, s * 1.25)
    part(g, new BoxGeometry(0.5, 0.5, 3.0), LANES.purple, 0, 3.2, 0)
    for (let k = 0; k < 7; k++) part(g, new SphereGeometry(0.2 + (k % 2) * 0.08, 10, 8), WORLD.tileWhite, (k % 2 ? 0.2 : -0.2), 3.5, -1.1 + k * 0.36)
    pane(2.0, 2.4, 1.45)
    part(g, new SphereGeometry(1.0, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), LANES.lilac, 0, 3.55, 0)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      part(g, new SphereGeometry(0.13, 8, 6), WORLD.tileWhite, Math.cos(a) * 0.95, 3.63, Math.sin(a) * 0.95)
    }
    part(g, new SphereGeometry(0.16, 8, 6), WORLD.tileWhite, 0, 4.55, 0)
  } else if (id === '20x') {
    // Two red/white rockets on the lane edges, glass between.
    for (const s of [-1, 1]) {
      const z = s * half
      const fins = part(g, new ConeGeometry(0.65, 0.6, 12), LANES.rocketOrange, 0, 0.3, z)
      fins.rotation.x = Math.PI
      for (let k = 0; k < 5; k++) part(g, new CylinderGeometry(0.4, 0.4, 0.5, 14), k % 2 ? LANES.rocketWhite : LANES.red, 0, 0.75 + k * 0.5, z)
      part(g, new ConeGeometry(0.4, 1.0, 14), LANES.red, 0, 3.5, z)
    }
    pane(2.0, 2.4, 1.45)
  } else if (id === '3x') {
    // Lifebuoy arch: striped posts, white semicircle, two lifebuoys, three clownfish orbiting.
    for (const s of [-1, 1]) {
      const z = s * half
      for (let k = 0; k < 7; k++) part(g, new CylinderGeometry(0.25, 0.25, 0.5, 12), k % 2 ? WORLD.tileWhite : LANES.blue, 0, 0.25 + k * 0.5, z)
      const buoy = part(g, new TorusGeometry(0.3, 0.1, 8, 20), LANES.lifebuoyRed, 0, 3.75, z)
      buoy.rotation.y = Math.PI / 2
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) part(g, new BoxGeometry(0.22, 0.14, 0.14), WORLD.tileWhite, 0, 3.75 + Math.sin(a) * 0.3, z + Math.cos(a) * 0.3)
    }
    const arch = part(g, new TorusGeometry(1.5, 0.15, 10, 32, Math.PI), WORLD.tileWhite, 0, 3.5, 0)
    arch.rotation.y = Math.PI / 2
    pane(2.0, 2.4, 1.45)
    const fish = new Group()
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2
      const f = new Group()
      const body = part(f, new SphereGeometry(0.3, 14, 10), LANES.clownOrange, 0, 0, 0)
      body.scale.set(0.6, 0.8, 1.4)
      for (const bz of [0.15, -0.15]) {
        const band = part(f, new SphereGeometry(0.31, 14, 10), WORLD.tileWhite, 0, 0, bz)
        band.scale.set(0.62, 0.82, 0.25)
      }
      const tail = part(f, new ConeGeometry(0.22, 0.35, 4), LANES.clownOrange, 0, 0, -0.5)
      tail.rotation.x = Math.PI / 2
      part(f, new SphereGeometry(0.06, 6, 4), LANES.postBlack, 0.16, 0.08, 0.28)
      f.position.set(0, Math.sin(a) * 1.1, Math.cos(a) * 1.1)
      f.rotation.x = -a // tangent to the orbit
      fish.add(f)
    }
    fish.position.set(0, 3.5, 0)
    dyn.fish = bakeProp(fish)
    moving.add(dyn.fish)
  } else if (id === '15x') {
    // Crown arch: gold posts with cubes on top, a red/gold crown floating between them.
    for (const s of [-1, 1]) {
      part(g, new BoxGeometry(0.5, 3.5, 0.5), LANES.gold, 0, 1.75, s * half)
      part(g, new BoxGeometry(0.8, 0.55, 0.7), LANES.gold, 0, 3.78, s * half) // treasure chest body
      const lid = part(g, new CylinderGeometry(0.35, 0.35, 0.8, 12, 1, false, 0, Math.PI), LANES.gold, 0, 4.05, s * half)
      lid.rotation.z = Math.PI / 2
      part(g, new BoxGeometry(0.1, 0.2, 0.12), LANES.crownRed, -0.42, 3.85, s * half)
    }
    pane(2.0, 2.4, 1.45)
    const crown = new Group()
    part(crown, new CylinderGeometry(1.0, 1.0, 0.7, 24), LANES.gold, 0, 0.35, 0)
    const band = new Mesh(new TorusGeometry(1.02, 0.06, 8, 40), M.neonGold)
    band.rotation.x = Math.PI / 2
    band.position.y = 0.6
    crown.add(band)
    const cloth = part(crown, new SphereGeometry(0.85, 16, 12), LANES.crownRed, 0, 0.75, 0)
    cloth.scale.set(1, 0.7, 1)
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2
      const x = Math.cos(a) * 0.82
      const z = Math.sin(a) * 0.82
      part(crown, new ConeGeometry(0.3, 0.7, 8), LANES.gold, x, 1.05, z)
      part(crown, new SphereGeometry(0.13, 8, 6), k % 2 ? LANES.red : LANES.jewelBlue, x, 1.45, z)
      part(crown, new SphereGeometry(0.14, 8, 6), k % 2 ? LANES.jewelBlue : LANES.red, Math.cos(a + 0.6) * 1.0, 0.35, Math.sin(a + 0.6) * 1.0)
    }
    crown.position.set(0, 4.1, 0)
    dyn.crown = bakeProp(crown)
    moving.add(dyn.crown)
    dyn.crownY = crown.position.y
  } else if (id === '50x') {
    // Checker posts, a green alien on the +Z post, glass between, a UFO hovering above.
    for (const s of [-1, 1]) for (let k = 0; k < 7; k++) part(g, new BoxGeometry(0.5, 0.5, 0.5), k % 2 ? WORLD.tileWhite : LANES.postBlack, 0, 0.25 + k * 0.5, s * half)
    pane(2.0, 2.4, 1.45)
    const az = half
    part(g, new SphereGeometry(0.34, 12, 10), LANES.alienGreen, 0, 3.8, az)
    part(g, new SphereGeometry(0.45, 14, 12), LANES.alienGreen, 0, 4.45, az)
    part(g, new SphereGeometry(0.18, 10, 8), WORLD.tileWhite, -0.32, 4.5, az)
    part(g, new SphereGeometry(0.09, 8, 6), LANES.postBlack, -0.46, 4.5, az)
    part(g, new CylinderGeometry(0.04, 0.04, 0.5, 6), LANES.alienGreen, 0, 5.1, az)
    part(g, new SphereGeometry(0.1, 8, 6), LANES.alienGreen, 0, 5.4, az)
    const ufo = new Group()
    const body = part(ufo, new SphereGeometry(1.5, 28, 14), LANES.ufoBlue, 0, 0, 0)
    body.scale.set(1, 0.2, 1)
    part(ufo, new CylinderGeometry(0.9, 0.9, 0.2, 24), LANES.ufoBlue, 0, 0.1, 0)
    const dome = part(ufo, new SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), LANES.ufoDome, 0, 0.2, 0)
    dome.scale.set(1, 0.8, 1)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      part(ufo, new SphereGeometry(0.08, 6, 4), LANES.ufoLight, Math.cos(a) * 1.2, -0.12, Math.sin(a) * 1.2)
    }
    ufo.position.set(0, 5.6, 0)
    const baked = bakeProp(ufo)
    const cone = new Mesh(new ConeGeometry(1.3, 2.6, 24, 1, true), M.beam)
    cone.position.y = -1.5
    baked.add(cone)
    moving.add(baked)
    dyn.ufo = baked
    dyn.ufoY = ufo.position.y
  }
}
