// spawn-hub (ZONE_SPECS/spawn-hub.md): the plaza around the spawn point. Everything is
// placed from HUB in src/config/world.js. Static meshes are baked per material.
import { BoxGeometry, CylinderGeometry, Group, Mesh, OctahedronGeometry, PlaneGeometry, SphereGeometry, TorusGeometry, MeshBasicMaterial, CanvasTexture, SRGBColorSpace } from 'three'
import { HUB, STRIP, LANE } from '../../config/world.js'
import { HUB as C, WORLD, FX } from '../../config/palette.js'
import { glossy, legoMaterial, plastic, worldUVs } from '../../shared/materials.js'
import { floatingLabel } from '../../shared/labels.js'
import { put, solidBox } from '../../propkit.js'
import { bake } from '../../bake.js'
import { bush, cubeTree, daisy, dashedSquare, egg, pedestal, wandStatue } from '../props.js'
import { mulberry32 } from '../../textures.js'
import { RAPIER, addFixed } from '../../physics.js'
import { registerZone } from '../../interact.js'
import { buyEgg, state } from '../../state/game.js'
import { EGGS, PETS } from '../../config/mechanics.js'
import { openWindow, toast } from '../../ui/windows/shell.js'

const tileWhite = () => legoMaterial(WORLD.tileWhite, WORLD.tileWhiteAlt, 2)

// Leaderboard face: green board, 10 rows (rank + name | value), "YOUR RANK" footer.
function paintBoard(rows) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 480
  const ctx = c.getContext('2d')
  ctx.fillStyle = C.board
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.font = '600 30px Fredoka, "Arial Black", sans-serif'
  ctx.textBaseline = 'middle'
  rows.forEach(([name, value], i) => {
    const y = 28 + i * 40
    ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.06)'
    ctx.fillRect(12, y - 18, c.width - 24, 36)
    ctx.fillStyle = i < 3 ? '#ffd93d' : '#ffffff'
    ctx.textAlign = 'left'
    ctx.fillText(name, 24, y)
    ctx.textAlign = 'right'
    ctx.fillText(value, c.width - 24, y)
  })
  ctx.fillStyle = '#9fe0ff'
  ctx.textAlign = 'center'
  ctx.fillText('YOUR RANK  -', c.width / 2, 452)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.repeat.x = -1 // the scene is mirrored in X at render time (main.js)
  tex.offset.x = 1
  return new MeshBasicMaterial({ map: tex })
}
const grass = () => legoMaterial(WORLD.grassA, WORLD.grassB, 2)

function floorPatch(parent, mat, x0, x1, z0, z1, y = 0) {
  const geo = worldUVs(new PlaneGeometry(x1 - x0, z1 - z0), 2, 'xy', (x0 + x1) / 2, -(z0 + z1) / 2)
  const m = new Mesh(geo, mat)
  m.rotation.x = -Math.PI / 2
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2)
  m.receiveShadow = true
  parent.add(m)
  return m
}

