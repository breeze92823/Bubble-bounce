// Game state + events + persistence (CONTRACTS.md §Game state). One mutable `state`,
// mutated only through the functions here so every change emits its event and is saved.
import { BUBBLES, DAILY, EGGS, GIFTS, GOALS, LEVELS, MULTIPLIER, PETS, PET_LIMITS, START, TUTORIAL, WANDS, WHEEL, WINS } from '../config/mechanics.js'

const listeners = new Map()
export function on(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set())
  listeners.get(name).add(fn)
  return () => listeners.get(name).delete(fn)
}
export function emit(name, payload) {
  for (const fn of listeners.get(name) || []) fn(payload)
}

function fresh() {
  return {
    breath: START.breath,
    wins: START.wins,
    rebirths: START.rebirths,
    level: START.level,
    xp: START.xp,
    bestDistance: 0,
    equippedBubble: 'plain',
    bubbles: ['plain'],
    pets: { owned: [], equipped: [], discovered: [], nextId: 1, autoDelete: false },
    wands: { owned: [], equipped: null },
    boosts: { inventory: {}, active: [] }, // active: [{ id, until }]
    gifts: { playtimeMs: 0, claimed: [], day: '' },
    daily: { day: 1, lastClaim: 0 },
    spin: { lastFree: 0, free: 1 },
    goalIndex: 0,
    codes: [],
    tutorial: 0, // index into TUTORIAL; past the end = done
  }
}

export const state = fresh()

// --- derived ---------------------------------------------------------------------------
export function activeBoost(id) {
  const now = Date.now()
  return state.boosts.active.some((b) => b.id === id && b.until > now)
}
export function petMultiplier() {
  return state.pets.equipped.reduce((sum, id) => {
    const p = state.pets.owned.find((o) => o.id === id)
    return sum + (p ? (PETS[p.type]?.mult || 0) * (p.golden ? 2 : 1) : 0)
  }, 0)
}
export function multiplier() {
  return MULTIPLIER.rebirthMult(state.rebirths) + petMultiplier()
}
export function wandMultiplier() {
  const w = WANDS.find((w) => w.id === state.wands.equipped)
  return w ? w.mult : 1
}
export function equippedBubble() {
  const b = BUBBLES.find((b) => b.id === state.equippedBubble) || BUBBLES[0]
  if (b.id === 'celestial') {
    const best = Math.max(...state.bubbles.map((id) => BUBBLES.find((x) => x.id === id)?.breath || 1))
    return { ...b, breath: Math.round(best * b.bestFactor) }
  }
  return b
}
export const xpForLevel = () => LEVELS.xpForLevel(state.level)
export const rebirthLevel = () => LEVELS.rebirthLevel(state.rebirths)
export const canRebirth = () => state.level >= rebirthLevel()

