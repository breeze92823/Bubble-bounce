// World layout. Origin = spawn point on the ground, +Y up, +Z down the main lane,
// +X = the player's right when facing +Z. 1 unit = 1 avatar height. Every zone
// position and size lives here (Reference-Screenshots/ZONE_MAP.md and
// ZONE_SPECS/*.md); scene code never hard-codes a position.

export const DISTANCE_METERS_PER_UNIT = 5 // HUD "756m" = 151 units (OPEN_QUESTIONS Q1)

export const SPAWN_POINT = { x: 0, y: 0.05, z: 0 }
export const SPAWN_FACING = 0 // yaw 0 = facing +Z (down the lane)
export const BLOW_RETURN = { x: 0, y: 0.05, z: 9 } // where the player lands after a burst

// Zone bounding boxes (centre + size), used by the debug overlay and for zone tests.
export const ZONES = {
  'spawn-hub': { center: [0, 2, -6], size: [60, 10, 40] },
  'bubble-shop-pads': { center: [-13, 1, -1.5], size: [13, 3, 21] },
  'training-pads': { center: [18, 3, -4.5], size: [16, 7, 25] },
  'blow-zone-strip': { center: [0, 0.5, 9], size: [22, 1, 6] },
  'main-lane': { center: [0, 1, 51], size: [40, 10, 78] },
  'bubble-ride-lane': { center: [0, 5, 425], size: [50, 30, 670] },
  'boundary-and-skyline': { center: [0, 0, 300], size: [2000, 40, 2000] },
}

// --- Hub plaza (spawn-hub) ------------------------------------------------------
export const HUB = {
  plaza: { x0: -30, x1: 30, z0: -26, z1: 14 },
  path: { halfWidth: 1.5, z0: -3, z1: 6, chevronPitch: 1.5 },
  waterChannel: { z0: -18.75, z1: -17.25, y: -0.25, depth: 0.8 },
  bridge: { x: 0, halfWidth: 0.8, z0: -19.1, z1: -16.9, deckHeight: 0.25, railHeight: 0.8, arch: 0.35 },
  rearStrip: { z0: -26, z1: -19 },
  fountain: { x: 0, z: -9, baseRadius: 3, baseHeight: 0.5, basinRadius: 1.8, basinY: 1.2, capY: 2.6 },
  eggs: [
    { id: 'royalLion', x: 3, z: -6, kind: 'gold', orbit: true },
    { id: 'king', x: -3, z: -6, kind: 'gold', orbit: true },
    { id: 'common', x: 4.5, z: -9, kind: 'white' },
    { id: 'rare', x: 5, z: -12, kind: 'white' },
    { id: 'uncommon', x: -4.5, z: -9, kind: 'green' },
    { id: 'mythic', x: -5.5, z: -12, kind: 'yellow' },
  ],
  portal: { x: -5, z: 6.5, w: 2.0, h: 2.5, d: 0.5, discRadius: 0.8, yaw: 0.35 },
  portalMat: { x: -5, z: 4.2, size: 1.6 },
  pinkRing: { x: -10, z: 11, poleHeight: 6, ringRadius: 2, ringY: 8 },
  purpleRing: { x: 12, z: 12, poleHeight: 6, ringRadius: 2, ringY: 8 },
  leaderboards: { z: -23.5, xs: [5.1, 1.7, -1.7, -5.1], w: 2.6, h: 2.4, y: 1.0 }, // Top Wins at +X: facing -Z the player's right is -X, so +X reads screen-left
  walls: { innerHeight: 7, bandHeight: 0.6, upperSetback: 0, upperHeight: 0, laneMouth: 8, frontWall: false, baseStrip: 0.6 }, // one tall wall, grass band on top, trees on the band
  // Green islands on the pale tile plaza (the path, fountain and pedestals stay on tile).
  grassPatches: [
    { x0: -8, x1: -1.5, z0: -2, z1: 6 },
    { x0: 1.5, x1: 8, z0: -2, z1: 6 },
    { x0: 7, x1: 10.5, z0: -16, z1: -3 },
    { x0: -10.5, x1: -7, z0: -16, z1: -3 },
    { x0: -8, x1: 8, z0: -16.5, z1: -13.5 },
  ],
  tree: { canopy: 2.0, trunk: 1.0 },
}

