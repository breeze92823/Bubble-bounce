# Build Prompt: Bubble Bounce gameplay

Paste everything below the line into a new Claude Code session opened in
`C:\ThreeJS\Bubble-bounce-repo\Bubble-bounce`.

---

You are building the gameplay of **Bubble Bounce**, a Roblox-style game in this
repo (`C:\ThreeJS\Bubble-bounce-repo\Bubble-bounce`, the frontend; backend:
`..\Bubble-bounce-backend`). It plays like **Bowling Roll**
(`C:\ThreeJS\Bowling-roll\Bowling-roll`): same loop, same progression, same
structure. Only the theme and the two core actions change: the player
**inflates bubbles with a wand** instead of bowling, and **rides a bubble down
the lane** instead of rolling a ball. Work autonomously. When something is
unclear, pick the option closest to the reference screenshots and Bowling Roll,
and record the choice in CLAUDE.md.

## Read first (in this order)

1. **Bowling Roll**, the gameplay to port: `CLAUDE.md` (the game loop and the
   file map), `BUILD_PROMPT.md`, `ANIMATIONS.md`, `INTERACTION.md`, then
   `src/bowler.js` (pad lock + auto loop + Throw Zone throw), `src/lanes.js`,
   `src/run.js` (run, chase camera, distance counter, scoring, end-of-run),
   `src/throwAnim.js`, `src/progression.js`, `src/state.js`, `src/shop.js`,
   `src/fx.js` (`runSummary`).
2. **This repo**: `src/config/mechanics.js` and `src/config/world.js` hold the
   rule numbers and every zone position. They are the source of truth for
   numbers; do not invent new ones where a value exists. Then `src/state/game.js`
   (`addBreath`, `addWins`, `multiplier`, `wandMultiplier`, `winsForRide`,
   `buyBubble`, `rebirth`), `src/world/*` (zones already built:
   `spawn-hub`, `bubble-shop-pads`, `training-pads`, `blow-zone-strip`,
   `main-lane`, `bubble-ride-lane`), `src/shared/bubble.js`,
   `src/shared/wand.js`, `src/ui/hud.js`, `src/ui/windows/`.
3. **Reference screenshots**: `C:\ThreeJS\Bubble-bounce\Bubble-bounce\Reference-Screenshots`
   (outside this repo; the config comments' `Reference-Screenshots/...` paths
   mean this folder). Read `REFERENCE_INDEX.md`, `MECHANICS.md`, `ZONE_MAP.md`,
   `OPEN_QUESTIONS.md`, then the zone spec for each phase in `ZONE_SPECS/`
   (`training-pads.md`, `bubble-shop-pads.md`, `blow-zone-strip.md`,
   `bubble-ride-lane.md`, `burst-and-rewards.md`, `ui-overlay.md`). The specs
   give exact camera offsets, timings, colours and effects; follow them over
   this prompt where they are more precise. Open the cited `.png` shots while
   building each part (`compare/` holds earlier side-by-side comparisons).

Note: `CLAUDE.md` in this repo is still a copy of Bowling Roll's. Do not trust
its file map; trust the code.

## What maps to what

| Bowling Roll | Bubble Bounce |
|---|---|
| Skill | **Breath** (starts at 1, `START.breath`) |
| Training Lanes: bowl on a pad for Skill | **Training Pads**: stand on a pad, the wand blows bubbles on a loop (`TRAINING.blowInterval`), each blow adds Breath = bubble's `breath` x pad `mult` x `multiplier()` |
| Premium lanes unlock with rebirths + Wins | Pads unlock by **rebirth level** (`TRAINING.lanes[].unlock.rebirths`); the Robux-only pads (3x, 15x, 50x) are locked or priced in Wins, as Bowling Roll did |
| Ball Shop (+N Skill per throw, bought with Wins) | **Breath upgrades** on the Bubble Shop pads: `BUBBLES` (+1, +3, +5, +12 ... Breath per blow), bought with Wins, Hold-E buy/equip |
| Throw Zone | **Blow Zone** strip (`ZONES['blow-zone-strip']`) |
| THROW: ball rolls down the Run Lane | **BLOW**: the player inflates one big bubble, climbs inside, and it **bounces** down the lane |
| Range from Skill (`runReach`) | Ride distance from Breath (`RIDE.distanceMeters(breath)`); bubble size from Breath (`BLOW.diameter(breath)`) |
| Strikes on pins pay Wins | Wins from **distance when the bubble bursts**: `winsForRide(distance)` = round(distance / 13) x `multiplier()` x `wandMultiplier()` x active Wins boosts |
| Pets, eggs, rebirth, daily, spin, gifts | Already in this repo (windows + state); wire them to the new loop |

## The Blow Zone sequence (the core feature)

Full detail: `ZONE_SPECS/blow-zone-strip.md`, `bubble-ride-lane.md`,
`burst-and-rewards.md`.

