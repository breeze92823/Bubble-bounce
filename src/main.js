import { NeutralToneMapping, Clock, Group, PCFSoftShadowMap, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { CAMERA, graphicsPreset, RENDER } from './config.js'
import * as bloxity from './bloxity.js'
import { install as installInput, onKey } from './input.js'
import { installTouch } from './touch.js'
import { createPlayerBody, interpolate as interpolatePlayer, player, resetPlayer, respawn } from './player.js'
import { setCameraSensitivity, syncYawToPlayer, update as updateCamera } from './camera.js'
import { onModeChanged, toggleMode } from './modes.js'
import { bodyCount, initPhysics, stepPhysics } from './physics.js'
import { createLighting } from './lighting.js'
import { createEnvironment } from './world/environment.js'
import { buildWorld } from './world/index.js'
import { createPostFx } from './postfx.js'
import { setNeonBloom } from './propkit.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { Particles } from './effects/particles.js'
import { FloatingTexts } from './effects/floatingText.js'
import { advanceTutorial, emit as emitState, on as onState, state, tickPlaytime } from './state/game.js'
import { WandHolder, wandRingWorld } from './shared/wand.js'
import { createInflater } from './gameplay/inflater.js'
import { createDirector } from './gameplay/director.js'
import { createRide } from './gameplay/ride.js'
import { createBubbleMesh } from './shared/bubble.js'
import { BUBBLES } from './config/mechanics.js'
import { installHud } from './ui/hud.js'
import { createGuide } from './ui/guide.js'
import { installAllWindows } from './ui/windows/index.js'
import { isOpen as anyWindowOpen } from './ui/windows/shell.js'
import { initNet, onLeaderboardData } from './net.js'
import { installSound } from './sound.js'
import { installInteract,setInteractEnabled, updateInteract } from './interact.js'

// Boot order: Bloxity SDK -> renderer -> Rapier (async wasm) -> ground + sky + lighting,
// player body -> avatar (async, swaps in when ready) -> loop. The SDK is optional at every step.
let lighting = null
let renderer = null
let postfx = null

// Settings come from the portal's settings menu (or their defaults offline).
function applySetting(key, value) {
  if (key === 'camera_sensitivity') setCameraSensitivity(value)
  else if (key === 'fullscreen') bloxity.requestFullscreen(value)
  else if (key === 'graphics_quality' && renderer) {
    const next = graphicsPreset(value)
    renderer.shadowMap.enabled = next.shadows
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, next.dpr))
    lighting?.setShadows(next)
    postfx?.configure(next)
    setNeonBloom(next.bloom)
    postfx?.setSize(window.innerWidth, window.innerHeight)
  }
}
bloxity.onSetting(applySetting)
bloxity.init()
initNet()

// --- Renderer ---------------------------------------------------------------
const preset = graphicsPreset(bloxity.settings.graphics_quality)
renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = NeutralToneMapping // keeps the saturated flat Roblox colours
renderer.toneMappingExposure = RENDER.exposure
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr))
document.body.appendChild(renderer.domElement)
installInput(() => bloxity.showMenu(), renderer.domElement) // Esc opens the portal menu

const scene = new Scene()
// Handedness: the reference convention (+X = the player's right when facing +Z down the lane)
// is left-handed; Three.js is right-handed. All game logic, physics and config use the reference
// frame unchanged; only the picture is mirrored: the scene renders with scale.x = -1 through
// `renderCamera`, a mirrored copy of the logic `camera`.
scene.scale.x = -1
const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
const renderCamera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
function mirrorCamera() {
  renderCamera.position.set(-camera.position.x, camera.position.y, camera.position.z)
  const q = camera.quaternion
  renderCamera.quaternion.set(q.x, -q.y, -q.z, q.w)
  if (renderCamera.fov !== camera.fov || renderCamera.aspect !== camera.aspect) {
    renderCamera.fov = camera.fov
    renderCamera.aspect = camera.aspect
    renderCamera.updateProjectionMatrix()
  }
  renderCamera.updateMatrixWorld()
}
postfx = createPostFx(renderer, scene, renderCamera)
postfx.configure(preset)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  postfx.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

for (const key of Object.keys(bloxity.settings)) applySetting(key, bloxity.settings[key])

// --- Physics + ground + sky --------------------------------------------------
bloxity.loadingStep('Starting physics')
await initPhysics()

