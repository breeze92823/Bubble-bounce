// The bubble: material (translucent physical + white Fresnel rim + one strong specular
// highlight) and the shape per bubble type (SHARED_ASSETS §Bubble). One factory for
// the shop items, the inflate bubble and the ride bubble: `createBubbleMesh(type, diameter)`.
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  OctahedronGeometry,
  RingGeometry,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  AdditiveBlending,
} from 'three'
import { BUBBLE as TINTS } from '../config/palette.js'
import { BUBBLES } from '../config/mechanics.js'
import { mulberry32 } from '../textures.js'

const RIM = { color: new Color(TINTS.rim), power: 2.5, strength: 0.8 }

// Translucent plastic-glass with a Fresnel rim injected into the standard fragment shader.
// Alpha-blended, no `transmission`: that renders the whole scene again every frame a bubble is on
// screen, which made the blow + ride lag (the bubble fills the view there).
export function createBubbleMaterial(tintHex, { opacity = 0.35, iridescence = 0.25, rimStrength = RIM.strength } = {}) {
  const m = new MeshPhysicalMaterial({
    color: tintHex,
    transparent: true,
    opacity,
    roughness: 0.05,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    iridescence,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [300, 600],
    side: DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.2,
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: RIM.color }
    shader.uniforms.uRimPower = { value: RIM.power }
    shader.uniforms.uRimStrength = { value: rimStrength }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor; uniform float uRimPower; uniform float uRimStrength;')
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        float fres = pow(1.0 - max(dot(normalize(vViewPosition), normalize(normal)), 0.0), uRimPower);
        gl_FragColor.rgb += uRimColor * fres * uRimStrength;
        gl_FragColor.a = max(gl_FragColor.a, min(1.0, fres * 0.9));`,
      )
  }
  m.customProgramCacheKey = () => 'bubble-rim'
  return m
}

// --- Shapes (unit size: fits in a 1 x 1 x 1 box, centred) --------------------------------
function lathe(profile, segments = 32) {
  return new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), segments)
}

function dropGeometry() {
  // Water drop: round bottom, pointed top.
  const pts = []
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const a = -Math.PI / 2 + t * Math.PI // bottom -> equator -> top
    const r = Math.cos(a) * 0.4
    const y = Math.sin(a) * 0.4
    pts.push([t < 0.5 ? r : r * (1 - (t - 0.5) * 1.2), y - 0.1])
  }
  pts.push([0.0, 0.5])
  return lathe(pts)
}

function balloonGeometry() {
  const pts = []
  for (let i = 0; i <= 18; i++) {
    const t = i / 18
    const a = -Math.PI / 2 + t * Math.PI
    const r = Math.cos(a) * 0.42 * (1 + 0.12 * Math.sin(a))
    pts.push([Math.max(0.0001, r), Math.sin(a) * 0.45 + 0.05])
  }
  pts.push([0.08, -0.42], [0.1, -0.5], [0, -0.5]) // knot
  return lathe(pts)
}

function starShape(outer = 0.5, inner = 0.23, round = 0.2) {
  // Rounded 4-point star (the reference "+75" bubble): tips and valleys are quadratic curves.
  const s = new Shape()
  const pts = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2
    const r = i % 2 === 0 ? outer : inner
    pts.push([Math.cos(a) * r, Math.sin(a) * r])
  }
  for (let i = 0; i < 8; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % 8]
    const [xp, yp] = pts[(i + 7) % 8]
    const ax = x0 + (xp - x0) * round
    const ay = y0 + (yp - y0) * round
    const bx = x0 + (x1 - x0) * round
    const by = y0 + (y1 - y0) * round
    if (i === 0) s.moveTo(ax, ay)
    else s.lineTo(ax, ay)
    s.quadraticCurveTo(x0, y0, bx, by)
  }
  s.closePath()
  return s
}

function starGeometry() {
  const g = new ExtrudeGeometry(starShape(), { depth: 0.22, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.1, bevelSegments: 6, curveSegments: 10 })
  g.translate(0, 0, -0.11)
  return g
}

function meteorGeometry() {
  const g = new IcosahedronGeometry(0.46, 2)
  const rand = mulberry32(99)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const k = 0.86 + rand() * 0.28
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k)
  }
  g.computeVertexNormals()
  return g
}

function swirlTexture(a = '#3b2a8f', b = '#7ad8ff') {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = a
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = b
  ctx.lineWidth = 10
  ctx.lineCap = 'round'
  for (let arm = 0; arm < 3; arm++) {
    ctx.beginPath()
    for (let t = 0; t < 1; t += 0.02) {
      const ang = arm * ((Math.PI * 2) / 3) + t * Math.PI * 2.2
      const r = 10 + t * 110
      const x = 128 + Math.cos(ang) * r
      const y = 128 + Math.sin(ang) * r * 0.6
      if (t === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

const geoCache = {}
const geo = (key, make) => geoCache[key] || (geoCache[key] = make())

// Builds the item for a bubble type id (BUBBLES in mechanics.js), `diameter` units across.
export function createBubbleMesh(typeId, diameter = 1) {
  const type = BUBBLES.find((b) => b.id === typeId) || BUBBLES[0]
  const tint = TINTS[type.tint] || TINTS.plain
  const group = new Group()
  group.name = 'bubble'
  group.userData.type = type
  let main
  switch (type.shape) {
    case 'drop':
      main = new Mesh(geo('drop', dropGeometry), createBubbleMaterial(tint, { opacity: 0.6 }))
      break
    case 'balloon':
      main = new Mesh(geo('balloon', balloonGeometry), createBubbleMaterial(tint, { opacity: 0.85, iridescence: 0 }))
      break
    case 'cubeGem':
      main = new Mesh(geo('cube', () => new BoxGeometry(0.72, 0.72, 0.72)), createBubbleMaterial(tint, { opacity: 0.6 }))
      main.rotation.set(0.4, 0.6, 0)
      break
    case 'gem':
      main = new Mesh(geo('gem', () => new OctahedronGeometry(0.5, 0).scale(0.8, 1, 0.8)), createBubbleMaterial(tint, { opacity: 0.6 }))
      break
    case 'star':
      main = new Mesh(geo('star', starGeometry), createBubbleMaterial(tint, { opacity: 0.42, iridescence: 0.1, rimStrength: 0.9 }))
      break
    case 'meteor':
      main = new Mesh(geo('meteor', meteorGeometry), createBubbleMaterial(tint, { opacity: 0.95, iridescence: 0, rimStrength: 0.3 }))
      main.material.roughness = 0.8
      main.material.clearcoat = 0
      break
    case 'planet': {
      main = new Mesh(geo('sphere', () => new SphereGeometry(0.45, 32, 24)), createBubbleMaterial(tint, { opacity: 0.8 }))
      const ring = new Mesh(geo('ring', () => new RingGeometry(0.6, 0.8, 48)), new MeshBasicMaterial({ color: '#f2e6ff', transparent: true, opacity: 0.7, side: DoubleSide, depthWrite: false }))
      ring.rotation.set(Math.PI / 2 - 0.45, 0, 0.2)
      group.add(ring)
      break
    }
    case 'blackHole': {
      main = new Mesh(geo('coreSphere', () => new SphereGeometry(0.22, 24, 16)), new MeshBasicMaterial({ color: '#120a24' }))
      const ring = new Mesh(geo('bhRing', () => new TorusGeometry(0.55, 0.06, 12, 48)), new MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }))
      ring.rotation.set(Math.PI / 2 - 0.5, 0, 0)
      group.add(ring)
      break
    }
    case 'galaxy': {
      const m = createBubbleMaterial(tint, { opacity: 0.9, iridescence: 0.4 })
      m.map = swirlTexture()
      main = new Mesh(geo('sphere', () => new SphereGeometry(0.45, 32, 24)), m)
      const ring = new Mesh(geo('galRing', () => new RingGeometry(0.62, 0.72, 48)), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, side: DoubleSide, depthWrite: false }))
      ring.rotation.set(Math.PI / 2 - 0.5, 0, 0.3)
      group.add(ring)
      break
    }
    default:
      main = new Mesh(geo('sphere', () => new SphereGeometry(0.45, 32, 24)), createBubbleMaterial(tint))
  }
  main.name = 'bubbleBody'
  main.castShadow = true
  main.renderOrder = 10
  group.add(main)
  group.scale.setScalar(diameter)
  return group
}

// Shop/pedestal items rotate and bob; the ride bubble wobbles. `t` = elapsed seconds.
export function animateBubbleItem(group, t, { spin = 0.3, bob = 0.1 } = {}) {
  group.rotation.y = t * spin * Math.PI * 2
  group.position.y = group.userData.baseY + Math.sin(t * Math.PI) * bob
}