export function buildZone({ scene, particles, floatingTexts, player, cutouts = [] }) {
  const group = new Group()
  group.name = 'zone:spawn-hub'
  const statics = new Group()
  const P = HUB.plaza

  // --- Floor: white tiles everywhere, grass patches on top (0.01 up), the water channel cut.
  const white = tileWhite()
  const green = grass()
  floorPatch(statics, white, P.x0, P.x1, P.z0, HUB.waterChannel.z0)
  floorPatch(statics, white, P.x0, P.x1, HUB.waterChannel.z1, P.z1)
  for (const g of HUB.grassPatches) floorPatch(statics, green, g.x0, g.x1, g.z0, g.z1, 0.01)
  // Water channel: dark floor, cyan water, white kerbs.
  const ch = HUB.waterChannel
  floorPatch(statics, plastic('#2a6fa0'), P.x0, P.x1, ch.z0, ch.z1, -ch.depth)
  const water = floorPatch(group, glossy(WORLD.water, { transparent: true, opacity: 0.85, roughness: 0.15 }), P.x0, P.x1, ch.z0, ch.z1, ch.y)
  water.name = 'water'
  for (const z of [ch.z0, ch.z1]) put(statics, new BoxGeometry(P.x1 - P.x0, 0.2, 0.2), glossy(WORLD.tileWhite), 0, 0.1, z)
  // Bridge: arched tan planks with cyan glass rails.
  const b = HUB.bridge
  const bridge = new Group()
  bridge.position.set(b.x, 0, (b.z0 + b.z1) / 2)
  const planks = 7
  const span = b.z1 - b.z0
  for (let i = 0; i < planks; i++) {
    const u = (i + 0.5) / planks - 0.5
    const z = u * span
    const yArc = b.arch * (1 - (u * 2) ** 2)
    const pl = put(bridge, new BoxGeometry(b.halfWidth * 2, b.deckHeight, span / planks - 0.04), glossy(WORLD.wood), 0, b.deckHeight / 2 + yArc, z)
    pl.rotation.x = -u * 2 * b.arch * 1.2
  }
  for (const sx of [-1, 1]) {
    put(bridge, new BoxGeometry(0.08, b.railHeight, span), glossy(C.railGlass, { transparent: true, opacity: 0.7 }), sx * b.halfWidth, b.deckHeight + b.arch * 0.6 + b.railHeight / 2, 0)
    for (const z of [-span / 2, span / 2]) put(bridge, new BoxGeometry(0.14, b.railHeight + 0.1, 0.14), glossy(C.railGlass), sx * b.halfWidth, b.deckHeight + b.railHeight / 2, z)
  }
  statics.add(bridge)
  solidBox(b.halfWidth, (b.deckHeight + b.arch) / 2, (b.z1 - b.z0) / 2, b.x, (b.deckHeight + b.arch) / 2, (b.z0 + b.z1) / 2)
  // Channel walls so the player cannot walk into the water except over the bridge.
  for (const [x0, x1] of [[P.x0, b.x - b.halfWidth], [b.x + b.halfWidth, P.x1]]) {
    solidBox((x1 - x0) / 2, 1, (ch.z1 - ch.z0) / 2, (x0 + x1) / 2, -0.2, (ch.z0 + ch.z1) / 2)
  }

  // --- Spawn path: pale tile strip with big grey chevrons pointing +Z (grass either side).
  const path = HUB.path
  floorPatch(statics, legoMaterial('#dfe6ef', '#dfe6ef', 1), -path.halfWidth + 0.4, path.halfWidth - 0.4, path.z0, path.z1, 0.02)
  const chevMat = plastic('#ffffff')
  for (let z = path.z0 + 0.8; z < path.z1; z += path.chevronPitch) {
    for (const sx of [-1, 1]) {
      const arm = put(statics, new BoxGeometry(0.9, 0.03, 0.14), chevMat, sx * 0.32, 0.04, z, false)
      arm.rotation.y = sx * Math.PI / 4
    }
  }

  // --- Fountain
  const f = HUB.fountain
  const fountain = new Group()
  fountain.position.set(f.x, 0, f.z)
  const fMat = glossy(C.fountain)
  put(fountain, new CylinderGeometry(f.baseRadius, f.baseRadius, f.baseHeight, 32), fMat, 0, f.baseHeight / 2, 0)
  put(fountain, new CylinderGeometry(f.baseRadius - 0.35, f.baseRadius - 0.35, 0.05, 32), glossy(WORLD.water, { roughness: 0.1 }), 0, f.baseHeight + 0.02, 0)
  put(fountain, new CylinderGeometry(0.5, 0.6, f.basinY - f.baseHeight, 16), fMat, 0, (f.basinY + f.baseHeight) / 2, 0)
  put(fountain, new CylinderGeometry(f.basinRadius, f.basinRadius, 0.3, 24), fMat, 0, f.basinY + 0.15, 0)
  put(fountain, new CylinderGeometry(f.basinRadius - 0.25, f.basinRadius - 0.25, 0.05, 24), glossy(WORLD.water, { roughness: 0.1 }), 0, f.basinY + 0.32, 0)
  put(fountain, new CylinderGeometry(0.35, 0.45, f.capY - f.basinY - 0.3, 12), fMat, 0, (f.capY + f.basinY) / 2, 0)
  put(fountain, new CylinderGeometry(1.0, 1.0, 0.25, 20), fMat, 0, f.capY - 0.1, 0)
  put(fountain, new CylinderGeometry(0.8, 0.8, 0.05, 20), glossy(WORLD.water, { roughness: 0.1 }), 0, f.capY + 0.04, 0)
  put(fountain, new CylinderGeometry(0.22, 0.28, 0.6, 10), fMat, 0, f.capY + 0.35, 0)
  const dome = put(fountain, new SphereGeometry(0.5, 16, 12), glossy('#ffd0ea'), 0, f.capY + 0.7, 0)
  dome.scale.y = 0.55
  const ball = new SphereGeometry(0.16, 10, 8)
  const pink = glossy('#ffd0ea')
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    put(fountain, ball, pink, Math.cos(a) * f.baseRadius, f.baseHeight + 0.08, Math.sin(a) * f.baseRadius)
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    put(fountain, ball, pink, Math.cos(a) * f.basinRadius, f.basinY + 0.33, Math.sin(a) * f.basinRadius)
  }
  statics.add(fountain)
  addFixed(RAPIER.ColliderDesc.cylinder(f.baseHeight / 2, f.baseRadius), { x: f.x, y: f.baseHeight / 2, z: f.z })
  addFixed(RAPIER.ColliderDesc.cylinder(f.capY / 2, 0.7), { x: f.x, y: f.capY / 2, z: f.z })

  // --- Eggs on pedestals
  const eggColors = { gold: C.eggWhite, white: C.eggWhite, cyan: C.eggBlue, green: C.eggGreen, yellow: WORLD.gold }
  const pedColors = { gold: WORLD.gold, white: WORLD.tileWhite, cyan: C.rarePlate, green: C.pedestalGreen, yellow: WORLD.gold }
  const eggLabels = {
    royalLion: [{ text: 'BEST IN GAME', color: '#5ad0ff', size: 0.16 }, { text: 'Royal Lion', color: '#ffd23a', size: 0.31 }, { text: 'Always 1000% Better', color: '#ff7ad9', size: 0.16 }, { text: '100,000 Wins', color: '#ffd93d', size: 0.19 }],
    king: [{ text: 'King Egg', color: '#ff5fcf', size: 0.31 }, { text: '25,000 Wins', color: '#ffd93d', size: 0.19 }],
    common: [{ text: 'Common Egg', color: '#ffffff', size: 0.28 }, { text: '50 Wins', color: '#ffd93d', size: 0.19 }],
    uncommon: [{ text: 'Uncommon Egg', color: '#39e24a', size: 0.28 }, { text: '500 Wins', color: '#ffd93d', size: 0.19 }],
    rare: [{ text: 'Rare Egg', color: '#5ad0ff', size: 0.28 }, { text: '4,000 Wins', color: '#ffd93d', size: 0.19 }],
    mythic: [{ text: 'Mythic Egg', color: '#ffd23a', size: 0.28 }, { text: 'R$ 30', color: '#39e24a', size: 0.19 }],
  }
  const eggItems = []
  for (const e of HUB.eggs) {
    const g = new Group()
    g.position.set(e.x, 0, e.z)
    const big = e.orbit
    if (big) g.add(pedestal(1.25, 0.6, pedColors[e.kind], 3))
    else put(g, new BoxGeometry(1.5, 0.2, 1.5), glossy(pedColors[e.kind]), 0, 0.1, 0)
    const item = new Group()
    item.position.y = big ? 0.6 : 1.0 // side eggs hover ~1 u above their plates
    if (e.id === 'royalLion') {
      // Bee-striped egg with a gold crown
      const eg = egg(C.beeYellow, 1.2)
      item.add(eg)
      for (const y of [0.35, 0.6, 0.85]) {
        const band = put(item, new CylinderGeometry(0.42 - Math.abs(y - 0.6) * 0.4, 0.42 - Math.abs(y - 0.6) * 0.4, 0.1, 20), glossy(C.beeBlack), 0, y, 0)
        band.scale.set(1.02, 1, 1.02)
      }
      put(item, new CylinderGeometry(0.22, 0.28, 0.22, 8), glossy(WORLD.gold), 0, 1.28, 0)
    } else if (e.id === 'king') {
      const eg = egg(C.kingBlue, 1.3)
      item.add(eg)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        const dia = put(item, new OctahedronGeometry(0.16, 0), glossy(C.kingPurple), Math.cos(a) * 0.4, 0.65, Math.sin(a) * 0.4)
        dia.scale.set(0.6, 1, 0.3)
      }
      put(item, new CylinderGeometry(0.24, 0.3, 0.24, 8), glossy(WORLD.gold), 0, 1.38, 0)
    } else {
      item.add(egg(eggColors[e.kind], 1.0))
    }
    g.add(item)
    if (e.orbit) particles.orbitRing(g, 1.0, '#fff2b0').position.y = 1.3
    const label = floatingLabel(eggLabels[e.id])
    label.position.y = big ? 2.4 : 1.6
    g.add(label)
    group.add(g)
    eggItems.push({ item, phase: Math.random() * Math.PI * 2, sparkle: true, x: e.x, z: e.z, y: (big ? 0.6 : 1.0) + 0.8 })
    addFixed(RAPIER.ColliderDesc.cylinder(0.3, big ? 1.25 : 0.8), { x: e.x, y: 0.3, z: e.z })
  }

  // --- World 2 portal (stone ring, green swirl, skull) + dashed mat
  const po = HUB.portal
  const portal = new Group()
  portal.position.set(po.x, 0, po.z)
  portal.rotation.y = po.yaw
  const stone = legoMaterial(WORLD.stone, '#8f949e', 1, { studStrength: 0.5 })
  // Upright cobblestone oval standing on the grass; the green disc with a white spiral fills it.
  const R = po.discRadius + 0.38
  const ringY = R * 1.15 + 0.02
  const ring = put(portal, new TorusGeometry(R, 0.36, 10, 32), stone, 0, ringY, 0)
  ring.scale.set(1, 1.15, 1)
  const swirl = new Mesh(new CylinderGeometry(po.discRadius + 0.1, po.discRadius + 0.1, 0.1, 32), new MeshBasicMaterial({ color: C.portalSwirl }))
  swirl.rotation.x = Math.PI / 2
  swirl.position.y = ringY
  swirl.scale.set(1, 1.15, 1)
  portal.add(swirl)
  const swirlLines = new Group()
  for (let i = 0; i < 3; i++) {
    const t = new Mesh(new TorusGeometry(0.22 + i * 0.22, 0.045, 6, 24, Math.PI * 1.2), new MeshBasicMaterial({ color: '#ffffff' }))
    t.rotation.z = (i * Math.PI * 2) / 3
    swirlLines.add(t)
  }
  swirlLines.position.copy(swirl.position)
  swirlLines.position.z += 0.07
  portal.add(swirlLines)
  const skullY = ringY + R * 1.15 + 0.36 + 0.3
  put(portal, new SphereGeometry(0.32, 12, 10), glossy('#f4f4f4'), 0, skullY, 0)
  for (const sx of [-1, 1]) {
    put(portal, new SphereGeometry(0.08, 8, 6), glossy('#111111'), sx * 0.12, skullY + 0.04, 0.27)
    const horn = put(portal, new CylinderGeometry(0.03, 0.08, 0.32, 6), glossy('#f4f4f4'), sx * 0.36, skullY + 0.2, 0)
    horn.rotation.z = -sx * 0.6
  }
  group.add(portal)
  const portalLabel = floatingLabel([{ text: 'WORLD 2', color: '#ffffff', size: 0.45 }, { text: 'BLOW WITH 50M', color: '#ffd93d', size: 0.26 }])
  portalLabel.position.set(po.x, skullY + 0.5, po.z)
  group.add(portalLabel)
  solidBox(R + 0.4, R * 1.15, 0.4, po.x, R * 1.15, po.z, po.yaw)
  const mat = dashedSquare(HUB.portalMat.size)
  mat.position.set(HUB.portalMat.x, 0, HUB.portalMat.z)
  group.add(mat)

  // --- Wand statues
  const pr = HUB.pinkRing
  const pinkStatue = wandStatue(C.ringPink, C.ringPink, pr)
  pinkStatue.position.set(pr.x, 0, pr.z)
  const qr = HUB.purpleRing
  const purpleStatue = wandStatue(C.ringPurple, C.ringPoleBlue, qr)
  purpleStatue.position.set(qr.x, 0, qr.z)
  statics.add(pinkStatue, purpleStatue)
  for (const r of [pr, qr]) addFixed(RAPIER.ColliderDesc.cylinder(r.poleHeight / 2, 0.3), { x: r.x, y: r.poleHeight / 2, z: r.z })

  // --- Leaderboards: painted green boards in gold frames on green bases, titles floating above.
  const lb = HUB.leaderboards
  const titles = ['Top Wins', 'Top Robux Spent', 'Top Time Played', 'Top Level']
  const frameMat = glossy(C.boardFrame)
  const names = ['bubbleKing', 'shnyeyi', 'esth9er', 'Mavie_123', 'popz', 'xXairXx', 'soapy', 'nova_7', 'driftr', 'kai']
  titles.forEach((title, i) => {
    const x = lb.xs[i]
    const face = paintBoard(names.map((n, r) => [`${r + 1}. ${names[(r + i * 3) % names.length]}`, Math.round(900000 / (r + 1) ** 1.6 / 10 ** (i % 2)).toLocaleString()]))
    const board = put(statics, new BoxGeometry(lb.w, lb.h, 0.2), [plastic(C.board), plastic(C.board), plastic(C.board), plastic(C.board), face, plastic(C.board)], x, lb.y + lb.h / 2, lb.z)
    put(statics, new BoxGeometry(lb.w + 0.3, 0.14, 0.3), frameMat, x, lb.y + lb.h + 0.07, lb.z)
    put(statics, new BoxGeometry(lb.w + 0.3, 0.14, 0.3), frameMat, x, lb.y - 0.07, lb.z)
    for (const sx of [-1, 1]) put(statics, new BoxGeometry(0.14, lb.h + 0.28, 0.3), frameMat, x + sx * (lb.w / 2 + 0.07), lb.y + lb.h / 2, lb.z)
    put(statics, new BoxGeometry(lb.w - 0.4, lb.y, 0.6), legoMaterial(C.board, C.board, 1, { studStrength: 0.4 }), x, lb.y / 2, lb.z)
    const t = floatingLabel([{ text: title, color: '#ffffff', size: 0.3 }])
    t.position.set(x, lb.y + lb.h + 0.25, lb.z)
    group.add(t)
  })
  solidBox((lb.xs[0] - lb.xs[3] + lb.w) / 2, lb.h / 2 + 0.5, 0.4, 0, lb.h / 2 + 0.5, lb.z)

  // --- Walls: one tall checker wall around the plaza (open at the front), grass band on top,
  // a green strip along the base, cube trees standing on the band.
  const W = HUB.walls
  const wallMat = legoMaterial(WORLD.wallBlue, WORLD.wallWhite, 1, { studStrength: 0.4 })
  const bandMat = legoMaterial(WORLD.grassBand, WORLD.grassBand, 1, { studStrength: 0.5 })
  function wallRun(x0, x1, z0, z1, h, y = 0) {
    const w = x1 - x0
    const d = z1 - z0
    const geo = new BoxGeometry(w, h, d)
    worldUVs(geo, 1, w > d ? 'xy' : 'zy', w > d ? (x0 + x1) / 2 : (z0 + z1) / 2, y)
    put(statics, geo, wallMat, (x0 + x1) / 2, y + h / 2, (z0 + z1) / 2)
    put(statics, new BoxGeometry(w + 0.3, W.bandHeight, d + 0.3), bandMat, (x0 + x1) / 2, y + h + W.bandHeight / 2, (z0 + z1) / 2)
    put(statics, new BoxGeometry(w + 0.2, W.baseStrip, d + 0.2), bandMat, (x0 + x1) / 2, W.baseStrip / 2, (z0 + z1) / 2)
    solidBox(w / 2, h / 2 + W.bandHeight, d / 2, (x0 + x1) / 2, y + h / 2, (z0 + z1) / 2)
  }
  const t = 1.2
  const m = W.laneMouth
  wallRun(P.x0 - t, P.x1 + t, P.z0 - t, P.z0, W.innerHeight) // rear
  wallRun(P.x0 - t, P.x0, P.z0, P.z1, W.innerHeight) // west
  wallRun(P.x1, P.x1 + t, P.z0, P.z1, W.innerHeight) // east
  if (W.frontWall) {
    wallRun(P.x0 - t, -m, P.z1, P.z1 + t, W.innerHeight)
    wallRun(m, P.x1 + t, P.z1, P.z1 + t, W.innerHeight)
  }
  const treeY = W.innerHeight + W.bandHeight
  const treeSpots = []
  for (let x = P.x0 + 3; x < P.x1; x += 7) treeSpots.push([x, P.z0 - t / 2])
  for (let z = P.z0 + 3; z < P.z1; z += 7) {
    treeSpots.push([P.x0 - t / 2, z])
    treeSpots.push([P.x1 + t / 2, z])
  }
  treeSpots.forEach(([x, z], i) => {
    const tr = cubeTree(i % 3 === 0, HUB.tree.canopy, HUB.tree.trunk)
    tr.position.set(x, treeY, z)
    statics.add(tr)
  })

  // --- Daisies, bushes, grass tufts on the grass patches
  const dr = mulberry32(5)
  for (const g of HUB.grassPatches) {
    const n = Math.round(((g.x1 - g.x0) * (g.z1 - g.z0)) / 12)
    for (let i = 0; i < n; i++) {
      const d = daisy()
      d.position.set(g.x0 + dr() * (g.x1 - g.x0), 0.01, g.z0 + dr() * (g.z1 - g.z0))
      d.rotation.y = dr() * Math.PI * 2
      statics.add(d)
    }
  }
  for (const [x, z] of [[-9, 7.5], [9.5, -8], [-9, -13], [9, -12], [-7, 2], [7, 1]]) {
    const bsh = bush(0.5 + dr() * 0.25)
    bsh.position.set(x, 0, z)
    statics.add(bsh)
  }

  // Bake statics (one mesh per material) and add the dynamic bits.
  const baked = bake(statics, true)
  baked.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true
  })
  group.add(baked)
  scene.add(group)

  // --- Press-E zones (interact.js): Wins eggs, portal, wand statues. Mythic is Robux-only and has none.
  const near = (x, z, r) => !!player?.position && Math.hypot(player.position.x - x, player.position.z - z) <= r
  for (const e of HUB.eggs) {
    const def = EGGS.find((d) => d.id === e.id)
    if (!def || def.robux) continue
    registerZone({
      id: `egg:${e.id}`,
      instant: true,
      isNear: () => near(e.x, e.z, 2.2),
      label: () => `Hatch ${def.name} (${def.price.toLocaleString('en-US')} Wins)`,
      onConfirm: () => {
        const pet = buyEgg(def.id)
        const y = 2.6
        if (pet) {
          floatingTexts?.spawn('padGain', PETS[pet.type].name, e.x, y, e.z, { scale: 0.7 })
          particles.sparkle(e.x, 1.6, e.z, { count: 24, radius: 0.9, size: 0.5, life: 1, up: 0.8 })
        } else {
          const full = state.wins >= def.price
          floatingTexts?.spawn('padGain', full ? 'Pet storage full' : `Need ${Math.max(1, def.price - state.wins).toLocaleString('en-US')} more Wins!`, e.x, y, e.z, { scale: 0.6 })
        }
      },
    })
  }
  const pm = HUB.portalMat
  registerZone({
    id: 'portal:world2',
    instant: true,
    isNear: () => near(pm.x, pm.z, 2),
    label: () => 'Enter World 2',
    onConfirm: () => toast(state.bestDistance >= 50 ? 'World 2 is coming soon' : 'Blow 50M to unlock World 2'),
  })
  for (const [id, r] of [['wands:pink', HUB.pinkRing], ['wands:purple', HUB.purpleRing]]) {
    registerZone({ id, instant: true, isNear: () => near(r.x, r.z, 2.5), label: () => 'Open Wands', onConfirm: () => openWindow('wands') })
  }

  // Ambient bubbles near the pink ring and the lane mouth (sparse).
  particles.ambientSpawner(pr.x, 2.5, pr.z, 4, 0.3)
  particles.ambientSpawner(0, 2.5, 13, 5, 0.25)

  let sparkleAcc = 0
  return {
    group,
    update(dt, elapsed) {
      for (const e of eggItems) {
        e.item.position.y = (e.y - 0.8) + Math.sin(elapsed * Math.PI + e.phase) * 0.1
        e.item.rotation.y = elapsed * 0.4
      }
      swirl.rotation.z = elapsed * 0.2 * Math.PI * 2
      swirlLines.rotation.z = elapsed * 0.2 * Math.PI * 2
      sparkleAcc += dt
      if (sparkleAcc > 0.25) {
        sparkleAcc = 0
        for (const e of eggItems) if (e.sparkle) particles.pedestalSparkle(e.x, e.y, e.z, 2)
        particles.spray(f.x, f.capY + 0.9, f.z)
      }
    },
  }
}
