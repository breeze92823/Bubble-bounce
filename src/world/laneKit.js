// Lane cross-section builder shared by main-lane and bubble-ride-lane (ZONE_SPECS/main-lane.md
// §Cross-section): floor x ±halfWidth, walls ±halfWidth..+thickness in alternating segments,
// raised plateaus beyond. Everything static is returned in `statics` for baking by the caller.
import { BoxGeometry, Group, Mesh, PlaneGeometry } from 'three'
import { LANE } from '../config/world.js'
import { legoMaterial, worldUVs } from '../shared/materials.js'
import { put, solidBox } from '../propkit.js'
import { RAPIER, addFixed } from '../physics.js'

export function floorStrip(parent, mat, x0, x1, z0, z1, y = 0) {
  const geo = worldUVs(new PlaneGeometry(x1 - x0, z1 - z0), 2, 'xy', (x0 + x1) / 2, -(z0 + z1) / 2)
  const m = new Mesh(geo, mat)
  m.rotation.x = -Math.PI / 2
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2)
  m.receiveShadow = true
  parent.add(m)
  return m
}

// One segment of lane from z0 to z1 with `look`:
// { floorA, floorB, wallA, wallB, plateau, dash?: { color, length, gap, width } }
export function laneSegment(statics, z0, z1, look, { collide = true } = {}) {
  const H = LANE.halfWidth
  const T = LANE.wallThickness
  const floorMat = legoMaterial(look.floorA, look.floorB, 2)
  const FY = LANE.floorY
  floorStrip(statics, floorMat, -H, H, z0, z1, FY)
  // walls: alternating 6 u blocks
  const wa = legoMaterial(look.wallA, look.wallA, 2)
  const wb = legoMaterial(look.wallB, look.wallB, 2)
  for (let z = z0; z < z1; z += LANE.wallSegment) {
    const len = Math.min(LANE.wallSegment, z1 - z)
    const mat = Math.floor((z - LANE.start) / LANE.wallSegment) % 2 === 0 ? wa : wb
    for (const sx of [-1, 1]) {
      const wh = LANE.wallHeight - FY
      const geo = new BoxGeometry(T, wh, len)
      worldUVs(geo, 2, 'zy', z + len / 2, 0)
      put(statics, geo, mat, sx * (H + T / 2), FY + wh / 2, z + len / 2)
    }
  }
  // plateaus
  const plMat = legoMaterial(look.plateauA || look.plateau, look.plateauB || look.plateau, 2)
  for (const sx of [-1, 1]) {
    const x0 = sx > 0 ? H + T : -(H + T + LANE.plateauWidth)
    const x1 = sx > 0 ? H + T + LANE.plateauWidth : -(H + T)
    floorStrip(statics, plMat, x0, x1, z0, z1, LANE.plateauHeight)
    // plateau side face toward the lane is the wall; outer edge drops to the ocean (hidden)
    const geo = new BoxGeometry(LANE.plateauWidth, LANE.plateauHeight, z1 - z0)
    put(statics, geo, plMat, (x0 + x1) / 2, LANE.plateauHeight / 2 - 0.01, (z0 + z1) / 2, false).visible = false
  }
  // centre dashes
  if (look.dash) {
    const d = look.dash
    const dm = legoMaterial(d.color, d.color, 1, { studs: false })
    for (let z = z0 + d.gap / 2; z < z1; z += d.length + d.gap) {
      const len = Math.min(d.length, z1 - z)
      put(statics, new BoxGeometry(d.width, 0.03, len), dm, 0, FY + 0.02, z + len / 2, false)
    }
  }
  if (collide) {
    const len = z1 - z0
    addFixed(RAPIER.ColliderDesc.cuboid(H + T + LANE.plateauWidth, 0.5, len / 2), { x: 0, y: FY - 0.5, z: (z0 + z1) / 2 }, null, { friction: 0.9 })
    for (const sx of [-1, 1]) {
      solidBox(T / 2, (LANE.wallHeight - FY) / 2, len / 2, sx * (H + T / 2), FY + (LANE.wallHeight - FY) / 2, (z0 + z1) / 2)
      solidBox(LANE.plateauWidth / 2, LANE.plateauHeight / 2, len / 2, sx * (H + T + LANE.plateauWidth / 2), LANE.plateauHeight / 2, (z0 + z1) / 2)
    }
  }
}

// Sheer cliff face where the hub plaza edge (y 0, at z) drops to the lowered lane floor.
export function laneCliff(statics, mat, z) {
  const W = LANE.halfWidth + LANE.wallThickness
  const drop = -LANE.floorY
  const geo = new BoxGeometry(W * 2, drop - 0.02, 2)
  worldUVs(geo, 2, 'xy', 0, 0)
  put(statics, geo, mat, 0, LANE.floorY + (drop - 0.02) / 2, z - 1)}

// Billboard zone sign over the lane centre at the segment start.
export function zoneSign(group, text, z, floatingLabel, y = 6) {
  const s = floatingLabel([{ text, color: '#ffffff', size: 1.1 }, { text: `${Math.round((z - LANE.start) * 5)}m`, color: '#bfc4cc', size: 0.35 }])
  s.position.set(0, y, z)
  s.material.depthTest = false
  group.add(s)
  return s
}

export const plateauX = (sx, inset = 0) => sx * (LANE.halfWidth + LANE.wallThickness + inset)
export const plateauY = LANE.plateauHeight
export const emptyGroup = () => new Group()
