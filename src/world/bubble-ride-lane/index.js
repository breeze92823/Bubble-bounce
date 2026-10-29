// bubble-ride-lane (ZONE_SPECS/bubble-ride-lane.md): the themed segments of the lane after
// the Grassland: Neighborhood (towers), Carnival (tents, balloons, Ferris wheel), Beach (palms,
// umbrellas), Desert (mesas, cacti), Snow (pines, snowmen, ice spikes) and Volcano. Each segment
// reuses the lane cross-section (laneKit) with its own floor/wall/plateau colours and props.
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, MeshBasicMaterial, PlaneGeometry, DoubleSide } from 'three'
import { LANE, SEGMENTS } from '../../config/world.js'
import { RIDE as C, WORLD } from '../../config/palette.js'
import { glossy, legoMaterial, plastic } from '../../shared/materials.js'
import { floatingLabel } from '../../shared/labels.js'
import { put } from '../../propkit.js'
import { bake } from '../../bake.js'
import { bush, daisy } from '../props.js'
import { laneSegment, plateauX, plateauY, zoneSign } from '../laneKit.js'
import { mulberry32 } from '../../textures.js'

const LOOKS = {
  neighborhood: { floorA: C.neighborhoodFloorA, floorB: C.neighborhoodFloorB, wallA: C.neighborhoodWallA, wallB: C.neighborhoodWallB, plateauA: '#9fb0cc', plateauB: '#b9c4d6', dash: { color: C.dashYellow, length: 1.5, gap: 1.5, width: 0.3 } },
  carnival: { floorA: C.carnivalFloor, floorB: C.carnivalFloor, wallA: C.carnivalWallA, wallB: C.carnivalWallB, plateauA: C.carnivalSand, plateauB: C.carnivalSand, dash: { color: C.laneWhite, length: 1.5, gap: 1.5, width: 0.3 } },
  beach: { floorA: C.beachFloorA, floorB: C.beachFloorB, wallA: C.beachWallA, wallB: C.beachWallB, plateauA: C.beachSand, plateauB: C.beachSand },
  desert: { floorA: C.desertFloorA, floorB: C.desertFloorB, wallA: C.desertWallA, wallB: C.desertWallB, plateauA: C.desertFloorA, plateauB: C.desertFloorA },
  snow: { floorA: C.snowFloorA, floorB: C.snowFloorB, wallA: C.snowWallA, wallB: C.snowWallB, plateauA: '#ffffff', plateauB: '#f4fbff' },
  volcano: { floorA: C.volcanoFloorA, floorB: C.volcanoFloorB, wallA: C.volcanoWall, wallB: '#6a4a3a', plateauA: '#5a3a2a', plateauB: '#6a4a3a' },
}

// --- props -------------------------------------------------------------------------------
function tower(h = 26) {
  const g = new Group()
  const body = legoMaterial(C.tower, C.tower, 2, { studs: false })
  put(g, new BoxGeometry(8, h, 8), body, 0, h / 2, 0)
  const win = glossy(C.towerWindow)
  const rows = Math.floor(h / 2.2)
  for (const face of [0, 1, 2, 3]) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 3; c++) {
        const w = put(g, new BoxGeometry(1.4, 1.4, 0.1), win, -2.4 + c * 2.4, 1.5 + r * 2.2, 4.05, false)
        if (face === 1) w.position.set(4.05, w.position.y, -2.4 + c * 2.4), (w.rotation.y = Math.PI / 2)
        if (face === 2) w.position.set(-2.4 + c * 2.4, w.position.y, -4.05)
        if (face === 3) w.position.set(-4.05, w.position.y, -2.4 + c * 2.4), (w.rotation.y = Math.PI / 2)
      }
    }
  }
  put(g, new BoxGeometry(8.4, 0.4, 8.4), plastic('#8fb0d8'), 0, h + 0.2, 0)
  put(g, new CylinderGeometry(0.08, 0.08, 2, 6), plastic('#ff3a4e'), 2, h + 1.4, 2)
  return g
}

function circusTent(scale = 1) {
  const g = new Group()
  const red = glossy('#ff3a4e')
  const white = glossy('#ffffff')
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const seg = put(g, new BoxGeometry(1.6, 3, 0.3), i % 2 ? red : white, Math.cos(a) * 2.9, 1.5, Math.sin(a) * 2.9)
    seg.rotation.y = -a
  }
  const roof = put(g, new ConeGeometry(3.6, 2.2, 12), red, 0, 4.1, 0)
  roof.rotation.y = Math.PI / 12
  put(g, new TorusGeometry(3.4, 0.15, 6, 24), glossy(WORLD.gold), 0, 3.1, 0).rotation.x = Math.PI / 2
  put(g, new CylinderGeometry(0.06, 0.06, 1.2, 6), plastic('#ffffff'), 0, 5.8, 0)
  put(g, new BoxGeometry(0.9, 0.5, 0.05), glossy('#ffd23a'), 0.45, 6.2, 0)
  g.scale.setScalar(scale)
  return g
}

