// Floating texts (SHARED_ASSETS §Floating text): "+450" with a lungs icon rising from a
// wall, "+N Breath" over a pad, "+1,250" with a trophy. Billboard sprites that rise and fade.
import { CanvasTexture, Group, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'
import { FONT_FAMILY } from '../config.js'
import { FX } from '../config/palette.js'

const STYLES = {
  breathGain: { color: FX.breathText, size: 1.2, icon: 'lungs', rise: 1.5, life: 1.2 },
  padGain: { color: FX.gainGreen, size: 0.8, icon: null, rise: 1.5, life: 1.0 },
  padFail: { color: FX.failRed, size: 0.8, icon: null, rise: 1.5, life: 1.0 },
  winsGain: { color: FX.trophy, size: 1.0, icon: 'trophy', rise: 1.2, life: 1.2 },
}

export function drawLungs(ctx, x, y, s) {
  // Two blue lobes with a pale windpipe, as the HUD icon.
  ctx.fillStyle = '#9fd0ff'
  ctx.fillRect(x - s * 0.06, y - s * 0.5, s * 0.12, s * 0.45)
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#5ab0ff'
    ctx.beginPath()
    ctx.ellipse(x + sx * s * 0.26, y + s * 0.05, s * 0.22, s * 0.4, sx * 0.25, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#bfe4ff'
    ctx.beginPath()
    ctx.ellipse(x + sx * s * 0.2, y - s * 0.1, s * 0.08, s * 0.16, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function drawTrophy(ctx, x, y, s) {
  ctx.fillStyle = FX.trophy
  ctx.strokeStyle = FX.trophyDark
  ctx.lineWidth = s * 0.05
  ctx.beginPath()
  ctx.moveTo(x - s * 0.25, y - s * 0.45)
  ctx.lineTo(x + s * 0.25, y - s * 0.45)
  ctx.quadraticCurveTo(x + s * 0.27, y, x, y + s * 0.05)
  ctx.quadraticCurveTo(x - s * 0.27, y, x - s * 0.25, y - s * 0.45)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillRect(x - s * 0.05, y + s * 0.05, s * 0.1, s * 0.14)
  ctx.fillRect(x - s * 0.2, y + s * 0.19, s * 0.4, s * 0.1)
}

function paint(style, text) {
  const S = STYLES[style]
  const px = 96
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  ctx.font = `700 ${px}px ${FONT_FAMILY}, "Arial Black", sans-serif`
  const tw = ctx.measureText(text).width
  const iconW = S.icon ? px * 1.1 : 0
  c.width = Math.ceil(tw + iconW + 40)
  c.height = px * 1.4
  ctx.font = `700 ${px}px ${FONT_FAMILY}, "Arial Black", sans-serif`
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  if (S.icon === 'lungs') drawLungs(ctx, 20 + px * 0.5, c.height / 2, px)
  if (S.icon === 'trophy') drawTrophy(ctx, 20 + px * 0.5, c.height / 2, px)
  ctx.lineWidth = px * 0.16
  ctx.strokeStyle = '#000000'
  ctx.strokeText(text, 20 + iconW, c.height / 2)
  ctx.fillStyle = S.color
  ctx.fillText(text, 20 + iconW, c.height / 2)
  return c
}

export class FloatingTexts {
  constructor(scene) {
    this.group = new Group()
    this.group.name = 'floatingTexts'
    scene.add(this.group)
    this.items = []
  }

  // Spawns `text` in `style` at (x, y, z); it rises STYLES[style].rise over its life and fades.
  spawn(style, text, x, y, z, { scale = 1 } = {}) {
    const S = STYLES[style]
    const canvas = paint(style, text)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false }))
    const h = S.size * scale
    sprite.scale.set((h * canvas.width) / canvas.height, h, 1)
    sprite.position.set(x, y, z)
    sprite.renderOrder = 30
    this.group.add(sprite)
    this.items.push({ sprite, t: 0, life: S.life, rise: S.rise, y0: y, sx: sprite.scale.x, sy: sprite.scale.y })
    return sprite
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]
      it.t += dt
      const k = it.t / it.life
      if (k >= 1) {
        this.group.remove(it.sprite)
        it.sprite.material.map.dispose()
        it.sprite.material.dispose()
        this.items.splice(i, 1)
        continue
      }
      it.sprite.position.y = it.y0 + it.rise * (1 - Math.pow(1 - k, 2))
      it.sprite.material.opacity = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.4 : 1
      it.sprite.scale.set(it.sx * pop, it.sy * pop, 1)
    }
  }
}
