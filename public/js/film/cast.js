// The scholar presents his discovery: a realistic figure of him (a photo
// cut out of its background, see actor.js) stands at the side of the frame,
// from the knees up, in a layer of its own over the animation, and points
// at the discovery or holds his instrument.
import { THREE, clamp } from './kit.js';
import { createActor } from './actor.js';

// How each animation is presented: side of the frame and pose.
// Scenes that show the scholar inside the scene itself are left out.
const CAST = {
  algebra: { side: 'right', pose: 'point' },
  numerals: { side: 'left', pose: 'hold' },
  cipher: { side: 'left', pose: 'hold' },
  optics: { side: 'right', pose: 'hold' },
  nile: { side: 'left', pose: 'point' },
  laboratory: { side: 'left', pose: 'hold' },
  heart: { side: 'left', pose: 'point' },
  music: { side: 'left', pose: 'hold' },
  cubic: { side: 'right', pose: 'hold' },
  machine: { side: 'left', pose: 'point' },
  pi: { side: 'left', pose: 'hold' },
  celestial: { side: 'left', pose: 'point' },
  stars: { side: 'left', pose: 'hold' },
  orbit: { side: 'left', pose: 'point' },
  observatory: { side: 'left', pose: 'point' },
  tusi: { side: 'left', pose: 'point' },
  globe: { side: 'left', pose: 'point' },
  moon: { side: 'left', pose: 'point' },
  comet: { side: 'left', pose: 'point' },
  kutadgu: { side: 'left', pose: 'hold' },
  turkmap: { side: 'left', pose: 'point' },
  sines: { side: 'left', pose: 'point' },
  rhymes: { side: 'left', pose: 'hold' },
  'navoi-scales': { side: 'left', pose: 'hold' },
};

export function presenterFor(sceneId) {
  return CAST[sceneId] ?? null;
}

// Adds the presenter to a scene object { scene, camera, update }.
// params.cast holds the pictures of the scholar: { point: url, hold: url }.
export function addPresenter(obj, sceneId, params = {}) {
  const cast = CAST[sceneId];
  const poses = params.cast ?? {};
  // Scenes with the scholar inside them, or no pictures of him yet: no presenter.
  if (!cast || params.presenter === false || obj.ownFigure || !Object.keys(poses).length) return obj;
  // From the knees up, the lower edge fading out.
  const actor = createActor(poses, { height: 1, cutBottom: 0.12, shadow: false, crop: 'knees' });
  actor.pose(poses[cast.pose] ? cast.pose : Object.keys(poses)[0]);
  const side = cast.side === 'right' ? 1 : -1;
  // The photos face to the right: on the right side he is mirrored to face the middle.
  actor.set({ face: -side });
  // Night and space scenes light him less brightly than a sunlit room.
  const bg = obj.scene.background?.isColor ? obj.scene.background : null;
  const lum = bg ? 0.2126 * bg.r + 0.7152 * bg.g + 0.0722 * bg.b : 0.3;
  actor.tint(new THREE.Color().setScalar(0.86 + Math.min(lum, 0.5) * 0.28));

  const layer = new THREE.Scene();
  layer.add(actor.root);
  const local = new THREE.Vector3();
  const inner = obj.update?.bind(obj);
  obj.overlay = layer;
  obj.update = (frame) => {
    inner?.(frame);
    const { camera } = obj;
    camera.updateMatrixWorld();
    const depth = 6;
    const hh = depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const hw = hh * camera.aspect;
    // The engine draws the 3D scenes a little higher (setViewOffset): find
    // the real bottom of the visible frame.
    const shift = camera.view?.enabled ? camera.view.offsetY / camera.view.fullHeight : 0;
    const bottom = -hh * (1 + 2 * shift);
    const narrow = camera.aspect < 1;
    // A waist-up picture is shown smaller, so his head is the same size.
    const height = hh * 2 * (narrow ? 0.56 : 0.84) * (actor.kneeUp() ? 1 : 0.6);
    const width = actor.width() * height;
    const appear = clamp((frame.p - 0.015) / 0.07);
    local.set(side * (hw - width * 0.5 - hw * (narrow ? 0.02 : 0.04)), bottom - height * 0.04 + (1 - appear) * -height * 0.05, -depth);
    actor.root.position.copy(local).applyMatrix4(camera.matrixWorld);
    actor.root.quaternion.copy(camera.quaternion);
    actor.root.scale.setScalar(height);
    actor.update(frame.t, frame.dt, null, { appear });
  };
  return obj;
}
