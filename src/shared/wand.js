// The bubble wand (SHARED_ASSETS §Wand): a glossy ring on a short handle with a white
// end cap. Held in the right hand: `WandHolder` finds the arm nodes of whatever rig is
// loaded and places the wand at the hand each frame, handle continuing the forearm, so
// the GLB's twisted bone frames never matter.
import { CylinderGeometry, Group, Matrix4, Mesh, SphereGeometry, TorusGeometry, Vector3, Quaternion } from 'three'
import { WAND } from '../config/palette.js'
import { glossy } from './materials.js'

const LOOKS = {
  default: { ring: WAND.pink, handle: WAND.pink, cap: WAND.tip },
  plastic: { ring: '#f23c3c', handle: '#f23c3c', cap: '#ffffff' },
  flower: { ring: '#ff5fd0', handle: '#ffffff', cap: '#2fbf4f' },
  heart: { ring: '#ff3f9e', handle: '#ff7fc0', cap: '#ffffff' },
  star: { ring: '#ffb52a', handle: '#3a7bff', cap: '#ffb52a' },
  crystal: { ring: '#5ad0ff', handle: '#2f6cff', cap: '#ffffff' },
  golden: { ring: '#ffd23a', handle: '#ffb52a', cap: '#ffffff' },
  diamond: { ring: '#9fe0ff', handle: '#3aa0ff', cap: '#ffffff' },
  magic: { ring: '#ffd23a', handle: '#3a7bff', cap: '#ffffff' },
  galaxy: { ring: '#5a2fbf', handle: '#ffd23a', cap: '#ffd23a' },
  blackHole: { ring: '#2a1040', handle: '#111111', cap: '#8a3dff' },
}

export const WAND_SIZE = { ringRadius: 0.175, tube: 0.025, handle: 0.5, handleRadius: 0.03, cap: 0.04 }

// The wand's local frame: handle along -Y (cap at the bottom), ring at the top in the XY plane
// (its axis is +Z, i.e. the player blows through it along the wand's +Z).
export function createWand(wandId = 'default') {
  const look = LOOKS[wandId] || LOOKS.default
  const g = new Group()
  g.name = 'wand'
  const S = WAND_SIZE
  const ring = new Mesh(new TorusGeometry(S.ringRadius, S.tube, 12, 32), glossy(look.ring))
  ring.position.y = S.handle / 2 + S.ringRadius
  const handle = new Mesh(new CylinderGeometry(S.handleRadius, S.handleRadius, S.handle, 12), glossy(look.handle))
  const cap = new Mesh(new SphereGeometry(S.cap, 12, 8), glossy(look.cap))
  cap.position.y = -S.handle / 2
  for (const m of [ring, handle, cap]) m.castShadow = true
  g.add(ring, handle, cap)
  g.userData.ring = ring
  return g
}

// World position of the ring centre (where bubbles grow from).
export function wandRingWorld(wand, out = new Vector3()) {
  return wand.userData.ring.getWorldPosition(out)
}

const tmpA = new Vector3()
const tmpB = new Vector3()
const tmpF = new Vector3()
const tmpS = new Vector3()
const tmpU = new Vector3()
const tmpH = new Vector3()
const tmpA2 = new Vector3()
const tmpX = new Vector3()
const tmpQ = new Quaternion()
const tmpM = new Matrix4()

// The rig's 'L' arm is the one that appears on the viewer's left when the avatar faces the camera
// (the player's right hand, as in blow-zone-strip_03). The wand is held in it.
export const HAND = 'L'

// How the wand sits in the hand: lean toward the body's centre line (+X, the avatar's right is -X), tilt toward the face, and how far up the handle the hand grips (0 = at the cap).
const HOLD = { lean: 0.35, tilt: -0.15, grip: 0.55 }

// While blowing (`atMouth`) the ring sits in front of the mouth (blow-zone-strip.md §Animations,
// blow-zone-strip_03): this far up from the neck pivot and out along the facing, in avatar units;
// the handle then runs from the ring down to the hand. `side` shifts it toward the wand hand so
// the eyes stay visible above it.
const MOUTH = { up: -0.02, out: 0.3, side: 0.07 }
const RING_FROM_ORIGIN = WAND_SIZE.handle / 2 + WAND_SIZE.ringRadius

