// Game audio (ported from Bowling Roll): synthesised one-shots on one shared WebAudio graph, no files.
// Browsers only allow audio after a user gesture, so the context is built on the first pointer / key
// press and sounds asked for before that are dropped. Suspended while the tab is hidden. Never throws.

let ctx = null
let master = null
let noise = null // 1 s of white noise
let brown = null // 2 s of deep (brownian) noise, for wind and thuds
const volume = 0.8

function noiseBuffer(seconds, deep) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    const white = Math.random() * 2 - 1
    if (!deep) d[i] = white
    else d[i] = (last = (last + 0.02 * white) / 1.02) * 3.5
  }
  return buf
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = volume
  master.connect(ctx.destination)
  noise = noiseBuffer(1, false)
  brown = noiseBuffer(2, true)
}

export function installSound() {
  const unlock = () => {
    try {
      if (!ctx) build()
      if (ctx?.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {})
    } catch {
      // Audio is optional.
    }
  }
  for (const type of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(type, unlock, { capture: true, passive: true })
  document.addEventListener('visibilitychange', () => {
    try {
      if (!ctx) return
      if (document.hidden) ctx.suspend().catch(() => {})
      else ctx.resume().catch(() => {})
    } catch {
      // Audio is optional.
    }
  })
}

const safe =
  (fn) =>
  (...args) => {
    try {
      if (ctx && !document.hidden) fn(ctx.currentTime + 0.01, ...args)
    } catch {
      // Audio is optional.
    }
  }

// An oscillator gliding f0 -> f1 over its `end` s life, fading from `peak`.
function tone(t, type, f0, f1, peak, end, attack = 0.004) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + end)
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + end)
  o.connect(g).connect(master)
  o.onended = () => g.disconnect()
  o.start(t)
  o.stop(t + end + 0.02)
}

// Filtered noise; returns the filter so callers can sweep it.
function hiss(t, type, freq, q, peak, end, attack = 0.002, buf = noise) {
  const s = ctx.createBufferSource()
  const f = ctx.createBiquadFilter()
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + end)
  s.buffer = buf
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  s.connect(f).connect(g).connect(master)
  s.onended = () => g.disconnect()
  s.start(t, Math.random() * Math.max(0, buf.duration - end - 0.05), end + 0.02)
  return f
}

// A struck bell: a few inharmonic sine partials.
function bell(t, freq, end, peak) {
  for (const [mult, amp] of [[1, 1], [2.01, 0.35], [3.98, 0.12]]) tone(t, 'sine', freq * mult, freq * mult, peak * amp, end, 0.008)
}

// A held sound built from `parts` (sources feeding one gain): `stop()` fades it out early.
// Returns a no-op handle when audio is not running.
const idle = { set() {}, stop() {} }
function held(make) {
  try {
    if (!ctx || document.hidden) return idle
    const t = ctx.currentTime + 0.01
    const out = ctx.createGain()
    out.connect(master)
    const handle = make(t, out)
    let stopped = false
    return {
      set: (...a) => !stopped && handle.set?.(...a),
      stop() {
        if (stopped) return
        stopped = true
        try {
          const now = ctx.currentTime
          out.gain.cancelScheduledValues(now)
          out.gain.setTargetAtTime(0.0001, now, 0.03)
          for (const s of handle.sources) s.stop(now + 0.2)
          setTimeout(() => out.disconnect(), 300)
        } catch {
          // Audio is optional.
        }
      },
    }
  } catch {
    return idle
  }
}

function loopNoise(t, buf, type, freq, q, into) {
  const s = ctx.createBufferSource()
  const f = ctx.createBiquadFilter()
  s.buffer = buf
  s.loop = true
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  s.connect(f).connect(into)
  s.start(t, Math.random() * buf.duration)
  return { s, f }
}

// --- The blow (blow-zone-strip.md, training-pads.md) ----------------------------------------

// Blowing through the wand while the bubble grows for `seconds`: a breathy hiss that swells and
// brightens, under a soft stretchy tone rising with the bubble. Stop it early when the blow ends.
export function inflateSound(seconds) {
  return held((t, out) => {
    const end = t + seconds
    out.gain.setValueAtTime(0.0001, t)
    out.gain.exponentialRampToValueAtTime(1, t + 0.12)
    out.gain.setValueAtTime(1, end - 0.15)
    out.gain.exponentialRampToValueAtTime(0.0001, end)
    const breath = ctx.createGain()
    breath.gain.value = 0.16
    breath.connect(out)
    const air = loopNoise(t, noise, 'bandpass', 900, 0.9, breath)
    air.f.frequency.setValueAtTime(900, t)
    air.f.frequency.exponentialRampToValueAtTime(1800, end)
    const o = ctx.createOscillator()
    const og = ctx.createGain()
    og.gain.value = 0.05
    o.type = 'triangle'
    o.frequency.setValueAtTime(190, t)
    o.frequency.exponentialRampToValueAtTime(480, end)
    const lfo = ctx.createOscillator() // the film of the bubble wobbling
    const depth = ctx.createGain()
    lfo.frequency.value = 7
    depth.gain.value = 9
    lfo.connect(depth).connect(o.frequency)
    o.connect(og).connect(out)
    o.start(t)
    lfo.start(t)
    for (const s of [air.s, o, lfo]) s.stop(end + 0.05)
    return { sources: [air.s, o, lfo] }
  })
}

