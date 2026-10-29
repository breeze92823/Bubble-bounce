// The world: every zone under one root (CONTRACTS.md §Scene roots). Zones are added
// here in BUILD_PLAN order; until a zone is built its area is bare ground.
import { Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'
import { RAPIER, addFixed } from '../physics.js'
import { WORLD } from '../config/palette.js'
import { HUB } from '../config/world.js'
import { legoTexture, worldUVs } from '../shared/materials.js'
import { buildZone as buildSpawnHub } from './spawn-hub/index.js'
import { buildZone as buildTrainingPads } from './training-pads/index.js'
import { buildZone as buildBubbleShopPads } from './bubble-shop-pads/index.js'
import { buildZone as buildMainLane } from './main-lane/index.js'
import { buildZone as buildBlowZoneStrip } from './blow-zone-strip/index.js'
import { buildZone as buildBubbleRideLane } from './bubble-ride-lane/index.js'
import { buildZone as buildBoundary } from './boundary-and-skyline/index.js'

export function buildWorld(scene, ctx) {
  const root = new Group()
  root.name = 'world'
  scene.add(root)

  // Hub floor collider (the plaza + what the other hub zones sit on).
  const P = HUB.plaza
  addFixed(RAPIER.ColliderDesc.cuboid((P.x1 - P.x0) / 2 + 6, 0.5, (P.z1 - P.z0) / 2 + 6), { x: 0, y: -0.5, z: (P.z0 + P.z1) / 2 }, null, { friction: 0.9 })

  const zones = {}
  const zctx = { scene: root, ...ctx }
  zones['spawn-hub'] = buildSpawnHub(zctx)
  zones['training-pads'] = buildTrainingPads(zctx)
  zones['bubble-shop-pads'] = buildBubbleShopPads(zctx)
  zones['main-lane'] = buildMainLane(zctx)
  zones['blow-zone-strip'] = buildBlowZoneStrip(zctx)
  zones['bubble-ride-lane'] = buildBubbleRideLane(zctx)
  zones['boundary-and-skyline'] = buildBoundary(zctx)

  return {
    root,
    zones,
    update(dt, elapsed) {
      for (const z of Object.values(zones)) z.update?.(dt, elapsed)
    },
  }
}
