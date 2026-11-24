// A realistic scholar inside the 3D animations. He is a photograph drawn
// by the neural network and cut out of its background
// (tools/gen_presenters.py), standing in the scene as a card that turns
// to the camera. It breathes, steps when it walks, mirrors itself to
// face where it is going, and crossfades between poses.
import { THREE } from './kit.js';

const loader = new THREE.TextureLoader();
const cache = new Map();

function texture(url) {
  if (!cache.has(url)) {
    const tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    cache.set(url, tex);
  }
  return cache.get(url);
}

// Soft dark spot under the feet, so he stands on the ground.
function contactShadow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 1;
  return mesh;
}

const CARD_VERT = /* glsl */ `
  varying vec2 vUv;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const CARD_FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float opacity;
  uniform float cutBottom;   // fades the lower edge (a figure cut at the knees)
  uniform vec3 tint;         // the light of the scene
  uniform float flip;
  uniform float crop;        // part of the picture shown, from the top
  varying vec2 vUv;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    vec2 uv = vec2(flip > 0.5 ? 1.0 - vUv.x : vUv.x, 1.0 - (1.0 - vUv.y) * crop);
    vec4 c = texture2D(map, uv);
    float a = c.a * opacity * smoothstep(0.0, cutBottom + 0.0001, vUv.y);
    if (a < 0.02) discard;
    // A little lift for the tone mapping of the film look, then the scene light.
    vec3 col = pow(c.rgb, vec3(0.97)) * 1.08 * tint;
    // The soft edge still holds a little of the old backdrop: darken it.
    col *= mix(0.55, 1.0, smoothstep(0.25, 0.95, c.a));
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function card() {
  const material = new THREE.ShaderMaterial({
    vertexShader: CARD_VERT,
    fragmentShader: CARD_FRAG,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { map: { value: null }, opacity: { value: 0 }, cutBottom: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) }, flip: { value: 0 }, crop: { value: 1 } },
    ]),
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.translate(0, 0.5, 0); // pivot at the feet
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 2;
  return mesh;
}

// poses: { name: url }. height: how tall the card is in scene units.
// crop: the part of the picture shown, from the top (0.66 — from the knees up);
// 'knees' crops full-length pictures only and shows waist-up ones whole.
export function createActor(poses, { height = 1.85, cutBottom = 0, shadow = true, crop = 1 } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const cards = [card(), card()];
  body.add(...cards);
  const spot = shadow ? contactShadow() : null;
  if (spot) root.add(spot);
  for (const c of cards) c.material.uniforms.cutBottom.value = cutBottom;
  const cropOf = (img) => (crop === 'knees' ? (img.height / img.width > 1.9 ? 0.64 : 1) : crop);

  let current = null;
  let fadeFrom = null;
  let mix = 1;
  let walk = 0;
  let facing = 1;
  let flipNow = 0;
  const names = Object.keys(poses);

  const fit = (mesh, url) => {
    const tex = texture(url);
    mesh.material.uniforms.map.value = tex;
    const size = () => {
      const img = tex.image;
      if (!img?.width) return;
      const part = cropOf(img);
      mesh.material.uniforms.crop.value = part;
      mesh.scale.set((height * img.width) / (img.height * part), height, 1);
    };
    size();
    if (!tex.image?.width) {
      const wait = setInterval(() => {
        if (tex.image?.width) {
          size();
          clearInterval(wait);
        }
      }, 50);
    }
  };

  const api = {
    root,
    poses: names,
    has: (name) => Boolean(poses[name]),
    // Width of the figure for a height of one (0.5 until the picture loads).
    width: () => (cards[0].scale.x || height * 0.5) / height,
    // Is the picture a full-length one cut at the knees (else waist-up)?
    kneeUp: () => cards[0].material.uniforms.crop.value < 1,
    // Switches to a pose with a short crossfade.
    pose(name) {
      const pick = poses[name] ? name : poses.hold ? 'hold' : names[0];
      if (!pick || pick === current) return api;
      if (current) {
        fadeFrom = current;
        [cards[0], cards[1]] = [cards[1], cards[0]];
        mix = 0;
      }
      current = pick;
      fit(cards[0], poses[pick]);
      return api;
    },
    // walk: 0 still … 1 walking. facing: +1 to the right of the screen, −1 to the left.
    set({ walking = 0, face = facing } = {}) {
      walk = walking;
      facing = face;
      return api;
    },
    tint(color) {
      for (const c of cards) c.material.uniforms.tint.value.set(color);
      return api;
    },
    // Turns the card to the camera; mirrors the picture when he should face
    // the other way (the photos look to the right).
    update(t, dt, camera, { appear = 1 } = {}) {
      if (camera) {
        const cam = camera.getWorldPosition(new THREE.Vector3());
        const pos = root.getWorldPosition(new THREE.Vector3());
        root.rotation.y = Math.atan2(cam.x - pos.x, cam.z - pos.z);
      }
      flipNow += ((facing < 0 ? 1 : 0) - flipNow) * (dt > 0 ? Math.min(1, dt * 10) : 1);
      const flip = flipNow > 0.5 ? 1 : 0;
      // The new pose fades in over the old one. Until its picture has loaded
      // the old pose stays, so he never vanishes between two poses.
      const ready = (c) => Boolean(c.material.uniforms.map.value?.image?.width);
      if (fadeFrom && !ready(cards[0])) mix = 0;
      else mix = Math.min(1, mix + (dt > 0 ? dt / 0.35 : 1));
      cards[0].visible = true;
      cards[0].material.uniforms.opacity.value = ready(cards[0]) ? appear * (fadeFrom ? mix : 1) : 0;
      cards[1].material.uniforms.opacity.value = fadeFrom ? appear * (1 - mix) : 0;
      cards[1].visible = Boolean(fadeFrom) && mix < 1;
      if (mix >= 1) fadeFrom = null;
      for (const c of cards) c.material.uniforms.flip.value = flip;
      cards[0].position.z = 0;
      cards[1].position.z = -0.002;
      // Breathing when still, a step rhythm when walking.
      const step = Math.abs(Math.sin(t * 5.2));
      const bob = walk * step * 0.035 * height;
      const breathe = (1 - walk) * Math.sin(t * 1.7) * 0.004;
      body.position.y = bob;
      body.scale.y = 1 + breathe;
      body.rotation.z = walk * Math.sin(t * 5.2) * 0.025 + (1 - walk) * Math.sin(t * 0.6) * 0.006;
      if (spot) {
        const w = cards[0].scale.x || height * 0.4;
        spot.scale.set(w * 1.1, height * 0.22, 1);
        spot.position.y = 0.01;
        spot.material.opacity = appear * (1 - bob * 2);
      }
      return api;
    },
    dispose() {
      for (const c of cards) {
        c.geometry.dispose();
        c.material.dispose();
      }
      if (spot) {
        spot.geometry.dispose();
        spot.material.map.dispose();
        spot.material.dispose();
      }
    },
  };
  // All poses start loading at once, so a change of pose has its picture ready.
  for (const url of Object.values(poses)) texture(url);
  api.pose(names.includes('hold') ? 'hold' : names[0]);
  return api;
}

// Which way he faces on screen: +1 right, −1 left, for a direction in the world.
export function screenFacing(camera, direction) {
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion()));
  const d = right.dot(direction);
  return Math.abs(d) < 1e-4 ? 1 : Math.sign(d);
}
