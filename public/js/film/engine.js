import { THREE, clamp } from './kit.js';
import { SCENES } from './scenes/index.js';
import { createCinema } from './cinema.js';
import { createPost } from './post.js';
import { addPresenter } from './cast.js';

const CROSSFADE = 0.85;

function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.map && !m.map.userData.shared) m.map.dispose();
      m.dispose();
    }
  });
}

// A warm room as a reflection map: brass, glass and stone in the 3D
// animations reflect lamplight instead of looking like flat plastic.
export function makeEnvironment(renderer) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, '#fff1d6');
  sky.addColorStop(0.42, '#b98d55');
  sky.addColorStop(0.55, '#3b2a18');
  sky.addColorStop(1, '#0a0705');
  g.fillStyle = sky;
  g.fillRect(0, 0, 512, 256);
  // Windows and lamps give the metals their highlights.
  g.fillStyle = '#fffaf0';
  for (const [x, y, w, h] of [[60, 50, 46, 60], [210, 40, 30, 70], [360, 56, 52, 52]]) g.fillRect(x, y, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  tex.dispose();
  pmrem.dispose();
  return env;
}

export function prepareScene(obj, environment, id, params) {
  if (!obj.scene.environment) {
    obj.scene.environment = environment;
    obj.scene.environmentIntensity = 0.55;
  }
  // The scholar of the film presents his discovery.
  addPresenter(obj, id, params);
  if (obj.overlay) obj.overlay.environment = environment;
  return obj;
}

// Owns the WebGL renderer. A part of the film is shown either as cinematic
// shots (pictures with a moving camera) or, when a part has no pictures yet,
// as one of the hand-made 3D scenes. Both go through the same film look.
export function createEngine(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  // Scenes with people cast soft shadows from the sun.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const post = createPost(renderer);
  const environment = makeEnvironment(renderer);
  const ctx = { aspect: 1, height: 1 };
  const cinema = createCinema(ctx);
  let size = { w: 1, h: 1 };
  let mode = null; // 'scene' | 'shots'
  let current = null;

  // Subtitles cover the lower part of the screen, so the 3D scenes are drawn
  // slightly higher than the camera's true centre.
  const frame3d = (camera) => {
    camera.aspect = ctx.aspect;
    camera.setViewOffset(size.w, size.h, 0, size.h * 0.11, size.w, size.h);
    camera.updateProjectionMatrix();
  };
  let time = 0;
  let last = performance.now();
  let playing = true;
  let running = true;
  let frame = 0;
  let progress = () => 0;
  let fade = 1;
  let leak = 0;
  let black = 0;
  let blackTarget = 0;
  // While paused (or on the start and end screens) the picture stands still,
  // so it is drawn only when something changes: saves the GPU and battery.
  let dirty = 2;
  // A 3D animation shown as one of the shots of a part.
  let animation = null;

  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio();
    dirty = 2;
    post.setSize(Math.round(w * pr), Math.round(h * pr));
    ctx.aspect = w / h;
    ctx.height = h * pr;
    size = { w, h };
    cinema.resize();
    if (mode === 'scene' && current) frame3d(current.camera);
    if (animation) frame3d(animation.obj.camera);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  let fadeTime = CROSSFADE;
  function crossfade(seconds = CROSSFADE, flare = 1) {
    post.capture();
    fade = 0;
    fadeTime = seconds;
    leak = flare;
  }

  function animationFor(shot) {
    if (animation?.shot === shot) return animation;
    if (animation) disposeTree(animation.obj.scene);
    const factory = SCENES[shot.scene] ?? SCENES.library;
    animation = { shot, start: time, obj: prepareScene(factory({ params: shot.params ?? {}, ctx }), environment, shot.scene, shot.params ?? {}) };
    frame3d(animation.obj.camera);
    return animation;
  }
  function dropAnimation() {
    if (animation?.obj.overlay) disposeTree(animation.obj.overlay);
    if (animation) disposeTree(animation.obj.scene);
    animation = null;
  }

  const draw = (dt) => {
    if (!mode) return;
    const p = progress();
    if (mode === 'shots') {
      const cut = cinema.prepare(p, time);
      if (cut === 'cut') crossfade();
      else if (cut === 'angle') crossfade(0.3, 0.35);
      const { shot } = cinema.current();
      if (shot?.scene) {
        const a = animationFor(shot);
        a.obj.update?.({ t: time - a.start, dt, p: cinema.local(p) });
        post.renderContent(a.obj.scene, a.obj.camera, { tone: true, overlay: a.obj.overlay });
      } else {
        if (animation) dropAnimation();
        cinema.update({ t: time, dt, p });
        post.renderContent(cinema.scene, cinema.camera, { tone: false });
      }
    } else {
      current.update?.({ t: time, dt, p });
      post.renderContent(current.scene, current.camera, { tone: true, overlay: current.overlay });
    }
    fade = clamp(fade + dt / fadeTime);
    leak = Math.max(0, leak - dt * 1.4);
    black += (blackTarget - black) * Math.min(1, dt * 3);
    const mix = fade * fade * (3 - 2 * fade);
    post.composite({ mix, time, leak: 0.02 + leak * 0.14, black });
  };

  const loop = (now) => {
    if (!running) return;
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const settling = fade < 1 || Math.abs(black - blackTarget) > 0.002;
    if (!playing && !settling && dirty <= 0) return;
    if (playing) time += dt;
    draw(playing ? dt : settling ? dt : 0);
    dirty -= 1;
  };
  frame = requestAnimationFrame(loop);

  function leaveScene() {
    if (mode === 'scene' && current) disposeTree(current.scene);
    if (mode === 'scene' && current?.overlay) disposeTree(current.overlay);
    current = null;
    dropAnimation();
  }

  return {
    // A hand-made 3D scene (see scenes/index.js).
    show(id, params = {}) {
      dirty = 2;
      if (mode) crossfade();
      leaveScene();
      const factory = SCENES[id] ?? SCENES.library;
      current = prepareScene(factory({ params, ctx }), environment, id, params);
      mode = 'scene';
      time = 0;
      frame3d(current.camera);
    },
    // Cinematic shots for a part; onShot(i, shot) is called on every cut.
    showShots(shots, cuts, onShot, seconds = 0) {
      dirty = 2;
      if (mode) crossfade();
      leaveScene();
      cinema.setShots(shots, cuts, onShot, seconds);
      mode = 'shots';
      // Draw again once the pictures arrive.
      return cinema.ready().then(() => {
        dirty = 2;
      });
    },
    setCuts(cuts, seconds) {
      cinema.setCuts(cuts, seconds);
    },
    preload(shots) {
      cinema.preload(shots);
    },
    setProgress(fn) {
      progress = fn;
    },
    setPlaying(value) {
      playing = value;
      dirty = 2;
    },
    // Fade the picture to black (for the end of the film) or back.
    setBlack(value) {
      blackTarget = value ? 1 : 0;
    },
    // Used by the preview mode: jump to a moment and draw it once.
    seek(t) {
      time = t;
      fade = 1;
      draw(0);
    },
    destroy() {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      leaveScene();
      cinema.dispose();
      environment.dispose();
      post.dispose();
      renderer.dispose();
    },
  };
}