function balloons() {
  const g = new Group()
  const cols = ['#ff3a4e', '#3cd25a', '#3fa0ff', '#ffd23a', '#ff5fcf']
  put(g, new CylinderGeometry(0.02, 0.02, 3, 4), plastic('#ffffff'), 0, 1.5, 0, false)
  cols.forEach((c, i) => {
    const a = (i / cols.length) * Math.PI * 2
    const b = put(g, new SphereGeometry(0.3, 10, 8), glossy(c), Math.cos(a) * 0.35, 3.2 + (i % 2) * 0.3, Math.sin(a) * 0.35)
    b.scale.y = 1.2
  })
  return g
}

function iceCreamStall() {
  const g = new Group()
  put(g, new BoxGeometry(2, 1, 1.6), glossy('#3fa0ff'), 0, 0.5, 0)
  for (const sx of [-1, 1]) put(g, new CylinderGeometry(0.06, 0.06, 2.2, 6), plastic('#ffffff'), sx * 0.9, 1.1, -0.7)
  for (let i = 0; i < 5; i++) put(g, new BoxGeometry(0.46, 0.08, 1.8), i % 2 ? glossy('#ff3a4e') : glossy('#ffffff'), -0.92 + i * 0.46, 2.2, 0)
  return g
}

function ferrisWheel() {
  const g = new Group()
  const frame = glossy('#3a7bff')
  for (const sx of [-1, 1]) {
    const leg = put(g, new BoxGeometry(0.3, 6, 0.3), frame, sx * 1.5, 3, 0.8)
    leg.rotation.z = sx * 0.25
  }
  const wheel = new Group()
  wheel.position.y = 5.5
  put(wheel, new TorusGeometry(5, 0.15, 8, 40), frame, 0, 0, 0)
  const cols = ['#ff3a4e', '#ffd23a', '#3cd25a', '#ff5fcf', '#3fa0ff', '#ff8a2a', '#ffffff', '#8d4bff']
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    put(wheel, new BoxGeometry(0.12, 10, 0.12), frame, 0, 0, 0).rotation.z = a
    put(wheel, new BoxGeometry(0.9, 0.9, 0.7), glossy(cols[i]), Math.cos(a) * 5, Math.sin(a) * 5, 0)
  }
  g.add(wheel)
  g.userData.wheel = wheel
  return g
}

function palmTree() {
  const g = new Group()
  const trunk = plastic(C.palmTrunk)
  let x = 0
  let y = 0
  for (let i = 0; i < 6; i++) {
    const seg = put(g, new CylinderGeometry(0.22 - i * 0.02, 0.26 - i * 0.02, 1.05, 8), trunk, x, y + 0.5, 0)
    seg.rotation.z = -0.12 * (i + 1)
    x += Math.sin(0.12 * (i + 1)) * 1.0
    y += Math.cos(0.12 * (i + 1)) * 1.0
  }
  const frond = legoMaterial(WORLD.canopy, WORLD.canopy, 1, { studStrength: 0.4 })
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const f = put(g, new BoxGeometry(2.4, 0.25, 0.7), frond, x + Math.cos(a) * 1.1, y + 0.1, Math.sin(a) * 1.1)
    f.rotation.y = -a
    f.rotation.z = 0.35
  }
  put(g, new SphereGeometry(0.22, 8, 6), plastic('#6a3a1a'), x + 0.2, y - 0.2, 0.2)
  return g
}

function umbrella() {
  const g = new Group()
  put(g, new CylinderGeometry(0.04, 0.04, 1.6, 6), plastic('#ffffff'), 0, 0.8, 0)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const w = put(g, new ConeGeometry(1, 0.35, 8, 1, false, a, Math.PI / 4), i % 2 ? glossy('#ff3a4e') : glossy('#ffffff'), 0, 1.65, 0)
    w.scale.set(1, 1, 1)
  }
  return g
}

function towel() {
  const m = new Mesh(new PlaneGeometry(1.1, 2), glossy('#3fa0ff'))
  m.rotation.x = -Math.PI / 2
  m.position.y = 0.02
  return m
}

function mesa(w = 10) {
  const g = new Group()
  const tiers = [[w, 1.5], [w * 0.8, 1.5], [w * 0.6, 1.5], [w * 0.4, 1.2]]
  let y = 0
  tiers.forEach(([s, h], i) => {
    put(g, new BoxGeometry(s, h, s), legoMaterial(i % 2 ? C.mesaA : C.mesaB, i % 2 ? C.mesaA : C.mesaB, 2, { studStrength: 0.4 }), 0, y + h / 2, 0)
    y += h
  })
  return g
}

