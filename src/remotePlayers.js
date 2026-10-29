// Other players in the room: the server relays each client's pose (~NET.poseEvery s) and this
// draws them with the same avatar, animator and bubble as the local player. Positions are
// smoothed toward the latest pose; a player not heard from for NET.remoteTimeout s is dropped.
import { Group } from 'three'
import { NET } from './config.js'
import { BUBBLE as TINTS } from './config/palette.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { createBubbleMesh } from './shared/bubble.js'

const SMOOTH = 14 // 1/s: how fast a remote avatar closes on its latest pose
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

function disposeBubble(scene, mesh) {
  scene.remove(mesh)
  mesh.traverse((o) => o.material?.dispose?.())
}

export function createRemotePlayers({ scene, particles }) {
  const players = new Map() // session id -> remote

  function setAvatar(r, next) {
    if (r.avatar) r.group.remove(r.avatar)
    disposeAnimator(r.animator)
    r.avatar = next
    r.group.add(next)
    r.animator = makeAnimator(next)
    r.animator?.setOverride(r.pose?.o || null)
  }

  function spawn(id) {
    const group = new Group()
    scene.add(group)
    const r = { id, group, avatar: null, animator: null, bubble: null, bubbleType: '', pose: null, seen: 0, gone: false }
    setAvatar(r, buildDefaultCharacter()) // visible at once; swapped for the real rig when it loads
    loadBaseCharacter().then((rig) => !r.gone && setAvatar(r, rig))
    players.set(id, r)
    return r
  }

  function popBubble(r) {
    if (!r.bubble) return
    const m = r.bubble
    const tint = TINTS[m.userData.type?.tint] || TINTS.plain
    particles.burst(m.position.x, m.position.y, m.position.z, { tint, diameter: m.scale.x })
    disposeBubble(scene, m)
    r.bubble = null
    r.bubbleType = ''
  }

  function remove(id) {
    const r = players.get(id)
    if (!r) return
    r.gone = true
    if (r.bubble) disposeBubble(scene, r.bubble)
    disposeAnimator(r.animator)
    scene.remove(r.group)
    players.delete(id)
  }

  return {
    // msg: { id, name, x, y, z, f, sp, g, vy, o, s, b }
    pose(msg) {
      if (!msg?.id) return
      const r = players.get(msg.id) ?? spawn(msg.id)
      const first = !r.pose
      r.pose = msg
      r.seen = 0
      r.animator?.setOverride(msg.o || null)
      if (first) {
        r.group.position.set(msg.x, msg.y, msg.z)
        r.group.rotation.y = msg.f
      }
      const b = msg.b
      if (!b) return popBubble(r)
      if (r.bubbleType !== b.t) {
        if (r.bubble) disposeBubble(scene, r.bubble)
        r.bubble = createBubbleMesh(b.t, 1)
        r.bubbleType = b.t
        scene.add(r.bubble)
        r.bubble.position.set(b.x, b.y, b.z)
      }
    },
    remove,
    clear() {
      for (const id of [...players.keys()]) remove(id)
    },
    update(dt) {
      const k = 1 - Math.exp(-SMOOTH * dt)
      for (const r of [...players.values()]) {
        r.seen += dt
        if (r.seen > NET.remoteTimeout) {
          remove(r.id)
          continue
        }
        const p = r.pose
        const g = r.group
        g.position.x += (p.x - g.position.x) * k
        g.position.y += (p.y - g.position.y) * k
        g.position.z += (p.z - g.position.z) * k
        g.rotation.y += angleTo(g.rotation.y, p.f) * k
        g.scale.setScalar(p.s || 1)
        r.animator?.update(dt, { grounded: p.g, speed: p.sp, verticalVelocity: p.vy, turn: 0 })
        if (r.bubble && p.b) {
          const m = r.bubble
          m.position.x += (p.b.x - m.position.x) * k
          m.position.y += (p.b.y - m.position.y) * k
          m.position.z += (p.b.z - m.position.z) * k
          m.scale.set(p.b.sx, p.b.sy, p.b.sx)
          m.rotation.y = p.b.ry
        }
      }
    },
  }
}
