# Animations: the wand blow and the bubble ride

Numbers live in `src/config/mechanics.js` (`TRAIN_BLOW`, `BLOW`, `RIDE`, `REWARD`) and the poses in
`src/config.js` (`ANIM.blow`, `ANIM.ride`). Specs: `ZONE_SPECS/training-pads.md`,
`blow-zone-strip.md`, `bubble-ride-lane.md`, `burst-and-rewards.md` in the reference folder.

## The wand
`shared/wand.js` `WandHolder(playerGroup)`: every frame, after the animator has posed the rig, the
equipped wand is placed at the hand (the `ArmL2_leaf` bone; `ArmL2` + 1.25 rig units or `ArmL1` on
rigs without it) in `playerGroup`'s local frame, ring facing where the avatar looks. While the `blow`
pose plays (`wand.atMouth`, set by main.js) the ring sits in front of the mouth (`MOUTH` in wand.js:
0.3 u out from the neck, a little toward the wand hand) and the handle runs down to the hand, which
the pose puts under the chin; otherwise the handle leans up from the hand. Working in the parent's
frame keeps the scene's X mirror out of the maths. The model changes on `wandEquipped`.

The growing bubble turns to the avatar's facing (flat shapes like the star face the shot camera)
and its sparkles (`BLOW.sparkles`, `sparkleSize`) sit on the rim as seen along that facing.

## Training pad blow (`world/training-pads`)
Standing still (`TRAIN_BLOW.stillSpeed`) on an unlocked pad, every `TRAINING.blowInterval` (1.5 s):
the avatar turns down the lane (+X), takes the `blow` pose, and `inflater.start(bubble, 1.2 u,
..., { duration: 1.2 s })` grows the equipped bubble just in front of the ring (ease-out) with rim
sparkles. At full size it pops (`particles.burst`: shards + sparkles + ring flash) and a green
"+N Breath" rises over the player. Moving or leaving the pad pops a bubble in progress.

## Blow Zone run (`gameplay/ride.js`), t = seconds since BLOW
| t | What | Camera | HUD |
|---|---|---|---|
| 0 - 1.0 | `blow` pose, avatar faces +X (the camera); the bubble grows on the avatar's -X side at the wand ring's height to `BLOW.diameter(breath)` over 1.6 s, resting on the ground once big | **Shot A** (close-up, blow-zone-strip_03): P + (1.3, 0.85, 0.35) looking at P + (-0.5, 0.7, -0.05), FOV 70, dolly-in 0.1 u/s | hidden (`cinematic`), touch controls hidden |
| 1.0 - 1.8 | avatar faces -X (toward the bubble); at 1.6 the bubble slides over the avatar (0.2 s) to centre (rideX, r, P.z) while the avatar shrinks to fit (`RIDE.avatarFill`) and takes the `ride` crouch facing +Z; the bubble turns from the camera to face down the lane | **Shot B** (hard cut, over the avatar's right shoulder, which is +Z when facing -X; blow-zone-strip_02): P + (1.6, 1.3, 0.8) looking at P + (-1.5, 0.55, -0.1) | hidden |
| 1.8 - burst | the bubble moves +Z at 40 u/s in parabolic bounces (12 u long, apex min(1.2 x diameter, 4 u)), squash 0.18 s on each landing, 5 deg wobble, shadow disc, sparkle trail; each landing: "+N" lungs text at a wall (alternating sides), camera shake, sand/snow puffs in Beach / Desert / Snow | **Ride cam** blended in over 0.4 s: bubble + (0, 6, -10) (0.15 s lag) looking at bubble + (0, 1, 8) | `ride`: distance counter, Breath / level bar and stats only |
| burst + 0 | pop (shards, sparkles, ring flash); the avatar drops to the lane | ride cam holds on the burst point | |
| + 0.3 | fade to black (0.25 s) | | `reward` |
| + 0.6 | reward card: trophy, "+Wins", distance, NEW BEST! | | |
| + 2.0 | teleport to `BLOW_RETURN` facing +Z; fade in (0.3 s) | chase cam behind the player | default |
| + 2.3 | 12 trophies fly into the avatar's chest; each adds 1/12 of the Wins | | |

## Sounds (`sound.js`, all synthesised)
Inflate (breathy hiss + a rising, wobbling tone for the inflate's length; stopped if the bubble
pops early) with a `twinkle` per rim sparkle; a pad bubble pops with `pop(0)` and pays with `coin`.
Blow Zone run: `swish` on the cut to shot B, `gulp` as the bubble slides over the avatar, `launch` +
the `windSound` loop (its filter follows the bounce height) for the ride, `boing` on every landing,
`pop(1)` at the burst (the wind stops), `fadeWhoosh` on the fade out and the return,
`rewardSound` with the card (`fanfare` on a NEW BEST), a `coin` per trophy rising in pitch, and
`chime` when the last one lands.