// --- mutations -----------------------------------------------------------------------
export function addBreath(delta, source = 'blow') {
  if (!(delta > 0)) return
  const gain = activeBoost('breath2x') ? delta * 2 : delta
  state.breath += gain
  emit('breathChanged', { breath: state.breath, delta: gain, source })
  addXp(gain)
  save()
}
export const winsBoostActive = () => activeBoost('wins2x') || activeBoost('wins2x20')
// `boosted: false` when the caller already applied the 2x Wins potion (a ride's burst).
export function addWins(delta, source = 'burst', boosted = true) {
  const gain = boosted && winsBoostActive() ? delta * 2 : delta
  state.wins += gain
  emit('winsChanged', { wins: state.wins, delta: gain, source })
  save()
}
export function spendWins(amount) {
  if (state.wins < amount) return false
  state.wins -= amount
  emit('winsChanged', { wins: state.wins, delta: -amount, source: 'spend' })
  save()
  return true
}
export function addXp(delta) {
  state.xp += delta
  let changed = false
  while (state.xp >= xpForLevel()) {
    state.xp -= xpForLevel()
    state.level++
    changed = true
  }
  emit('levelChanged', { level: state.level, xp: state.xp, xpForLevel: xpForLevel(), levelUp: changed })
}
export function rebirth() {
  if (!canRebirth()) return false
  state.rebirths++
  state.level = 1
  state.xp = 0
  state.breath = START.breath
  emit('rebirth', { rebirths: state.rebirths })
  emit('breathChanged', { breath: state.breath, delta: 0, source: 'rebirth' })
  emit('levelChanged', { level: 1, xp: 0, xpForLevel: xpForLevel(), levelUp: false })
  emit('multiplierChanged', { multiplier: multiplier() })
  save()
  return true
}
export function buyBubble(id) {
  const b = BUBBLES.find((b) => b.id === id)
  if (!b || state.bubbles.includes(id)) return equipBubble(id)
  if (b.robux) return false
  if (!spendWins(b.price)) return false
  state.bubbles.push(id)
  emit('bubbleBought', { id })
  return equipBubble(id)
}
export function equipBubble(id) {
  if (!state.bubbles.includes(id)) return false
  state.equippedBubble = id
  emit('bubbleEquipped', { id, bubble: equippedBubble() })
  save()
  return true
}
export function buyWand(id) {
  const w = WANDS.find((w) => w.id === id)
  if (!w) return false
  if (!state.wands.owned.includes(id)) {
    if (w.robux) return false
    if (!spendWins(w.price)) return false
    state.wands.owned.push(id)
  }
  state.wands.equipped = id
  emit('wandEquipped', { id })
  save()
  return true
}
export function buyEgg(id) {
  const egg = EGGS.find((e) => e.id === id)
  if (!egg || egg.robux || !egg.pets.length) return null
  if (state.pets.owned.length >= PET_LIMITS.owned) return null
  if (!spendWins(egg.price)) return null
  return hatch(egg)
}
export function hatch(egg) {
  const total = egg.weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  let type = egg.pets[0]
  for (let i = 0; i < egg.pets.length; i++) {
    r -= egg.weights[i]
    if (r <= 0) {
      type = egg.pets[i]
      break
    }
  }
  const pet = { id: state.pets.nextId++, type, golden: false }
  if (state.pets.autoDelete && PETS[type].rarity === 'Common') {
    emit('petHatched', { pet, deleted: true })
    save()
    return pet
  }
  state.pets.owned.push(pet)
  if (!state.pets.discovered.includes(type)) state.pets.discovered.push(type)
  emit('petHatched', { pet, deleted: false })
  save()
  return pet
}
export function equipPet(id) {
  if (state.pets.equipped.includes(id) || state.pets.equipped.length >= PET_LIMITS.equipped) return false
  if (!state.pets.owned.some((p) => p.id === id)) return false
  state.pets.equipped.push(id)
  emit('petEquipped', { equipped: state.pets.equipped })
  emit('multiplierChanged', { multiplier: multiplier() })
  save()
  return true
}
export function unequipPet(id) {
  state.pets.equipped = state.pets.equipped.filter((p) => p !== id)
  emit('petEquipped', { equipped: state.pets.equipped })
  emit('multiplierChanged', { multiplier: multiplier() })
  save()
}
export function deletePet(id) {
  unequipPet(id)
  state.pets.owned = state.pets.owned.filter((p) => p.id !== id)
  emit('petEquipped', { equipped: state.pets.equipped })
  save()
}
export function equipBest() {
  const sorted = [...state.pets.owned].sort((a, b) => PETS[b.type].mult * (b.golden ? 2 : 1) - PETS[a.type].mult * (a.golden ? 2 : 1))
  state.pets.equipped = sorted.slice(0, PET_LIMITS.equipped).map((p) => p.id)
  emit('petEquipped', { equipped: state.pets.equipped })
  emit('multiplierChanged', { multiplier: multiplier() })
  save()
}
export function addBoost(id, n = 1) {
  state.boosts.inventory[id] = (state.boosts.inventory[id] || 0) + n
  emit('boostsChanged', { inventory: state.boosts.inventory })
  save()
}
export function useBoost(id, minutes = 10) {
  if (!(state.boosts.inventory[id] > 0)) return false
  state.boosts.inventory[id]--
  const now = Date.now()
  const existing = state.boosts.active.find((b) => b.id === id)
  if (existing) existing.until = Math.max(existing.until, now) + minutes * 60000
  else state.boosts.active.push({ id, until: now + minutes * 60000 })
  emit('boostUsed', { id, active: state.boosts.active })
  emit('boostsChanged', { inventory: state.boosts.inventory })
  save()
  return true
}
export function giveReward(reward) {
  // A reward object from GIFTS / DAILY / WHEEL / GOALS.
  if (reward.wins) addWins(reward.wins, 'reward')
  if (reward.breath) addBreath(reward.breath, 'reward')
  if (reward.breathFactor) addBreath(Math.max(1, Math.round(state.breath * reward.breathFactor)), 'reward')
  if (reward.egg) {
    const egg = EGGS.find((e) => e.id === reward.egg)
    if (egg?.pets.length) for (let i = 0; i < (reward.n || 1); i++) hatch(egg)
  }
  if (reward.boost) addBoost(reward.boost, reward.n || 1)
  if (reward.pet) {
    const pet = { id: state.pets.nextId++, type: reward.pet, golden: false }
    state.pets.owned.push(pet)
    if (!state.pets.discovered.includes(reward.pet)) state.pets.discovered.push(reward.pet)
    emit('petHatched', { pet, deleted: false })
  }
  if (reward.bubbleBreath) {
    // The diamond bubble: a one-off bubble type registered on the fly.
    if (!BUBBLES.some((b) => b.id === 'diamond')) BUBBLES.push({ id: 'diamond', name: 'Diamond Bubble', breath: reward.bubbleBreath, price: 0, shape: 'gem', tint: 'sparkle' })
    if (!state.bubbles.includes('diamond')) state.bubbles.push('diamond')
  }
  save()
}