// One rim sparkle while the bubble grows: a tiny high glint.
export const twinkle = safe((t) => {
  bell(t, 2400 + Math.random() * 1800, 0.25, 0.04)
})

// A bubble popping; `size` 0 (a pad bubble) .. 1 (the ride bubble's burst).
export const pop = safe((t, size = 0) => {
  const f0 = 1100 - 500 * size
  hiss(t, 'highpass', 2500, 0.7, 0.22 + 0.15 * size, 0.04)
  tone(t, 'sine', f0, f0 * 0.22, 0.3 + 0.15 * size, 0.08 + 0.08 * size)
  if (size > 0.5) {
    // the big burst: a wet low pop, a spray and glitter
    tone(t + 0.02, 'sine', 320, 70, 0.35, 0.25)
    const f = hiss(t, 'bandpass', 3000, 1, 0.18, 0.45, 0.005)
    f.frequency.exponentialRampToValueAtTime(900, t + 0.45)
    for (let i = 0; i < 6; i++) bell(t + 0.06 + i * 0.05 + Math.random() * 0.03, 1800 + Math.random() * 2200, 0.3, 0.035)
  }
})

// The hard cut from shot A to shot B: a short air swish.
export const swish = safe((t) => {
  const f = hiss(t, 'bandpass', 700, 1.4, 0.3, 0.22, 0.06)
  f.frequency.exponentialRampToValueAtTime(2400, t + 0.2)
})

// The finished bubble sliding over the avatar: a rubbery gulp.
export const gulp = safe((t) => {
  tone(t, 'sine', 240, 620, 0.22, 0.16, 0.01)
  tone(t + 0.1, 'sine', 520, 300, 0.12, 0.14, 0.01)
  hiss(t, 'lowpass', 500, 0.8, 0.12, 0.18, 0.02, brown)
})

// --- The ride and the burst (bubble-ride-lane.md, burst-and-rewards.md) ----------------------

// The bubble launching down the lane.
export const launch = safe((t) => {
  const f = hiss(t, 'bandpass', 500, 1.2, 0.3, 0.5, 0.12)
  f.frequency.exponentialRampToValueAtTime(2200, t + 0.18)
  f.frequency.exponentialRampToValueAtTime(700, t + 0.5)
  tone(t, 'sine', 300, 900, 0.1, 0.3, 0.03)
})

// Wind rushing past while riding; `set(k)` with k 0 (on the ground) .. 1 (at the apex).
export function windSound() {
  return held((t, out) => {
    out.gain.setValueAtTime(0.0001, t)
    out.gain.exponentialRampToValueAtTime(0.22, t + 0.4)
    const w = loopNoise(t, brown, 'bandpass', 500, 0.6, out)
    return {
      sources: [w.s],
      set(k) {
        w.f.frequency.setTargetAtTime(420 + 500 * k, ctx.currentTime, 0.08)
      },
    }
  })
}

// One landing: a soft thump and a springy boing, slightly different every time.
export const boing = safe((t) => {
  const v = 0.94 + Math.random() * 0.12
  tone(t, 'sine', 120 * v, 55, 0.35, 0.16)
  tone(t + 0.01, 'triangle', 260 * v, 560 * v, 0.07, 0.16, 0.01)
  tone(t + 0.12, 'sine', 560 * v, 380 * v, 0.04, 0.12, 0.01)
})

// Breath paid out (a landing's "+N", a pad blow): a light double tick.
export const coin = safe((t, step = 0) => {
  const k = Math.pow(2, Math.min(step, 12) / 24) // trophies climb a little in pitch
  bell(t, 1567.98 * k, 0.2, 0.07) // G6
  bell(t + 0.06, 2093 * k, 0.4, 0.07) // C7
})

// The fade out to the reward card and back to the Blow Zone: a low rush.
export const fadeWhoosh = safe((t) => {
  const f = hiss(t, 'lowpass', 1400, 0.7, 0.35, 0.5, 0.15, brown)
  f.frequency.exponentialRampToValueAtTime(300, t + 0.5)
})

// The reward card appearing: a bright arpeggio (a NEW BEST gets the fanfare instead).
export const rewardSound = safe((t) => {
  ;[659.25, 783.99, 1046.5].forEach((f, i) => bell(t + i * 0.07, f, 0.6, 0.13)) // E5 G5 C6
})

// Can't afford it / can't do it: two low falling buzzes.
export const errorSound = safe((t) => {
  tone(t, 'square', 220, 160, 0.12, 0.14)
  tone(t + 0.12, 'square', 180, 120, 0.12, 0.2)
})

// Bought / equipped.
export const chime = safe((t) => {
  bell(t, 987.77, 0.35, 0.14) // B5
  bell(t + 0.08, 1318.5, 0.6, 0.14) // E6
})

// Big moments (a hatched pet): a rising arpeggio, a chord and sparkles.
export const fanfare = safe((t) => {
  ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => bell(t + i * 0.085, f, 0.9, 0.18)) // C5 E5 G5 C6 E6
  ;[1046.5, 1318.5, 1567.98].forEach((f) => bell(t + 0.45, f, 1.4, 0.1))
  for (let i = 0; i < 8; i++) bell(t + 0.5 + i * 0.07 + Math.random() * 0.03, 2093 + Math.random() * 2200, 0.25, 0.035)
})
