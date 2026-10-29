// Rebirth (ui-rebirth): before/after multiplier, the reset warning, level progress.
import { MULTIPLIER, TRAINING } from '../../config/mechanics.js'
import { canRebirth, rebirth, rebirthLevel, state } from '../../state/game.js'
import { lungs } from '../art.js'
import { closeWindow, defineWindow, toast } from './shell.js'

const ARROW = `<svg class="arrow" viewBox="0 0 60 50"><path d="M4 16 H30 V4 L56 25 L30 46 V34 H4 Z" fill="#fff" stroke="#111" stroke-width="4" stroke-linejoin="round"/></svg>`

function multBox(n) {
  return `<div class="mult">${lungs()}<span class="t">x${n}<br>BREATH</span></div>`
}

defineWindow('rebirth', {
  title: 'Rebirth',
  icon: '🔄',
  width: 710,
  render() {
    const now = MULTIPLIER.rebirthMult(state.rebirths)
    const lane = TRAINING.lanes.find((l) => l.unlock.rebirths === state.rebirths + 1)
    const need = rebirthLevel()
    const ready = canRebirth()
    return `
      <div class="cols">
        <div class="col"><span class="t">Before</span>${multBox(now)}</div>
        ${ARROW}
        <div class="col"><span class="t">After</span>${multBox(MULTIPLIER.rebirthMult(state.rebirths + 1))}</div>
      </div>
      <div class="t warn">Resets your LEVEL and BREATH!</div>
      ${lane ? `<div class="t thin unlock">Unlocks the ${lane.id} Breath bubble trainer!</div>` : ''}
      <div class="bar"><div class="fill" style="width:${Math.min(100, (state.level / need) * 100)}%"></div><span class="t">Level ${state.level} / Level ${need}</span></div>
      <div class="row actions">
        <button class="btn gray" data-act="keep"><span class="t">Keep training!</span></button>
        ${ready ? `<button class="btn green" data-act="rebirth"><span class="t">Rebirth!</span></button>` : ''}
      </div>`
  },
  onAction(act) {
    if (act === 'keep') closeWindow()
    else if (act === 'rebirth' && rebirth()) {
      toast(`Rebirthed! x${MULTIPLIER.rebirthMult(state.rebirths)} Breath`)
      closeWindow()
    }
  },
})
