// Windows entry: registers every window and opens them from the HUD buttons.
import { on } from '../../state/game.js'
import { installWindows, openWindow } from './shell.js'
import './rebirth.js'
import './wands.js'
import './inventory.js'
import './rewards.js'
import './spin.js'
import './petIndex.js'

// HUD action id -> window [id, tab].
const OPENS = {
  rebirth: ['rebirth'],
  wands: ['wands'],
  inventory: ['inventory', 'bubbles'],
  pets: ['inventory', 'pets'],
  gifts: ['gifts'],
  daily: ['daily'],
  spin: ['spin'],
}
export function installAllWindows() {
  installWindows()
  on('hudAction', ({ id }) => {
    if (OPENS[id]) return openWindow(...OPENS[id])
  })
}
