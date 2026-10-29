// Ocean and clouds (boundary-and-skyline.md §Ocean, §Sky). The sky gradient, sun and
// haze live in lighting.js; this is the water plane around the island and the cumulus
// bands near the horizon. Both follow the player so the horizon never runs out.
import { Group, IcosahedronGeometry, Mesh, MeshLambertMaterial, MeshPhysicalMaterial, PlaneGeometry, Vector2 } from 'three'
import { LIGHTING } from '../config/world.js'
import { SKY, WORLD } from '../config/palette.js'
import { mulberry32, paintWaterNormal, toTexture } from '../textures.js'

function makeClouds() {
  const { count, minElevation, maxElevation, distance, scale = 1, flat = 1 } = LIGHTING.clouds
  const rand = mulberry32(2024)
  const geo = new IcosahedronGeometry(1, 3)
  const mat = new MeshLambertMaterial({ color: SKY.cloud, emissive: SKY.cloudShade, emissiveIntensity: 0.55, fog: false })
  const group = new Group()
  group.name = 'clouds'
  for (let i = 0; i < count; i++) {
    const ang = rand() * Math.PI * 2
    const el = ((minElevation + rand() * (maxElevation - minElevation)) * Math.PI) / 180
    const dist = distance * (0.8 + rand() * 0.5)
    const cloud = new Group()
    const puffs = 5 + Math.floor(rand() * 5)
    const len = 40 + rand() * 60
    for (let p = 0; p < puffs; p++) {
      const t = p / (puffs - 1) - 0.5
      const r = (1 - Math.abs(t) * 1.1) * (14 + rand() * 10)
      const puff = new Mesh(geo, mat)
      puff.scale.set(r, r * 0.8, r)
      puff.position.set(t * len, r * 0.25 + rand() * 4, (rand() - 0.5) * 12)
      cloud.add(puff)
    }
    const flat = new Mesh(geo, mat)
    flat.scale.set(len * 0.62, 6, 14)
    cloud.add(flat)
    cloud.position.set(Math.cos(ang) * dist * Math.cos(el), Math.sin(el) * dist, Math.sin(ang) * dist * Math.cos(el))
    cloud.lookAt(0, cloud.position.y, 0)
    cloud.scale.set(scale, scale * flat, scale)
    cloud.userData.ang = ang
    cloud.userData.dist = dist
    cloud.userData.el = el
    group.add(cloud)
  }
  return group
}

export function createEnvironment(scene) {
  const ripples = paintWaterNormal()
  const normalA = toTexture(ripples, { repeat: LIGHTING.oceanSize / 14 })
  const normalB = toTexture(ripples, { repeat: LIGHTING.oceanSize / 37 })
  const ocean = new Mesh(
    new PlaneGeometry(LIGHTING.oceanSize, LIGHTING.oceanSize),
    new MeshPhysicalMaterial({
      color: WORLD.ocean,
      roughness: 0.5,
      metalness: 0,
      normalMap: normalA,
      normalScale: new Vector2(0.08, 0.08),
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      clearcoatNormalMap: normalB,
      clearcoatNormalScale: new Vector2(0.15, 0.15),
    }),
  )
  ocean.name = 'ocean'
  ocean.rotation.x = -Math.PI / 2
  ocean.position.y = LIGHTING.oceanLevel
  ocean.receiveShadow = true
  const clouds = makeClouds()
  scene.add(ocean, clouds)

  return {
    ocean,
    clouds,
    update(dt, elapsed, focus) {
      normalA.offset.set(elapsed * 0.012, elapsed * 0.02)
      normalB.offset.set(-elapsed * 0.008, elapsed * 0.005)
      const drift = elapsed * LIGHTING.clouds.drift
      for (const cloud of clouds.children) {
        const a = cloud.userData.ang + drift
        const { dist, el } = cloud.userData
        cloud.position.set(Math.cos(a) * dist * Math.cos(el), Math.sin(el) * dist, Math.sin(a) * dist * Math.cos(el))
      }
      if (focus) {
        ocean.position.x = focus.x
        ocean.position.z = focus.z
        clouds.position.set(focus.x, 0, focus.z)
      }
    },
  }
}
