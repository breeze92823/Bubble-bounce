// Particle presets (SHARED_ASSETS §Particle presets). One pooled Points system per sprite
// kind (sparkle / dot / shard / dust), CPU-simulated; plus sprite-based trophies that fly to a
// target, bubble-material ambient bubbles and spinning orbit rings. Everything lives under
// one `fx` group. Budget: capacities below sum to ~6k points.
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, NormalBlending, Points, ShaderMaterial, Sprite, SpriteMaterial, SRGBColorSpace, TorusGeometry, Vector3 } from 'three'
import { FX } from '../config/palette.js'
import { paintSoftDot, paintSparkle, mulberry32 } from '../textures.js'
import { createBubbleMesh } from '../shared/bubble.js'
import { neon } from '../propkit.js'

const rand = mulberry32(31337)
const R = () => rand()

const vert = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (600.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`
const frag = /* glsl */ `
  uniform sampler2D uMap;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
    if (gl_FragColor.a < 0.01) discard;
  }`

class PointPool {
  constructor(parent, texture, capacity, additive) {
    this.capacity = capacity
    this.pos = new Float32Array(capacity * 3)
    this.size = new Float32Array(capacity)
    this.col = new Float32Array(capacity * 3)
    this.alpha = new Float32Array(capacity)
    this.p = []
    for (let i = 0; i < capacity; i++) this.p.push({ alive: false, life: 0, max: 1, v: new Vector3(), g: 0, drag: 0, s0: 1, s1: 1, c: new Color(), spin: 0 })
    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(this.pos, 3))
    geo.setAttribute('aSize', new BufferAttribute(this.size, 1))
    geo.setAttribute('aColor', new BufferAttribute(this.col, 3))
    geo.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1))
    const tex = new CanvasTexture(texture)
    tex.colorSpace = SRGBColorSpace
    const mat = new ShaderMaterial({
      uniforms: { uMap: { value: tex } },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
      fog: false,
    })
    this.points = new Points(geo, mat)
    this.points.frustumCulled = false
    this.points.renderOrder = 20
    parent.add(this.points)
    this.next = 0
    this.live = 0
  }

  emit(x, y, z, { vx = 0, vy = 0, vz = 0, life = 1, size = 0.5, sizeEnd = size, color = '#ffffff', gravity = 0, drag = 0 }) {
    const i = this.next
    this.next = (this.next + 1) % this.capacity
    const q = this.p[i]
    if (!q.alive) this.live++
    q.alive = true
    q.life = 0
    q.max = life
    q.v.set(vx, vy, vz)
    q.g = gravity
    q.drag = drag
    q.s0 = size
    q.s1 = sizeEnd
    q.c.set(color)
    this.pos[i * 3] = x
    this.pos[i * 3 + 1] = y
    this.pos[i * 3 + 2] = z
    this.col[i * 3] = q.c.r
    this.col[i * 3 + 1] = q.c.g
    this.col[i * 3 + 2] = q.c.b
    this.alpha[i] = 1
    this.size[i] = size
  }

  update(dt) {
    if (!this.live) return
    for (let i = 0; i < this.capacity; i++) {
      const q = this.p[i]
      if (!q.alive) continue
      q.life += dt
      if (q.life >= q.max) {
        q.alive = false
        this.live--
        this.alpha[i] = 0
        this.size[i] = 0
        continue
      }
      const t = q.life / q.max
      q.v.y += q.g * dt
      if (q.drag) q.v.multiplyScalar(Math.max(0, 1 - q.drag * dt))
      this.pos[i * 3] += q.v.x * dt
      this.pos[i * 3 + 1] += q.v.y * dt
      this.pos[i * 3 + 2] += q.v.z * dt
      // scale in fast, out slow; alpha fades over the last 40 %
      const sIn = Math.min(1, t * 6)
      this.size[i] = (q.s0 + (q.s1 - q.s0) * t) * sIn
      this.alpha[i] = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4
    }
    const g = this.points.geometry
    g.attributes.position.needsUpdate = true
    g.attributes.aSize.needsUpdate = true
    g.attributes.aColor.needsUpdate = true
    g.attributes.aAlpha.needsUpdate = true
  }
}

export class Particles {
  constructor(scene) {
    this.group = new Group()
    this.group.name = 'fx'
    scene.add(this.group)
    this.sparkles = new PointPool(this.group, paintSparkle(), 2000, true)
    this.dots = new PointPool(this.group, paintSoftDot(), 2000, true)
    this.dust = new PointPool(this.group, paintSoftDot(), 600, false)
    this.sprites = [] // flying trophies: { sprite, from, to, t, dur, delay, onArrive }
    this.rings = [] // orbit rings: { mesh, speed }
    this.bubbles = [] // ambient bubbles: { mesh, life, max, vy, sway, x0 }
    this.spawners = [] // ambient bubble spawners: { x, y, z, radius, rate, acc }
    this.trophyTex = null
  }

  // --- presets ---------------------------------------------------------------------------
  sparkle(x, y, z, { count = 12, radius = 0.6, size = 0.6, color = FX.sparkle, life = 0.8, up = 0.3 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = R() * Math.PI * 2
      const r = radius * Math.sqrt(R())
      this.sparkles.emit(x + Math.cos(a) * r, y + (R() - 0.5) * radius, z + Math.sin(a) * r, {
        vx: (R() - 0.5) * 0.4,
        vy: up + R() * 0.3,
        vz: (R() - 0.5) * 0.4,
        life: life * (0.7 + R() * 0.6),
        size: size * (0.6 + R() * 0.8),
        sizeEnd: size * 0.3,
        color,
      })
    }
  }

  pedestalSparkle(x, y, z, count = 8) {
    this.sparkle(x, y, z, { count, radius: 1.0, size: 0.3, color: FX.pedestalSparkle, life: 1.2, up: 0.5 })
  }

  laneSparkle(x, y, z, hx, hz, count = 60) {
    for (let i = 0; i < count; i++) {
      this.dots.emit(x + (R() - 0.5) * 2 * hx, y + R() * 0.3, z + (R() - 0.5) * 2 * hz, {
        vx: (R() - 0.5) * 0.2,
        vy: 0.05 + R() * 0.1,
        vz: (R() - 0.5) * 0.2,
        life: 3,
        size: 0.15,
        color: R() < 0.5 ? '#4affd9' : '#ffe23a',
      })
    }
  }

  burst(x, y, z, { tint = '#ffffff', diameter = 3 } = {}) {
    // Shards (bubble-tinted soft dots) fly out with gravity; sparkles on top; a ring flash.
    for (let i = 0; i < 16; i++) {
      const a = R() * Math.PI * 2
      const e = (R() - 0.3) * Math.PI
      const sp = 4 + R() * 4
      this.dust.emit(x, y, z, {
        vx: Math.cos(a) * Math.cos(e) * sp,
        vy: Math.sin(e) * sp + 2,
        vz: Math.sin(a) * Math.cos(e) * sp,
        life: 0.6,
        size: 0.3 + R() * 0.3,
        sizeEnd: 0.1,
        color: tint,
        gravity: -9,
      })
    }
    this.sparkle(x, y, z, { count: 20, radius: diameter * 0.5, size: 0.7, life: 0.7, up: 1 })
    this.glowRing(x, y, z, diameter * 0.6, diameter, '#ffffff', 0.25)
  }

  glowRing(x, y, z, r0, r1, color = '#ffffff', life = 0.25) {
    // An unlit ring that scales up and fades.
    const mesh = new Mesh(new TorusGeometry(1, 0.06, 8, 48), new MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }))
    mesh.position.set(x, y, z)
    mesh.rotation.x = Math.PI / 2
    mesh.scale.setScalar(r0)
    this.group.add(mesh)
    this.rings.push({ mesh, flash: { t: 0, life, r0, r1 } })
  }

  // Fountain spray: a few white dots up and out, falling back.
  spray(x, y, z) {
    for (let i = 0; i < 6; i++) {
      const a = R() * Math.PI * 2
      this.dots.emit(x, y, z, { vx: Math.cos(a) * 0.6, vy: 2.2 + R() * 0.8, vz: Math.sin(a) * 0.6, life: 0.9, size: 0.18, sizeEnd: 0.1, color: '#ffffff', gravity: -5 })
    }
  }

  landDust(x, y, z, color = '#e8d593') {
    for (let i = 0; i < 8; i++) {
      const a = R() * Math.PI * 2
      this.dust.emit(x, y + 0.1, z, { vx: Math.cos(a) * 2, vy: 0.8, vz: Math.sin(a) * 2, life: 0.5, size: 0.4, sizeEnd: 0.9, color, drag: 2 })
    }
  }

  // 12 trophies flying from a cloud to a target point, staggered; onArrive(i) per trophy.
  trophyShower(targetFn, { count = 12, from = null, onArrive = null, onDone = null } = {}) {
    const tex = this.trophyTexture()
    const t0 = targetFn()
    let left = count
    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }))
      sprite.scale.setScalar(0.8)
      const start = from ? from.clone() : new Vector3(t0.x - 2 - R() * 5, 1 + R() * 3, t0.z + 3 + R() * 5)
      sprite.position.copy(start)
      this.group.add(sprite)
      this.sprites.push({
        sprite,
        from: start,
        t: 0,
        dur: 0.6 + R() * 0.4,
        delay: i * 0.06,
        targetFn,
        onArrive: () => {
          onArrive?.(i)
          if (--left === 0) onDone?.()
        },
      })
    }
  }

  trophyTexture() {
    if (this.trophyTex) return this.trophyTex
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const ctx = c.getContext('2d')
    ctx.fillStyle = FX.trophy
    ctx.strokeStyle = FX.trophyDark
    ctx.lineWidth = 6
    // cup
    ctx.beginPath()
    ctx.moveTo(34, 24)
    ctx.lineTo(94, 24)
    ctx.quadraticCurveTo(96, 80, 64, 84)
    ctx.quadraticCurveTo(32, 80, 34, 24)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    // handles
    ctx.beginPath()
    ctx.arc(30, 44, 14, Math.PI * 0.5, Math.PI * 1.5)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(98, 44, 14, -Math.PI * 0.5, Math.PI * 0.5)
    ctx.stroke()
    // stem + base
    ctx.fillRect(58, 84, 12, 14)
    ctx.fillRect(42, 98, 44, 12)
    ctx.strokeRect(42, 98, 44, 12)
    // star
    ctx.fillStyle = '#fff6b0'
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 6 : 13
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2
      ctx.lineTo(64 + Math.cos(a) * r, 52 + Math.sin(a) * r)
    }
    ctx.closePath()
    ctx.fill()
    this.trophyTex = new CanvasTexture(c)
    this.trophyTex.colorSpace = SRGBColorSpace
    return this.trophyTex
  }

  // Two unlit yellow tori spinning around a pedestal item.
  orbitRing(parent, radius = 1.1, color = FX.orbitRing) {
    const g = new Group()
    for (const tilt of [0.5, -0.5]) {
      const m = new Mesh(new TorusGeometry(radius, 0.05, 8, 64), neon(color, 2.2))
      m.rotation.set(Math.PI / 2 + tilt, 0, 0)
      g.add(m)
    }
    parent.add(g)
    this.rings.push({ mesh: g, speed: 0.25 })
    return g
  }

  // Sparse ambient bubbles rising from an area (SHARED_ASSETS `ambientBubble`).
  ambientSpawner(x, y, z, radius = 3, rate = 0.5) {
    this.spawners.push({ x, y, z, radius, rate, acc: 0 })
  }

  // --- per frame --------------------------------------------------------------------------
  update(dt, elapsed) {
    this.sparkles.update(dt)
    this.dots.update(dt)
    this.dust.update(dt)
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const s = this.sprites[i]
      s.t += dt
      const k = Math.max(0, s.t - s.delay) / s.dur
      const to = s.targetFn()
      const e = k * k // ease-in
      s.sprite.position.lerpVectors(s.from, to, Math.min(1, e))
      s.sprite.position.y += Math.sin(Math.min(1, e) * Math.PI) * 0.6
      if (k >= 1) {
        this.group.remove(s.sprite)
        this.sprites.splice(i, 1)
        this.sparkle(to.x, to.y, to.z, { count: 6, radius: 0.4, size: 0.4, life: 0.5 })
        s.onArrive()
      }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]
      if (r.flash) {
        r.flash.t += dt
        const k = r.flash.t / r.flash.life
        if (k >= 1) {
          this.group.remove(r.mesh)
          this.rings.splice(i, 1)
          continue
        }
        r.mesh.scale.setScalar(r.flash.r0 + (r.flash.r1 - r.flash.r0) * k)
        r.mesh.material.opacity = 0.9 * (1 - k)
      } else {
        r.mesh.rotation.y += r.speed * Math.PI * 2 * dt
      }
    }
    for (const sp of this.spawners) {
      sp.acc += dt * sp.rate
      while (sp.acc >= 1 && this.bubbles.length < 60) {
        sp.acc -= 1
        const a = R() * Math.PI * 2
        const r = sp.radius * Math.sqrt(R())
        const mesh = createBubbleMesh('plain', 0.35 + R() * 0.5)
        mesh.position.set(sp.x + Math.cos(a) * r, sp.y + R() * 1.5, sp.z + Math.sin(a) * r)
        this.group.add(mesh)
        this.bubbles.push({ mesh, life: 0, max: 6 + R() * 3, vy: 0.25 + R() * 0.15, sway: R() * Math.PI * 2, x0: mesh.position.x })
      }
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]
      b.life += dt
      if (b.life >= b.max) {
        this.group.remove(b.mesh)
        this.bubbles.splice(i, 1)
        this.sparkle(b.mesh.position.x, b.mesh.position.y, b.mesh.position.z, { count: 4, radius: 0.3, size: 0.3, life: 0.4 })
        continue
      }
      b.mesh.position.y += b.vy * dt
      b.mesh.position.x = b.x0 + Math.sin(elapsed * 1.3 + b.sway) * 0.3
    }
  }

  get liveCount() {
    return this.sparkles.live + this.dots.live + this.dust.live + this.sprites.length + this.bubbles.length
  }
}
