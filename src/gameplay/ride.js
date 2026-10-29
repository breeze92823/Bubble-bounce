// The Blow Zone run, start to finish (blow-zone-strip.md, bubble-ride-lane.md,
// burst-and-rewards.md):
//   blow   shots A then B while the equipped bubble inflates beside the avatar; it then slides
//          over the avatar (sized by Breath),
//   ride   the bubble bounces down the lane at RIDE.speed (+Breath on every landing, distance
//          counter) until the Breath-based distance is reached,
//   burst  pop, fade to black, the reward screen, back to the Blow Zone, trophy shower + Wins.
// While it runs it owns the avatar's placement (`avatar`, read by main.js) and the camera
// (director); the player's physics body waits in the Blow Zone, locked.
import { CircleGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { BLOW, REWARD, RIDE } from '../config/mechanics.js'
import { BLOW_RETURN, DISTANCE_METERS_PER_UNIT, HUB, LANE, SEGMENTS } from '../config/world.js'
import { resetPlayer } from '../player.js'
import { syncYawToPlayer } from '../camera.js'
import { abbreviate } from '../ui/format.js'
import { activeBoost, addBreath, addWins, advanceTutorial, emit, equippedBubble, multiplier, recordDistance, state, winsForRide } from '../state/game.js'

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
const GRAVITY = -30 // the avatar's drop after the burst

export function createRide({ scene, player, particles, floatingTexts, inflater, director, animator }) {
  // What main.js draws while `ownsAvatar`: feet position, yaw, scale, and the animator input.
  const avatar = { x: 0, y: 0, z: 0, facing: 0, scale: 1 }
  const anim = { grounded: true, speed: 0, verticalVelocity: 0, turn: 0 }

  const shadow = new Mesh(new CircleGeometry(1, 32), new MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.2, depthWrite: false }))
  shadow.rotation.x = -Math.PI / 2
  shadow.visible = false
  shadow.renderOrder = 1
  scene.add(shadow)

  const P = new Vector3() // the player's feet when BLOW was pressed
  const snapFrom = new Vector3()
  const centre = new Vector3()
  const chest = new Vector3()
  const focus = new Vector3() // what the ride cam follows; stays at the burst point after the pop
  let phase = 'idle' // idle | blow | ride | burst
  let owns = false
  let t = 0
  let mesh = null
  let bubble = null
  let d = 1
  let r = 0.5
  let rideX = 0
  let z0 = 0
  let endZ = 0
  let apex = 1
  let lastBounce = 0
  let squash = 0
  let trail = 0
  let shownMeters = -1
  let vy = 0
  let snapT = -1
  let snapYaw = 0 // the bubble faced the shot camera while inflating; it turns down the lane
  let reward = null // { meters, wins, shown, best, steps: Set }

  // The growing bubble sits on -X of the avatar: in front of it in shot B (the avatar faces the
  // pads), behind it in shot A. It starts at the wand ring's height (blow-zone-strip_02: it grows
  // out of the ring at the mouth) and rests on the ground once it is big.
  function anchor(rad, out, ring) {
    return out.set(P.x - BLOW.bubbleGap - rad, Math.max(ring.y, P.y + rad), ring.z)
  }

  function onInflated() {
    mesh = inflater.release()
    snapFrom.copy(mesh.position)
    snapYaw = mesh.rotation.y
    snapT = 0
    avatar.facing = 0 // down the lane
    animator()?.setOverride('ride')
  }

  function begin() {
    if (phase !== 'idle') return false
    if (inflater.active) inflater.stop() // a pad blow in progress
    bubble = equippedBubble()
    d = BLOW.diameter(state.breath)
    r = d / 2
    apex = Math.min(RIDE.maxApex, RIDE.apexFactor * d)
    P.set(player.position.x, player.position.y, player.position.z)
    rideX = clamp(P.x, -(LANE.halfWidth - r - 0.2), LANE.halfWidth - r - 0.2)
    const meters = RIDE.distanceMeters(state.breath)
    endZ = Math.min(LANE.start + meters / DISTANCE_METERS_PER_UNIT, LANE.end - r - 0.5)

    player.locked = true
    player.riding = true
    player.velocity.x = player.velocity.y = player.velocity.z = 0
    owns = true
    Object.assign(avatar, { x: P.x, y: P.y, z: P.z, facing: BLOW.shotA.facing, scale: 1 })
    anim.grounded = true
    anim.verticalVelocity = 0
    phase = 'blow'
    t = 0
    snapT = -1
    mesh = null
    emit('hudMode', 'cinematic')
    director.fixed(P, BLOW.shotA)
    inflater.start(bubble.id, d, onInflated, { duration: BLOW.inflateTime, anchor })
    return true
  }

  // --- blow ----------------------------------------------------------------------------------
  function updateBlow(dt) {
    if (t - dt < BLOW.shotA.duration && t >= BLOW.shotA.duration) {
      director.fixed(P, BLOW.shotB) // hard cut
      avatar.facing = BLOW.shotB.facing
    }
    if (snapT >= 0 && mesh) {
      snapT = Math.min(1, snapT + dt / BLOW.snapTime)
      const k = snapT * snapT * (3 - 2 * snapT)
      centre.set(rideX, r, P.z)
      mesh.position.lerpVectors(snapFrom, centre, k)
      mesh.rotation.y = snapYaw * (1 - k)
      fitAvatar(mesh.position, k)
    }
    if (snapT >= 1 && t >= BLOW.shotA.duration + BLOW.shotB.duration) startRide()
  }

  // The crouched avatar sits in the bubble's middle, shrunk to fit small bubbles.
  function fitAvatar(c, k = 1) {
    const s = Math.min(1, (d * RIDE.avatarFill) / player.dims.height)
    avatar.scale = 1 + (s - 1) * k
    avatar.x = P.x + (c.x - P.x) * k
    avatar.z = c.z
    avatar.y = P.y + (c.y - 0.55 * player.dims.height * avatar.scale - P.y) * k
  }

  // --- ride ----------------------------------------------------------------------------------
  function startRide() {
    phase = 'ride'
    z0 = P.z
    lastBounce = 0
    squash = 0
    trail = 0
    shownMeters = -1
    shadow.visible = true
    focus.copy(mesh.position)
    director.follow(() => focus, RIDE.camera, BLOW.rideBlend)
    emit('hudMode', 'ride')
    emit('bubbleBlown', { diameter: d, distanceMeters: (endZ - LANE.start) * DISTANCE_METERS_PER_UNIT, bubbleType: bubble.id })
  }

  // The lane lies below the hub: ground is the plaza (y 0) up to its edge, the lane floor past it;
  // the bubble drifts off the cliff and falls in an arc over CLIFF_FALL units.
  const CLIFF_FALL = 4
  const groundAt = (z) => (z < HUB.plaza.z1 ? 0 : LANE.floorY)
  function fallAt(z) {
    const k = clamp((z - HUB.plaza.z1) / CLIFF_FALL, 0, 1)
    return LANE.floorY * k * k * (3 - 2 * k)
  }

  function segmentAt(z) {
    return SEGMENTS.find((s) => z >= s.z0 && z < s.z1) || SEGMENTS[SEGMENTS.length - 1]
  }

  function onBounce(index, z) {
    const gain = bubble.breath * multiplier()
    addBreath(gain, 'bounce')
    const shown = activeBoost('breath2x') ? gain * 2 : gain
    const side = index % 2 ? 1 : -1
    floatingTexts.spawn('breathGain', `+${abbreviate(shown)}`, side * (LANE.halfWidth + 0.8), LANE.wallHeight + 0.6, z + 3)
    emit('bubbleBounce', { z, index, breathGain: shown })
    director.shake(RIDE.camera.shake, RIDE.camera.shakeTime)
    squash = RIDE.squash
    const dust = RIDE.dust[segmentAt(z).id]
    if (dust) particles.landDust(rideX, groundAt(z) + 0.05, z, dust)
  }

  function updateRide(dt) {
    let z = mesh.position.z + RIDE.speed * dt
    const finished = z >= endZ
    if (finished) z = endZ
    const s = z - z0
    const n = Math.floor(s / RIDE.bounceLength)
    const u = s / RIDE.bounceLength - n
    const h = 4 * apex * u * (1 - u)
    if (n > lastBounce) {
      lastBounce = n
      onBounce(n, z)
    }
    const base = fallAt(z)
    mesh.position.set(rideX, base + r + h, z)
    focus.copy(mesh.position)
    // squash and stretch on landing, a slight wobble always
    let sx = 1
    let sy = 1
    if (squash > 0) {
      squash = Math.max(0, squash - dt)
      const k = Math.sin(Math.PI * (1 - squash / RIDE.squash))
      sx = 1 + 0.15 * k
      sy = 1 - 0.2 * k
    }
    mesh.scale.set(d * sx, d * sy, d * sx)
    mesh.rotation.z = Math.sin(t * 5) * RIDE.wobble
    mesh.rotation.x = Math.sin(t * 3.7) * RIDE.wobble * 0.5
    fitAvatar(mesh.position)

    const lift = clamp(1 - h / (apex * 2), 0.4, 1)
    shadow.position.set(rideX, groundAt(z) + 0.03, z)
    shadow.scale.setScalar(r * 1.2 * lift)
    shadow.material.opacity = 0.2 * lift

    trail += dt
    if (trail > 0.08) {
      trail = 0
      const a = Math.random() * Math.PI * 2
      particles.sparkle(rideX + Math.cos(a) * r, base + r + h + Math.sin(a) * r, z - r * 0.5, { count: 1, radius: 0.1, size: 0.3 + Math.random() * 0.3, life: 0.7, up: 0.2 })
    }

    const meters = Math.max(0, Math.round((z - LANE.start) * DISTANCE_METERS_PER_UNIT))
    if (meters !== shownMeters) {
      shownMeters = meters
      emit('rideDistance', { meters })
    }
    if (finished) burst(meters)
  }

  // --- burst + reward ------------------------------------------------------------------------
  function burst(meters) {
    const c = mesh.position
    particles.burst(c.x, c.y, c.z, { tint: mesh.userData.tint, diameter: d })
    scene.remove(mesh)
    mesh.traverse((o) => o.material?.dispose?.())
    mesh = null
    shadow.visible = false
    animator()?.setOverride(null)
    avatar.scale = 1
    vy = 0
    phase = 'burst'
    t = 0
    const wins = winsForRide(meters)
    reward = { meters, wins, shown: activeBoost('wins2x') ? wins * 2 : wins, best: recordDistance(meters), steps: new Set() }
    emit('bubbleBurst', { distanceMeters: meters, z: c.z })
  }

  const once = (step) => !reward.steps.has(step) && reward.steps.add(step)

  function updateBurst(dt) {
    if (owns && avatar.y > LANE.floorY) {
      // the avatar drops to the lane and stays there
      vy += GRAVITY * dt
      avatar.y = Math.max(LANE.floorY, avatar.y + vy * dt)
      anim.grounded = avatar.y <= LANE.floorY
      anim.verticalVelocity = vy
    }
    if (t >= REWARD.fadeOut && once('fade')) {
      emit('screenFade', { on: true, time: REWARD.fadeTime })
      emit('hudMode', 'reward')
    }
    if (t >= REWARD.screen && once('screen')) emit('rewardScreen', { wins: reward.shown, meters: reward.meters, best: reward.best })
    if (t >= REWARD.teleport && once('teleport')) {
      emit('rewardScreen', null)
      director.clear()
      resetPlayer(BLOW_RETURN, 0)
      syncYawToPlayer()
      player.locked = false
      player.riding = false
      owns = false
      anim.grounded = true
      emit('screenFade', { on: false, time: REWARD.fadeIn })
      emit('hudMode', 'default')
    }
    if (t >= REWARD.shower && once('shower')) {
      // the next run may start before the last trophy lands: keep this one's numbers
      const n = REWARD.trophies
      const total = reward.wins
      const each = Math.floor(total / n)
      const shown = reward.shown
      const target = () => chest.set(player.renderPosition.x, player.renderPosition.y + player.dims.height * 0.6, player.renderPosition.z)
      particles.trophyShower(target, {
        count: n,
        onArrive(i) {
          const chunk = i === n - 1 ? total - each * (n - 1) : each
          if (chunk > 0) addWins(chunk, 'burst')
          particles.sparkle(chest.x, chest.y, chest.z, { count: 4, radius: 0.3, size: 0.4, life: 0.5, up: 0.5 })
        },
        onDone() {
          emit('winsAwarded', { wins: shown, multiplier: multiplier() })
          advanceTutorial('blow')
        },
      })
      phase = 'idle'
    }
  }

  return {
    avatar,
    anim,
    begin,
    get active() {
      return phase !== 'idle'
    },
    get ownsAvatar() {
      return owns
    },
    update(dt) {
      if (phase === 'idle') return
      t += dt
      if (phase === 'blow') updateBlow(dt)
      else if (phase === 'ride') updateRide(dt)
      else if (phase === 'burst') updateBurst(dt)
    },
  }
}