function cactus(h = 3) {
  const g = new Group()
  const green = glossy(C.cactus)
  put(g, new CylinderGeometry(0.4, 0.4, h, 10), green, 0, h / 2, 0)
  for (const sx of [-1, 1]) {
    put(g, new CylinderGeometry(0.22, 0.22, 0.8, 8), green, sx * 0.6, h * 0.5, 0).rotation.z = Math.PI / 2
    put(g, new CylinderGeometry(0.22, 0.22, 1.0, 8), green, sx * 0.8, h * 0.5 + 0.5, 0)
  }
  put(g, new SphereGeometry(0.22, 8, 6), glossy(C.cactusFlower), 0, h + 0.1, 0)
  return g
}

function rockStack() {
  const g = new Group()
  const m = glossy(C.mesaA)
  put(g, new CylinderGeometry(0.8, 0.9, 0.3, 8), m, 0, 0.15, 0)
  put(g, new CylinderGeometry(0.6, 0.7, 0.3, 8), m, 0.1, 0.45, 0)
  put(g, new CylinderGeometry(0.4, 0.5, 0.3, 8), m, 0, 0.75, 0)
  return g
}

function pine() {
  const g = new Group()
  put(g, new CylinderGeometry(0.2, 0.25, 1, 6), plastic(WORLD.trunk), 0, 0.5, 0)
  for (let i = 0; i < 3; i++) {
    put(g, new ConeGeometry(1.6 - i * 0.4, 1.6, 8), glossy(C.pine), 0, 1.6 + i * 1.1, 0)
    put(g, new ConeGeometry(0.9 - i * 0.25, 0.4, 8), glossy('#ffffff'), 0, 2.4 + i * 1.1, 0)
  }
  return g
}

function snowman() {
  const g = new Group()
  const white = glossy('#ffffff')
  put(g, new SphereGeometry(0.6, 12, 10), white, 0, 0.6, 0)
  put(g, new SphereGeometry(0.45, 12, 10), white, 0, 1.45, 0)
  put(g, new SphereGeometry(0.32, 12, 10), white, 0, 2.05, 0)
  put(g, new CylinderGeometry(0.3, 0.3, 0.08, 10), plastic('#111111'), 0, 2.36, 0)
  put(g, new CylinderGeometry(0.2, 0.2, 0.35, 10), plastic('#111111'), 0, 2.55, 0)
  put(g, new ConeGeometry(0.06, 0.4, 6), glossy('#ff8a2a'), 0, 2.05, 0.4).rotation.x = Math.PI / 2
  for (const sx of [-1, 1]) put(g, new CylinderGeometry(0.03, 0.03, 0.9, 4), plastic(WORLD.trunk), sx * 0.7, 1.55, 0).rotation.z = sx * 1.2
  return g
}

function iceSpike() {
  return put(new Group(), new ConeGeometry(0.6, 4, 6), glossy('#bfeeff', { transparent: true, opacity: 0.85 }), 0, 2, 0).parent
}

function volcanoCone() {
  const g = new Group()
  put(g, new ConeGeometry(7, 9, 12), legoMaterial('#5a3a2a', '#5a3a2a', 2, { studStrength: 0.3 }), 0, 4.5, 0)
  put(g, new CylinderGeometry(2.2, 2.2, 0.3, 12), new MeshBasicMaterial({ color: C.lava }), 0, 9, 0)
  return g
}

