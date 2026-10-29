// Colyseus link to ../Bubble-bounce-backend (room "world").
// Signed-in players' progress lives on the server: on join it answers with `progress` (the saved
// doc -> hydrate), `noProgress` (new account, guest or no database: keep the current state and
// save it) or `serverError` (the save could not be read: never overwrite it). From then on the
// state is sent as `saveProgress` whenever it changed, at most every NET.saveEvery s, and when the
// tab hides or closes.
// Guests (not signed in to Bloxity), and everyone when no server is configured, keep their
// progress in this browser only (state/game.js, localStorage). A guest who signs in to a NEW
// account brings that progress along (noProgress keeps the current state); an account that has a
// save loads it instead.
// Never throws and never blocks play: without a server the game runs on the browser save.
import { Client } from '@colyseus/sdk'
import { DEV_MODE, NET, SERVER_URL } from './config.js'
import { hydrate, snapshot } from './state/game.js'
import { authState, canResolveServer, getPfp, resolveServerEndpoint, subscribeAuth } from './bloxity.js'

export const net = { room: null, connected: false, hydrated: false, leaderboard: null }

// --- Identity ---------------------------------------------------------------------
// Signed-in players use their Bloxity id; everyone else a per-browser guest id (never saved on
// the server). Dev mode (no SDK) plays as a per-browser dev id so a local server with Mongo keeps
// its progress.
function storedId(key, make) {
  try {
    let id = localStorage.getItem(key)
    if (!id) localStorage.setItem(key, (id = make()))
    return id
  } catch {
    return make()
  }
}
const rand = () => Math.random().toString(36).slice(2, 8)
const GUEST = storedId('bubble-bounce.guest', () => `guest-${rand()}`)
const DEV = DEV_MODE ? storedId('bubble-bounce.dev', () => `dev-${rand()}`) : ''

function identity() {
  if (DEV) return { userId: DEV, username: `Dev ${DEV.slice(4)}` }
  const u = authState.user
  const id = u && (u._id || u.id || u.userId || u.uid)
  if (!id) return { userId: GUEST, username: authState.guest?.displayName || authState.guest?.username || 'Guest' }
  return { userId: String(id), username: String(u.displayName || u.username || u.name || 'Player') }
}
const isGuestId = (id) => id.startsWith('guest-')
export const hasServer = () => !!(SERVER_URL || canResolveServer())

// --- Saving -----------------------------------------------------------------------
let lastSaved = ''
let savedAt = 0
let sentId = ''
let loadedId = ''

function send(type, payload) {
  try {
    net.room?.send(type, payload)
  } catch (err) {
    console.warn('[net] send failed', type, err)
  }
}

export function saveNow() {
  savedAt = performance.now()
  if (!net.connected || !net.hydrated || !authState.ready || isGuestId(sentId)) return
  const snap = JSON.stringify(snapshot())
  if (snap === lastSaved) return
  lastSaved = snap
  send('saveProgress', JSON.parse(snap))
}

// --- Connection -------------------------------------------------------------------
let onLeaderboard = () => {}
function attach(room) {
  net.room = room
  net.connected = true
  room.onMessage('progress', (doc) => {
    net.hydrated = true
    lastSaved = ''
    // A reconnect under the same identity: this tab is newer than the save, so push it instead.
    if (loadedId === sentId || !doc) return saveNow()
    loadedId = sentId
    hydrate(doc)
    saveNow()
  })
  room.onMessage('noProgress', () => {
    net.hydrated = true
    loadedId = sentId
    lastSaved = ''
    saveNow()
  })
  room.onMessage('serverError', () => {
    net.hydrated = false
    console.warn('[net] server could not read the saved progress; saving is off for this session')
  })
  room.onMessage('leaderboard', (data) => {
    net.leaderboard = data
    onLeaderboard(data)
  })
  room.onLeave(() => {
    if (net.room !== room) return
    net.room = null
    net.connected = false
    net.hydrated = false
    setTimeout(connect, NET.rejoin * 1000)
  })
}

async function joinAnyRoom(options) {
  if (SERVER_URL) return new Client(SERVER_URL).joinOrCreate('world', options)
  const { endpoint } = await resolveServerEndpoint(/^(guest|dev)-/.test(options.userId) ? undefined : options.userId)
  return new Client(endpoint).joinOrCreate('world', options)
}

let connecting = false
let retryIn = NET.retry
async function connect() {
  if (!hasServer() || connecting || net.connected) return
  connecting = true
  try {
    const id = identity()
    sentId = id.userId
    const room = await joinAnyRoom({ ...id, pfp: getPfp() })
    retryIn = NET.retry
    attach(room)
  } catch (err) {
    console.info(`[net] could not reach the server (retrying in ${retryIn}s); playing on the browser save`, err?.message ?? err)
    setTimeout(connect, retryIn * 1000)
    retryIn = Math.min(retryIn * 2, NET.retryMax)
  } finally {
    connecting = false
  }
}

// Once a second: save if due.
setInterval(() => {
  if (!document.hidden && performance.now() - savedAt >= NET.saveEvery * 1000) saveNow()
}, 1000)

// setLeaderboard(data): { boards: { rebirths|wins|breath|bestDistance: [{ name, value }] }, ranks }.
export function initNet({ setLeaderboard } = {}) {
  if (setLeaderboard) onLeaderboard = setLeaderboard
  window.addEventListener('pagehide', saveNow)
  document.addEventListener('visibilitychange', () => document.hidden && saveNow())
  if (!hasServer()) return console.info('[net] no server configured; progress is kept in this browser')
  subscribeAuth((s) => {
    if (!s.ready) return
    if (!net.connected) return void connect()
    const id = identity()
    if (id.userId === sentId) return send('identify', { username: id.username, pfp: getPfp() })
    // Save under the OLD identity before switching (auth has already moved on).
    saveNow()
    net.hydrated = false
    sentId = id.userId
    send('identify', { ...id, pfp: getPfp() })
  })
}
