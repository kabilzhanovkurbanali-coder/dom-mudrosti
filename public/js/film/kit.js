// Shared building blocks for the film scenes.
import * as THREE from '/vendor/three/three.module.js';

export { THREE };

export const COLORS = {
  night: 0x0b1018,
  deep: 0x111b27,
  gold: 0xd6ab55,
  goldDeep: 0xa87a1e,
  teal: 0x22a899,
  tealDeep: 0x0b6e63,
  parchment: 0xe9dcc0,
  sand: 0xc9a86a,
  stone: 0x8c8273,
  stoneDark: 0x4d463d,
  wood: 0x6b4423,
  red: 0xc8463d,
  blue: 0x3f6fd1,
  white: 0xf4efe2,
};

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
// Eased progress of p inside the window [a, b].
export const stage = (p, a, b) => smooth((p - a) / (b - a));

// Seeded random numbers so a scene looks the same every time it plays.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Background lit like a film set: a soft warm glow behind the subject,
// falling off into darkness at the edges, instead of a flat colour.
const backdrops = new Map();
export function backdrop(color) {
  if (backdrops.has(color)) return backdrops.get(color);
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const base = new THREE.Color(color);
  const glowColor = base.clone().lerp(new THREE.Color(0x8a6236), 0.22).multiplyScalar(2.2);
  const edge = base.clone().multiplyScalar(0.45);
  const grad = g.createRadialGradient(256, 220, 10, 256, 260, 380);
  grad.addColorStop(0, `#${glowColor.getHexString()}`);
  grad.addColorStop(0.55, `#${base.getHexString()}`);
  grad.addColorStop(1, `#${edge.getHexString()}`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.shared = true;
  backdrops.set(color, tex);
  return tex;
}

export function createStage({ background = COLORS.night, fog = null, ambient = 0.55, sun = 1.6 } = {}) {
  const scene = new THREE.Scene();
  scene.background = backdrop(background);
  if (fog) scene.fog = new THREE.Fog(background, fog[0], fog[1]);
  const hemi = new THREE.HemisphereLight(0xfff1d6, 0x1a2230, ambient);
  const light = new THREE.DirectionalLight(0xffe2b0, sun);
  light.position.set(6, 10, 8);
  scene.add(hemi, light);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
  return { scene, camera, sun: light, hemi };
}

// Camera distance at which a sphere of `radius` fits both frame directions,
// so the same scene works on a wide monitor and a vertical phone.
export function fitDistance(camera, radius, margin = 1.15) {
  const v = THREE.MathUtils.degToRad(camera.fov) / 2;
  const h = Math.atan(Math.tan(v) * camera.aspect);
  return (radius * margin) / Math.sin(Math.min(v, h));
}

export function orbit(camera, target, distance, yaw, pitch) {
  camera.position.set(
    target.x + distance * Math.cos(pitch) * Math.sin(yaw),
    target.y + distance * Math.sin(pitch),
    target.z + distance * Math.cos(pitch) * Math.cos(yaw),
  );
  camera.lookAt(target);
}

export const metal = (color, roughness = 0.35, metalness = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
export const matte = (color, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
export const shine = (color, intensity = 1.2) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.6 });

let glowMap;
function glowTexture() {
  if (glowMap) return glowMap;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowMap = new THREE.CanvasTexture(c);
  glowMap.userData.shared = true;
  return glowMap;
}

export function glow(color, size = 1, opacity = 1) {
  const material = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(size);
  return sprite;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// A text sprite. `size` is the world height of one line.
// `template` reserves room when the text changes later via sprite.userData.set().
// `serif` gives the book face of the site (for formulas and titles).
export const SERIF = "'Cormorant Garamond', 'Times New Roman', Georgia, serif";
export function label(text, { size = 0.5, color = '#f4ecd8', weight = 600, background = 'rgba(11,16,24,0.72)', template, family: face, glow: halo = 0 } = {}) {
  const px = 64;
  const family = face ?? 'Inter, system-ui, -apple-system, sans-serif';
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `${weight} ${px}px ${family}`;
  const sizing = String(template ?? text).split('\n');
  const w = Math.ceil(Math.max(...sizing.map((l) => measure.measureText(l).width)) + px * 1.1);
  const h = Math.ceil(sizing.length * px * 1.3 + px * 0.55);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const draw = (value) => {
    g.clearRect(0, 0, w, h);
    if (background) {
      g.fillStyle = background;
      roundRect(g, 2, 2, w - 4, h - 4, px * 0.32);
      g.fill();
    }
    g.font = `${weight} ${px}px ${family}`;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (halo) {
      g.shadowColor = color;
      g.shadowBlur = px * 0.35 * halo;
    }
    const lines = String(value).split('\n');
    const top = (h - lines.length * px * 1.3) / 2;
    lines.forEach((line, i) => g.fillText(line, w / 2, top + px * 1.3 * (i + 0.5)));
    g.shadowBlur = 0;
    texture.needsUpdate = true;
  };
  draw(text);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false }),
  );
  const unit = size / (px * 1.3);
  sprite.scale.set(w * unit, h * unit, 1);
  sprite.renderOrder = 20;
  let current = String(text);
  sprite.userData.set = (value) => {
    if (String(value) === current) return;
    current = String(value);
    draw(value);
  };
  return sprite;
}

