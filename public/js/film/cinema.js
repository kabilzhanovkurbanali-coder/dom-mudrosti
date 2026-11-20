// Cinematic shots: a still frame becomes a shallow 3D relief using its depth
// map, and the camera moves through it (dolly, truck, crane), so near
// objects drift against the background like in a real camera move.
// Particles (dust, embers, mist…) float between the camera and the picture.
import { THREE, clamp, lerp } from './kit.js';

const IMAGE_ASPECT = 16 / 9;
const FOV = 30;
const DISTANCE = 10;
const OVERSCAN = 1.2;

const RELIEF_VERT = /* glsl */ `
  uniform sampler2D tDepth;
  uniform float uDepth;
  uniform float uHasDepth;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float d = uHasDepth > 0.5 ? texture2D(tDepth, uv).r : 0.0;
    vec3 p = position;
    p.z += (d - 0.35) * uDepth;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const RELIEF_FRAG = /* glsl */ `
  uniform sampler2D tColor;
  uniform float uExposure;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tColor, vUv).rgb * uExposure;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const PARTICLE_VERT = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uSize;
  uniform float uPix;
  uniform float uSwirl;
  uniform float uTwinkle;
  uniform vec3 uBox;
  uniform vec3 uCenter;
  uniform vec3 uVelocity;
  varying float vAlpha;
  void main() {
    vec3 p = aSeed.xyz * uBox;
    p += uVelocity * uTime * (0.6 + aSeed.w * 0.8);
    p.x += sin(uTime * 0.31 + aSeed.w * 23.0) * uSwirl;
    p.y += cos(uTime * 0.27 + aSeed.x * 17.0) * uSwirl * 0.7;
    p = mod(p, uBox) - uBox * 0.5 + uCenter;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.35 + aSeed.w * 1.3) * uPix / max(0.5, -mv.z);
    float flicker = 0.5 + 0.5 * sin(uTime * (1.3 + aSeed.w * 4.0) + aSeed.y * 40.0);
    // Fade out near the box faces, so particles never pop in.
    vec3 e = abs(mod(aSeed.xyz * uBox + uVelocity * uTime * (0.6 + aSeed.w * 0.8), uBox) / uBox - 0.5) * 2.0;
    float edge = 1.0 - smoothstep(0.75, 1.0, max(e.x, max(e.y, e.z)));
    vAlpha = mix(1.0, flicker, uTwinkle) * edge;
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uSoft;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(clamp(1.0 - d, 0.0, 1.0), uSoft) * vAlpha * uOpacity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

// Look of each particle kind. Sizes and speeds are in world units
// (the picture is about 6 units tall).
const PARTICLES = {
  dust: { count: 260, color: 0xffd9a0, size: 0.035, opacity: 0.55, velocity: [0.03, 0.02, 0], swirl: 0.18, twinkle: 0.6, soft: 1.6, additive: true },
  embers: { count: 200, color: 0xff8a3d, size: 0.05, opacity: 0.85, velocity: [0.05, 0.35, 0], swirl: 0.35, twinkle: 0.9, soft: 1.2, additive: true },
  gold: { count: 220, color: 0xffd27a, size: 0.045, opacity: 0.8, velocity: [0, -0.12, 0], swirl: 0.25, twinkle: 1, soft: 2.2, additive: true },
  stars: { count: 180, color: 0xdfe8ff, size: 0.03, opacity: 0.7, velocity: [0.01, 0, 0], swirl: 0.02, twinkle: 1, soft: 2.4, additive: true },
  mist: { count: 36, color: 0xd8cbb5, size: 2.6, opacity: 0.07, velocity: [0.12, 0.01, 0], swirl: 0.25, twinkle: 0, soft: 1.8, additive: false },
  smoke: { count: 40, color: 0x9a9088, size: 2.2, opacity: 0.08, velocity: [0.03, 0.16, 0], swirl: 0.3, twinkle: 0, soft: 1.8, additive: false },
  none: { count: 0 },
};

