// Pets (SHARED_ASSETS §Pet): 0.6 u rounded cube bodies with ears, big eyes and cheeks,
// following 1.2 u behind-right of the player with a short lag and a bob.
import { BoxGeometry, ConeGeometry, Group, Mesh, SphereGeometry, Vector3 } from 'three'
import { PET } from '../config/palette.js'
import { glossy, plastic } from './materials.js'

const LOOKS = {
  kitty: { body: PET.kitty, face: PET.kittyFace, ear: PET.kittyEar, ears: 'cat' },
  duck: { body: '#ffd23a', face: '#ffe88a', ear: '#ff8a2a', ears: 'none', beak: true },
  pink: { body: '#ff9fd6', face: '#ffd0ea', ear: '#ff5fb4', ears: 'round' },
  fox: { body: '#ff8a2a', face: '#ffe0b0', ear: '#ffffff', ears: 'cat' },
  pup: { body: '#3cd25a', face: '#d8ffd8', ear: '#2fa84a', ears: 'round' },
  dragon: { body: '#4aa0ff', face: '#9fd0ff', ear: '#2f6cff', ears: 'spikes', wings: true },
  king: { body: '#3f6cff', face: '#a8c4ff', ear: '#ffd23a', ears: 'spikes', wings: true },
  lion: { body: '#ffb02e', face: '#ffe0a0', ear: '#c46a10', ears: 'round' },
  starDragon: { body: '#3b2a8f', face: '#7ad8ff', ear: '#ffd23a', ears: 'spikes', wings: true },
}

export function createPet(look = 'kitty') {
  const L = LOOKS[look] || LOOKS.kitty
  const g = new Group()
  g.name = `pet:${look}`
  const body = new Mesh(new BoxGeometry(0.6, 0.55, 0.6), glossy(L.body))
  body.position.y = 0.3
  body.castShadow = true
  g.add(body)
  const face = new Mesh(new BoxGeometry(0.52, 0.3, 0.06), plastic(L.face))
  face.position.set(0, 0.26, 0.31)
  g.add(face)
  const eyeGeo = new SphereGeometry(0.06, 10, 8)
  for (const sx of [-1, 1]) {
    const eye = new Mesh(eyeGeo, plastic(PET.eye))
    eye.position.set(sx * 0.13, 0.36, 0.32)
    g.add(eye)
    const cheek = new Mesh(new SphereGeometry(0.04, 8, 6), plastic(PET.cheek))
    cheek.position.set(sx * 0.22, 0.24, 0.32)
    g.add(cheek)
  }
  if (L.ears === 'cat' || L.ears === 'spikes') {
    for (const sx of [-1, 1]) {
      const ear = new Mesh(new ConeGeometry(0.1, 0.2, 4), glossy(L.ear))
      ear.position.set(sx * 0.2, 0.65, 0)
      ear.rotation.y = Math.PI / 4
      g.add(ear)
    }
  } else if (L.ears === 'round') {
    for (const sx of [-1, 1]) {
      const ear = new Mesh(new SphereGeometry(0.1, 10, 8), glossy(L.ear))
      ear.position.set(sx * 0.22, 0.6, 0)
      g.add(ear)
    }
  }
  if (L.beak) {
    const beak = new Mesh(new ConeGeometry(0.08, 0.14, 4), glossy(L.ear))
    beak.rotation.x = Math.PI / 2
    beak.position.set(0, 0.26, 0.4)
    g.add(beak)
  }
  if (L.wings) {
    for (const sx of [-1, 1]) {
      const wing = new Mesh(new BoxGeometry(0.3, 0.2, 0.05), glossy(L.ear))
      wing.position.set(sx * 0.4, 0.45, -0.1)
      wing.rotation.z = sx * 0.6
      g.add(wing)
    }
  }
  return g
}

// Follows a target point (the player's feet) with a lag; slot 0..2 fans the pets out.
export class PetFollower {
  constructor(mesh, slot = 0) {
    this.mesh = mesh
    this.slot = slot
    this.pos = new Vector3()
    this.initialised = false
    this.t = 0
  }

  update(dt, playerPos, facing) {
    this.t += dt
    const side = this.slot === 0 ? 1 : this.slot === 1 ? -1 : 0
    const back = this.slot === 2 ? 1.8 : 1.2
    const fx = Math.sin(facing)
    const fz = Math.cos(facing)
    const rx = Math.cos(facing)
    const rz = -Math.sin(facing)
    const tx = playerPos.x - fx * back + rx * side * 0.9
    const tz = playerPos.z - fz * back + rz * side * 0.9
    if (!this.initialised) {
      this.pos.set(tx, playerPos.y, tz)
      this.initialised = true
    } else {
      const k = 1 - Math.exp(-6 * dt)
      this.pos.x += (tx - this.pos.x) * k
      this.pos.z += (tz - this.pos.z) * k
      this.pos.y += (playerPos.y - this.pos.y) * k
    }
    this.mesh.position.set(this.pos.x, this.pos.y + Math.abs(Math.sin(this.t * Math.PI * 2)) * 0.1, this.pos.z)
    this.mesh.rotation.y = facing
  }
}
