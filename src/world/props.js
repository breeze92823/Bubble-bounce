// Prop builders shared by the hub and lane zones (ZONE_SPECS). All primitives; sizes in
// units. Each returns a Group positioned at its origin on the ground (y 0).
import { BoxGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, TorusGeometry, DoubleSide, MeshBasicMaterial, CircleGeometry, PlaneGeometry } from 'three'
import { WORLD, HUB } from '../config/palette.js'
import { glossy, plastic, legoMaterial } from '../shared/materials.js'
import { neon, put } from '../propkit.js'

const mats = {}
const mat = (key, make) => mats[key] || (mats[key] = make())

export const trunkMat = () => mat('trunk', () => plastic(WORLD.trunk))
export const canopyMat = () => mat('canopy', () => legoMaterial(WORLD.canopy, WORLD.canopy, 1, { studStrength: 0.6 }))
export const bushMat = () => mat('bush', () => glossy(WORLD.bush))

// Cube tree: 3 u canopy on a 1.5 u trunk; `double` stacks a second, smaller canopy.
export function cubeTree(double = false, canopy = 2.2, trunk = 1.2) {
  const g = new Group()
  put(g, new CylinderGeometry(0.22, 0.26, trunk, 8), trunkMat(), 0, trunk / 2, 0)
  put(g, new BoxGeometry(canopy, canopy, canopy), canopyMat(), 0, trunk + canopy / 2, 0)
  if (double) put(g, new BoxGeometry(canopy * 0.7, canopy * 0.7, canopy * 0.7), canopyMat(), 0, trunk + canopy + canopy * 0.35, 0)
  return g
}

// Round bush: three squashed spheres.
export function bush(scale = 0.6) {
  const g = new Group()
  const geo = new SphereGeometry(0.75, 12, 8)
  for (const [x, z, s] of [[0, 0, 1], [0.6, 0.2, 0.75], [-0.5, 0.3, 0.7]]) {
    const m = put(g, geo, bushMat(), x, 0.55 * s, z)
    m.scale.set(s, s * 0.8, s)
  }
  g.scale.setScalar(scale)
  return g
}

// Daisy: stem, 6 white petals, yellow centre. 0.8 u tall.
export function daisy() {
  const g = new Group()
  g.scale.setScalar(0.5)
  put(g, new CylinderGeometry(0.03, 0.03, 0.6, 5), mat('stem', () => plastic('#3cb84a')), 0, 0.3, 0, false)
  const petal = new SphereGeometry(0.11, 8, 6)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const m = put(g, petal, mat('petal', () => plastic(WORLD.daisyPetal)), Math.cos(a) * 0.16, 0.62, Math.sin(a) * 0.16, false)
    m.scale.set(1, 0.5, 1)
  }
  put(g, new SphereGeometry(0.09, 8, 6), mat('daisyC', () => plastic(WORLD.daisyCentre)), 0, 0.64, 0, false)
  return g
}

// Flat glossy puddle (ellipse) with a lighter rim.
export function puddle(rx, rz) {
  const g = new Group()
  const rim = new Mesh(new CircleGeometry(1, 32), mat('puddleRim', () => glossy(WORLD.puddleRim)))
  rim.rotation.x = -Math.PI / 2
  rim.scale.set(rx, rz, 1)
  rim.position.y = 0.05
  const body = new Mesh(new CircleGeometry(1, 32), mat('puddle', () => glossy(WORLD.puddle, { roughness: 0.1 })))
  body.rotation.x = -Math.PI / 2
  body.scale.set(rx * 0.85, rz * 0.85, 1)
  body.position.y = 0.06
  rim.receiveShadow = body.receiveShadow = true
  g.add(rim, body)
  return g
}

// Wand-ring statue: pole with a lime collar and a big glossy torus on top (XY plane).
export function wandStatue(ringColor, poleColor, { poleHeight = 6, ringRadius = 2, ringY = 8 } = {}) {
  const g = new Group()
  put(g, new CylinderGeometry(0.25, 0.25, poleHeight, 12), glossy(poleColor), 0, poleHeight / 2, 0)
  put(g, new CylinderGeometry(0.4, 0.4, 0.5, 12), glossy(HUB.ringLime), 0, poleHeight - 0.6, 0)
  put(g, new TorusGeometry(ringRadius, 0.35, 14, 40), glossy(ringColor), 0, ringY, 0)
  return g
}

// Lego-brick treasure chest: box body, flat overhanging lid in `lid` colour with a trim band, lock plate.
export function chest({ w = 2, d = 1.3, h = 1.2, body, lid, trim, lock }) {
  const g = new Group()
  const bodyH = h * 0.62
  put(g, new BoxGeometry(w, bodyH, d), legoMaterial(body, body, 1, { studStrength: 0.5 }), 0, bodyH / 2, 0)
  put(g, new BoxGeometry(w + 0.12, h - bodyH, d + 0.12), glossy(lid), 0, bodyH + (h - bodyH) / 2, 0)
  put(g, new BoxGeometry(w + 0.16, 0.08, d + 0.16), glossy(trim), 0, bodyH + 0.04, 0)
  put(g, new BoxGeometry(w + 0.16, 0.06, d + 0.16), glossy(trim), 0, h - 0.03, 0)
  put(g, new BoxGeometry(0.32, 0.3, 0.1), glossy(lock), 0, bodyH - 0.05, d / 2 + 0.05)
  return g
}

// Glowing floor disc (additive, unlit).
export function glowDisc(radius, color, opacity = 0.5) {
  const m = new Mesh(new CircleGeometry(radius, 40), neon(color, 1.8, { transparent: true, opacity, depthWrite: false, side: DoubleSide }))
  m.rotation.x = -Math.PI / 2
  m.position.y = 0.03
  return m
}

// Gold stepped octagonal pedestal.
export function pedestal(radius = 1.25, height = 0.6, color = WORLD.gold, steps = 3) {
  const g = new Group()
  for (let i = 0; i < steps; i++) {
    const r = radius * (1 - i * 0.18)
    const h = height / steps
    put(g, new CylinderGeometry(r, r, h, 8), glossy(color), 0, h * (i + 0.5), 0)
  }
  return g
}

// Egg: a stretched sphere.
export function egg(color, h = 1.1) {
  const m = new Mesh(new SphereGeometry(h * 0.36, 20, 16), glossy(color))
  m.scale.set(1, 1.35, 1)
  m.position.y = h * 0.5
  m.castShadow = true
  return m
}

// Dashed square outline on the ground.
export function dashedSquare(size, color = '#ffffff') {
  const g = new Group()
  const dash = new PlaneGeometry(0.3, 0.08)
  const m = new MeshBasicMaterial({ color })
  const n = Math.round(size / 0.5)
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < n; i++) {
      const t = -size / 2 + (i + 0.5) * (size / n)
      const d = new Mesh(dash, m)
      d.rotation.x = -Math.PI / 2
      if (side === 0) d.position.set(t, 0.03, -size / 2)
      if (side === 1) d.position.set(t, 0.03, size / 2)
      if (side === 2) {
        d.position.set(-size / 2, 0.03, t)
        d.rotation.z = Math.PI / 2
      }
      if (side === 3) {
        d.position.set(size / 2, 0.03, t)
        d.rotation.z = Math.PI / 2
      }
      g.add(d)
    }
  }
  return g
}