lighting = createLighting(scene, renderer, preset)
const particles = new Particles(scene)
const floatingTexts = new FloatingTexts(scene)
const environment = createEnvironment(scene) // ocean + clouds

// --- Player avatar ----------------------------------------------------------
// The Bloxity base rig (player.glb; procedural fallback if it fails), dressed
// with the signed-in player's equipped cosmetics and body proportions. It
// rebuilds on customizer edits and sign-in/out. The equipped wand rides in its hand.
const playerGroup = new Group()
scene.add(playerGroup)
let avatar = null
let animator = null
let generation = 0
let avatarReady = false
const wand = new WandHolder(playerGroup, state.wands.equipped || 'default')
onState('wandEquipped', ({ id }) => wand.setWand(id))

function setAvatar(next) {
  if (avatar) playerGroup.remove(avatar)
  const override = animator?.override ?? null // keep a blow/ride pose across an avatar swap
  disposeAnimator(animator)
  avatar = next
  playerGroup.add(avatar)
  animator = makeAnimator(avatar)
  animator?.setOverride(override)
  wand.setAvatar(avatar)
}

// --- Gameplay: the inflate, the scripted camera and the Blow Zone run ------------
const ringWorld = new Vector3()
const inflater = createInflater({
  scene,
  particles,
  animator: () => animator,
  // The ring in the logic frame: the scene renders mirrored in X about the origin (above).
  wandRing: (out) => {
    if (!wand.upper) return out.set(playerGroup.position.x, playerGroup.position.y + player.dims.height * 0.8, playerGroup.position.z)
    wandRingWorld(wand.wand, ringWorld)
    return out.set(-ringWorld.x, ringWorld.y, ringWorld.z)
  },
  facing: () => playerGroup.rotation.y,
})
const director = createDirector()
const ride = createRide({ scene, player, particles, floatingTexts, inflater, director, animator: () => animator })
const world = buildWorld(scene, { particles, floatingTexts, inflater, player, ride }) // the zones
onLeaderboardData(world.zones['spawn-hub'].setLeaderboard)
createPlayerBody()
syncYawToPlayer()

// Draw everything once while loading, so the first BLOW and the first ride down the lane do not
// freeze (0.3-0.9 s each): shaders compile and the driver finishes them on a real draw, and the
// lane's baked geometry + textures upload, which otherwise happens when the ride camera first sees
// them. Covers one bubble per type (their materials differ in defines) and everything hidden until
// a run (the ride's shadow disc ...). The warm-up bubbles are never disposed, so their programs
// stay alive when a burst disposes the live bubble's material.
const warmBubbles = BUBBLES.map((b) => createBubbleMesh(b.id, 1))
function warmUp() {
  for (const m of warmBubbles) scene.add(m)
  const hidden = []
  const culled = []
  scene.traverse((o) => {
    if (!o.visible) {
      hidden.push(o)
      o.visible = true
    }
    if (o.frustumCulled) {
      culled.push(o)
      o.frustumCulled = false
    }
  })
  postfx.render()
  for (const o of hidden) o.visible = false
  for (const o of culled) o.frustumCulled = true
  for (const m of warmBubbles) scene.remove(m)
}
warmUp()

// Objective banner steps that no zone owns.
onState('bubbleBought', () => advanceTutorial('buy'))
onState('rebirth', () => advanceTutorial('rebirth'))

setAvatar(buildDefaultCharacter()) // visible immediately; replaced once the rig loads

async function loadAvatar() {
  // The SDK fires twice per change (optimistic + confirmed); only the newest load may land.
  const mine = ++generation
  try {
    const group = await loadBaseCharacter()
    if (mine !== generation) return
    const equipped = bloxity.authState.user ? bloxity.getEquippedAvatar() : null
    await attachEquippedAccessories(group, equipped, { skinTextureUrl: bloxity.getSkinTextureUrl() })
    if (mine !== generation) return
    applyProportions(group, bloxity.authState.user ? bloxity.getProportions() : null)
    setAvatar(group)
  } finally {
    if (mine === generation) avatarReady = true
  }
}

let signedIn = null
bloxity.subscribeAuth((s) => {
  const now = !!s.user
  if (now !== signedIn) {
    signedIn = now
    loadAvatar() // also runs once at start to swap in the real rig
  }
})
bloxity.onAvatarChanged(loadAvatar)
bloxity.onProportionsChanged(() => applyProportions(avatar, bloxity.getProportions()))
bloxity.onRespawnRequest(respawn)

