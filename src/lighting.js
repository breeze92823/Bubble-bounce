import { BackSide, Color, DirectionalLight, Fog, HemisphereLight, Mesh, PMREMGenerator, Scene, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import { LIGHTING } from './config/world.js'
import { SKY } from './config/palette.js'

// The one lighting mood of the references (SHARED_ASSETS §Lighting rig,
// boundary-and-skyline.md): a bright noon sun from ahead-left (shadows fall to +X/-Z),
// a three-stop sky gradient baked into a PMREM environment map for IBL, a hemisphere
// fill, soft shadows following the focus point, and a light haze on the far lane.
const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`
const skyFragment = /* glsl */ `
  uniform vec3 zenith;
  uniform vec3 mid;
  uniform vec3 horizon;
  uniform vec3 sunDir;
  uniform vec3 sunColor;
  varying vec3 vDir;
  void main() {
    float h = normalize(vDir).y;
    vec3 col = mix(horizon, mid, smoothstep(0.08, 0.38, h));
    col = mix(col, zenith, smoothstep(0.4, 0.9, h));
    float d = max(dot(normalize(vDir), sunDir), 0.0);
    col += sunColor * pow(d, 48.0) * 0.12; // soft glow only: no visible disc in the references
    col = mix(col, horizon * 0.9, smoothstep(0.0, -0.2, h)); // below the horizon (hidden by the ocean)
    gl_FragColor = vec4(col, 1.0);
  }`

export function createLighting(scene, renderer, preset) {
  const dir = new Vector3(...LIGHTING.sunDirection).normalize()

  const skyMaterial = new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new Color(SKY.zenith) },
      mid: { value: new Color(SKY.mid) },
      horizon: { value: new Color(SKY.horizon) },
      sunDir: { value: dir.clone() },
      sunColor: { value: new Color(SKY.sun) },
    },
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    toneMapped: false, // the sky shows its authored colours; only the lit world is tone-mapped
  })
  const sky = new Mesh(new SphereGeometry(LIGHTING.skyRadius, 48, 24), skyMaterial)
  sky.name = 'sky'
  sky.renderOrder = -2
  sky.frustumCulled = false
  scene.add(sky)

  scene.fog = new Fog(SKY.haze, LIGHTING.hazeNear, LIGHTING.hazeFar)

  const hemi = new HemisphereLight(SKY.hemiSky, SKY.hemiGround, LIGHTING.hemiIntensity)
  const sun = new DirectionalLight(SKY.sun, LIGHTING.sunIntensity)
  sun.castShadow = preset.shadows
  sun.shadow.mapSize.set(preset.shadowMap, preset.shadowMap)
  const r = LIGHTING.shadowRange
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 220 })
  sun.shadow.bias = -0.0003
  sun.shadow.normalBias = 0.02
  sun.shadow.radius = LIGHTING.shadowRadius
  scene.add(hemi, sun, sun.target)

  // Image-based lighting from the sky dome.
  const pmrem = new PMREMGenerator(renderer)
  const envScene = new Scene()
  envScene.add(new Mesh(sky.geometry, skyMaterial))
  const envTarget = pmrem.fromScene(envScene, 0, 1, LIGHTING.skyRadius * 2)
  scene.environment = envTarget.texture
  scene.environmentIntensity = LIGHTING.envIntensity
  renderer.toneMappingExposure = LIGHTING.exposure

  return {
    sun,
    sunDirection: dir,
    setShadows(next) {
      sun.castShadow = next.shadows
      if (sun.shadow.mapSize.x !== next.shadowMap) {
        sun.shadow.mapSize.set(next.shadowMap, next.shadowMap)
        sun.shadow.map?.dispose()
        sun.shadow.map = null
      }
    },
    // Kept for the touch/settings hooks; there is no night in this game.
    toggleDayNight() {},
    // Every frame: the sky dome and the sun's shadow box follow the focus (player or debug camera).
    update(dt, focus) {
      sky.position.set(focus.x, 0, focus.z)
      sun.position.set(focus.x + dir.x * 90, focus.y + dir.y * 90, focus.z + dir.z * 90)
      sun.target.position.set(focus.x, focus.y, focus.z)
      sun.target.updateMatrixWorld()
    },
  }
}
