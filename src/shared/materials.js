// Shared "lego plastic" materials: every surface in the reference is a studded brick
// surface (SHARED_ASSETS §Common world materials). One canvas painter makes a colour
// map (optionally a 2-colour checker) and a matching normal map with round studs.
import { CanvasTexture, Color, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace, Vector2 } from 'three'

const cache = new Map()

// Paints one tile of `tile` world units at `px` pixels: checker of a/b (2 x 2 squares when
// `checker`), studs on a `studPitch` grid. Returns { map, normal } textures that repeat once
// per `tile` units, so world-space UVs are (x / tile, z / tile).
export function legoTexture(a, b = a, tile = 2, { px = 256, studPitch = 0.25, checker = false, studs = true, studStrength = 1 } = {}) {
  const key = `${a}|${b}|${tile}|${px}|${studPitch}|${checker}|${studs}|${studStrength}`
  if (cache.has(key)) return cache.get(key)
  const c = document.createElement('canvas')
  c.width = c.height = px
  const ctx = c.getContext('2d')
  ctx.fillStyle = a
  ctx.fillRect(0, 0, px, px)
  if (checker) {
    ctx.fillStyle = b
    ctx.fillRect(px / 2, 0, px / 2, px / 2)
    ctx.fillRect(0, px / 2, px / 2, px / 2)
  }
  // Studs: a faint lighter disc with a darker lower edge on the colour map; a bump on the normal.
  const n = Math.max(1, Math.round(tile / studPitch))
  const step = px / n
  const r = step * 0.32
  const col = new Color(a)
  const hi = `rgba(255,255,255,0.10)`
  const lo = `rgba(0,0,0,0.10)`
  if (studs) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const cx = (i + 0.5) * step
        const cy = (j + 0.5) * step
        ctx.fillStyle = lo
        ctx.beginPath()
        ctx.arc(cx, cy + r * 0.25, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = hi
        ctx.beginPath()
        ctx.arc(cx, cy - r * 0.15, r * 0.9, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
  // Seam lines between tiles (slightly darker), one per tile edge.
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = Math.max(1, px / 128)
  ctx.strokeRect(0.5, 0.5, px - 1, px - 1)
  if (checker) {
    ctx.beginPath()
    ctx.moveTo(px / 2, 0)
    ctx.lineTo(px / 2, px)
    ctx.moveTo(0, px / 2)
    ctx.lineTo(px, px / 2)
    ctx.stroke()
  }
  const map = new CanvasTexture(c)
  map.colorSpace = SRGBColorSpace
  map.wrapS = map.wrapT = RepeatWrapping
  map.anisotropy = 8

  // Normal map: flat (128,128,255) with a hemispherical bump per stud.
  const nc = document.createElement('canvas')
  nc.width = nc.height = px
  const nctx = nc.getContext('2d')
  nctx.fillStyle = 'rgb(128,128,255)'
  nctx.fillRect(0, 0, px, px)
  if (studs) {
    const img = nctx.getImageData(0, 0, px, px)
    const d = img.data
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const cx = (i + 0.5) * step
        const cy = (j + 0.5) * step
        const R = r
        for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
          for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
            const dx = (x - cx) / R
            const dy = (y - cy) / R
            const dd = dx * dx + dy * dy
            if (dd > 1 || x < 0 || y < 0 || x >= px || y >= px) continue
            const edge = Math.min(1, (1 - dd) * 4) // bevel at the rim, flat top
            const nx = -dx * (1 - edge) * studStrength
            const ny = dy * (1 - edge) * studStrength // canvas y is down
            const at = (y * px + x) * 4
            d[at] = 128 + nx * 127
            d[at + 1] = 128 + ny * 127
            d[at + 2] = 255
          }
        }
      }
    }
    nctx.putImageData(img, 0, 0)
  }
  const normal = new CanvasTexture(nc)
  normal.wrapS = normal.wrapT = RepeatWrapping
  normal.anisotropy = 8
  const out = { map, normal, tile, color: col }
  cache.set(key, out)
  return out
}

// A standard lego material: colour (+ optional checker partner), tile size in units.
export function legoMaterial(a, b = a, tile = 2, opts = {}) {
  const { roughness = 0.6, metalness = 0, normalScale = 0.6, ...texOpts } = opts
  const t = legoTexture(a, b, tile, { checker: b !== a, ...texOpts })
  return new MeshStandardMaterial({ map: t.map, normalMap: t.normal, normalScale: new Vector2(normalScale, normalScale), roughness, metalness })
}

// Plain plastic (no studs): props, eggs, pedestals.
export const plastic = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.5, metalness: 0, ...extra })
export const glossy = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: 0.25, metalness: 0, ...extra })

// Sets planar world-space UVs on a geometry (x/z over `tile`) so lego tiles line up across meshes.
export function worldUVs(geometry, tile = 2, axis = 'xz', offsetX = 0, offsetZ = 0) {
  const pos = geometry.attributes.position
  const uv = geometry.attributes.uv
  const ai = axis[0] === 'x' ? 0 : axis[0] === 'y' ? 1 : 2
  const bi = axis[1] === 'x' ? 0 : axis[1] === 'y' ? 1 : 2
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getComponent(i, ai) + offsetX) / tile, (pos.getComponent(i, bi) + offsetZ) / tile)
  }
  uv.needsUpdate = true
  return geometry
}