// --- Modes + keys --------------------------------------------------------------
let firstPerson = false
onModeChanged((mode) => {
  firstPerson = mode === 'player' // first person: you are the camera (the avatar shows again for a run)
})
onKey('KeyV', toggleMode)
onKey('KeyR', () => {
  if (!ride.active) respawn()
})
// F / E = BLOW on the Blow Zone strip (the HUD button on touch).
onKey('KeyF', () => emitState('blowPressed'))
onKey('KeyE', () => emitState('blowPressed'))
installTouch({ mode: toggleMode, day: () => lighting.toggleDayNight(), respawn: () => !ride.active && respawn() })
const hud = installHud() // after the touch controls: its layout keeps clear of them
const guide = createGuide(scene, { hud, player, ride, director }) // the tutorial's arrows + tips
installAllWindows() // opened by the HUD's hudAction events
installSound() // WebAudio unlocks on the first gesture
installInteract() // hold-E prompts (zones register themselves in the world builders)

// --- Loop -------------------------------------------------------------------
const clock = new Clock()
let shownLoading = true
let readySince = 0
let elapsed = 0

function frame(dt) {
  elapsed += dt
  stepPhysics(dt) // runs the player controller + world at the fixed rate, interpolates bodies
  interpolatePlayer()
  ride.update(dt)

  // During a Blow Zone run the ride places the avatar (in the bubble); otherwise the body does.
  if (ride.ownsAvatar) {
    const a = ride.avatar
    playerGroup.position.set(a.x, a.y, a.z)
    playerGroup.rotation.y = a.facing
    playerGroup.scale.setScalar(a.scale)
    animator?.update(dt, ride.anim)
  } else {
    const p = player.renderPosition
    playerGroup.position.set(p.x, p.y, p.z)
    playerGroup.rotation.y = player.facing
    playerGroup.scale.setScalar(1)
    animator?.update(dt, {
      grounded: player.grounded,
      speed: Math.hypot(player.velocity.x, player.velocity.z),
      verticalVelocity: player.velocity.y,
      turn: 0,
    })
  }
  playerGroup.visible = !firstPerson || ride.ownsAvatar
  playerGroup.updateMatrixWorld(true)
  wand.atMouth = animator?.override === 'blow'
  wand.update() // keeps posing while hidden so the bubble ring is current when a blow starts
  inflater.update(dt)
  wand.wand.visible = !!wand.upper && inflater.active // the wand is only in hand while blowing

  if (director.active) director.update(camera, dt)
  else updateCamera(camera, dt)
  particles.update(dt, elapsed)
  floatingTexts.update(dt)
  world.update(dt, elapsed)
  guide.update(elapsed)
  setInteractEnabled(!anyWindowOpen() && !ride.active && !director.active)
  updateInteract()
  tickPlaytime(dt) // gifts unlock on playtime
  environment.update(dt, elapsed, playerGroup.position)
  lighting.update(dt, playerGroup.position)
  mirrorCamera()
  postfx.render()

  // Loading ends once the scene has drawn and the avatar has had its chance (max ~5 s).
  if (shownLoading) {
    readySince += dt
    if (avatarReady || readySince > 5) {
      shownLoading = false
      bloxity.notifyFirstFrame()
    }
  }
}
renderer.setAnimationLoop(() => frame(Math.min(clock.getDelta(), 0.1))) // clamp huge frames (tab switch, breakpoint)

window.addEventListener('beforeunload', bloxity.teardown)

// Dev-only console hook, e.g. __game.teleport(-24, 0, 6, Math.PI / 2)
if (import.meta.env.DEV) {
  const teleport = (x, y, z, facing = player.facing) => {
    resetPlayer({ x, y, z }, facing)
    syncYawToPlayer()
  }
  // step(n, dt): run n frames by hand (a hidden preview pane barely animates).
  const step = (n = 1, dt = 1 / 60) => {
    for (let i = 0; i < n; i++) frame(dt)
  }
  window.__game = { player, scene, renderer, camera, renderCamera, postfx, bodies: bodyCount, toggleMode, teleport, step, world, environment, lighting, ride, director, inflater, state, wand, guide }
}