// `parent` is the group that places the avatar (main.js `playerGroup`): the wand is posed in its
// local frame, so the render-time X mirror on the scene (main.js) never reaches the maths.
export class WandHolder {
  constructor(parent, wandId = 'default') {
    this.parent = parent
    this.wand = createWand(wandId)
    this.wand.visible = false
    parent.add(this.wand)
    this.avatar = null
    this.upper = null
    this.lower = null
    this.handOffset = 2.4 // rig units below the lowest arm node
    this.hand = null
    this.neck = null
    this.atMouth = false // set by main.js while the `blow` pose plays
  }

  setAvatar(avatar) {
    this.avatar = avatar
    const nodes = avatar?.nodes || {}
    this.upper = nodes[`Arm${HAND}1`] || null
    this.lower = nodes[`Arm${HAND}2`] || null
    // player.glb: ArmR2 is the forearm pivot, the hand is ~1.2 rig units below it; the
    // procedural fallback has only ArmR1 with the hand 2.4 below.
    this.handOffset = this.lower ? 1.25 : 2.4
    // player.glb ends the forearm in a leaf bone at the hand: use it when there is one
    this.hand = nodes[`Arm${HAND}2_leaf`] || null
    this.neck = nodes.Neck1 || null
    this.wand.visible = !!this.upper
  }

  setWand(wandId) {
    const was = this.wand
    this.wand = createWand(wandId)
    this.wand.visible = was.visible
    this.parent.remove(was)
    this.parent.add(this.wand)
  }

  // The wand is posed relative to the avatar, not along the forearm: the handle leans up and
  // toward the body's centre line, the ring faces the way the avatar looks (blow-zone-strip_03),
  // so it stays right whatever the twisted GLB bone frames do. Only the hand position comes
  // from the rig.
  // Call after the animator has posed the rig and `parent.updateMatrixWorld(true)`.
  update() {
    if (!this.upper || !this.avatar) return
    const pivot = this.hand || this.lower || this.upper
    tmpB.set(0, this.hand ? 0 : -this.handOffset, 0)
    pivot.localToWorld(tmpB) // the hand, world
    this.parent.worldToLocal(tmpB) // ... in the parent's frame
    tmpQ.copy(this.avatar.quaternion) // the avatar's own lean inside the parent
    const forward = tmpF.set(0, 0, 1).applyQuaternion(tmpQ)
    const side = tmpS.set(1, 0, 0).applyQuaternion(tmpQ) // avatar's +X (its left)
    const up = tmpU.set(0, 1, 0).applyQuaternion(tmpQ)
    const h = HOLD
    let handle
    if (this.atMouth && this.neck) {
      // ring in front of the mouth, handle from the hand up to it
      const ring = tmpA.set(0, 0, 0)
      this.neck.localToWorld(ring)
      this.parent.worldToLocal(ring)
      ring.addScaledVector(up, MOUTH.up).addScaledVector(forward, MOUTH.out).addScaledVector(side, MOUTH.side)
      handle = tmpH.copy(ring).sub(tmpB).normalize()
      this.wand.position.copy(ring).addScaledVector(handle, -RING_FROM_ORIGIN)
    } else {
      // handle direction (cap -> ring): up, leaning toward the centre line and back toward the face
      handle = tmpH.copy(up).addScaledVector(side, h.lean).addScaledVector(forward, h.tilt).normalize()
      // the hand grips the handle a little above its cap
      this.wand.position.copy(tmpB).addScaledVector(handle, WAND_SIZE.handle * h.grip)
    }
    // ring axis: forward, made perpendicular to the handle
    const axis = tmpA2.copy(forward).addScaledVector(handle, -forward.dot(handle)).normalize()
    tmpX.crossVectors(handle, axis).normalize() // wand local X
    tmpM.makeBasis(tmpX, handle, axis)
    this.wand.quaternion.setFromRotationMatrix(tmpM)
  }
}