// --- zone ----------------------------------------------------------------------------------
export function buildZone({ scene, particles }) {
  const group = new Group()
  group.name = 'zone:bubble-ride-lane'
  const statics = new Group()
  const rand = mulberry32(99)
  const wheels = []
  for (const seg of SEGMENTS) {
    if (seg.id === 'grassland') continue
    laneSegment(statics, seg.z0, seg.z1, LOOKS[seg.id])
    const L = seg.z1 - seg.z0
    for (const sx of [-1, 1]) {
      switch (seg.id) {
        case 'neighborhood':
          for (let i = 0; i < 4; i++) {
            const t = tower(22 + rand() * 8)
            t.position.set(plateauX(sx, 10), plateauY, seg.z0 + 10 + i * 30)
            statics.add(t)
          }
          for (let z = seg.z0 + 3; z < seg.z1; z += 9) {
            const b = bush(0.6)
            b.position.set(plateauX(sx, 1 + rand() * 2), plateauY, z)
            statics.add(b)
            const d = daisy()
            d.position.set(plateauX(sx, 0.6 + rand() * 2), plateauY, z + 4)
            statics.add(d)
          }
          break
        case 'carnival': {
          const tent = circusTent(sx > 0 ? 1 : 0.8)
          tent.position.set(plateauX(sx, 7), plateauY, seg.z0 + 20 + (sx > 0 ? 30 : 0))
          statics.add(tent)
          for (let i = 0; i < 3; i++) {
            const b = balloons()
            b.position.set(plateauX(sx, 2 + rand() * 4), plateauY, seg.z0 + 8 + i * 25 + rand() * 6)
            statics.add(b)
          }
          if (sx > 0) {
            const st = iceCreamStall()
            st.position.set(plateauX(sx, 4), plateauY, seg.z1 - 12)
            st.rotation.y = -Math.PI / 2
            statics.add(st)
          } else {
            const fw = ferrisWheel()
            fw.position.set(plateauX(sx, 9), plateauY, seg.z0 + 6)
            fw.rotation.y = Math.PI / 2
            group.add(fw)
            wheels.push(fw.userData.wheel)
          }
          for (let z = seg.z0 + 2; z < seg.z1; z += 10) {
            const b = bush(0.55)
            b.position.set(plateauX(sx, 1 + rand() * 2), plateauY, z)
            statics.add(b)
          }
          break
        }
        case 'beach':
          for (let z = seg.z0 + 4; z < seg.z1; z += 12) {
            const p = palmTree()
            p.position.set(plateauX(sx, 5 + rand() * 4), plateauY, z + rand() * 4)
            p.rotation.y = rand() * Math.PI * 2
            statics.add(p)
          }
          for (let z = seg.z0 + 6; z < seg.z1; z += 16) {
            const u = umbrella()
            u.position.set(plateauX(sx, 2.5 + rand() * 2), plateauY, z)
            statics.add(u)
            const t = towel()
            t.position.set(plateauX(sx, 3.5 + rand()), plateauY + 0.02, z + 1.5)
            statics.add(t)
            const ball = put(statics, new SphereGeometry(0.25, 10, 8), glossy('#ffd23a'), plateauX(sx, 1.5), plateauY + 0.25, z + 3)
            ball.castShadow = true
          }
          for (let z = seg.z0 + 2; z < seg.z1; z += 11) {
            const b = bush(0.5)
            b.position.set(plateauX(sx, 1 + rand() * 1.5), plateauY, z)
            statics.add(b)
          }
          break
        case 'desert':
          for (let i = 0; i < 2; i++) {
            const m = mesa(10)
            m.position.set(plateauX(sx, 8), plateauY, seg.z0 + 20 + i * 55 + (sx > 0 ? 15 : 0))
            statics.add(m)
          }
          for (let z = seg.z0 + 3; z < seg.z1; z += 9) {
            const c = cactus(2 + rand() * 2)
            c.position.set(plateauX(sx, 1 + rand() * 5), plateauY, z + rand() * 3)
            statics.add(c)
            if (rand() < 0.5) {
              const r = rockStack()
              r.position.set(plateauX(sx, 1 + rand() * 3), plateauY, z + 5)
              statics.add(r)
            }
          }
          break
        case 'snow':
          for (let z = seg.z0 + 3; z < seg.z1; z += 10) {
            const p = pine()
            p.position.set(plateauX(sx, 2 + rand() * 6), plateauY, z + rand() * 3)
            statics.add(p)
            if (rand() < 0.6) {
              const s = snowman()
              s.position.set(plateauX(sx, 1 + rand() * 2), plateauY, z + 5)
              statics.add(s)
            }
            if (rand() < 0.4) {
              const sp = iceSpike()
              sp.position.set(plateauX(sx, 4 + rand() * 4), plateauY, z + 2)
              statics.add(sp)
            }
          }
          break
        case 'volcano': {
          const v = volcanoCone()
          v.position.set(plateauX(sx, 9), plateauY, seg.z0 + 40 + (sx > 0 ? 50 : 0))
          statics.add(v)
          for (let z = seg.z0 + 5; z < seg.z1; z += 12) {
            const r = rockStack()
            r.position.set(plateauX(sx, 1 + rand() * 4), plateauY, z)
            statics.add(r)
          }
          break
        }
      }
    }
    if (seg.sign) zoneSign(group, seg.id === 'neighborhood' ? `🏠 ${seg.sign} 🏠` : seg.sign, seg.z0, floatingLabel)
  }
  // Lane end: a stop wall so a maxed ride never falls off.
  put(statics, new BoxGeometry(LANE.halfWidth * 2 + 2, 3 - LANE.floorY, 1), legoMaterial('#5a3a2a', '#5a3a2a', 2), 0, (3 + LANE.floorY) / 2, LANE.end + 1)
  const baked = bake(statics, true)
  baked.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true
  })
  group.add(baked)
  scene.add(group)
  return {
    group,
    update(dt) {
      for (const w of wheels) w.rotation.z += dt * 0.15
    },
  }
}
