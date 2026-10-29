// main-lane (ZONE_SPECS/main-lane.md): the green Grassland segment of the lane from the blow
// strip (z 12) to the Neighborhood sign (z 90): checker floor, blue/white walls, raised green
// plateaus with cube trees, bushes, daisies, picket fences and houses toward the end.
import { BoxGeometry, ConeGeometry, Group } from 'three'
import { HUB, LANE, SEGMENTS } from '../../config/world.js'
import { legoMaterial } from '../../shared/materials.js'
import { WORLD, RIDE } from '../../config/palette.js'
import { glossy, plastic } from '../../shared/materials.js'
import { floatingLabel } from '../../shared/labels.js'
import { put } from '../../propkit.js'
import { bake } from '../../bake.js'
import { bush, cubeTree, daisy } from '../props.js'
import { laneCliff,laneSegment, plateauX, plateauY, zoneSign } from '../laneKit.js'
import { mulberry32 } from '../../textures.js'

export const GRASS_LOOK = { floorA: WORLD.grassA, floorB: WORLD.grassB, wallA: WORLD.wallBlue, wallB: WORLD.wallWhite, plateauA: WORLD.grassA, plateauB: WORLD.grassB }

export function house(seed = 0) {
  const g = new Group()
  const wall = plastic(seed % 2 ? '#fff2b0' : '#ffffff')
  put(g, new BoxGeometry(4, 2.4, 4), wall, 0, 1.2, 0)
  const roof = put(g, new ConeGeometry(3.2, 1.6, 4), glossy(RIDE.carnivalFloor), 0, 3.2, 0)
  roof.rotation.y = Math.PI / 4
  put(g, new BoxGeometry(0.9, 1.3, 0.1), plastic('#7a4a2a'), 0, 0.65, 2.05)
  for (const sx of [-1, 1]) put(g, new BoxGeometry(0.8, 0.8, 0.1), glossy('#9fd8ff'), sx * 1.3, 1.5, 2.05)
  return g
}

export function picketFence(len) {
  const g = new Group()
  const white = plastic('#ffffff')
  const n = Math.round(len / 0.6)
  for (let i = 0; i < n; i++) put(g, new BoxGeometry(0.18, 1, 0.08), white, -len / 2 + (i + 0.5) * (len / n), 0.5, 0, false)
  put(g, new BoxGeometry(len, 0.1, 0.06), white, 0, 0.7, 0, false)
  put(g, new BoxGeometry(len, 0.1, 0.06), white, 0, 0.35, 0, false)
  return g
}

export function buildZone({ scene }) {
  const group = new Group()
  group.name = 'zone:main-lane'
  const statics = new Group()
  const seg = SEGMENTS.find((s) => s.id === 'grassland')
  laneSegment(statics, seg.z0, seg.z1, GRASS_LOOK)
  laneCliff(statics, legoMaterial(WORLD.wallBlue, WORLD.wallWhite, 1), HUB.plaza.z1)

  const rand = mulberry32(21)
  for (const sx of [-1, 1]) {
    for (let z = seg.z0 + 4; z < seg.z1; z += 14) {
      const tr = cubeTree(rand() < 0.3)
      tr.position.set(plateauX(sx, 4 + rand() * 5), plateauY, z + (sx > 0 ? 7 : 0))
      statics.add(tr)
    }
    for (let z = seg.z0 + 2; z < seg.z1; z += 15) {
      const b = bush(0.8 + rand() * 0.5)
      b.position.set(plateauX(sx, 1 + rand() * 1.5), plateauY, z + rand() * 6)
      statics.add(b)
    }
    for (let z = seg.z0 + 1; z < seg.z1; z += 6) {
      const d = daisy()
      d.position.set(plateauX(sx, 0.5 + rand() * 2), plateauY, z + rand() * 3)
      statics.add(d)
    }
    for (let z = 60; z < seg.z1; z += 20) {
      const h = house(Math.round(rand() * 10))
      h.position.set(plateauX(sx, 6), plateauY, z + 6)
      h.rotation.y = sx > 0 ? -Math.PI / 2 : Math.PI / 2
      statics.add(h)
      const f = picketFence(8)
      f.position.set(plateauX(sx, 2.2), plateauY, z + 6)
      statics.add(f)
    }
  }
  const baked = bake(statics, true)
  baked.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true
  })
  group.add(baked)
  const next = SEGMENTS.find((s) => s.id === 'neighborhood')
  scene.add(group)
  return { group, update() {} }
}
