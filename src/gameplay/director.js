// Scripted camera (blow-zone-strip.md §Scripted camera shots, bubble-ride-lane.md §Scripted
// camera shots). While a shot is playing it owns the logic camera instead of camera.js: fixed
// shots A and B around the player's feet, then the ride follow cam behind the bubble. Every
// position is in the logic frame; main.js mirrors the picture as usual.
import { Vector3 } from 'three'

const lerp = (a, b, t) => a + (b - a) * t
const ease = (t) => t * t * (3 - 2 * t)

export function createDirector() {
  const pos = new Vector3()
  const target = new Vector3()
  const fromPos = new Vector3()
  const fromTarget = new Vector3()
  const wantPos = new Vector3()
  const wantTarget = new Vector3()
  const lagged = new Vector3()
  let shot = null // { place(dt, outPos, outTarget), fov, lag }
  let blend = 0
  let blendTime = 0
  let fromFov = 70
  let fov = 70
  let shake = 0
  let shakeAmount = 0
  let fresh = true

  // Starts `next`; blends from the current view over `seconds` (0 = hard cut).
  function play(next, seconds = 0) {
    fromPos.copy(pos)
    fromTarget.copy(target)
    fromFov = fov
    blendTime = seconds
    blend = seconds > 0 && !fresh ? 0 : 1
    shot = next
    fresh = false
    lagged.set(NaN, 0, 0)
  }

  return {
    get active() {
      return !!shot
    },
    // A fixed shot around feet `P`: { pos, target, fov, dolly } offsets (BLOW.shotA / shotB).
    fixed(P, spec, seconds = 0) {
      let t = 0
      play(
        {
          fov: spec.fov,
          place(dt, outPos, outTarget) {
            t += dt
            outTarget.set(P.x + spec.target[0], P.y + spec.target[1], P.z + spec.target[2])
            outPos.set(P.x + spec.pos[0], P.y + spec.pos[1], P.z + spec.pos[2])
            if (spec.dolly) {
              // slow push toward the target
              const d = outTarget.clone().sub(outPos)
              const len = d.length()
              outPos.addScaledVector(d, Math.min(len * 0.5, spec.dolly * t) / len)
            }
          },
        },
        seconds,
      )
    },
    // The ride cam: `focus()` returns the bubble centre; position lags, the target does not.
    follow(focus, spec, seconds = 0) {
      play(
        {
          fov: spec.fov,
          lag: spec.lag,
          place(dt, outPos, outTarget) {
            const f = focus()
            outTarget.set(f.x + spec.target[0], f.y + spec.target[1], f.z + spec.target[2])
            outPos.set(f.x + spec.pos[0], f.y + spec.pos[1], f.z + spec.pos[2])
          },
        },
        seconds,
      )
    },
    shake(amount, seconds) {
      shakeAmount = amount
      shake = seconds
    },
    clear() {
      shot = null
      fresh = true
    },
    update(camera, dt) {
      if (!shot) return
      shot.place(dt, wantPos, wantTarget)
      if (shot.lag) {
        // Position follows with a time constant of `lag` seconds.
        if (Number.isNaN(lagged.x)) lagged.copy(wantPos)
        else lagged.lerp(wantPos, 1 - Math.exp(-dt / shot.lag))
        wantPos.copy(lagged)
      }
      if (blend < 1) {
        blend = Math.min(1, blend + dt / blendTime)
        const k = ease(blend)
        pos.lerpVectors(fromPos, wantPos, k)
        target.lerpVectors(fromTarget, wantTarget, k)
        fov = lerp(fromFov, shot.fov, k)
      } else {
        pos.copy(wantPos)
        target.copy(wantTarget)
        fov = shot.fov
      }
      camera.position.copy(pos)
      if (shake > 0) {
        shake -= dt
        camera.position.x += (Math.random() - 0.5) * 2 * shakeAmount
        camera.position.y += (Math.random() - 0.5) * 2 * shakeAmount
      }
      camera.lookAt(target)
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov
        camera.updateProjectionMatrix()
      }
    },
  }
}
