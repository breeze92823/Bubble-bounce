// Main HUD (Reference-Screenshots ui-overlay): DOM overlay over the canvas, fed by the
// state events in state/game.js. Buttons do not open anything themselves; they emit
// `hudAction` { id } for the windows to pick up.
import './hud.css'
import { GIFTS } from '../config/mechanics.js'
import * as bloxity from '../bloxity.js'
import { canRebirth, currentGoal, emit, giftUnlockedAt, multiplier, on, rebirthLevel, spinWaitMs, state, tutorialStep, xpForLevel } from '../state/game.js'
import { abbreviate, commas } from './format.js'
export { abbreviate }

// Reference frame the sizes in hud.css are measured in, and the heights each column needs.
const REF = { w: 1920, h: 991, minSide: 700 }
const LEFT_H = 496 + 200 // goal + 3 rows, plus the stats block under it
const RIGHT_H = 200 + 82 + 70 // offset from the top, the column, the event line
const LEFT_H_SHORT = 354 // the 3 rows alone
const RIGHT_H_SHORT = 80 + 82 + 50 // under the top icons, the spin button, the event line
const MIN_SCALE = 0.3
const SHORT_SCALE = 0.4 // 110 px tiles stay >= 44 px tap targets


function clock(ms) {
  const s = Math.ceil(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

const TEMPLATE = `
  <div class="hud-topright">
    <button class="hud-round" data-action="daily"><span class="emoji">📅</span></button>
  </div>

  <div class="hud-left">
    <button class="hud-goal" data-action="goal">
      <span class="t head">GOAL</span>
      <span class="egg"></span>
      <span class="t count" data-ref="goal">0/1</span>
    </button>
    <div class="hud-grid">
      <button class="hud-tile rebirth" data-action="rebirth">
        <span class="t pct" data-ref="rebirthPct">0%</span>
        <span class="emoji">🔄</span><span class="t lbl">Rebirth</span>
      </button>
      <button class="hud-tile pets" data-action="pets"><span class="emoji">🐶</span><span class="t lbl">Pets</span></button>
      <button class="hud-tile wands" data-action="wands"><span class="emoji">🪄</span><span class="t lbl">Wands</span></button>
      <button class="hud-tile inventory" data-action="inventory"><span class="emoji">🎒</span><span class="t lbl small">Inventory</span></button>
      <button class="hud-tile gifts" data-action="gifts">
        <span class="alert t thin" data-ref="giftAlert" hidden>!</span>
        <span class="emoji">🎁</span><span class="t lbl">Gifts</span>
      </button>
    </div>
  </div>

  <div class="hud-stats">
    <div class="row rebirths"><span class="emoji">🔴</span><span class="t" data-ref="rebirths">0</span></div>
    <div class="row wins"><span class="emoji">🏆</span><span class="t" data-ref="wins">0</span></div>
    <div class="row friend">
      <span class="t">Friend Boost <span data-ref="friend">+0%</span></span>
    </div>
  </div>

  <div class="hud-center">
    <div class="top">
      <span class="breath"><span class="emoji">🫁</span><span class="t" data-ref="breath">0 BREATH</span></span>
      <span class="t mult" data-ref="mult">x1 Multiplier</span>
    </div>
    <div class="hud-level">
      <div class="fill" data-ref="xpFill"></div>
      <span class="t lvl" data-ref="level">Level 1</span>
      <span class="t thin xp" data-ref="xp">0 / 0</span>
    </div>
  </div>

  <div class="hud-right">
    <button class="hud-spin" data-action="spin" data-ref="spin">
      <span class="wheel"></span>
      <span class="col"><span class="t title">SPIN</span><span class="t thin time" data-ref="spinTime">READY</span></span>
    </button>
  </div>


  <div class="t thin hud-objective" data-ref="objective" hidden></div>
  <div class="t hud-distance" data-ref="distance">0m</div>
  <button class="hud-blow" data-action="blow" data-ref="blow" hidden>
    <span class="t big">BLOW</span>
    <span class="t thin sub">Bounce as far as you can!</span>
  </button>
`

// Full-screen black fade and the Wins card after a burst (burst-and-rewards_02).
const REWARD_TEMPLATE = `
  <div class="reward-card" data-ref="card" hidden>
    <div class="row"><span class="emoji trophy">🏆</span><span class="t amount" data-ref="amount">+0</span></div>
    <div class="t thin meters" data-ref="meters">0m</div>
    <div class="t best" data-ref="best" hidden>NEW BEST!</div>
  </div>
`

export function installHud() {
  const root = document.createElement('div')
  root.className = 'hud'
  root.innerHTML = TEMPLATE
  document.body.appendChild(root)

  const ref = {}
  for (const el of root.querySelectorAll('[data-ref]')) ref[el.dataset.ref] = el

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]')
    if (!btn) return
    e.stopPropagation()
    if (btn.dataset.action === 'blow') return emit('uiBlow')
    emit('hudAction', { id: btn.dataset.action, index: btn.dataset.index != null ? +btn.dataset.index : undefined })
  })
  // Taps on the HUD must not grab the pointer lock or start a camera drag.
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) e.stopPropagation()
  })

  // --- values -------------------------------------------------------------------
  const set = (el, text) => {
    if (el.textContent !== text) el.textContent = text
  }
  function renderBreath() {
    set(ref.breath, `${abbreviate(state.breath)} BREATH`)
  }
  function renderWins() {
    set(ref.wins, commas(state.wins))
  }
  function renderLevel() {
    const need = xpForLevel()
    set(ref.level, `Level ${state.level}`)
    set(ref.xp, `${commas(state.xp)} / ${commas(need)}`)
    ref.xpFill.style.width = `${Math.min(100, (state.xp / need) * 100)}%`
    const pct = canRebirth() ? 100 : Math.floor((state.level / rebirthLevel()) * 100)
    set(ref.rebirthPct, `${pct}%`)
  }
  function renderMultiplier() {
    set(ref.mult, `x${+multiplier().toFixed(1)} Multiplier`)
  }
  function renderRebirths() {
    set(ref.rebirths, commas(state.rebirths))
    const g = currentGoal()
    set(ref.goal, g ? `${Math.min(state.rebirths, g.rebirths)}/${g.rebirths}` : 'DONE')
  }
  function renderTimers() {
    const wait = spinWaitMs()
    set(ref.spinTime, wait > 0 ? clock(wait) : 'READY')
    ref.spin.classList.toggle('ready', wait <= 0)

    const play = state.gifts.playtimeMs
    ref.giftAlert.hidden = !GIFTS.slots.some((_, i) => !state.gifts.claimed.includes(i) && play >= giftUnlockedAt(i))
  }
  function renderAll() {
    renderBreath()
    renderWins()
    renderLevel()
    renderMultiplier()
    renderRebirths()
    renderTimers()
  }

  on('breathChanged', renderBreath)
  on('winsChanged', renderWins)
  on('levelChanged', renderLevel)
  on('multiplierChanged', renderMultiplier)
  on('rebirth', () => {
    renderRebirths()
    renderLevel()
  })
  on('goalClaimed', renderRebirths)
  on('boostUsed', renderTimers)
  on('reset', renderAll)
  renderAll()
  setInterval(renderTimers, 1000)

  // --- blow / ride / reward states (UI_SPEC §HUD states) --------------------------------
  // hudMode: 'default' | 'cinematic' (shots A/B: nothing) | 'ride' (bar, stats, distance) |
  // 'reward' (black screen). The touch controls hide outside 'default' too (body class).
  const MODES = ['cinematic', 'ride', 'reward']
  on('hudMode', (mode) => {
    for (const m of MODES) root.classList.toggle(`mode-${m}`, m === mode)
    document.body.classList.toggle('scripted', mode !== 'default')
    if (mode === 'ride') set(ref.distance, '0m')
  })
  on('rideDistance', ({ meters }) => set(ref.distance, `${commas(meters)}m`))
  on('padEntered', ({ zone }) => {
    if (zone === 'blow-zone-strip') ref.blow.hidden = false
  })
  on('padLeft', ({ zone }) => {
    if (zone === 'blow-zone-strip') ref.blow.hidden = true
  })
  function renderObjective() {
    const step = tutorialStep()
    ref.objective.hidden = !step
    if (step) set(ref.objective, step.text)
  }
  on('tutorialChanged', renderObjective)
  on('reset', renderObjective)
  renderObjective()

  const layer = document.createElement('div')
  layer.className = 'reward-layer'
  layer.innerHTML = REWARD_TEMPLATE
  document.body.appendChild(layer)
  for (const el of layer.querySelectorAll('[data-ref]')) ref[el.dataset.ref] = el
  on('screenFade', ({ on: dark, time }) => {
    layer.style.transitionDuration = `${time}s`
    layer.classList.toggle('dark', dark)
  })
  on('rewardScreen', (r) => {
    ref.card.hidden = !r
    if (!r) return
    set(ref.amount, `+${commas(r.wins)}`)
    set(ref.meters, `${commas(r.meters)}m`)
    ref.best.hidden = !r.best
    ref.card.classList.remove('pop')
    void ref.card.offsetWidth // restart the pop-in
    ref.card.classList.add('pop')
  })

  // --- layout ---------------------------------------------------------------------
  // One scale for the whole HUD: the reference size on desktop, shrunk until both side
  // columns fit between Boxity's reserved corner and the touch controls.
  let reserved = []
  function layout() {
    const w = window.innerWidth
    const h = window.innerHeight
    const portrait = h > w
    root.classList.toggle('portrait', portrait)

    let resTop = 0
    let resLeft = 0
    for (const a of reserved) {
      if (a.top === 0 && a.width >= w * 0.6) resTop = Math.max(resTop, a.height) // the toolbar row alone
      if (a.left < 240) resLeft = Math.max(resLeft, a.top + a.height)
    }

    // Touch controls, when shown, own the top-right buttons and the bottom-right thumb arc.
    let rightTop = 0
    let rightBottom = 0
    let rightIcons = 0
    const touchTop = document.querySelector('.touch-top')?.getBoundingClientRect()
    const cluster = document.querySelector('.touch-cluster')?.getBoundingClientRect()
    if (touchTop?.width) {
      rightIcons = touchTop.width + 10
      rightTop = touchTop.bottom
    }
    if (cluster?.width) rightBottom = h - cluster.top

    let s = Math.min(Math.max(w, h) / REF.w, Math.min(w, h) / REF.minSide)
    // Short screens (phone landscape): the reference stack does not fit under Boxity's chat,
    // so the goal and stats move beside the button grid.
    const short = (h - resLeft - 8) / LEFT_H < SHORT_SCALE
    root.classList.toggle('short', short)
    if (short) s = Math.max(SHORT_SCALE, Math.min(s, (h - resLeft - 8) / LEFT_H_SHORT, (h - rightTop - rightBottom) / RIGHT_H_SHORT))
    else s = Math.max(MIN_SCALE, Math.min(s, (h - resLeft - 8) / LEFT_H, (h - rightTop - rightBottom) / RIGHT_H))

    const st = root.style
    st.setProperty('--s', s.toFixed(3))
    st.setProperty('--res-top', `${resTop}px`)
    st.setProperty('--res-left', `${resLeft}px`)
    st.setProperty('--right-top', `${rightTop}px`)
    st.setProperty('--right-bottom', `${rightBottom}px`)
    st.setProperty('--right-icons', `${rightIcons}px`)
  }

  bloxity.onReservedAreas((areas) => {
    reserved = areas
    layout()
  })
  window.addEventListener('resize', layout)
  window.visualViewport?.addEventListener('resize', layout)
  // touch.js switches its controls on and off with the body class.
  new MutationObserver(layout).observe(document.body, { attributes: true, attributeFilter: ['class'] })
  layout()
  // Fredoka swaps in late and changes text widths; nothing is measured from text, but re-run once.
  document.fonts?.ready.then(layout)

  return { root, layout }
}
