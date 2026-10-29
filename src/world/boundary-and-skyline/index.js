// boundary-and-skyline zone (ZONE_SPECS/boundary-and-skyline.md). Stub until the zone unit builds it.
import { Group } from 'three'

export function buildZone({ scene }) {
  const group = new Group()
  group.name = 'zone:boundary-and-skyline'
  scene.add(group)
  return { group, update() {} }
}
