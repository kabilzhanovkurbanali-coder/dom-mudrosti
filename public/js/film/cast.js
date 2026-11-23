// The scholar presents his discovery: a 3D figure at the side of the frame,
// drawn in its own layer over the animation (so parts of the scene never
// cut through him), turning to the discovery and gesturing at it.
import { THREE, clamp } from './kit.js';
import { createFigure } from './figure.js';

// How each animation is presented: side of the frame, hand actions, prop.
// Scenes that show the scholar inside the scene itself are left out.
const CAST = {
  algebra: { side: 'right', right: 'point', left: 'down' },
  numerals: { side: 'left', right: 'gesture' },
  cipher: { side: 'left', right: 'point', prop: 'quill', propSide: -1, left: 'write' },
  optics: { side: 'right', right: 'gesture' },
  nile: { side: 'left', right: 'point' },
  laboratory: { side: 'left', right: 'work', left: 'work' },
  heart: { side: 'left', right: 'point' },
  music: { side: 'left', right: 'work', left: 'work' },
  cubic: { side: 'right', right: 'hold', prop: 'compass' },
  machine: { side: 'left', right: 'gesture' },
  pi: { side: 'left', right: 'hold', prop: 'compass' },
  celestial: { side: 'left', right: 'point' },
  stars: { side: 'left', right: 'sight', prop: 'astrolabe', look: 'up' },
  orbit: { side: 'left', right: 'point' },
  observatory: { side: 'left', right: 'gesture' },
  tusi: { side: 'left', right: 'point' },
  globe: { side: 'left', right: 'point' },
  moon: { side: 'left', right: 'point' },
  comet: { side: 'left', right: 'point', look: 'up' },
  kutadgu: { side: 'left', right: 'present', left: 'present', prop: 'book' },
  turkmap: { side: 'left', right: 'point', prop: 'scroll', propSide: -1, left: 'hold' },
  sines: { side: 'left', right: 'point' },
  rhymes: { side: 'left', right: 'work', left: 'hold', prop: 'book', propSide: -1 },
};

export function presenterFor(sceneId) {
  return CAST[sceneId] ?? null;
}

// Adds the presenter to a scene object { scene, camera, update }.
export function addPresenter(obj, sceneId, params = {}) {
  const cast = CAST[sceneId];
  // Scenes with the scholar inside them need no presenter.
  if (!cast || params.presenter === false || obj.ownFigure) return obj;
  const figure = createFigure(params.who ?? 'default');
  if (cast.prop) figure.hold(cast.prop, cast.propSide ?? 1);

  // A layer of its own with a warm key light and a cool rim light.
  const layer = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xffe2b8, 2.4);
  key.position.set(2, 3, 4);
  const rim = new THREE.DirectionalLight(0x9fc4ff, 1.4);
  rim.position.set(-3, 2, -3);
  layer.add(new THREE.HemisphereLight(0xfff1dc, 0x2a2018, 0.9), key, rim);
  const holder = new THREE.Group();
  holder.add(figure.root);
  layer.add(holder);
  figure.root.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });

  const camLocal = new THREE.Vector3();
  const look = new THREE.Vector3();
  const inner = obj.update?.bind(obj);
  obj.overlay = layer;
  obj.update = (frame) => {
    inner?.(frame);
    const { camera } = obj;
    camera.updateMatrixWorld();
    // Stand at the side of the frame, from the knees up, about two thirds of its height.
    const depth = 6;
    const hh = depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const hw = hh * camera.aspect;
    const side = cast.side === 'right' ? 1 : -1;
    const narrow = camera.aspect < 1;
    const scale = (hh * 2 * (narrow ? 0.46 : 0.62)) / 1.8;
    camLocal.set(side * hw * (narrow ? 0.66 : 0.8), -hh * (narrow ? 0.92 : 1.0), -depth);
    holder.position.copy(camLocal).applyMatrix4(camera.matrixWorld);
    holder.quaternion.copy(camera.quaternion);
    holder.scale.setScalar(scale);
    // Turned toward the centre of the frame: in profile when pointing at it.
    const pointing = (cast.right ?? 'gesture') === 'point' && frame.p > 0.08;
    const turn = -side * (pointing ? 1.05 : 0.55);
    figure.root.rotation.y += (turn - figure.root.rotation.y) * (frame.dt > 0 ? Math.min(1, frame.dt * 4) : 1);
    // He looks at the discovery: the centre of the frame, or the sky.
    look.set(0, cast.look === 'up' ? hh * 1.4 : hh * 0.25, -depth - 4).applyMatrix4(camera.matrixWorld);
    const appear = clamp((frame.p - 0.02) / 0.08);
    figure.set({
      walk: 0,
      left: cast.left ?? 'down',
      right: frame.p > 0.08 ? cast.right ?? 'gesture' : 'down',
      look,
    });
    figure.update(frame.t, frame.dt);
    figure.root.position.y = (1 - appear) * -0.4;
  };
  return obj;
}
