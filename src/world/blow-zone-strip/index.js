// blow-zone-strip (ZONE_SPECS/blow-zone-strip.md): the yellow strip across the lane mouth with
// the "BLOW ZONE" decal and two cyan puddles. Standing on the strip shows the BLOW prompt
// (padEntered); BLOW starts the run in gameplay/ride.js (inflate, shots A/B, ride, burst).
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three'
import { HUB, STRIP } from '../../config/world.js'
import { RAPIER, addFixed } from '../../physics.js'
import { WORLD } from '../../config/palette.js'
import { FONT_FAMILY } from '../../config.js'
import { legoMaterial } from '../../shared/materials.js'
import { bake } from '../../bake.js'
import { puddle } from '../props.js'
import { floorStrip } from '../laneKit.js'
import { fontReady } from '../../propkit.js'
import { emit, on } from '../../state/game.js'

function blowZoneDecal() {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 300
  const ctx = c.getContext('2d')
  const draw = () => {
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.font = `italic 900 230px ${FONT_FAMILY}, "Arial Black", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 26
    ctx.strokeStyle = WORLD.textOutline
    ctx.strokeText('BLOW ZONE', c.width / 2, c.height / 2 + 10)
    ctx.fillStyle = WORLD.textWhite
    ctx.fillText('BLOW ZONE', c.width / 2, c.height / 2 + 10)
  }
  draw()
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  fontReady.then(() => {
    draw()
    tex.needsUpdate = true
  })
  return tex
}

export function buildZone({ scene, player, ride }) {
  const group = new Group()
  group.name = 'zone:blow-zone-strip'
  const statics = new Group()
  floorStrip(statics, legoMaterial(WORLD.tileYellow, WORLD.tileYellowAlt, 2), STRIP.x0, STRIP.x1, STRIP.z0, STRIP.z1, 0.02)
  for (const p of STRIP.puddles) {
    const pd = puddle(p.rx, p.rz)
    pd.position.set(p.x, 0.02, p.z)
    statics.add(pd)
  }
  const baked = bake(statics, false)
  baked.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true
  })
  group.add(baked)

  const decal = new Mesh(new PlaneGeometry(STRIP.textWidth, STRIP.textWidth * 300 / 2048), new MeshBasicMaterial({ map: blowZoneDecal(), transparent: true, depthWrite: false }))
  decal.rotation.x = -Math.PI / 2
  decal.scale.y = -1 // letter tops toward +Z; the render-time X mirror (main.js) keeps the reading order
  decal.position.set(0, 0.06, STRIP.textZ)
  decal.renderOrder = 2
  group.add(decal)
  scene.add(group)

  // The lane is ride-only: an invisible wall on the strip's far edge, across the whole plaza.
  const P = HUB.plaza
  addFixed(RAPIER.ColliderDesc.cuboid((P.x1 - P.x0) / 2 + 6, 3, 1), { x: 0, y: 3, z: STRIP.z1 + 1 }, null, { friction: 0 })

  // --- mechanics: standing on the strip shows BLOW; blowing hands over to the ride ----------
  let onStrip = false
  const onStripNow = () => {
    const p = player.position
    return p.x > STRIP.x0 && p.x < STRIP.x1 && p.z > STRIP.z0 && p.z < STRIP.z1
  }

  function blow() {
    if (onStripNow() && !ride.active) ride.begin()
  }
  on('blowPressed', blow)
  on('uiBlow', blow)

  return {
    group,
    update() {
      const now = onStripNow() && !ride.active
      if (now !== onStrip) {
        onStrip = now
        emit(now ? 'padEntered' : 'padLeft', { zone: 'blow-zone-strip', id: 'strip' })
      }
    },
  }
}
