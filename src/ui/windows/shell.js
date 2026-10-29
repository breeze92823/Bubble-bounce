// Window shell (Reference-Screenshots windows): one modal at a time over a blurred
// backdrop. A window is { title, icon, width, tabs?, render(arg) -> html, onAction(act, el) }.
// Bodies re-render from scratch on every state event while open, so render() must be pure.
import '../windows.css'
import { closeX } from '../art.js'
import { on } from '../../state/game.js'

const defs = new Map()
let layer = null
let current = null // { id, def, wrap, arg }

const RERENDER_ON = ['breathChanged', 'winsChanged', 'levelChanged', 'multiplierChanged', 'rebirth', 'bubbleEquipped', 'bubbleBought', 'wandEquipped', 'petHatched', 'petEquipped', 'boostsChanged', 'boostUsed', 'giftClaimed', 'dailyClaimed', 'spinClaimed', 'goalClaimed', 'reset']

export function defineWindow(id, def) {
  defs.set(id, def)
}

export const isOpen = (id) => (id ? current?.id === id : !!current)

export function openWindow(id, arg) {
  const def = defs.get(id)
  if (!def) return
  if (current) close(false)
  document.exitPointerLock?.()
  const wrap = document.createElement('div')
  wrap.className = `win-wrap win-${id} ${def.className || ''}`
  wrap.style.setProperty('--w', def.width || 900)
  wrap.innerHTML = `
    ${def.tabs ? '<div class="win-tabs"></div>' : ''}
    <div class="win-panel">
      <span class="win-icon emoji">${def.icon || ''}</span>
      <div class="win-title t"></div>
      <button class="win-close" data-act="close" aria-label="Close">${closeX()}</button>
      <div class="win-body"></div>
    </div>
    ${def.below ? '<div class="win-below"></div>' : ''}`
  layer.appendChild(wrap)
  current = { id, def, wrap, arg: arg ?? def.defaultArg }
  layer.classList.add('open')
  document.body.classList.add('window-open')
  def.onOpen?.(current.arg)
  render()
}

function close(hideLayer = true) {
  if (!current) return
  current.def.onClose?.()
  current.wrap.remove()
  current = null
  if (hideLayer) {
    layer.classList.remove('open')
    document.body.classList.remove('window-open')
  }
}
export const closeWindow = () => close(true)

// Switch tab / argument without rebuilding the frame (inventory tabs, index tabs).
export function setArg(arg) {
  if (!current) return
  current.arg = arg
  render()
}

export function render() {
  if (!current) return
  const { def, wrap, arg } = current
  const title = typeof def.title === 'function' ? def.title(arg) : def.title
  wrap.querySelector('.win-title').textContent = title
  const icon = typeof def.icon === 'function' ? def.icon(arg) : def.icon
  wrap.querySelector('.win-icon').innerHTML = icon || ''
  if (def.tabs) {
    wrap.querySelector('.win-tabs').innerHTML = def.tabs
      .map((t) => `<button class="win-tab ${t.id === arg ? 'on' : ''}" data-act="tab" data-id="${t.id}"><span class="ico">${t.icon}</span><span class="t">${t.label}</span></button>`)
      .join('')
  }
  const body = wrap.querySelector('.win-body')
  const scroll = body.querySelector('.scroll')
  const keep = scroll ? [scroll.scrollLeft, scroll.scrollTop] : null
  body.innerHTML = def.render(arg)
  if (def.below) wrap.querySelector('.win-below').innerHTML = def.below(arg)
  // Keep the scroll position across re-renders (wands strip, index grid).
  const next = body.querySelector('.scroll')
  if (keep && next) [next.scrollLeft, next.scrollTop] = keep
  def.afterRender?.(wrap, arg)
}

// --- toast -------------------------------------------------------------------------
let toastTimer = 0
export function toast(text) {
  const el = document.querySelector('.ui-toast')
  el.textContent = text
  el.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200)
}

// --- install -------------------------------------------------------------------------
export function installWindows() {
  layer = document.createElement('div')
  layer.className = 'win-layer'
  document.body.appendChild(layer)
  const t = document.createElement('div')
  t.className = 'ui-toast t'
  document.body.appendChild(t)

  layer.addEventListener('click', (e) => {
    if (!current) return
    if (e.target === layer) return closeWindow() // tap outside the window
    const el = e.target.closest('[data-act]')
    if (!el) return
    const act = el.dataset.act
    if (act === 'close') return closeWindow()
    if (act === 'tab') return setArg(el.dataset.id)
    current.def.onAction?.(act, el, current.arg)
  })
  // Keep taps on windows away from the camera and pointer lock.
  layer.addEventListener('pointerdown', (e) => e.stopPropagation())

  // Esc closes the window first (input.js opens the portal menu on Esc otherwise).
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.code === 'Escape' && current) {
        e.stopImmediatePropagation()
        e.preventDefault()
        closeWindow()
      }
    },
    { capture: true },
  )

  for (const name of RERENDER_ON) on(name, () => current && render())
  // Countdowns: windows with a tick() re-render once a second.
  setInterval(() => current?.def.tick && (current.def.tick(current.arg) ?? render()), 1000)

  const layout = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    const s = Math.min(1, Math.max(0.5, Math.min(Math.max(w, h) / 1920, Math.min(w, h) / 700), Math.min(w / 1100, h / 860)))
    layer.style.setProperty('--s', s.toFixed(3))
    layer.classList.toggle('portrait', h > w)
  }
  window.addEventListener('resize', layout)
  layout()
}