// --- Bubble shop pads --------------------------------------------------------------
export const PADS = {
  plateau: { x0: -19, x1: -7, z0: -11, z1: 8, height: 0.3 },
  columnX: { cheap: -10, dear: -15.5 },
  rowZ: [5.5, 2, -1.5, -5, -8.5],
  padSize: 2.4,
  itemSize: 0.85, // bubble-shop-pads_03: items span ~1/3 of the pad (spec said 1 u)
  itemHeight: 1.0, // bubble-shop-pads_01/_03: the items hover ~1 u over the pad (spec said 1.3)
  labelHeight: 1.75, // label bottom just above the item (spec said 2.6)
  // Plaza side of the cheap column at the +5 row, touching the plateau edge (all three images; the
  // spec's "between the columns" was wrong). Low gold octagon r1 h0.4.
  celestial: { x: -7.95, z: -1.3, radius: 0.95, height: 0.28 },
}

// --- Trainer lanes ------------------------------------------------------------------
export const TRAINERS = {
  x0: 11,
  length: 14,
  width: 2.8, // kerb to kerb; judge round 1: a visible tile strip between lanes
  padX: 12.3,
  hoopX: 13.8,
  gateX: 25,
  pitch: 3.55,
  firstZ: 6, // lane 1x; the others step -pitch
  slabHeight: 0.3,
  kerbHeight: 0.5, // kerb top; chunky (judge round 1) but flush-looking (judge round 2)
  kerbWidth: 0.45,
  badgeX: 16.5, // badges float over the lane between hoop and middle (training-pads_02/_03)
  badgeY: 3.2,
  gateScale: [1.3, 1.3, 1.15], // gate props read larger in the references than the spec sizes
}

// --- Blow strip ------------------------------------------------------------------------
export const STRIP = {
  x0: -11,
  x1: 11,
  z0: 6,
  z1: 12,
  textZ: 9,
  textHeight: 2,
  textWidth: 13,
  puddles: [
    { x: -8.5, z: 9, rx: 2, rz: 1 },
    { x: 8.5, z: 9, rx: 2, rz: 1 },
  ],
}

// --- Lane cross-section (shared by every segment) ------------------------------------------
export const LANE = {
  halfWidth: 7, // floor x -7..7
  floorY: -1, // lane ground, a cliff below the hub's y = 0 (5 m at 5 m per unit)
  wallThickness: 1.6,
  wallHeight: 1.8,
  wallSegment: 6,
  plateauWidth: 12, // x ±8..±20
  plateauHeight: 1.5,
  start: 12,
  end: 760,
}

// Themed segments along +Z (bubble-ride-lane.md).
export const SEGMENTS = [
  { id: 'grassland', z0: 12, z1: 90, sign: null },
  { id: 'neighborhood', z0: 90, z1: 210, sign: 'Neighborhood' },
  { id: 'carnival', z0: 210, z1: 290, sign: 'Carnival' },
  { id: 'beach', z0: 290, z1: 400, sign: 'Beach' },
  { id: 'desert', z0: 400, z1: 510, sign: 'Desert' },
  { id: 'snow', z0: 510, z1: 620, sign: 'Snow' },
  { id: 'volcano', z0: 620, z1: 760, sign: 'Volcano' },
]

// --- Sky / lighting -------------------------------------------------------------------------
export const LIGHTING = {
  sunDirection: [-0.45, 0.8, 0.4], // toward the sun; shadows fall to +X/-Z
  sunIntensity: 2.6,
  hemiIntensity: 0.85,
  envIntensity: 0.2,
  exposure: 1.15,
  shadowRange: 40,
  shadowRadius: 4,
  hazeNear: 250,
  hazeFar: 900,
  skyRadius: 1200,
  oceanLevel: -1.2, // below LANE.floorY, or the lane floor ends up underwater
  oceanSize: 2400,
  clouds: { count: 14, minElevation: 3, maxElevation: 9, distance: 700, scale: 1.2, flat: 0.45, drift: 0.0003 }, // a faint flat layer near the horizon
}
