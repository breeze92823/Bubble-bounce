# Animations: the wand blow and the bubble ride

Numbers live in `src/config/mechanics.js` (`TRAIN_BLOW`, `BLOW`, `RIDE`, `REWARD`) and the poses in
`src/config.js` (`ANIM.blow`, `ANIM.ride`). Specs: `ZONE_SPECS/training-pads.md`,
`blow-zone-strip.md`, `bubble-ride-lane.md`, `burst-and-rewards.md` in the reference folder.

## The wand
`shared/wand.js` `WandHolder(playerGroup)`: every frame, after the animator has posed the rig, the
equipped wand is placed at the hand (`ArmL2` + 1.25 rig units, or `ArmL1` on the fallback rig) in
`playerGroup`'s local frame, handle leaning up toward the body's centre line, ring facing where the
avatar looks. Working in the parent's frame keeps the scene's X mirror out of the maths. The model
changes on `wandEquipped`.

## Training pad blow (`world/training-pads`)
Standing still (`TRAIN_BLOW.stillSpeed`) on an unlocked pad, every `TRAINING.blowInterval` (1.5 s):
the avatar turns down the lane (+X), takes the `blow` pose, and `inflater.start(bubble, 1.2 u,
..., { duration: 1.2 s })` grows the equipped bubble just in front of the ring (ease-out) with rim
sparkles. At full size it pops (`particles.burst`: shards + sparkles + ring flash) and a green
"+N Breath" rises over the player. Moving or leaving the pad pops a bubble in progress.

## Blow Zone run (`gameplay/ride.js`), t = seconds since BLOW
| t | What | Camera | HUD |
|---|---|---|---|
| 0 - 1.0 | `blow` pose, avatar faces +X (the camera); the bubble grows on the avatar's -X side to `BLOW.diameter(breath)` over 1.6 s, resting on the ground once big | **Shot A**: P + (3, 1.2, 1) looking at P + (-0.5, 1.3, 0), FOV 70, dolly-in 0.3 u/s | hidden (`cinematic`), touch controls hidden |
| 1.0 - 1.8 | avatar faces -X (toward the bubble); at 1.6 the bubble slides over the avatar (0.2 s) to centre (rideX, r, P.z) while the avatar shrinks to fit (`RIDE.avatarFill`) and takes the `ride` crouch facing +Z | **Shot B** (hard cut): P + (5, 1.6, -2.5) looking at P + (-4, 1.4, 0.5) | hidden |
| 1.8 - burst | the bubble moves +Z at 40 u/s in parabolic bounces (12 u long, apex min(1.2 x diameter, 4 u)), squash 0.18 s on each landing, 5 deg wobble, shadow disc, sparkle trail; each landing: "+N" lungs text at a wall (alternating sides), camera shake, sand/snow puffs in Beach / Desert / Snow | **Ride cam** blended in over 0.4 s: bubble + (0, 6, -10) (0.15 s lag) looking at bubble + (0, 1, 8) | `ride`: distance counter, Breath / level bar and stats only |
| burst + 0 | pop (shards, sparkles, ring flash); the avatar drops to the lane | ride cam holds on the burst point | |
| + 0.3 | fade to black (0.25 s) | | `reward` |
| + 0.6 | reward card: trophy, "+Wins", distance, NEW BEST! | | |
| + 2.0 | teleport to `BLOW_RETURN` facing +Z; fade in (0.3 s) | chase cam behind the player | default |
| + 2.3 | 12 trophies fly into the avatar's chest; each adds 1/12 of the Wins | | |
