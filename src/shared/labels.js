// World labels (SHARED_ASSETS §Floating text): multi-line billboard sprites in Fredoka bold
// with a black outline, one colour/size per line; and the black pill badges of the trainer
// gates. Painted on canvas once (repainted when Fredoka finishes loading).
import { CanvasTexture, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'
import { FONT_FAMILY } from '../config.js'
import { fontReady } from '../propkit.js'

const PX_PER_UNIT = 96 // canvas pixels per world unit of text height

// lines: [{ text, color = '#fff', size = 0.5 (units), outline = '#000', weight = 700 }]
// Returns { canvas, draw(), height } where height is the total text height in units.
export function paintLines(lines, { lineGap = 0.08, pad = 0.15 } = {}) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  let heightUnits = 0
  function draw() {
    const widths = []
    let total = pad * 2
    for (const l of lines) {
      const size = (l.size ?? 0.5) * PX_PER_UNIT
      ctx.font = `${l.weight ?? 700} ${size}px ${FONT_FAMILY}, "Arial Black", sans-serif`
      widths.push(ctx.measureText(l.text).width)
      total += size * 1.15 + lineGap * PX_PER_UNIT
    }
    const w = Math.ceil(Math.max(...widths) + pad * 2 * PX_PER_UNIT + 40)
    const h = Math.ceil(total)
    canvas.width = w
    canvas.height = h
    ctx.clearRect(0, 0, w, h)
    let y = pad * PX_PER_UNIT
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.lineJoin = 'round'
    for (const l of lines) {
      const size = (l.size ?? 0.5) * PX_PER_UNIT
      ctx.font = `${l.weight ?? 700} ${size}px ${FONT_FAMILY}, "Arial Black", sans-serif`
      ctx.lineWidth = size * 0.16
      ctx.strokeStyle = l.outline ?? '#000000'
      ctx.strokeText(l.text, w / 2, y)
      ctx.fillStyle = l.color ?? '#ffffff'
      ctx.fillText(l.text, w / 2, y)
      y += size * 1.15 + lineGap * PX_PER_UNIT
    }
    heightUnits = h / PX_PER_UNIT
  }
  draw()
  return { canvas, draw, get height() { return heightUnits } }
}

// A billboard sprite of `lines`, anchored at its bottom centre. `scaleUnits` = total height.
export function floatingLabel(lines, opts = {}) {
  const t = paintLines(lines, opts)
  const tex = new CanvasTexture(t.canvas)
  tex.colorSpace = SRGBColorSpace
  const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: opts.depthTest ?? true, fog: false }))
  sprite.name = 'label'
  sprite.center.set(0.5, 0)
  const fit = () => sprite.scale.set((t.height * t.canvas.width) / t.canvas.height, t.height, 1)
  fit()
  fontReady.then(() => {
    t.draw()
    tex.dispose()
    sprite.material.map = new CanvasTexture(t.canvas)
    sprite.material.map.colorSpace = SRGBColorSpace
    sprite.material.needsUpdate = true
    fit()
  })
  return sprite
}

// Trainer-gate badge: black pill with an icon + number, then a status line and a title.
// icon: 'rebirth' | 'robux'. status: 'UNLOCKED' | 'LOCKED'.
export function badgeLabel({ icon, value, status, title }) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const W = 640
  const H = 330
  function draw() {
    canvas.width = W
    canvas.height = H
    ctx.clearRect(0, 0, W, H)
    // pill
    const pw = 300
    const ph = 72
    const px = (W - pw) / 2
    const py = 10
    ctx.fillStyle = '#111111'
    ctx.beginPath()
    ctx.roundRect(px, py, pw, ph, 36)
    ctx.fill()
    // icon
    ctx.save()
    ctx.translate(px + 44, py + ph / 2)
    if (icon === 'robux') {
      ctx.fillStyle = '#d8dbe3'
      ctx.rotate(Math.PI / 4)
      ctx.fillRect(-18, -18, 36, 36)
      ctx.fillStyle = '#111111'
      ctx.fillRect(-9, -9, 18, 18)
    } else {
      ctx.strokeStyle = '#ff4f8f'
      ctx.lineWidth = 8
      ctx.beginPath()
      ctx.arc(0, 0, 18, 0.3, Math.PI * 1.6)
      ctx.stroke()
      ctx.strokeStyle = '#4ab0ff'
      ctx.beginPath()
      ctx.arc(0, 0, 18, Math.PI * 1.3, Math.PI * 2.5)
      ctx.stroke()
    }
    ctx.restore()
    ctx.font = `700 46px ${FONT_FAMILY}, "Arial Black", sans-serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(value), px + 90, py + ph / 2 + 2)
    // status
    ctx.textAlign = 'center'
    ctx.lineJoin = 'round'
    ctx.font = `700 40px ${FONT_FAMILY}, "Arial Black", sans-serif`
    ctx.lineWidth = 8
    ctx.strokeStyle = '#000000'
    ctx.strokeText(status, W / 2, 130)
    ctx.fillStyle = status === 'LOCKED' ? '#ff3b3b' : '#39e24a'
    ctx.fillText(status, W / 2, 130)
    // title
    ctx.font = `700 74px ${FONT_FAMILY}, "Arial Black", sans-serif`
    ctx.lineWidth = 12
    ctx.strokeText(title, W / 2, 230)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(title, W / 2, 230)
  }
  draw()
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }))
  sprite.name = 'badge'
  sprite.center.set(0.5, 0)
  const height = 1.7
  sprite.scale.set((height * W) / H, height, 1)
  fontReady.then(() => {
    draw()
    tex.needsUpdate = true
  })
  return sprite
}