export function fade(object, opacity) {
  object.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      m.transparent = true;
      m.opacity = opacity;
    }
    if (o.isSprite || o.isMesh || o.isPoints || o.isLine) o.visible = opacity > 0.01;
  });
}

export function starfield(count = 2000, radius = 300, seed = 7) {
  const rand = rng(seed);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos.set([radius * s * Math.cos(a), radius * u, radius * s * Math.sin(a)], i * 3);
    const b = 0.35 + rand() * 0.65;
    const warm = rand() < 0.2;
    col.set([b, b * (warm ? 0.85 : 0.95), b * (warm ? 0.65 : 1)], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false }),
  );
}

// Floating dust motes; call update(t) every frame.
export function dust(count = 300, box = [12, 6, 12], color = 0xffe7b0, seed = 3) {
  const rand = rng(seed);
  const base = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    base.set([(rand() - 0.5) * box[0], rand() * box[1], (rand() - 0.5) * box[2]], i * 3);
  }
  const pos = base.slice();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 0.05, color, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  points.userData.update = (t) => {
    for (let i = 0; i < count; i++) {
      pos[i * 3] = base[i * 3] + Math.sin(t * 0.2 + i) * 0.3;
      pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.13 + i * 1.7) * 0.25;
      pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.17 + i * 0.7) * 0.3;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return points;
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpDir = new THREE.Vector3();

// Moves an existing rod so it spans a → b.
export function placeRod(mesh, a, b) {
  tmpDir.subVectors(b, a);
  mesh.position.copy(a).addScaledVector(tmpDir, 0.5);
  mesh.scale.y = Math.max(tmpDir.length(), 1e-4);
  mesh.quaternion.setFromUnitVectors(UP, tmpDir.normalize());
  return mesh;
}

// A solid rod between two points — WebGL lines are always 1px thin.
export function rod(a, b, radius, material) {
  return placeRod(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 10), material), a, b);
}

export function tube(points, radius, material, segments = 200) {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), material);
}

// Shows only the first `fraction` of a tube built with tube() or TubeGeometry.
export function revealTube(mesh, fraction) {
  const total = mesh.geometry.index.count;
  mesh.geometry.setDrawRange(0, Math.floor((total * clamp(fraction)) / 6) * 6);
}

export function arcPoints(radius, from, to, steps = 64, plane = 'xy', center = new THREE.Vector3()) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    const p = plane === 'xy'
      ? new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0)
      : new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    pts.push(p.add(center));
  }
  return pts;
}

export function ring(radius, thickness, material, segments = 128) {
  return new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 10, segments), material);
}

export function star8Shape(outer = 1, inner = 0.76) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

// Sky dome with a vertical gradient.
export function skyDome(top, bottom, radius = 400) {
  const geo = new THREE.SphereGeometry(radius, 32, 16);
  const colors = [];
  const a = new THREE.Color(top);
  const b = new THREE.Color(bottom);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = clamp((pos.getY(i) / radius) * 1.6 + 0.25);
    const c = b.clone().lerp(a, t);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
}

// Pointed («Islamic») arch as a curve, from the left foot to the right foot.
export function pointedArch(width, rise) {
  // The left half is an arc centred right of the middle, and vice versa.
  const r = width * 0.8;
  const cx = -width / 2 + r;
  const apex = Math.acos(-cx / r);
  const scaleY = rise / (r * Math.sin(apex));
  const left = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI + (apex - Math.PI) * (i / 16);
    left.push(new THREE.Vector3(cx + r * Math.cos(a), r * Math.sin(a) * scaleY, 0));
  }
  const right = left.slice(0, -1).reverse().map((p) => new THREE.Vector3(-p.x, p.y, 0));
  return [...left, ...right];
}

export function houseColors(seed = 5) {
  const rand = rng(seed);
  const palette = [0xcfb48a, 0xd8c29c, 0xbf9f70, 0xe2d3b0, 0xb89568];
  return () => palette[Math.floor(rand() * palette.length)];
}
