// The inflate (blow-zone-strip.md §Effects, training-pads.md §Effects): the equipped bubble
// grows at the wand while the avatar holds the `blow` pose, with sparkles around the rim. One
// bubble at a time. `stop()` pops it; `release()` hands the live mesh to the ride instead.
import { Vector3 } from 'three'
import { BLOW } from '../config/mechanics.js'
import { BUBBLE as TINTS } from '../config/palette.js'
import { createBubbleMesh } from '../shared/bubble.js'

const easeOut = (t) => 1 - (1 - t) * (1 - t)

// ctx: { scene, particles, animator() (current animator or null), wandRing(out) (logic-frame
// position of the wand ring), facing() (the avatar's yaw) }
export function createInflater({ scene, particles, animator, wandRing, facing }) {
  const ring = new Vector3()
  const centre = new Vector3()
  let mesh = null
  let t = 0
  let duration = 1
  let diameter = 1
  let anchor = null
  let onDone = null
  let done = false
  let sparkAt = 0

  // Default anchor: just in front of the ring, along the way the avatar faces.
  function atWand(r, out, ring) {
    const f = facing()
    return out.set(ring.x + Math.sin(f) * r * 0.9, ring.y, ring.z + Math.cos(f) * r * 0.9)
  }

  function clear() {
    if (mesh) {
      scene.remove(mesh)
      mesh.traverse((o) => o.material?.dispose?.())
    }
    mesh = null
    anchor = null
    onDone = null
    animator()?.setOverride(null)
  }

  const api = {
    get active() {
      return !!mesh
    },
    get mesh() {
      return mesh
    },
    // Grows bubble `typeId` to `size` (diameter, u) over `opts.duration` s, then calls onDone(mesh).
    // `opts.anchor(radius, out, ring)` places the bubble's centre each frame from the wand ring's
    // position (default: just in front of the ring).
    start(typeId, size, done_, opts = {}) {
      clear()
      mesh = createBubbleMesh(typeId, 0.01)
      mesh.userData.tint = TINTS[mesh.userData.type.tint] || TINTS.plain
      scene.add(mesh)
      t = 0
      done = false
      sparkAt = 0
      duration = opts.duration ?? BLOW.inflateTime
      diameter = size
      anchor = opts.anchor || atWand
      onDone = done_
      animator()?.setOverride('blow')
      api.update(0)
    },
    update(dt) {
      if (!mesh || done) return
      t = Math.min(duration, t + dt)
      const k = t / duration
      const d = Math.max(0.05, diameter * easeOut(k))
      mesh.scale.setScalar(d)
      wandRing(ring)
      anchor(d / 2, centre, ring)
      mesh.position.copy(centre)
      // Flat shapes (the star) face the way the avatar blows, i.e. toward the shot's camera.
      const f = facing()
      mesh.rotation.y = f
      // Sparkles spread evenly over the inflate, on the rim as seen along the blow direction.
      while (sparkAt < BLOW.sparkles && sparkAt / BLOW.sparkles <= k) {
        sparkAt++
        const a = Math.random() * Math.PI * 2
        const side = Math.cos(a) * d * 0.5
        const s = BLOW.sparkleSize
        particles.sparkle(centre.x + Math.cos(f) * side, centre.y + Math.sin(a) * d * 0.5, centre.z - Math.sin(f) * side, { count: 1, radius: 0.1, size: s[0] + Math.random() * (s[1] - s[0]), life: 0.8, up: 0.4 })
      }
      if (k >= 1) {
        done = true
        onDone?.(mesh)
      }
    },
    // Pops the bubble where it is (12 shards + sparkles) and ends the pose.
    stop() {
      if (mesh) particles.burst(mesh.position.x, mesh.position.y, mesh.position.z, { tint: mesh.userData.tint, diameter: mesh.scale.x })
      clear()
    },
    // Ends the inflate but keeps the mesh alive: the caller owns it now.
    release() {
      const m = mesh
      mesh = null
      clear()
      return m
    },
  }
  return api
}