function createParticles(maxCount = 300) {
  const seeds = new Float32Array(maxCount * 4);
  let s = 12345;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < seeds.length; i++) seeds[i] = rand();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxCount * 3), 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const material = new THREE.ShaderMaterial({
    vertexShader: PARTICLE_VERT,
    fragmentShader: PARTICLE_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 0.04 },
      uPix: { value: 500 },
      uSwirl: { value: 0.2 },
      uTwinkle: { value: 0.5 },
      uBox: { value: new THREE.Vector3(1, 1, 1) },
      uCenter: { value: new THREE.Vector3() },
      uVelocity: { value: new THREE.Vector3() },
      uColor: { value: new THREE.Color() },
      uOpacity: { value: 0.5 },
      uSoft: { value: 1.5 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 10;

  return {
    points,
    set(kind, box) {
      const spec = PARTICLES[kind] ?? PARTICLES.dust;
      const u = material.uniforms;
      geo.setDrawRange(0, Math.min(maxCount, spec.count));
      points.visible = spec.count > 0;
      if (!spec.count) return;
      u.uSize.value = spec.size;
      u.uSwirl.value = spec.swirl;
      u.uTwinkle.value = spec.twinkle;
      u.uOpacity.value = spec.opacity;
      u.uSoft.value = spec.soft;
      u.uColor.value.set(spec.color);
      u.uVelocity.value.set(...spec.velocity);
      u.uBox.value.copy(box.size);
      u.uCenter.value.copy(box.center);
      material.blending = spec.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      material.premultipliedAlpha = true;
      material.needsUpdate = true;
    },
    update(time, pix) {
      material.uniforms.uTime.value = time;
      material.uniforms.uPix.value = pix;
    },
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}

// Camera paths: offsets as fractions of the picture, z as a share of the
// starting distance. u goes from 0 to 1 over the shot.
const MOVES = {
  push: (u) => ({ x: 0, y: 0.004, z: lerp(1, 0.82, u), roll: 0 }),
  pull: (u) => ({ x: 0, y: 0, z: lerp(0.82, 1, u), roll: 0 }),
  left: (u) => ({ x: lerp(0.055, -0.055, u), y: 0, z: lerp(0.92, 0.88, u), roll: 0 }),
  right: (u) => ({ x: lerp(-0.055, 0.055, u), y: 0, z: lerp(0.92, 0.88, u), roll: 0 }),
  rise: (u) => ({ x: 0, y: lerp(-0.05, 0.05, u), z: lerp(0.93, 0.88, u), roll: 0 }),
  fall: (u) => ({ x: 0, y: lerp(0.05, -0.05, u), z: lerp(0.9, 0.86, u), roll: 0 }),
  drift: (u) => ({ x: Math.sin(u * Math.PI) * 0.03, y: lerp(-0.015, 0.015, u), z: lerp(0.95, 0.85, u), roll: lerp(-0.012, 0.012, u) }),
};

// Second camera angle for long shots: a closer framing with another move,
// like a cut to a tighter lens in editing.
const SECOND_ANGLE = { push: 'left', pull: 'right', left: 'push', right: 'push', rise: 'drift', fall: 'push', drift: 'pull' };
const ANGLE_AFTER = 8.5; // seconds

const ease = (u) => {
  const x = clamp(u);
  // Mostly linear, so the camera never stops, with soft ends.
  return lerp(x, x * x * (3 - 2 * x), 0.45);
};

export function createCinema(ctx) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070b);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 100);

  const relief = new THREE.ShaderMaterial({
    vertexShader: RELIEF_VERT,
    fragmentShader: RELIEF_FRAG,
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      uDepth: { value: 0 },
      uHasDepth: { value: 0 },
      uExposure: { value: 1 },
    },
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 224, 128), relief);
  plane.frustumCulled = false;
  scene.add(plane);

  const particles = createParticles();
  scene.add(particles.points);

  const cache = new Map();
  const loader = new THREE.TextureLoader();
  function texture(url, color) {
    if (!url) return null;
    if (!cache.has(url)) {
      const entry = { texture: null, ready: false, promise: null };
      entry.promise = new Promise((resolve) => {
        loader.load(
          url,
          (tex) => {
            tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            tex.minFilter = THREE.LinearFilter;
            tex.generateMipmaps = false;
            tex.anisotropy = 1;
            entry.texture = tex;
            entry.ready = true;
            resolve(entry);
          },
          undefined,
          () => {
            entry.ready = true;
            resolve(entry);
          },
        );
      });
      cache.set(url, entry);
    }
    return cache.get(url);
  }

  let shots = [];
  let cuts = [0];
  let duration = 0;
  let segments = [];
  let segment = -1;
  let index = -1;
  let shot = null;
  let angle = null;
  let shotStart = 0;
  let view = { w: 1, h: 1 };
  let onShot = () => {};

  function layout() {
    const visibleH = 2 * DISTANCE * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const visibleW = visibleH * ctx.aspect;
    let h;
    if (ctx.aspect > IMAGE_ASPECT) h = (visibleW * OVERSCAN) / IMAGE_ASPECT;
    else h = visibleH * OVERSCAN;
    view = { w: h * IMAGE_ASPECT, h, visibleW, visibleH };
    plane.scale.set(view.w, view.h, 1);
    camera.aspect = ctx.aspect;
    camera.updateProjectionMatrix();
    particles.set(shot?.fx ?? 'none', particleBox());
  }

  function particleBox() {
    return {
      size: new THREE.Vector3(view.visibleW * 1.3, view.visibleH * 1.3, DISTANCE * 0.55),
      center: new THREE.Vector3(0, 0, DISTANCE * 0.42),
    };
  }

  function apply(next, time) {
    shot = next;
    shotStart = time;
    if (next.scene) {
      particles.set('none', particleBox());
      return;
    }
    const color = texture(next.src, true);
    const depth = texture(next.depth, false);
    relief.uniforms.tColor.value = color?.texture ?? null;
    relief.uniforms.tDepth.value = depth?.texture ?? null;
    relief.uniforms.uHasDepth.value = depth?.texture ? 1 : 0;
    // Deeper relief for wide establishing shots, gentler for close-ups.
    // The depth map only lifts the picture a touch: a deeper relief stretched
    // the edges of mountains and animals when the camera moved.
    relief.uniforms.uDepth.value = view.h * 0.015;
    particles.set(next.fx, particleBox());
    shotStart = time;
  }

  // Each shot is one segment, or two (wide, then close) when it is long.
  function buildSegments() {
    segments = [];
    shots.forEach((s, i) => {
      const start = cuts[i] ?? i / shots.length;
      const end = cuts[i + 1] ?? 1;
      const seconds = (end - start) * duration;
      if (duration && seconds > ANGLE_AFTER && !s.scene) {
        const mid = start + (end - start) * 0.52;
        segments.push({ shot: i, start, end: mid, angle: null });
        segments.push({
          shot: i,
          start: mid,
          end,
          angle: { move: SECOND_ANGLE[s.move] ?? 'push', zoom: 0.8, x: (i % 2 ? 1 : -1) * 0.07, y: 0.02 },
        });
      } else segments.push({ shot: i, start, end, angle: null });
    });
  }

  function segmentAt(p) {
    let i = 0;
    while (i + 1 < segments.length && p >= segments[i + 1].start) i++;
    return i;
  }

  layout();

  return {
    scene,
    camera,
    resize: layout,

    // New list of shots for a part. cuts[i] is where shot i starts (0..1),
    // seconds is the length of the part (to split long shots into two angles).
    setShots(list, cutList, handler, seconds = 0) {
      shots = list;
      cuts = cutList?.length === list.length ? cutList : list.map((_, i) => i / list.length);
      duration = seconds;
      buildSegments();
      index = -1;
      segment = -1;
      onShot = handler ?? (() => {});
      for (const s of list) {
        texture(s.src, true);
        texture(s.depth, false);
      }
    },
    setCuts(cutList, seconds = duration) {
      if (cutList?.length !== shots.length) return;
      cuts = cutList;
      duration = seconds;
      const keep = segments[segment];
      buildSegments();
      if (keep) segment = segments.findIndex((sg) => sg.shot === keep.shot && Boolean(sg.angle) === Boolean(keep.angle));
    },
    // Resolves when the pictures of the first shot are loaded.
    ready() {
      const first = shots[0];
      if (!first) return Promise.resolve();
      return Promise.all([texture(first.src, true)?.promise, texture(first.depth, false)?.promise]);
    },
    preload(list) {
      for (const s of list ?? []) {
        texture(s.src, true);
        texture(s.depth, false);
      }
    },

    // Picks the shot for progress p. Returns 'cut' when the picture changes
    // and 'angle' on a cut to the closer framing of the same picture, so the
    // engine can blend from the previous frame.
    prepare(p, time) {
      if (!segments.length) return false;
      const k = segmentAt(p);
      if (k === segment) return false;
      const sg = segments[k];
      if (sg.shot === index) {
        segment = k;
        angle = sg.angle;
        shotStart = time;
        return 'angle';
      }
      const entry = cache.get(shots[sg.shot].src);
      // Hold the previous shot until the next picture has arrived.
      if (!shots[sg.shot].scene && !entry?.ready && index !== -1) return false;
      const first = index === -1;
      segment = k;
      index = sg.shot;
      angle = sg.angle;
      apply(shots[index], time);
      onShot(index, shots[index]);
      return first ? false : 'cut';
    },

    // Progress inside the current shot (0..1): drives the 3D animations.
    local(p) {
      const sg = segments[segment];
      if (!sg) return p;
      const start = cuts[sg.shot] ?? 0;
      const end = cuts[sg.shot + 1] ?? 1;
      return clamp((p - start) / Math.max(0.0001, end - start));
    },

    update({ t, p }) {
      if (!shot || shot.scene) return;
      // The first shot of a part may be shown before its pictures arrive.
      const color = cache.get(shot.src)?.texture ?? null;
      const depth = shot.depth ? cache.get(shot.depth)?.texture ?? null : null;
      if (relief.uniforms.tColor.value !== color) {
        relief.uniforms.tColor.value = color;
        shotStart = t;
      }
      if (relief.uniforms.tDepth.value !== depth) {
        relief.uniforms.tDepth.value = depth;
        relief.uniforms.uHasDepth.value = depth ? 1 : 0;
      }
      const sg = segments[segment] ?? { start: 0, end: 1 };
      const u = ease((p - sg.start) / Math.max(0.0001, sg.end - sg.start));
      const m = (MOVES[angle?.move ?? shot.move] ?? MOVES.push)(u);
      if (angle) {
        m.z *= angle.zoom;
        m.x += angle.x;
        m.y += angle.y;
      }
      // A touch of hand-held motion keeps still frames alive.
      const shake = 0.0016 * view.h;
      const hx = Math.sin(t * 0.9) * shake + Math.sin(t * 2.3) * shake * 0.4;
      const hy = Math.cos(t * 0.7) * shake + Math.sin(t * 1.9) * shake * 0.3;
      const x = m.x * view.w + hx;
      const y = m.y * view.h + hy;
      camera.position.set(x, y, DISTANCE * m.z);
      camera.up.set(Math.sin(m.roll), Math.cos(m.roll), 0);
      camera.lookAt(x * 0.45, y * 0.45, 0);
      // Fade in from a slightly darker exposure at the start of each shot.
      relief.uniforms.uExposure.value = angle ? 1 : lerp(0.82, 1, clamp((t - shotStart) / 0.9));
      const pix = (ctx.height ?? 800) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
      particles.update(t, pix);
    },

    current: () => ({ index, shot }),

    dispose() {
      for (const entry of cache.values()) entry.texture?.dispose();
      cache.clear();
      plane.geometry.dispose();
      relief.dispose();
      particles.dispose();
    },
  };
}