// Wins for a ride (burst-and-rewards.md, MECHANICS §Wins), before the 2x Wins potion.
export function winsForRide(distanceMeters) {
  return Math.round(Math.max(1, Math.round(distanceMeters * WINS.perMeter)) * multiplier() * wandMultiplier())
}
// Keeps the longest ride; true when this one is a new best.
export function recordDistance(meters) {
  if (meters <= state.bestDistance) return false
  state.bestDistance = meters
  save()
  return true
}

// Objective banner: moves on only from the step named `id` (events can fire in any order).
export const tutorialStep = () => TUTORIAL[state.tutorial] || null
export function advanceTutorial(id) {
  if (tutorialStep()?.id !== id) return
  state.tutorial++
  emit('tutorialChanged', { step: tutorialStep() })
  save()
}
// The banner's SKIP: the whole tutorial counts as done.
export function skipTutorial() {
  state.tutorial = TUTORIAL.length
  emit('tutorialChanged', { step: null })
  save()
}

// --- persistence ---------------------------------------------------------------------
// Progress is stored only on the server: net.js sends `snapshot()` whenever it changed. Writers
// still call save(), which is a no-op kept so they need not care.
export function save() {}
// The state as the server stores it (net.js sends this as `saveProgress`).
export const snapshot = () => state
// Replaces the state with the server's saved doc (net.js `progress`).
export function hydrate(doc) {
  const { serverTime, ...saved } = doc || {}
  Object.assign(state, fresh(), saved)
  state.boosts.active = (state.boosts.active || []).filter((b) => b.until > Date.now())
  emit('reset', {})
}
export function reset() {
  Object.assign(state, fresh())
  emit('reset', {})
}

// Playtime for the gifts panel: accumulated while the tab is visible.
export function tickPlaytime(dt) {
  const today = new Date().toDateString()
  if (state.gifts.day !== today) {
    state.gifts.day = today
    state.gifts.claimed = []
    state.gifts.playtimeMs = 0
  }
  state.gifts.playtimeMs += dt * 1000
}
export function giftUnlockedAt(i) {
  return GIFTS.unlockMinutes[i] * 60000
}
export const giftClaimed = (i) => state.gifts.claimed.includes(i)
export const giftWaitMs = (i) => Math.max(0, giftUnlockedAt(i) - state.gifts.playtimeMs)
export function claimGift(i) {
  if (giftClaimed(i) || giftWaitMs(i) > 0) return false
  giveReward(GIFTS.slots[i])
  state.gifts.claimed.push(i)
  emit('giftClaimed', { index: i })
  save()
  return true
}
export function setAutoDelete(on) {
  state.pets.autoDelete = !!on
  emit('petEquipped', { equipped: state.pets.equipped })
  save()
}
export function dailyReady() {
  return Date.now() - state.daily.lastClaim >= 24 * 3600000
}
export function claimDaily() {
  if (!dailyReady()) return null
  if (Date.now() - state.daily.lastClaim > 48 * 3600000 && state.daily.lastClaim) state.daily.day = 1
  const reward = DAILY[state.daily.day - 1]
  giveReward(reward)
  state.daily.lastClaim = Date.now()
  state.daily.day = (state.daily.day % 7) + 1
  emit('dailyClaimed', { reward })
  save()
  return reward
}

// Spin the wheel: one free spin every WHEEL.freeSpinHours; the wedge is rolled by chance.
export function spinWaitMs() {
  return Math.max(0, state.spin.lastFree + WHEEL.freeSpinHours * 3600000 - Date.now())
}
export function spin() {
  if (spinWaitMs() > 0) return -1
  const total = WHEEL.wedges.reduce((a, w) => a + w.chance, 0)
  let r = Math.random() * total
  let index = WHEEL.wedges.length - 1
  for (let i = 0; i < WHEEL.wedges.length; i++) {
    r -= WHEEL.wedges[i].chance
    if (r <= 0) {
      index = i
      break
    }
  }
  state.spin.lastFree = Date.now()
  return index
}
export function claimSpin(index) {
  const w = WHEEL.wedges[index]
  giveReward(w.pet ? { pet: w.pet } : w)
  emit('spinClaimed', { index })
  save()
}

// Goals: a ladder of rebirth targets; the current one pays out once reached.
export const currentGoal = () => GOALS[state.goalIndex] || null
export const goalReady = () => {
  const g = currentGoal()
  return !!g && state.rebirths >= g.rebirths
}
export function claimGoal() {
  if (!goalReady()) return null
  const g = currentGoal()
  for (const r of g.rewards) giveReward(r)
  state.goalIndex++
  emit('goalClaimed', { goal: g })
  save()
  return g
}