1. Player stands on the Blow Zone strip; the green **BLOW** button ("Bounce as
   far as you can!") appears (`blow-zone-strip_01`). Pressing it (button, or a
   key) locks the player in place and hides the HUD.
2. **Blow animation**: right arm raised, wand ring in front of the mouth,
   breathing bob; the equipped bubble grows from the wand ring over
   `BLOW.inflateTime` to `BLOW.diameter(breath)`, with sparkles around the rim.
3. **Camera shots**, fixed order, offsets from the spec:
   **Shot A** (`blow-zone-strip_03`, `BLOW.shotA`): front close-up of the
   avatar and wand, slow dolly-in. **Shot B** (`blow-zone-strip_02`,
   `BLOW.shotB`): hard cut to a low over-the-shoulder view of the bubble
   inflating. At the end of the inflate the bubble snaps around the avatar,
   then the camera blends into the ride follow cam over `BLOW.rideBlend`.
4. **Ride** (`bubble-ride-lane_01`–`_06`): the player sits inside the bubble.
   It moves forward at `RIDE.speed` and bounces in arcs (`RIDE.bounceLength`,
   apex = `RIDE.apexFactor` x diameter), so bigger bubbles bounce higher. Show
   the ride HUD (distance counter) and the themed lane zones; every bounce
   adds `RIDE.breathPerBounce` Breath with a "+N" popup.
5. **Burst** at `RIDE.distanceMeters(breath)`, following
   `burst-and-rewards.md`: the bubble pops into shards and a ring flash, fade
   to black, the reward screen (trophy icon + "+1,250"-style Wins), teleport
   to `BLOW_RETURN` facing down the lane, then the trophy shower flies into
   the avatar while the Wins counter counts up.

Write `ANIMATIONS.md` for the wand blow (training loop and Blow Zone) and the
ride, the way Bowling Roll's documents the throw.

## Ground rules

- Keep the stack: vanilla Three.js + Rapier + Vite, no React. Everything
  procedural (canvas textures, merged geometry); no new model files besides
  `public/avatars/player.glb`.
- Every tunable lives in `src/config/` (`mechanics.js`, `world.js`,
  `palette.js`). Values marked (A) are assumptions: keep them, list them at the
  end.
- All Bloxity calls go through `src/bloxity.js` and must never throw; keep the
  HUD clear of `bloxity.onReservedAreas`.
- Robux buttons stay removed (see the existing windows); Robux items are either
  locked or given a Wins price.
- Mobile first-class: every action has a touch path (BLOW is a HUD button, Hold-E
  works with a finger). Check 375x812 and 812x375 as well as desktop. Keep draw
  calls low; respect the graphics presets.
- Saving: the frontend saves to localStorage (`SAVE_KEY`). Only add networking
  if asked; if you add a saved field, make sure `save()` / `load()` round-trip
  it.

## Build order (finish and verify each phase before the next)

1. **Training Pads**: pad detection + lock (port `bowler.js`), the wand blow
   loop with a small bubble per blow, Breath per blow with a popup, Space to
   leave, rebirth-locked pads show their requirement and refuse.
2. **Breath upgrades**: Bubble Shop pads with labels (+N Breath, price in Wins,
   EQUIPPED / LOCKED), Hold-E buy and equip; the equipped bubble is the one the
   wand blows everywhere.
3. **Blow Zone**: the BLOW button, the blow animation and the two camera shots.
4. **Ride and burst**: bouncing ride, follow cam, counter, burst, reward
   screen, teleport back, trophy shower.
5. **Progression and HUD**: Breath feeds XP / level, level cap -> REBIRTH!,
   rebirth unlocks the next pads; HUD shows Breath, Wins, multiplier; tutorial
   steps with guide arrows (train -> buy an upgrade -> blow in the Blow Zone).
6. **Docs**: rewrite `CLAUDE.md` for Bubble Bounce (same density as Bowling
   Roll's), plus `ANIMATIONS.md` and `INTERACTION.md`.

## Verify (every phase)

- `npm run build` passes with no new errors or warnings.
- Run the dev server with the preview tools (`.claude/launch.json`,
  `VITE_DEV_MODE=true`), check the console, use `__game.teleport` to stand where
  each reference shot was taken and compare screenshots side by side.
- Gameplay: train on the 1x pad and watch Breath rise; a locked pad refuses;
  buy and equip +3 Breath and see each blow give more; blow in the Blow Zone
  and see shot A then shot B (compare with `blow-zone-strip_03` / `_02`), a
  bubble sized by Breath, the ride, the burst, the reward screen and the Wins
  (multipliers included); rebirth unlocks the next pad; progress
  survives a reload.
- Phone viewports: controls usable, HUD clear of the Bloxity toolbar.

When done, report what was built, every (A) assumption still in use, and
anything you could not verify.
